import { useEffect, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import { CRDT } from "../crdt/CRDT.js";
import { SocketSync } from "../socket/SocketSync.js";
import { MonacoAdapter } from "../editor/MonacoAdapter.js";
import { socket } from "../socket/socket.js";

function Editor({ roomId, username, users }) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const adapterRef = useRef(null);
  const [isEditorReady, setIsEditorReady] = useState(false);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setIsEditorReady(true);
  }

  // Update remote cursors and prune disconnected users' styling when the active users list changes
  useEffect(() => {
    if (adapterRef.current && users) {
      adapterRef.current.updateActiveUsers(users);
    }
  }, [users]);

  useEffect(() => {
    if (!roomId || !username || !isEditorReady || !editorRef.current || !monacoRef.current) return;

    // Use socket.id as the clientId to ensure uniqueness. Fallback if not populated.
    const clientId = socket.id || username || Math.random().toString(36).substring(2, 9);
    console.log("Initializing Custom CRDT with clientId:", clientId);

    const crdt = new CRDT(clientId);
    const sync = new SocketSync(socket, crdt, roomId, username);
    const adapter = new MonacoAdapter(editorRef.current, monacoRef.current, crdt, sync);

    adapterRef.current = adapter;

    // Trigger initial document synchronization request
    socket.emit("sync-document", { roomId });

    console.log("CRDT editor connected successfully:", {
      roomId,
      username,
      clientId,
    });

    return () => {
      console.log("Cleaning up CRDT editor adapter...");
      adapter.destroy();
      sync.destroy();
      adapterRef.current = null;
    };
  }, [roomId, username, isEditorReady]);

  return (
    <div className="editor-container">
      <MonacoEditor
        height="100%"
        language="javascript"
        theme="vs-dark"
        defaultValue="// Start coding together...\n"
        onMount={handleEditorDidMount}
        options={{
          fontSize: 16,
          minimap: { enabled: false },
          automaticLayout: true,
          wordWrap: "on",
        }}
      />
    </div>
  );
}

export default Editor;