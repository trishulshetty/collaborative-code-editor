const roomUsers = new Map();
const roomCode = new Map();

function getUsersInRoom(roomId) {
  if (!roomUsers.has(roomId)) return [];
  return Array.from(roomUsers.get(roomId).values());
}

export default function setupEditorSocket(io) {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", ({ roomId, username }) => {
      if (!roomId || !username) return;

      socket.join(roomId);

      socket.data.roomId = roomId;
      socket.data.username = username;

      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Map());
      }

      roomUsers.get(roomId).set(socket.id, {
        socketId: socket.id,
        username
      });

      if (!roomCode.has(roomId)) {
        roomCode.set(roomId, "// Start coding together...\n");
      }

      socket.emit("code-update", {
        code: roomCode.get(roomId)
      });

      io.to(roomId).emit("users-update", {
        users: getUsersInRoom(roomId)
      });

      socket.to(roomId).emit("user-joined", {
        username
      });

      console.log(`${username} joined room ${roomId}`);
    });

    socket.on("code-change", ({ roomId, code }) => {
      if (!roomId) return;

      roomCode.set(roomId, code);

      socket.to(roomId).emit("code-update", {
        code
      });
    });

    socket.on("disconnect", () => {
      const { roomId, username } = socket.data;

      if (roomId && roomUsers.has(roomId)) {
        roomUsers.get(roomId).delete(socket.id);

        io.to(roomId).emit("users-update", {
          users: getUsersInRoom(roomId)
        });

        socket.to(roomId).emit("user-left", {
          username
        });

        if (roomUsers.get(roomId).size === 0) {
          roomUsers.delete(roomId);
        }
      }

      console.log("User disconnected:", socket.id);
    });
  });
}
