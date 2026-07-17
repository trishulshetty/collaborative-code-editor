/**
 * Generates monotonic, unique logical counters (identifiers) for each client.
 * Implements Lamport timestamp observation to prevent collisions.
 */
export class IdentifierGenerator {
  constructor(clientId, initialCounter = 0) {
    this.clientId = clientId;
    this.counter = initialCounter;
  }

  /**
   * Generates a new unique identifier for a local character insertion.
   * Increments the internal counter by 1.
   *
   * @returns {{clientId: string, counter: number}}
   */
  generate() {
    this.counter++;
    return {
      clientId: this.clientId,
      counter: this.counter,
    };
  }

  /**
   * Gets the current counter value.
   *
   * @returns {number}
   */
  getCounter() {
    return this.counter;
  }

  /**
   * Observes a counter from a remote operation and advances the local counter if necessary.
   * This is critical to ensure that future local operations have a counter strictly greater
   * than any received operations, maintaining causal order.
   *
   * @param {number} remoteCounter
   */
  observe(remoteCounter) {
    if (remoteCounter > this.counter) {
      this.counter = remoteCounter;
    }
  }
}
