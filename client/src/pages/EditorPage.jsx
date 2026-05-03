import { useEffect, useState } from "react";
import Editor from "../components/Editor";
import RoomJoin from "../components/RoomJoin";
import UserList from "../components/UserList";
import { socket } from "../socket/socket";

function EditorPage() {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");

  function handleJoin({ roomId, username }) {
    const joinPayload = {
      roomId,
      username
    };

    socket.emit("join-room", joinPayload, (response) => {
      console.log("Join response:", response);

      if (!response || !response.success) {
        alert(response?.message || "Failed to join room");
        return;
      }

      setRoomId(roomId);
      setUsername(username);
      setUsers(response.users || []);
      setJoined(true);
    });
  }

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to server:", socket.id);
      setConnectionStatus("Connected");
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server");
      setConnectionStatus("Disconnected");
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error.message);
      setConnectionStatus("Connection Error");
    });

    socket.on("users-update", ({ users }) => {
      console.log("Users update:", users);
      setUsers(users);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("users-update");
    };
  }, []);

  if (!joined) {
    return (
      <>
        <div style={{ position: "fixed", top: 10, right: 10, color: "white" }}>
          Socket: {connectionStatus}
        </div>
        <RoomJoin onJoin={handleJoin} />
      </>
    );
  }

  return (
    <div className="app-layout">
      <div className="sidebar">
        <h2>Room</h2>
        <p>{roomId}</p>

        <h2>You</h2>
        <p>{username}</p>

        <p>Status: {connectionStatus}</p>

        <UserList users={users} />
      </div>

      <div className="main-editor">
        <Editor roomId={roomId} username={username} />
      </div>
    </div>
  );
}

export default EditorPage;