export interface TagRead {
  type: 'tag_read';
  timestamp: string;
  epc: string;
  rssi?: number;
  antenna?: number;
  readerId: string;
}

export type TagReadCallback = (tag: TagRead) => void;

export interface AntennaInfo {
  id: number;
  power: number;
}

export interface ReaderInterface {
  startInventory(): Promise<void>;
  stopInventory(): Promise<void>;
  getStatus(): Promise<{ running: boolean }>;
  onTagRead(cb: TagReadCallback): void;
  shutdown(): Promise<void>;
  getAntennaConfig?(): Promise<AntennaInfo[]>;
  setAntennaPower?(antennaId: number, power: number): Promise<void>;
}
