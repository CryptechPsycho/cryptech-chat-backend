// server/src/utils/CallRoomStore.js
export default class CallRoomStore {
  constructor() {
    // roomCode -> {
    //   hostId,
    //   hostName,
    //   participants: Map(socketId -> { username, muted }),
    //   startedAt,
    //   ringing: Set<socketId>,
    // }
    this.rooms = new Map();
  }

  createCall(roomCode, callerId, callerName) {
    let room = this.rooms.get(roomCode);
    if (!room) {
      room = {
        hostId: callerId,
        hostName: callerName,
        participants: new Map(),
        startedAt: Date.now(),
        ringing: new Set(),
      };
      this.rooms.set(roomCode, room);
    }

    room.hostId = callerId;
    room.hostName = callerName;
    room.ringing.add(callerId);

    // host is always a participant in the call
    room.participants.set(callerId, {
      username: callerName,
      muted: false,
    });
  }

  joinCall(roomCode, socketId, username) {
    const room = this.rooms.get(roomCode);
    if (!room) return [];

    room.ringing.delete(socketId);
    room.participants.set(socketId, {
      username,
      muted: false,
    });

    // return full list of participants as {id, username}
    return Array.from(room.participants.entries()).map(([id, info]) => ({
      id,
      username: info.username,
    }));
  }

  leaveCall(roomCode, socketId) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    let username = null;
    if (room.participants.has(socketId)) {
      username = room.participants.get(socketId).username;
      room.participants.delete(socketId);
    }
    room.ringing.delete(socketId);

    const roomEmpty =
      room.participants.size === 0 && room.ringing.size === 0;

    if (roomEmpty) {
      this.rooms.delete(roomCode);
    }

    return { username, roomEmpty };
  }

  muteUser(roomCode, socketId, muted) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const info = room.participants.get(socketId);
    if (info) {
      info.muted = muted;
    }
  }

  getCall(roomCode) {
    return this.rooms.get(roomCode);
  }

  getCallSnapshot(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    return {
      hostId: room.hostId,
      hostName: room.hostName,
      participants: Array.from(room.participants.entries()).map(
        ([id, info]) => ({
          id,
          username: info.username,
        })
      ),
    };
  }
}
