import { compareIdentifiers, serializeIdentifier } from "../types/Identifier.js";

/**
 * Maintains the sequence of CharacterNodes (active and tombstones) making up the document.
 * Implements RGA sequence insertion point calculation.
 */
export class Document {
  constructor(initialNodes = []) {
    this.nodes = [...initialNodes];
  }

  /**
   * Returns a copy of the character nodes in the document.
   */
  getNodes() {
    return this.nodes;
  }

  /**
   * Finds the index of a node by its unique identifier.
   * Returns -1 if the identifier is null or not found in the sequence.
   */
  findNodeIndex(id) {
    if (id === null) return -1;
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      if (node.id.clientId === id.clientId && node.id.counter === id.counter) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Finds the correct index at which to insert a new CharacterNode.
   * Resolves conflicts deterministically using the Replicated Growable Array (RGA) algorithm.
   *
   * @param {Object} newNode - The node to be inserted.
   * @returns {number} The index at which the node should be inserted.
   */
  findInsertionPoint(newNode) {
    let leftIndex = -1;
    if (newNode.leftId !== null) {
      leftIndex = this.findNodeIndex(newNode.leftId);
      if (leftIndex === -1) {
        console.warn(`leftId ${serializeIdentifier(newNode.leftId)} not found in document. Defaulting leftIndex to -1.`);
      }
    }

    let rightIndex = this.nodes.length;
    if (newNode.rightId !== null) {
      rightIndex = this.findNodeIndex(newNode.rightId);
      if (rightIndex === -1) {
        console.warn(`rightId ${serializeIdentifier(newNode.rightId)} not found in document. Defaulting rightIndex to ${this.nodes.length}.`);
        rightIndex = this.nodes.length;
      }
    }

    // Sanity check: right neighbor must follow left neighbor
    if (rightIndex < leftIndex + 1) {
      rightIndex = this.nodes.length;
    }

    let insertIndex = leftIndex + 1;
    const skippedNodes = new Set();

    while (insertIndex < rightIndex) {
      const currentNode = this.nodes[insertIndex];
      const currentIdStr = serializeIdentifier(currentNode.id);
      const currentLeftIdStr = currentNode.leftId ? serializeIdentifier(currentNode.leftId) : null;

      // Rule: Any descendant of a skipped sibling must also be skipped to preserve the
      // tree structure order (i.e. child nodes stay after their parent node).
      const isDescendantOfSkipped = currentLeftIdStr !== null && skippedNodes.has(currentLeftIdStr);

      if (isDescendantOfSkipped) {
        skippedNodes.add(currentIdStr);
        insertIndex++;
      } else {
        // Compare siblings to resolve concurrent insertions.
        // We order concurrently inserted siblings descending by their Identifier (highest ID first).
        if (compareIdentifiers(currentNode.id, newNode.id) > 0) {
          skippedNodes.add(currentIdStr);
          insertIndex++;
        } else {
          // The new node's identifier is greater than the current node's, so it must be placed before it.
          break;
        }
      }
    }

    return insertIndex;
  }

  /**
   * Inserts a node physically at the specified index.
   */
  insertAt(index, node) {
    this.nodes.splice(index, 0, node);
  }

  /**
   * Finds the left and right neighbor identifiers at a given 0-indexed text offset.
   * Used for local insertions.
   */
  getNeighborsAtOffset(offset) {
    let leftId = null;
    let rightId = null;

    let activeCount = 0;

    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      if (!node.deleted) {
        if (activeCount === offset - 1) {
          leftId = node.id;
        } else if (activeCount === offset) {
          rightId = node.id;
          break;
        }
        activeCount++;
      }
    }

    return { leftId, rightId };
  }

  /**
   * Translates a physical node index to its 0-indexed visible text offset.
   * Returns -1 if the node is deleted or not found.
   */
  getVisibleOffsetOfNode(id) {
    let activeCount = 0;
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      if (node.id.clientId === id.clientId && node.id.counter === id.counter) {
        return node.deleted ? -1 : activeCount;
      }
      if (!node.deleted) {
        activeCount++;
      }
    }
    return -1;
  }

  /**
   * Translates a visible text offset to the active CharacterNode at that position.
   * Returns null if not found.
   */
  getActiveNodeAtOffset(offset) {
    let activeCount = 0;
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      if (!node.deleted) {
        if (activeCount === offset) {
          return node;
        }
        activeCount++;
      }
    }
    return null;
  }

  /**
   * Joins all non-deleted node values to generate the visible text representation.
   */
  visibleText() {
    return this.nodes
      .filter((node) => !node.deleted)
      .map((node) => node.value)
      .join("");
  }
}
