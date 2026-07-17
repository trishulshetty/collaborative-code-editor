import { spawn } from "child_process";
import { CRDT } from "../../../shared/crdt/CRDT.js";

const roomUsers = new Map();
const roomHistories = new Map();

function getUsersInRoom(roomId) {
  if (!roomUsers.has(roomId)) return [];
  return Array.from(roomUsers.get(roomId).values());
}

function getRoomHistory(roomId) {
  if (!roomHistories.has(roomId)) {
    roomHistories.set(roomId, []);
  }
  return roomHistories.get(roomId);
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
            message: "Room ID and username are required",
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
        username,
      });

      const users = getUsersInRoom(roomId);

      io.to(roomId).emit("users-update", {
        users,
      });

      // Send operation log history to the client that just joined
      const history = getRoomHistory(roomId);
      socket.emit("sync-document", {
        history,
      });

      if (callback) {
        callback({
          success: true,
          users,
        });
      }

      console.log(`Room ${roomId} users:`, users);
    });

    socket.on("insert-character", ({ roomId, operation }) => {
      if (!roomId || !operation) return;

      const history = getRoomHistory(roomId);
      history.push(operation);

      socket.to(roomId).emit("insert-character", {
        operation,
      });
    });

    socket.on("delete-character", ({ roomId, operation }) => {
      if (!roomId || !operation) return;

      const history = getRoomHistory(roomId);
      history.push(operation);

      socket.to(roomId).emit("delete-character", {
        operation,
      });
    });

    socket.on("sync-document", ({ roomId }) => {
      if (!roomId) return;
      const history = getRoomHistory(roomId);
      socket.emit("sync-document", {
        history,
      });
      console.log(`sync-document sent for room ${roomId} to socket ${socket.id}`);
    });

    socket.on("cursor-update", ({ roomId, username, cursorInfo }) => {
      if (!roomId) return;

      socket.to(roomId).emit("cursor-update", {
        socketId: socket.id,
        username,
        cursorInfo,
      });
    });

    socket.on("run-code", ({ roomId }) => {
      if (!roomId || !roomHistories.has(roomId)) {
        socket.emit("terminal-output", {
          output: "No code found for this room.\r\n",
        });
        socket.emit("terminal-done");
        return;
      }

      const history = getRoomHistory(roomId);

      // Rebuild the code document on the fly using the shared CRDT
      const serverCrdt = new CRDT("server", history);
      const code = serverCrdt.visibleText();

      if (!code.trim()) {
        socket.emit("terminal-output", {
          output: "Editor is empty.\r\n",
        });
        socket.emit("terminal-done");
        return;
      }

      socket.emit("terminal-output", {
        output: "Executing JavaScript...\r\n",
      });

      const child = spawn("node", ["-e", code], {
        shell: false,
        timeout: 5000,
      });

      child.stdout.on("data", (data) => {
        socket.emit("terminal-output", {
          output: data.toString().replace(/\n/g, "\r\n"),
        });
      });

      child.stderr.on("data", (data) => {
        socket.emit("terminal-output", {
          output: data.toString().replace(/\n/g, "\r\n"),
        });
      });

      child.on("close", (exitCode) => {
        socket.emit("terminal-output", {
          output: `\r\nProcess exited with code ${exitCode}\r\n`,
        });

        socket.emit("terminal-done");
      });

      child.on("error", (error) => {
        socket.emit("terminal-output", {
          output: `Execution error: ${error.message}\r\n`,
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
        users,
      });

      socket.to(roomId).emit("user-left", {
        username,
      });

      if (roomUsers.get(roomId).size === 0) {
        roomUsers.delete(roomId);
      }

      console.log(`Room ${roomId} users after disconnect:`, users);
    });
  });
}
