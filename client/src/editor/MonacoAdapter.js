const CURSOR_COLORS = [
  "#FF5722", // Orange
  "#4CAF50", // Green
  "#2196F3", // Blue
  "#9C27B0", // Purple
  "#FFEB3B", // Yellow
  "#00BCD4", // Cyan
  "#E91E63", // Pink
  "#FF9800", // Amber
  "#3F51B5", // Indigo
  "#009688", // Teal
];

function getColorForUser(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CURSOR_COLORS.length;
  return CURSOR_COLORS[index];
}

/**
 * Adapter bridging Monaco Editor events and the CRDT state synchronizer.
 */
export class MonacoAdapter {
  constructor(editor, monaco, crdt, sync) {
    this.editor = editor;
    this.monaco = monaco;
    this.crdt = crdt;
    this.sync = sync;
    this.isApplyingRemoteChange = false;

    // Initialize the decorations collection for remote cursors and selections
    this.decorationsCollection = this.editor.createDecorationsCollection([]);
    this.remoteCursors = new Map();

    this.setupLocalListeners();
    this.setupRemoteListeners();
  }

  setupLocalListeners() {
    const model = this.editor.getModel();
    if (!model) return;

    // Listen to local typing / deletion changes in Monaco
    this.editor.onDidChangeModelContent((event) => {
      if (this.isApplyingRemoteChange) return;

      // Monaco can batch multiple edits in a single event
      for (const change of event.changes) {
        const { rangeOffset, rangeLength, text } = change;

        // 1. Process local deletions
        if (rangeLength > 0) {
          const deleteOps = this.crdt.localDelete(rangeOffset, rangeLength);
          for (const op of deleteOps) {
            this.sync.broadcastDelete(op);
          }
        }

        // 2. Process local insertions
        if (text.length > 0) {
          const insertOps = this.crdt.localInsert(rangeOffset, text);
          for (const op of insertOps) {
            this.sync.broadcastInsert(op);
          }
        }
      }
    });

    // Listen to local cursor position movements
    this.editor.onDidChangeCursorPosition(() => {
      this.broadcastLocalCursor();
    });

    // Listen to local text selection highlights
    this.editor.onDidChangeCursorSelection(() => {
      this.broadcastLocalCursor();
    });
  }

  setupRemoteListeners() {
    // Apply remote inserts
    this.sync.onInsert((offset, value) => {
      this.isApplyingRemoteChange = true;
      try {
        const model = this.editor.getModel();
        if (!model) return;
        const position = model.getPositionAt(offset);
        const range = new this.monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        );

        this.editor.executeEdits("crdt-remote-insert", [
          {
            range,
            text: value,
            forceMoveMarkers: true,
          },
        ]);
      } finally {
        this.isApplyingRemoteChange = false;
      }
    });

    // Apply remote deletes
    this.sync.onDelete((offset) => {
      this.isApplyingRemoteChange = true;
      try {
        const model = this.editor.getModel();
        if (!model) return;
        const startPos = model.getPositionAt(offset);
        const endPos = model.getPositionAt(offset + 1);
        const range = new this.monaco.Range(
          startPos.lineNumber,
          startPos.column,
          endPos.lineNumber,
          endPos.column
        );

        this.editor.executeEdits("crdt-remote-delete", [
          {
            range,
            text: "",
            forceMoveMarkers: true,
          },
        ]);
      } finally {
        this.isApplyingRemoteChange = false;
      }
    });

    // Apply document state synchronizations (on initial join / reconnect)
    this.sync.onSync((text) => {
      this.isApplyingRemoteChange = true;
      try {
        const model = this.editor.getModel();
        if (!model) return;
        const fullRange = model.getFullModelRange();

        this.editor.executeEdits("crdt-sync", [
          {
            range: fullRange,
            text: text,
            forceMoveMarkers: true,
          },
        ]);
      } finally {
        this.isApplyingRemoteChange = false;
      }
    });

    // Render remote cursors and selection ranges
    this.sync.onCursor((userId, username, cursorInfo) => {
      this.handleRemoteCursor(userId, username, cursorInfo);
    });

    // Prune user cursor when they leave
    this.sync.onUserLeft((username) => {
      for (const [userId, info] of this.remoteCursors.entries()) {
        if (info.username === username) {
          this.remoteCursors.delete(userId);
          const styleEl = document.getElementById(`remote-style-${userId}`);
          if (styleEl) styleEl.remove();
        }
      }
      this.renderRemoteCursors();
    });
  }

  broadcastLocalCursor() {
    const position = this.editor.getPosition();
    const selection = this.editor.getSelection();

    if (position) {
      this.sync.broadcastCursor({
        lineNumber: position.lineNumber,
        column: position.column,
        selection: selection
          ? {
              startLineNumber: selection.startLineNumber,
              startColumn: selection.startColumn,
              endLineNumber: selection.endLineNumber,
              endColumn: selection.endColumn,
            }
          : null,
      });
    }
  }

  handleRemoteCursor(userId, username, cursorInfo) {
    const color = getColorForUser(userId);
    this.injectStyleForUser(userId, username, color);

    this.remoteCursors.set(userId, {
      username,
      cursorInfo,
    });

    this.renderRemoteCursors();
  }

  injectStyleForUser(userId, username, color) {
    const styleId = `remote-style-${userId}`;
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = `
      .remote-cursor-${userId} {
        border-left: 2px solid ${color};
        margin-left: -1px;
        position: relative;
      }
      .remote-cursor-widget-${userId} {
        content: "${username}";
        position: absolute;
        top: -14px;
        left: -2px;
        background-color: ${color};
        color: #fff;
        font-size: 9px;
        font-family: sans-serif;
        padding: 1px 4px;
        border-radius: 2px;
        white-space: nowrap;
        pointer-events: none;
        z-index: 10;
        opacity: 0.85;
        font-weight: bold;
      }
      .remote-selection-${userId} {
        background-color: ${color}2b;
      }
    `;
  }

  renderRemoteCursors() {
    const decorations = [];

    for (const [userId, info] of this.remoteCursors.entries()) {
      if (!info.cursorInfo) continue;
      const { lineNumber, column, selection } = info.cursorInfo;

      // 1. Add cursor line decoration
      decorations.push({
        range: new this.monaco.Range(lineNumber, column, lineNumber, column),
        options: {
          className: `remote-cursor-${userId}`,
          beforeContentClassName: `remote-cursor-widget-${userId}`,
        },
      });

      // 2. Add selection highlight decoration if selected
      if (
        selection &&
        (selection.startLineNumber !== selection.endLineNumber ||
          selection.startColumn !== selection.endColumn)
      ) {
        decorations.push({
          range: new this.monaco.Range(
            selection.startLineNumber,
            selection.startColumn,
            selection.endLineNumber,
            selection.endColumn
          ),
          options: {
            className: `remote-selection-${userId}`,
          },
        });
      }
    }

    this.decorationsCollection.set(decorations);
  }

  updateActiveUsers(users) {
    const activeSocketIds = new Set(users.map((u) => u.socketId));

    for (const userId of this.remoteCursors.keys()) {
      if (!activeSocketIds.has(userId)) {
        this.remoteCursors.delete(userId);
        const styleEl = document.getElementById(`remote-style-${userId}`);
        if (styleEl) styleEl.remove();
      }
    }
    this.renderRemoteCursors();
  }

  destroy() {
    this.decorationsCollection.clear();
    for (const userId of this.remoteCursors.keys()) {
      const styleEl = document.getElementById(`remote-style-${userId}`);
      if (styleEl) styleEl.remove();
    }
  }
}
