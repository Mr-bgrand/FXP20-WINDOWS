export interface TagRead {
  type: 'tag_read';
  timestamp: string;
  epc: string;
  rssi?: number;
  antenna?: number;
  readerId: string;
}

export interface TagInfo {
  epc: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  lastRssi?: number;
  lastAntenna?: number;
}

export interface ReaderStatus {
  running: boolean;
  initializing?: boolean;
  error?: string | null;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
