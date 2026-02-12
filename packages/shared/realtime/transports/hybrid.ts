import type {
  RealtimeTransport,
  RealtimeTransportOptions,
  RealtimeTransportStatus,
} from './types.js';

export class HybridTransport implements RealtimeTransport {
  private status: RealtimeTransportStatus = 'disconnected';
  private readonly transports: RealtimeTransport[];
  private readonly options: RealtimeTransportOptions;

  constructor(transports: RealtimeTransport[], options: RealtimeTransportOptions) {
    this.transports = transports;
    this.options = options;
  }

  getStatus(): RealtimeTransportStatus {
    return this.status;
  }

  disconnect(): void {
    for (const transport of this.transports) {
      transport.disconnect();
    }
    this.setStatus('disconnected');
  }

  async connect(): Promise<void> {
    if (this.status === 'connected' || this.status === 'connecting') return;
    this.setStatus('connecting');

    const results = await Promise.allSettled(this.transports.map((transport) => transport.connect()));
    const anyConnected = results.some((result) => result.status === 'fulfilled');
    this.setStatus(anyConnected ? 'connected' : 'disconnected');
  }

  private setStatus(next: RealtimeTransportStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.options.onStatus?.(next);
  }
}

