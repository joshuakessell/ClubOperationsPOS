export type RealtimeTransportStatus = 'disconnected' | 'connecting' | 'connected';

export type RealtimeTransportEvent = {
  type: 'message';
  data: unknown;
};

export type RealtimeTransportOptions = {
  onEvent: (event: RealtimeTransportEvent) => void;
  onStatus?: (status: RealtimeTransportStatus) => void;
  debug?: boolean;
};

export interface RealtimeTransport {
  connect(): Promise<void> | void;
  disconnect(): void;
  getStatus(): RealtimeTransportStatus;
}

