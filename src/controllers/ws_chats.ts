import { chatService } from "../services/ws_chats.js";
import type { WebSocket } from "ws";

export function chatController(ws: WebSocket) {
  ws.send("Connected to chat");

  ws.on("message", async (msg) => {
    try {
      const response = await chatService.processMessage(msg.toString());
      ws.send(response);
    } catch (err) {
      ws.send(JSON.stringify({ error: "Processing error." }));
    }
  });

  ws.on("close", () => {
    console.log("Chat client disconnected");
  });
}
