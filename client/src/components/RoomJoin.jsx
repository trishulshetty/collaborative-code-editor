import { useState } from "react";

function RoomJoin({ onJoin }) {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");

  function handleSubmit(e) {
    e.preventDefault();

    if (!username.trim() || !roomId.trim()) {
      alert("Please enter username and room ID");
      return;
    }

    onJoin({
      username: username.trim(),
      roomId: roomId.trim()
    });
  }

  return (
    <div className="join-container">
      <form className="join-box" onSubmit={handleSubmit}>
        <h1>Collaborative Code Editor</h1>

        <input
          type="text"
          placeholder="Enter your name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="text"
          placeholder="Enter room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />

        <button type="submit">Join Room</button>
      </form>
    </div>
  );
}

export default RoomJoin;
