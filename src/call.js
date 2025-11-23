// server/src/call.js
import CallRoomStore from "./utils/CallRoomStore.js";

export const callStore = new CallRoomStore();

export default function setupCallHandlers(io, socket) {
  // Start a call
  socket.on("call-start", ({ roomCode, username }) => {
    callStore.createCall(roomCode, socket.id, username);

    const snapshot = callStore.getCallSnapshot(roomCode);

    io.to(roomCode).emit("incoming-call", {
      caller: username,
      callerId: socket.id,
      roomCode,
      // [{ id, username }]
      participants: snapshot ? snapshot.participants : [],
    });
  });

  // User accepts / joins
  socket.on("call-accept", ({ roomCode, username }) => {
    const participants = callStore.joinCall(roomCode, socket.id, username);
    // participants = [{ id, username }]

    io.to(roomCode).emit("call-user-joined", {
      socketId: socket.id,
      username,
      participants,
    });
  });

  // (Decline is basically not used now but kept for logs)
  socket.on("call-decline", ({ roomCode, username }) => {
    io.to(roomCode).emit("call-user-declined", {
      username,
      socketId: socket.id,
    });
  });

  // Mute/unmute (for UI sync)
  socket.on("call-mute", ({ roomCode, muted }) => {
    callStore.muteUser(roomCode, socket.id, muted);

    io.to(roomCode).emit("call-user-muted", {
      socketId: socket.id,
      muted,
    });
  });

  // Host cancel or user leaves
  socket.on("call-leave", ({ roomCode }) => {
    const result = callStore.leaveCall(roomCode, socket.id);
    if (!result) return;

    const { username, roomEmpty } = result;

    io.to(roomCode).emit("call-user-left", {
      socketId: socket.id,
      username,
      roomEmpty,
    });

    if (roomEmpty) {
      io.to(roomCode).emit("call-ended", { roomCode });
    }
  });

  // --- WebRTC signaling relay ------------------------------ //

  socket.on("call-offer", ({ roomCode, to, sdp }) => {
    io.to(to).emit("call-offer", {
      roomCode,
      from: socket.id,
      sdp,
    });
  });

  socket.on("call-answer", ({ roomCode, to, sdp }) => {
    io.to(to).emit("call-answer", {
      roomCode,
      from: socket.id,
      sdp,
    });
  });

  socket.on("call-ice-candidate", ({ roomCode, to, candidate }) => {
    io.to(to).emit("call-ice-candidate", {
      roomCode,
      from: socket.id,
      candidate,
    });
  });

  // Disconnect cleanup
  socket.on("disconnect", () => {
    for (const [roomCode] of callStore.rooms.entries()) {
      const result = callStore.leaveCall(roomCode, socket.id);
      if (result) {
        const { username, roomEmpty } = result;
        io.to(roomCode).emit("call-user-left", {
          socketId: socket.id,
          username,
          roomEmpty,
        });
        if (roomEmpty) {
          io.to(roomCode).emit("call-ended", { roomCode });
        }
      }
    }
  });
}
