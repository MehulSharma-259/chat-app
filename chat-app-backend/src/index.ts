/** @format */
import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT) || 8000;
const wss = new WebSocketServer({ port: PORT });

const rooms: Map<string, Set<WebSocket>> = new Map();
let userCount = 0;

wss.on("connection", (ws: WebSocket) => {
  userCount++;
  console.log(`User connected (${userCount} online)`);

  ws.on("error", (err) => console.error("WebSocket error:", err));

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const { type, payload } = msg;

      if (!type || !payload) return;
      const { roomId, message } = payload;

      switch (type) {
        case "join":
          if (!roomId) return;
          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
          }
          rooms.get(roomId)?.add(ws);
          console.log(`User joined room: ${roomId}`);
          break;

        case "chat":
          if (!roomId || !message) return;
          const room = rooms.get(roomId);
          if (!room) {
            console.log(`Room ${roomId} does not exist`);
            return;
          }

          room.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: "chat", payload: { message } }));
            }
          });
          break;

        default:
          console.warn(`Unknown message type: ${type}`);
      }
    } catch (err) {
      console.error("Failed to process message:", err);
    }
  });

  ws.on("close", () => {
    userCount--;
    console.log(`User disconnected (${userCount} online)`);

    rooms.forEach((users, roomId) => {
      if (users.has(ws)) {
        users.delete(ws);
        if (users.size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
    });
  });
});

console.log(`✅ WebSocket server running on ws://localhost:${PORT}`);
