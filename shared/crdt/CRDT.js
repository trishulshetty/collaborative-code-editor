import { Document } from "./Document.js";
import { IdentifierGenerator } from "./IdentifierGenerator.js";
import { serializeIdentifier } from "../types/Identifier.js";

/**
 * High-level CRDT engine coordinating the Document sequence, CharacterMap,
 * OperationLog, and IdentifierGenerator.
 */
export class CRDT {
  constructor(clientId, initialHistory = []) {
    this.clientId = clientId;
    this.document = new Document();
    this.operationLog = [];
    this.characterMap = new Map();
    this.idGenerator = new IdentifierGenerator(clientId);
    this.pendingDeletions = new Set();

    if (initialHistory.length > 0) {
      this.replayOperations(initialHistory);
    }
  }

  /**
   * Returns the current client ID.
   */
  getClientId() {
    return this.clientId;
  }

  /**
   * Returns the Document sequence manager.
   */
  getDocument() {
    return this.document;
  }

  /**
   * Returns the historical list of applied operations.
   */
  getOperationLog() {
    return this.operationLog;
  }

  /**
   * Returns the CharacterMap mapping serialized ID keys to nodes.
   */
  getCharacterMap() {
    return this.characterMap;
  }

  /**
   * Performs a local insert of character values at a visible text offset.
   * Generates unique identifiers, inserts the nodes locally, and returns the generated insert operations.
   *
   * @param {number} offset - The 0-indexed visible text offset to insert at.
   * @param {string} value - The text string to insert (can be multiple characters).
   * @returns {Object[]} An array of generated InsertOperations to be broadcasted.
   */
  localInsert(offset, value) {
    const ops = [];
    let currentOffset = offset;

    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      const { leftId, rightId } = this.document.getNeighborsAtOffset(currentOffset);
      const id = this.idGenerator.generate();

      const node = {
        id,
        value: char,
        deleted: false,
        leftId,
        rightId,
      };

      this.insertNode(node);
      currentOffset++;

      const op = {
        type: "insert",
        character: node,
      };
      this.operationLog.push(op);
      ops.push(op);
    }

    return ops;
  }

  /**
   * Performs a local delete of character nodes starting at a visible text offset.
   * Marks the nodes as deleted locally and returns the generated delete operations.
   *
   * @param {number} offset - The 0-indexed visible text offset to start deletion.
   * @param {number} length - The number of visible characters to delete.
   * @returns {Object[]} An array of generated DeleteOperations to be broadcasted.
   */
  localDelete(offset, length) {
    const ops = [];

    for (let i = 0; i < length; i++) {
      const node = this.document.getActiveNodeAtOffset(offset);
      if (node) {
        node.deleted = true;
        const op = {
          type: "delete",
          id: node.id,
        };
        this.operationLog.push(op);
        ops.push(op);
      }
    }

    return ops;
  }

  /**
   * Applies a remote character insertion to the CRDT document.
   * Resolves conflicts and maintains eventual consistency.
   *
   * @param {Object} node - The CharacterNode to insert.
   * @returns {boolean} true if the node was successfully inserted, false if it was already processed.
   */
  remoteInsert(node) {
    const key = serializeIdentifier(node.id);
    if (this.characterMap.has(key)) {
      return false; // Deduplication
    }

    // Deep clone the node to prevent side-effects from shared object references in local tests/simulation
    const clonedNode = {
      id: { clientId: node.id.clientId, counter: node.id.counter },
      value: node.value,
      deleted: node.deleted,
      leftId: node.leftId ? { clientId: node.leftId.clientId, counter: node.leftId.counter } : null,
      rightId: node.rightId ? { clientId: node.rightId.clientId, counter: node.rightId.counter } : null,
    };

    this.insertNode(clonedNode);

    const op = {
      type: "insert",
      character: clonedNode,
    };
    this.operationLog.push(op);
    return true;
  }

  /**
   * Applies a remote character deletion to the CRDT document.
   * Marks the node matching the identifier as deleted.
   *
   * @param {Object} id - The Identifier of the character node to delete.
   * @returns {boolean} true if the node was successfully deleted, false if already deleted or buffered.
   */
  remoteDelete(id) {
    const key = serializeIdentifier(id);
    const node = this.characterMap.get(key);

    if (!node) {
      // Buffer the deletion if it arrived out of order (before the insertion).
      this.pendingDeletions.add(key);
      return false;
    }

    if (node.deleted) {
      return false; // Deduplication
    }

    node.deleted = true;

    const op = {
      type: "delete",
      id,
    };
    this.operationLog.push(op);
    return true;
  }

  /**
   * Applies any generic operation (insert/delete) to the CRDT.
   *
   * @param {Object} op - The operation to apply.
   * @returns {boolean} true if the operation resulted in a state change, false otherwise.
   */
  applyOperation(op) {
    if (op.type === "insert") {
      return this.remoteInsert(op.character);
    } else if (op.type === "delete") {
      return this.remoteDelete(op.id);
    }
    return false;
  }

  /**
   * Inserts a node into the document, handling conflict resolution and pending deletions.
   */
  insertNode(node) {
    const key = serializeIdentifier(node.id);

    // Apply pending deletion if the delete operation arrived before the insert.
    if (this.pendingDeletions.has(key)) {
      node.deleted = true;
      this.pendingDeletions.delete(key);
    }

    const insertIndex = this.document.findInsertionPoint(node);
    this.document.insertAt(insertIndex, node);
    this.characterMap.set(key, node);

    // Advance the identifier generator counter to guarantee monotonicity.
    this.idGenerator.observe(node.id.counter);
  }

  /**
   * Replays an entire operation history log to rebuild the CRDT state from scratch.
   */
  replayOperations(operations) {
    this.document = new Document();
    this.operationLog = [];
    this.characterMap.clear();
    this.pendingDeletions.clear();
    this.idGenerator = new IdentifierGenerator(this.clientId);

    for (const op of operations) {
      this.applyOperation(op);
    }
  }

  /**
   * Serializes the CRDT engine state including the client ID, generator counter, and history log.
   */
  serialize() {
    return JSON.stringify({
      clientId: this.clientId,
      counter: this.idGenerator.getCounter(),
      operationLog: this.operationLog,
    });
  }

  /**
   * Deserializes a state string and rebuilds the engine.
   */
  deserialize(serialized) {
    const data = JSON.parse(serialized);
    this.clientId = data.clientId;
    this.idGenerator = new IdentifierGenerator(data.clientId, data.counter);
    this.replayOperations(data.operationLog);
  }

  /**
   * Returns the plain visible text content of the document.
   */
  visibleText() {
    return this.document.visibleText();
  }
}
