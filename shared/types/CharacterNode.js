/**
 * CharacterNode structure specification for JSDoc and documentation purposes.
 *
 * @typedef {Object} Identifier
 * @property {string} clientId - The unique ID of the client who generated the character.
 * @property {number} counter - The logical sequence counter for the character.
 *
 * @typedef {Object} CharacterNode
 * @property {Identifier} id - The unique identifier of this character node.
 * @property {string} value - The text value of this single character.
 * @property {boolean} deleted - A tombstone flag indicating whether the node is deleted.
 * @property {Identifier|null} leftId - The identifier of the node's left neighbor at creation.
 * @property {Identifier|null} rightId - The identifier of the node's right neighbor at creation.
 */
