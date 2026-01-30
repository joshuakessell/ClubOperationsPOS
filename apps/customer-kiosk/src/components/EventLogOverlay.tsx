import { useEffect, useMemo, useRef, useState } from 'react';
import { LogEvent, onEvent } from '../lib/eventBus';
import { cn } from '../lib/utils';

const MAX_EVENTS = 500;

export default function EventLogOverlay() {
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [show, setShow] = useState(import.meta.env.MODE !== 'production');
  const [paused, setPaused] = useState(false);

  const [filterWSIn, setFilterWSIn] = useState(true);
  const [filterWSOut, setFilterWSOut] = useState(true);
  const [filterDB, setFilterDB] = useState(true);
  const [q, setQ] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off = onEvent((e) => {
      if (paused) return;
      setEvents((prev) => [...prev, e].slice(-MAX_EVENTS));
    });
    return () => {
      off();
    };
  }, [paused]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const filtered = useMemo(() => {
    const kinds = new Set<string>();
    if (filterWSIn) kinds.add('ws-in');
    if (filterWSOut) kinds.add('ws-out');
    if (filterDB) kinds.add('db');

    const s = q.trim().toLowerCase();

    return events.filter((e) => {
      if (!kinds.has(e.kind)) return false;
      if (!s) return true;

      const hay = [
        e.title,
        e.channel ?? '',
        (() => {
          try {
            return JSON.stringify(e.payload ?? '');
          } catch {
            return '[Unserializable payload]';
          }
        })(),
      ]
        .join(' ')
        .toLowerCase();

      return hay.includes(s);
    });
  }, [events, filterWSIn, filterWSOut, filterDB, q]);

  if (!show) return null;

  return (
    <div className="fixed inset-6 z-50 flex flex-col rounded-3xl border border-white/10 bg-slate-950/90 text-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <strong className="text-lg">Event Log</strong>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 w-40 rounded-full border border-white/10 bg-white/5 px-3 text-white placeholder:text-white/40 focus:outline-none"
          />
          <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <input
              type="checkbox"
              checked={filterWSIn}
              onChange={(e) => setFilterWSIn(e.target.checked)}
            />
            WS In
          </label>
          <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <input
              type="checkbox"
              checked={filterWSOut}
              onChange={(e) => setFilterWSOut(e.target.checked)}
            />
            WS Out
          </label>
          <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <input
              type="checkbox"
              checked={filterDB}
              onChange={(e) => setFilterDB(e.target.checked)}
            />
            DB
          </label>
          <button
            onClick={() => setPaused((p) => !p)}
            className="rounded-full border border-white/10 bg-white/10 px-3 py-1"
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={() => void navigator.clipboard.writeText(JSON.stringify(filtered, null, 2))}
            className="rounded-full border border-white/10 bg-white/10 px-3 py-1"
          >
            Copy
          </button>
          <button
            onClick={() => setEvents([])}
            className="rounded-full border border-white/10 bg-white/10 px-3 py-1"
          >
            Clear
          </button>
          <button
            onClick={() => setShow(false)}
            className="rounded-full border border-white/10 bg-white/10 px-3 py-1"
          >
            Hide
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-sm">
        {filtered.map((e) => (
          <div
            key={e.id}
            className={cn(
              'mb-3 rounded-2xl border border-white/10 bg-white/5 p-3',
              colorFor(e.kind)
            )}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide">
              <span className="rounded-full border border-current px-2 py-0.5">{e.kind}</span>
              <span className="text-white/60">{new Date(e.ts).toLocaleTimeString()}</span>
              {e.channel && <span className="text-white/60">· {e.channel}</span>}
              <strong className="text-white">· {e.title}</strong>
            </div>

            {e.payload !== undefined && (
              <pre className="mt-2 whitespace-pre-wrap text-xs text-white/70">
                {safeStringify(e.payload)}
              </pre>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function colorFor(k: LogEvent['kind']) {
  if (k === 'ws-in') return 'text-emerald-300';
  if (k === 'ws-out') return 'text-sky-300';
  return 'text-amber-300';
}

function safeStringify(v: unknown) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
