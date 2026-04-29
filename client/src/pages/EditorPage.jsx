import { useEffect, useState } from "react";
import Editor from "../components/Editor";
import RoomJoin from "../components/RoomJoin";
import UserList from "../components/UserList";
import { socket } from "../socket/socket";

function EditorPage() {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("// Start coding together...\n");
  const [users, setUsers] = useState([]);

  function handleJoin({ roomId, username }) {
    setRoomId(roomId);
    setUsername(username);
    setJoined(true);

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("join-room", {
      roomId,
      username
    });
  }

  function handleCodeChange(newCode) {
    setCode(newCode);

    socket.emit("code-change", {
      roomId,
      code: newCode
    });
  }

  useEffect(() => {
    socket.on("code-update", ({ code }) => {
      setCode(code);
    });

    socket.on("users-update", ({ users }) => {
      setUsers(users);
    });

    socket.on("user-joined", ({ username }) => {
      console.log(`${username} joined`);
    });

    socket.on("user-left", ({ username }) => {
      console.log(`${username} left`);
    });

    return () => {
      socket.off("code-update");
      socket.off("users-update");
      socket.off("user-joined");
      socket.off("user-left");
    };
  }, []);

  if (!joined) {
    return <RoomJoin onJoin={handleJoin} />;
  }

  return (
    <div className="app-layout">
      <div className="sidebar">
        <h2>Room</h2>
        <p>{roomId}</p>

        <h2>You</h2>
        <p>{username}</p>

        <UserList users={users} />
      </div>

      <div className="main-editor">
        <Editor code={code} onCodeChange={handleCodeChange} />
      </div>
    </div>
  );
}

export default EditorPage;
