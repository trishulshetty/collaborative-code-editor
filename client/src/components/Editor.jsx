import MonacoEditor from "@monaco-editor/react";

function Editor({ code, onCodeChange }) {
  return (
    <div className="editor-container">
      <MonacoEditor
        height="80vh"
        language="javascript"
        theme="vs-dark"
        value={code}
        onChange={(value) => onCodeChange(value || "")}
        options={{
          fontSize: 16,
          minimap: { enabled: false },
          automaticLayout: true
        }}
      />
    </div>
  );
}

export default Editor;
