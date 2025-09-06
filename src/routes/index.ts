import type { WebSocket } from 'ws';

import { chatController } from '../controllers/ws_chats.js';

export function routeConnection(pathname: string, ws: WebSocket): void {
  switch (pathname) {
    case '/chat':
      chatController(ws);
      break;
    default:
      ws.send(JSON.stringify({ error: 'Invalid route' }));
      ws.close(1008, 'Invalid route');
  }
}
