/**
 * Operation type specifications for sync messages.
 *
 * @typedef {Object} InsertOperation
 * @property {"insert"} type
 * @property {import("../types/CharacterNode").CharacterNode} character
 *
 * @typedef {Object} DeleteOperation
 * @property {"delete"} type
 * @property {import("../types/Identifier").Identifier} id
 *
 * @typedef {InsertOperation | DeleteOperation} Operation
 */
