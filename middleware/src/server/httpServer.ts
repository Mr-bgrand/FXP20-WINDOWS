import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { ReaderInterface } from '../reader/readerInterface';
import logger from '../logger';

export function createHttpServer(reader: ReaderInterface): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/reader/start', async (_req: Request, res: Response) => {
    try {
      await reader.startInventory();
      res.json({ success: true, message: 'Inventory started' });
    } catch (error) {
      logger.error('Failed to start inventory', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to start inventory',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/reader/stop', async (_req: Request, res: Response) => {
    try {
      await reader.stopInventory();
      res.json({ success: true, message: 'Inventory stopped' });
    } catch (error) {
      logger.error('Failed to stop inventory', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to stop inventory',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/reader/status', async (_req: Request, res: Response) => {
    try {
      const status = await reader.getStatus();
      res.json(status);
    } catch (error) {
      logger.error('Failed to get reader status', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get reader status',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
