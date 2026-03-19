import dotenv from 'dotenv';

dotenv.config();

export type ReaderMode = 'mock' | 'fxp20-jpos';

export interface Config {
  port: number;
  host: string;
  readerMode: ReaderMode;
  readerId: string;
  mockIntervalMs: number;
  mockTagPoolSize: number;
  logLevel: string;
}

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

export const config: Config = {
  port: getEnvNumber('PORT', 4000),
  host: getEnv('HOST', '0.0.0.0'),
  readerMode: getEnv('READER_MODE', 'fxp20-jpos') as ReaderMode,
  readerId: getEnv('READER_ID', 'FXP20-01'),
  mockIntervalMs: getEnvNumber('MOCK_INTERVAL_MS', 1000),
  mockTagPoolSize: getEnvNumber('MOCK_TAG_POOL_SIZE', 10),
  logLevel: getEnv('LOG_LEVEL', 'info'),
};
