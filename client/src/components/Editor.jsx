import { useEffect, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import { socket } from "../socket/socket";

function Editor({ roomId, username }) {
  const editorRef = useRef(null);
  const [isEditorReady, setIsEditorReady] = useState(false);

  function handleEditorDidMount(editor) {
    editorRef.current = editor;
    setIsEditorReady(true);
  }

  useEffect(() => {
    if (!roomId || !username || !isEditorReady || !editorRef.current) return;

    const ydoc = new Y.Doc();
    const yText = ydoc.getText("monaco");
    const model = editorRef.current.getModel();

    const binding = new MonacoBinding(
      yText,
      model,
      new Set([editorRef.current])
    );

    function handleRemoteUpdate({ update }) {
      if (!update) return;

      const binaryUpdate = Uint8Array.from(update);
      Y.applyUpdate(ydoc, binaryUpdate, "remote");
    }

    function handleLocalUpdate(update, origin) {
      if (origin === "remote") return;

      socket.emit("yjs-update", {
        roomId,
        update: Array.from(update)
      });
    }

    socket.on("yjs-sync", handleRemoteUpdate);
    socket.on("yjs-update", handleRemoteUpdate);

    ydoc.on("update", handleLocalUpdate);

    socket.emit("yjs-sync-request", {
      roomId
    });

    console.log("Yjs editor connected:", {
      roomId,
      username
    });

    return () => {
      socket.off("yjs-sync", handleRemoteUpdate);
      socket.off("yjs-update", handleRemoteUpdate);

      ydoc.off("update", handleLocalUpdate);

      binding.destroy();
      ydoc.destroy();
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
        wordWrap: "on"
      }}
    />
    </div>
  );
}

export default Editor;