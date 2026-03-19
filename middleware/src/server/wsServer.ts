import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { ReaderInterface, TagRead } from '../reader/readerInterface';
import logger from '../logger';

export function createWebSocketServer(
  httpServer: HttpServer,
  reader: ReaderInterface
): WebSocketServer {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/tags'
  });

  const clients = new Set<WebSocket>();

  reader.onTagRead((tag: TagRead) => {
    const message = JSON.stringify(tag);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          logger.error('Failed to send tag read to client', { error });
        }
      }
    });
  });

  wss.on('connection', (ws: WebSocket, req) => {
    const clientIp = req.socket.remoteAddress;
    logger.info('WebSocket client connected', { clientIp, totalClients: clients.size + 1 });

    clients.add(ws);

    ws.send(JSON.stringify({
      type: 'connected',
      timestamp: new Date().toISOString(),
      message: 'Connected to FXP20 tag stream',
    }));

    ws.on('close', () => {
      clients.delete(ws);
      logger.info('WebSocket client disconnected', { clientIp, totalClients: clients.size });
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', { error, clientIp });
    });
  });

  logger.info('WebSocket server initialized on path /ws/tags');
  return wss;
}
