/**
 * Handles the client-side socket synchronization layer in JavaScript.
 * Communicates CRDT operation broadcasts, cursor updates, and initial room state logs.
 */
export class SocketSync {
  constructor(socket, crdt, roomId, username) {
    this.socket = socket;
    this.crdt = crdt;
    this.roomId = roomId;
    this.username = username;

    this.onInsertCallback = null;
    this.onDeleteCallback = null;
    this.onSyncCallback = null;
    this.onCursorCallback = null;
    this.onUserLeftCallback = null;

    this.setupListeners();
  }

  setupListeners() {
    // Fired when the server sends the full operation log history
    this.socket.on("sync-document", ({ history }) => {
      console.log("Received sync-document. Replaying", history.length, "operations.");
      this.crdt.replayOperations(history);
      if (this.onSyncCallback) {
        this.onSyncCallback(this.crdt.visibleText());
      }
    });

    // Fired when another client inserts a character
    this.socket.on("insert-character", ({ operation }) => {
      const changed = this.crdt.applyOperation(operation);
      if (changed && this.onInsertCallback && operation.type === "insert") {
        const offset = this.crdt.getDocument().getVisibleOffsetOfNode(operation.character.id);
        if (offset !== -1) {
          this.onInsertCallback(offset, operation.character.value);
        }
      }
    });

    // Fired when another client deletes a character
    this.socket.on("delete-character", ({ operation }) => {
      if (operation.type === "delete") {
        // Look up the offset of the target node *before* marked deleted
        const offset = this.crdt.getDocument().getVisibleOffsetOfNode(operation.id);
        const changed = this.crdt.applyOperation(operation);
        if (changed && offset !== -1 && this.onDeleteCallback) {
          this.onDeleteCallback(offset);
        }
      }
    });

    // Fired when another client moves their cursor or highlights text
    this.socket.on("cursor-update", ({ socketId, username, cursorInfo }) => {
      if (this.onCursorCallback) {
        this.onCursorCallback(socketId, username, cursorInfo);
      }
    });

    // Fired when another client leaves the room
    this.socket.on("user-left", ({ username }) => {
      if (this.onUserLeftCallback) {
        this.onUserLeftCallback(username);
      }
    });
  }

  /**
   * Emits a newly generated local insert operation to the server.
   *
   * @param {Object} op
   */
  broadcastInsert(op) {
    this.socket.emit("insert-character", {
      roomId: this.roomId,
      operation: op,
    });
  }

  /**
   * Emits a newly generated local delete operation to the server.
   *
   * @param {Object} op
   */
  broadcastDelete(op) {
    this.socket.emit("delete-character", {
      roomId: this.roomId,
      operation: op,
    });
  }

  /**
   * Broadcasts local cursor coordinates/ranges to the server.
   *
   * @param {Object} cursorInfo
   */
  broadcastCursor(cursorInfo) {
    this.socket.emit("cursor-update", {
      roomId: this.roomId,
      username: this.username,
      cursorInfo,
    });
  }

  onInsert(callback) {
    this.onInsertCallback = callback;
  }

  onDelete(callback) {
    this.onDeleteCallback = callback;
  }

  onSync(callback) {
    this.onSyncCallback = callback;
  }

  onCursor(callback) {
    this.onCursorCallback = callback;
  }

  onUserLeft(callback) {
    this.onUserLeftCallback = callback;
  }

  /**
   * Cleans up socket listeners.
   */
  destroy() {
    this.socket.off("sync-document");
    this.socket.off("insert-character");
    this.socket.off("delete-character");
    this.socket.off("cursor-update");
    this.socket.off("user-left");
  }
}
