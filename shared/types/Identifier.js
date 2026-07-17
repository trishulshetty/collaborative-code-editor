/**
 * Compares two identifiers to establish a deterministic total order.
 * Sorts primarily by counter, and secondarily by clientId.
 *
 * @returns a negative number if id1 < id2, positive if id1 > id2, 0 if equal.
 */
export function compareIdentifiers(id1, id2) {
  if (id1 === null && id2 === null) return 0;
  if (id1 === null) return -1; // null is considered "less than" any identifier
  if (id2 === null) return 1;

  if (id1.counter !== id2.counter) {
    return id1.counter - id2.counter;
  }
  return id1.clientId.localeCompare(id2.clientId);
}

/**
 * Serializes an identifier into a unique string key.
 */
export function serializeIdentifier(id) {
  if (id === null) return "null";
  return `${id.clientId}:${id.counter}`;
}

/**
 * Deserializes a string key back into an identifier.
 */
export function deserializeIdentifier(str) {
  if (str === "null") return null;
  const index = str.lastIndexOf(":");
  if (index === -1) {
    throw new Error(`Invalid identifier serialization format: ${str}`);
  }
  const clientId = str.substring(0, index);
  const counter = parseInt(str.substring(index + 1), 10);
  return { clientId, counter };
}
