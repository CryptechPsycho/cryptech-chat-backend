// server/src/chat.js

export default function setupChatHandlers(io, socket) {

  socket.on("send-message", ({ roomCode, username, text }) => {
    io.to(roomCode).emit("receive-message", {
      type: "text",
      senderId: socket.id,
      username,
      text,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("voice-message", ({ roomCode, username, audio, mimeType, duration }) => {
    io.to(roomCode).emit("receive-voice-message", {
      type: "audio",
      senderId: socket.id,
      username,
      audio,
      mimeType,
      duration,
      timestamp: new Date().toISOString(),
    });
  });

}
