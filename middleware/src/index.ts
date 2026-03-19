import http from 'http';
import { config } from './config';
import logger from './logger';
import { createHttpServer } from './server/httpServer';
import { createWebSocketServer } from './server/wsServer';
import { ReaderInterface } from './reader/readerInterface';
import { MockReader } from './reader/mockReader';
import { FXP20JposReader } from './reader/fxp20JposReader';

function createReader(): ReaderInterface {
  switch (config.readerMode) {
    case 'mock':
      logger.info('Using MockReader');
      return new MockReader();

    case 'fxp20-jpos':
      logger.info('Using FXP20JposReader (native JPOS driver)');
      return new FXP20JposReader();

    default:
      logger.error('Unknown reader mode', { mode: config.readerMode });
      throw new Error(`Unknown reader mode: ${config.readerMode}`);
  }
}

async function main() {
  logger.info('Starting FXP20 Middleware Server', {
    version: '1.0.0',
    readerMode: config.readerMode,
    port: config.port,
  });

  const reader = createReader();
  const app = createHttpServer(reader);
  const httpServer = http.createServer(app);
  createWebSocketServer(httpServer, reader);

  httpServer.listen(config.port, config.host, () => {
    logger.info(`Server listening on http://${config.host}:${config.port}`);
    logger.info(`WebSocket at ws://${config.host}:${config.port}/ws/tags`);
    logger.info('Endpoints: GET /health, GET /reader/status, POST /reader/start, POST /reader/stop');
  });

  const shutdown = async () => {
    logger.info('Shutting down...');
    httpServer.close();
    await reader.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', (error) => { logger.error('Uncaught exception', { error }); shutdown(); });
  process.on('unhandledRejection', (reason) => { logger.error('Unhandled rejection', { reason }); shutdown(); });
}

main().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
