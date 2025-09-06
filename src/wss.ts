import { Server as HTTPServer } from "http";
import { Server as HTTPSServer } from "https";
import { WebSocketServer } from "ws";
import url from "url";
import type { IncomingMessage } from "http";
import type { TLSSocket } from "tls";
import logger from "./logger/winston-logger.js";
import { routeConnection } from "routes/index.js";

type ServerType = HTTPServer | HTTPSServer;

let wss: WebSocketServer | null = null;

function extractSocketDetails(req: IncomingMessage) {
  const socket = req.socket;
  const isTLS = "getPeerCertificate" in socket && typeof (socket as TLSSocket).getPeerCertificate === "function";

  let tlsInfo = {
    authorized: false,
    peerCertificate: null as Record<string, any> | null,
    protocol: undefined as string | undefined,
  };

  if (isTLS) {
    const tlsSocket = socket as TLSSocket;
    const cert = tlsSocket.getPeerCertificate();

    tlsInfo.authorized = tlsSocket.authorized;
    tlsInfo.protocol = typeof tlsSocket.alpnProtocol === "string" ? tlsSocket.alpnProtocol : undefined;

    if (cert && Object.keys(cert).length > 0) {
      tlsInfo.peerCertificate = cert;
    }

  }

  return {
    remoteAddress: socket.remoteAddress,
    remotePort: socket.remotePort,
    localAddress: socket.localAddress,
    localPort: socket.localPort,
    family: socket.remoteFamily,
    ...tlsInfo,
  };
}

export function setupWebSocketServer(server: ServerType) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req: IncomingMessage) => {
    const connectionId = Math.random().toString(36).slice(2);

    // Safe parse URL with fallback
    const parsedUrl = url.parse(req.url ?? "/", true);
    // const parsedUrl = url.parse(req.url ?? "/", true).pathname ?? "/";

    // Extract headers
    const headers = req.headers;

    // Extract full socket/transport details including TLS if available
    const socketDetails = extractSocketDetails(req);

    // WebSocket handshake info
    const handshake = {
      url: req.url,
      pathname: parsedUrl.pathname,
      query: parsedUrl.query,
      headers: {
        origin: headers.origin,
        "sec-websocket-key": headers["sec-websocket-key"],
        "sec-websocket-protocol": headers["sec-websocket-protocol"],
        "sec-websocket-extensions": headers["sec-websocket-extensions"],
        cookie: headers.cookie,
        ...headers,
      },
    };

    // Compose full info object
    const details = {
      connectionId,
      handshake,
      socket: socketDetails,
      timestamp: new Date().toISOString(),
    };

    logger.info("New WS connected", { details });

    // Send full connection info to client on connect
    ws.send(JSON.stringify({ type: "connection_info", details }));

    // Handle unauthorized TLS connection (example policy)
    if ("authorized" in socketDetails && socketDetails.authorized === false) {
      logger.warn("Unverified or unauthorized TLS connection");
      // Optionally close connection here:
      // ws.close();
    }

    // Route connection based on pathname
    routeConnection(parsedUrl.pathname ?? "/", ws);


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
  });
}

export async function closeWebSocketServer() {
  if (wss) {
    await new Promise<void>((resolve) => wss!.close(() => resolve()));
    logger.info("WebSocket server closed.");
    wss = null;
  }
}
