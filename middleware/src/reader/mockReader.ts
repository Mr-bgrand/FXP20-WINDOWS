import { ReaderInterface, TagRead, TagReadCallback } from './readerInterface';
import { config } from '../config';
import logger from '../logger';

export class MockReader implements ReaderInterface {
  private running: boolean = false;
  private callbacks: TagReadCallback[] = [];
  private interval?: ReturnType<typeof setInterval>;
  private tagPool: string[];

  constructor() {
    this.tagPool = Array.from({ length: config.mockTagPoolSize }, (_, i) =>
      `E28011700000021A7EAE${(i + 1).toString(16).toUpperCase().padStart(4, '0')}`
    );
    logger.info('MockReader initialized', { tagPoolSize: this.tagPool.length });
  }

  async startInventory(): Promise<void> {
    if (this.running) {
      logger.warn('MockReader is already running');
      return;
    }

    this.running = true;
    this.interval = setInterval(() => {
      const epc = this.tagPool[Math.floor(Math.random() * this.tagPool.length)];
      const tag: TagRead = {
        type: 'tag_read',
        timestamp: new Date().toISOString(),
        epc,
        rssi: -30 - Math.floor(Math.random() * 50),
        antenna: Math.ceil(Math.random() * 4),
        readerId: config.readerId,
      };
      this.emitTagRead(tag);
    }, config.mockIntervalMs);

    logger.info('MockReader started');
  }

  async stopInventory(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    logger.info('MockReader stopped');
  }

  async getStatus(): Promise<{ running: boolean }> {
    return { running: this.running };
  }

  onTagRead(cb: TagReadCallback): void {
    this.callbacks.push(cb);
  }

  async shutdown(): Promise<void> {
    await this.stopInventory();
  }

  private emitTagRead(tag: TagRead): void {
    this.callbacks.forEach(cb => {
      try { cb(tag); } catch (e) { logger.error('Error in tag read callback', { error: e }); }
    });
  }
}
