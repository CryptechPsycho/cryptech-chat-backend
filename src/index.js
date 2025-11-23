// server/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";

import setupChatHandlers from "./chat.js";
import setupCallHandlers, { callStore } from "./call.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

// IMPORTANT: disable perMessageDeflate so voice messages don't break
const io = new Server(httpServer, {
  cors: { origin: "*" },
  perMessageDeflate: false,
});

// -------------------------------------------------------
// ROOM MEMORY (ONLY FOR CHAT USERS LIST)
// -------------------------------------------------------
// roomCode => { users: Map(socketId -> username) }
const rooms = new Map();

function getRoomUsers(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return [];
  return Array.from(room.users.values());
}

// -------------------------------------------------------
// SOCKET.IO CONNECTION
// -------------------------------------------------------
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  // CREATE ROOM
  socket.on("create-room", ({ roomCode }) => {
    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, { users: new Map() });
      console.log("📦 Room created:", roomCode);
    }
  });

  // MANUAL LEAVE (for nice system messages)
  socket.on("manual-leave", ({ roomCode, username }) => {
    socket.isManualDisconnect = true;
    console.log(`🚪 ${username} manually left room ${roomCode}`);
  });

  // JOIN ROOM
  socket.on("join-room", ({ roomCode, username }, callback) => {
    if (!roomCode || !username) {
      return callback({ success: false, error: "missing-fields" });
    }

    if (!rooms.has(roomCode)) {
      return callback({ success: false, error: "invalid-room" });
    }

    const room = rooms.get(roomCode);
    room.users.set(socket.id, username);
    socket.join(roomCode);

    console.log(`👤 ${username} joined ${roomCode}`);

    io.to(roomCode).emit("room-users", {
      roomCode,
      users: getRoomUsers(roomCode),
    });

    io.to(roomCode).emit("system-message", {
      text: `${username} joined the room.`,
      timestamp: new Date().toISOString(),
      system: true,
    });

    // If call is already active → notify new user
    const snapshot = callStore.getCallSnapshot(roomCode);
    if (snapshot) {
      socket.emit("call-existing", {
        roomCode,
        hostName: snapshot.hostName,
        participants: snapshot.participants, // now array of {id, username}
      });
    }

    callback({ success: true });
  });

  // -------------------------------------------------------
  // CHAT HANDLERS
  // -------------------------------------------------------
  setupChatHandlers(io, socket);

  // -------------------------------------------------------
  // CALL HANDLERS
  // -------------------------------------------------------
  setupCallHandlers(io, socket, callStore);

  // -------------------------------------------------------
  // CLEANUP ON DISCONNECT
  // -------------------------------------------------------
  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);

    for (const [roomCode, room] of rooms.entries()) {
      if (room.users.has(socket.id)) {
        const username = room.users.get(socket.id);
        room.users.delete(socket.id);

        io.to(roomCode).emit("room-users", {
          roomCode,
          users: getRoomUsers(roomCode),
        });

        if (socket.isManualDisconnect) {
          io.to(roomCode).emit("system-message", {
            text: `${username} left the room.`,
            timestamp: new Date().toISOString(),
            system: true,
          });
        }

        if (room.users.size === 0) {
          rooms.delete(roomCode);
          console.log("🧹 Deleted empty room", roomCode);
        }
      }
    }
  });
});

// -------------------------------------------------------
// HTTP ROOT CHECK
// -------------------------------------------------------
app.get("/", (req, res) => {
  res.send("Cryptech.ai realtime chat + call backend is running.");
});

// -------------------------------------------------------
// START SERVER
// -------------------------------------------------------
httpServer.listen(PORT, () => {
  console.log("🔥 BACKEND IS RUNNING");
  console.log("🟢 PORT =", PORT);
});
