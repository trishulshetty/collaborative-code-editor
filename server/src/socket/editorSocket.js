import * as Y from "yjs";
import { spawn } from "child_process";

const roomUsers = new Map();
const roomDocs = new Map();

function getUsersInRoom(roomId) {
  if (!roomUsers.has(roomId)) return [];
  return Array.from(roomUsers.get(roomId).values());
}

// function getRoomDoc(roomId) {
//   if (!roomDocs.has(roomId)) {
//     const ydoc = new Y.Doc();
//     const yText = ydoc.getText("monaco");

//     yText.insert(0, "// Start coding together...\n");

//     roomDocs.set(roomId, ydoc);
//   }

//   return roomDocs.get(roomId);
// }

function getRoomDoc(roomId) {
  if (!roomDocs.has(roomId)) {
    const ydoc = new Y.Doc();
    ydoc.getText("monaco");
    roomDocs.set(roomId, ydoc);
  }

  return roomDocs.get(roomId);
}

export default function setupEditorSocket(io) {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join-room", ({ roomId, username }, callback) => {
      console.log("join-room received:", { roomId, username });

      if (!roomId || !username) {
        if (callback) {
          callback({
            success: false,
            message: "Room ID and username are required"
          });
        }
        return;
      }

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

      getRoomDoc(roomId);

      const users = getUsersInRoom(roomId);

      io.to(roomId).emit("users-update", {
        users
      });

      if (callback) {
        callback({
          success: true,
          users
        });
      }

      console.log(`Room ${roomId} users:`, users);
    });

    socket.on("yjs-sync-request", ({ roomId }) => {
      if (!roomId) return;

      const ydoc = getRoomDoc(roomId);
      const state = Y.encodeStateAsUpdate(ydoc);

      socket.emit("yjs-sync", {
        update: Array.from(state)
      });

      console.log("Yjs sync sent for room:", roomId);
    });

    socket.on("yjs-update", ({ roomId, update }) => {
      if (!roomId || !update) return;

      const ydoc = getRoomDoc(roomId);
      const binaryUpdate = Uint8Array.from(update);

      Y.applyUpdate(ydoc, binaryUpdate);

      socket.to(roomId).emit("yjs-update", {
        update: Array.from(binaryUpdate)
      });

      console.log("Yjs update received for room:", roomId);
    });

  //   socket.on("cursor-change", ({ roomId, username, position }) => {
  //   if (!roomId || !position) return;

  //   socket.to(roomId).emit("remote-cursor-change", {
  //     socketId: socket.id,
  //     username,
  //     position
  //   });
  // });

  socket.on("run-code", ({ roomId }) => {
  if (!roomId || !roomDocs.has(roomId)) {
    socket.emit("terminal-output", {
      output: "No code found for this room.\r\n"
    });
    socket.emit("terminal-done");
    return;
  }

  const ydoc = roomDocs.get(roomId);
  const yText = ydoc.getText("monaco");
  const code = yText.toString();

  if (!code.trim()) {
    socket.emit("terminal-output", {
      output: "Editor is empty.\r\n"
    });
    socket.emit("terminal-done");
    return;
  }

  socket.emit("terminal-output", {
    output: "Executing JavaScript...\r\n"
  });

  const child = spawn("node", ["-e", code], {
    shell: false,
    timeout: 5000
  });

  child.stdout.on("data", (data) => {
    socket.emit("terminal-output", {
      output: data.toString().replace(/\n/g, "\r\n")
    });
  });

  child.stderr.on("data", (data) => {
    socket.emit("terminal-output", {
      output: data.toString().replace(/\n/g, "\r\n")
    });
  });

  child.on("close", (exitCode) => {
    socket.emit("terminal-output", {
      output: `\r\nProcess exited with code ${exitCode}\r\n`
    });

    socket.emit("terminal-done");
  });

  child.on("error", (error) => {
    socket.emit("terminal-output", {
      output: `Execution error: ${error.message}\r\n`
    });

    socket.emit("terminal-done");
  });
});

    socket.on("disconnect", () => {
      
      console.log("Socket disconnected:", socket.id);

      const { roomId, username } = socket.data;

      if (!roomId || !roomUsers.has(roomId)) return;

      roomUsers.get(roomId).delete(socket.id);

      const users = getUsersInRoom(roomId);

      io.to(roomId).emit("users-update", {
        users
      });

      socket.to(roomId).emit("user-left", {
        username
      });

      if (roomUsers.get(roomId).size === 0) {
        roomUsers.delete(roomId);
      }

      console.log(`Room ${roomId} users after disconnect:`, users);
    });

    
  });
}