import { Server as HTTPServer } from "http";
import { Server as HTTPSServer } from "https";
import { WebSocketServer } from "ws";
import logger from "./logger/winston-logger.js";

type ServerType = HTTPServer | HTTPSServer;

let wss: WebSocketServer | null = null;

export function setupWebSocketServer(server: ServerType) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    logger.info(`WebSocket client connected: ${req.socket.remoteAddress}`);

    ws.on("message", (message) => {
      logger.info(`Received: ${message}`);
      ws.send(`Server received: ${message}`);
    });

    ws.on("close", () => {
      logger.info("WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error(`WebSocket error: ${err}`);
    });

    ws.send("Welcome to the secure WebSocket server!");
  });
}

export async function closeWebSocketServer() {
  if (wss) {
    await new Promise<void>((resolve) => wss!.close(() => resolve()));
    logger.info("WebSocket server closed.");
    wss = null;
  }
}