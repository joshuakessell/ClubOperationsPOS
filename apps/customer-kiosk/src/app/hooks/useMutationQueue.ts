import { useEffect, useState, useCallback } from 'react';

// Use a simple specialized queue for flow commands to ensure they happen in order
type QueuedMutation = {
    id: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string | null;
    createdAt: number;
    retryCount: number;
};

const STORAGE_KEY = 'kiosk_offline_mutation_queue';

export function useMutationQueue(apiBase: string, enabled: boolean = true) {
    const [queue, setQueue] = useState<QueuedMutation[]>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const saveQueue = useCallback((newQueue: QueuedMutation[]) => {
        setQueue(newQueue);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue));
        } catch (e) {
            console.error('Failed to save mutation queue', e);
        }
    }, []);

    const enqueue = useCallback(
        async (
            url: string,
            options: {
                method?: string;
                headers?: Record<string, string>;
                body?: string;
            }
        ) => {
            // Create mutation object
            const mutation: QueuedMutation = {
                id: crypto.randomUUID(),
                url,
                method: options.method || 'POST',
                headers: options.headers || {},
                body: options.body || null,
                createdAt: Date.now(),
                retryCount: 0,
            };

            // Add to queue immediately to persist intent
            const newQueue = [...queue, mutation];
            saveQueue(newQueue);

            // Try to send immediately
            return processOne(mutation, apiBase).catch((err) => {
                console.warn('Immediate mutation failed, kept in queue', err);
                // Swallow error to allow optimistic UI progression
            });
        },
        [queue, saveQueue, apiBase]
    );

    // Helper to process a single mutation
    const processOne = async (mutation: QueuedMutation, currentApiBase: string): Promise<void> => {
        // We need to rewrite the URL to match the current API base
        // The queued URL might have been from a different base (e.g. cloud vs lan)
        // We assume the path is consistent relative to the base.

        let targetUrl = mutation.url;
        try {
            // Extract path relative to the *original* base?
            // Or just blindly replace the origin? 
            // The `url` stored might be absolute or relative?
            // In useKioskActions, we pass `${apiBase}/v1/...`. 
            // So we can strip the protocol/host and append to currentApiBase.

            const urlObj = new URL(mutation.url);
            const path = urlObj.pathname + urlObj.search;
            targetUrl = `${currentApiBase}${path}`;
        } catch {
            // If it wasn't a valid URL, maybe it was already relative?
            // If relative, just prepend currentApiBase
            if (!mutation.url.startsWith('http')) {
                targetUrl = `${currentApiBase}${mutation.url}`;
            }
        }

        // Perform fetch
        const res = await fetch(targetUrl, {
            method: mutation.method,
            headers: mutation.headers,
            body: mutation.body,
        });

        if (!res.ok) {
            if (res.status >= 500 || res.status === 429) {
                // Server error, keep in queue
                throw new Error(`Server error ${res.status}`);
            }
            // 4xx error (validation, etc) - we should probably drop it? 
            // Or maybe it's a 404 because sync hasn't happened yet?
            // For safety in offline mode, we might want to keep retrying 404s for a bit?
            // But 400 (Bad Request) usually means it will never succeed.

            // For now, let's treat non-2xx as permanent failure and remove, 
            // UNLESS it's a network error (which is caught in catch block).
            // But 5xx should probably be retried.

            // If we are strictly offline, we might get network error.
            // If we are partly online but server is broken, we get 500.

            // Let's rely on standard fetch exception for network offline.
            // If we get a response, we consider it "processed" (even if failure) 
            // so we don't block the queue forever with a bad request.
            return;
        }

        // Success!
    };

    // Background processor
    useEffect(() => {
        if (!enabled || queue.length === 0) return;

        let mounted = true;
        let timeoutId: number | null = null;

        const processQueue = async () => {
            let activeQueue = [...queue];
            if (activeQueue.length === 0) return;

            const item = activeQueue[0]; // Strict FIFO
            if (!item) return;

            try {
                await processOne(item, apiBase);

                // Remove on success (or permanent failure)
                if (mounted) {
                    activeQueue = activeQueue.slice(1);
                    saveQueue(activeQueue);
                }
            } catch (err) {
                console.log('Queue retry failed', err);
                // Wait before retrying same item
            }

            if (mounted && activeQueue.length > 0) {
                timeoutId = window.setTimeout(processQueue, 1000); // Fast retry
            }
        };

        timeoutId = window.setTimeout(processQueue, 100);

        return () => {
            mounted = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [queue, apiBase, enabled, saveQueue]);

    return { enqueue, queueLength: queue.length };
}
