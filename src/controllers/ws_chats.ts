import type { WebSocket } from 'ws';

import logger from '../logger/winston-logger.js';
import { chatService } from '../services/ws_chats.js';

export function chatController(ws: WebSocket) {
  ws.send('Connected to chat');

  // Wrap async call inside synchronous callback to avoid misused-promises error
  ws.on('message', (msg) => {
    handleMessage(msg).catch((err) => {
      ws.send(JSON.stringify({ error: 'Processing error.' }));
      logger.error('Error processing message:', err);
    });
  });

  ws.on('close', () => {
    logger.info('Chat WebSocket client disconnected');
  });

  async function handleMessage(msg: unknown) {
    let messageStr: string;

    if (typeof msg === 'string') {
      messageStr = msg;
    } else if (msg instanceof Buffer) {
      messageStr = msg.toString('utf-8');
    } else if (msg instanceof ArrayBuffer) {
      messageStr = Buffer.from(msg).toString('utf-8');
    } else if (msg && typeof msg === 'object') {
      try {
        messageStr = JSON.stringify(msg);
      } catch {
        messageStr = '[Cannot stringify object]';
      }
    } else {
      messageStr = '';
    }

    const response = await chatService.processMessage(messageStr);
    ws.send(response);
  }
}
