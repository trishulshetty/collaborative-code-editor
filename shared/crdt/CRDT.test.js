import test from "node:test";
import assert from "node:assert";
import { CRDT } from "./CRDT.js";

// Helper to sync two CRDT instances by exchanging operations
function syncClients(clientA, clientB, opsA, opsB) {
  for (const op of opsB) {
    clientA.applyOperation(op);
  }
  for (const op of opsA) {
    clientB.applyOperation(op);
  }
}

// Helper to sync three CRDT instances
function syncThreeClients(cA, cB, cC, opsA, opsB, opsC) {
  // Client A receives B and C ops
  for (const op of opsB) cA.applyOperation(op);
  for (const op of opsC) cA.applyOperation(op);

  // Client B receives A and C ops
  for (const op of opsA) cB.applyOperation(op);
  for (const op of opsC) cB.applyOperation(op);

  // Client C receives A and B ops
  for (const op of opsA) cC.applyOperation(op);
  for (const op of opsB) cC.applyOperation(op);
}

test("1. Single user typing", () => {
  const crdt = new CRDT("user1");

  // Type "abc"
  const ops1 = crdt.localInsert(0, "abc");
  assert.strictEqual(crdt.visibleText(), "abc");
  assert.strictEqual(ops1.length, 3);

  // Insert "X" in between
  const ops2 = crdt.localInsert(1, "X");
  assert.strictEqual(crdt.visibleText(), "aXbc");
  assert.strictEqual(ops2.length, 1);

  // Delete "X"
  const ops3 = crdt.localDelete(1, 1);
  assert.strictEqual(crdt.visibleText(), "abc");
  assert.strictEqual(ops3.length, 1);
});

test("2. Two users typing simultaneously", () => {
  const clientA = new CRDT("clientA");
  const clientB = new CRDT("clientB");

  // Client A types "A" at offset 0
  const opsA = clientA.localInsert(0, "A");

  // Client B types "B" at offset 0 concurrently
  const opsB = clientB.localInsert(0, "B");

  // Exchange ops
  syncClients(clientA, clientB, opsA, opsB);

  // Assert convergence
  assert.strictEqual(clientA.visibleText(), clientB.visibleText());
  console.log("Converged Text:", clientA.visibleText());
});

test("3. Same-line insertion (concurrent edits after same character)", () => {
  const clientA = new CRDT("clientA");
  const clientB = new CRDT("clientB");

  // Start with same initial text
  const initOps = clientA.localInsert(0, "Hello");
  for (const op of initOps) {
    clientB.applyOperation(op);
  }

  assert.strictEqual(clientA.visibleText(), "Hello");
  assert.strictEqual(clientB.visibleText(), "Hello");

  // Client A types "X" at offset 5 (after "Hello")
  const opsA = clientA.localInsert(5, "X");

  // Client B types "Y" at offset 5 (after "Hello") concurrently
  const opsB = clientB.localInsert(5, "Y");

  // Sync clients
  syncClients(clientA, clientB, opsA, opsB);

  // Assert both have exact same output
  assert.strictEqual(clientA.visibleText(), clientB.visibleText());
  const text = clientA.visibleText();
  assert.ok(text === "HelloXY" || text === "HelloYX", `Text was: ${text}`);
  console.log("Same-line insertion result:", text);
});

test("4. Same character deletion", () => {
  const clientA = new CRDT("clientA");
  const clientB = new CRDT("clientB");

  // Initialize both with "Hello"
  const initOps = clientA.localInsert(0, "Hello");
  for (const op of initOps) {
    clientB.applyOperation(op);
  }

  // Client A deletes "o" (offset 4)
  const opsA = clientA.localDelete(4, 1);

  // Client B deletes "o" (offset 4) concurrently
  const opsB = clientB.localDelete(4, 1);

  // Sync
  syncClients(clientA, clientB, opsA, opsB);

  // Output should be "Hell" and no double delete errors
  assert.strictEqual(clientA.visibleText(), "Hell");
  assert.strictEqual(clientB.visibleText(), "Hell");
});

test("5. Delete + Insert race (inserting after deleted character)", () => {
  const clientA = new CRDT("clientA");
  const clientB = new CRDT("clientB");

  // Initialize both with "abc"
  const initOps = clientA.localInsert(0, "abc");
  for (const op of initOps) {
    clientB.applyOperation(op);
  }

  // Client A deletes "b" (offset 1)
  const opsA = clientA.localDelete(1, 1);

  // Client B concurrently inserts "X" after "b" (offset 2)
  const opsB = clientB.localInsert(2, "X");

  // Sync
  syncClients(clientA, clientB, opsA, opsB);

  // The character "b" is deleted. "X" is inserted after "b", which is a tombstone.
  // In the active text, "b" is ignored, but "X" should appear between "a" and "c" => "aXc".
  assert.strictEqual(clientA.visibleText(), "aXc");
  assert.strictEqual(clientB.visibleText(), "aXc");
});

test("6. Three users editing simultaneously", () => {
  const clientA = new CRDT("clientA");
  const clientB = new CRDT("clientB");
  const clientC = new CRDT("clientC");

  // Client A inserts "A"
  const opsA = clientA.localInsert(0, "A");
  // Client B inserts "B"
  const opsB = clientB.localInsert(0, "B");
  // Client C inserts "C"
  const opsC = clientC.localInsert(0, "C");

  // Sync all three
  syncThreeClients(clientA, clientB, clientC, opsA, opsB, opsC);

  // Check convergence
  assert.strictEqual(clientA.visibleText(), clientB.visibleText());
  assert.strictEqual(clientB.visibleText(), clientC.visibleText());
  console.log("Three users converged text:", clientA.visibleText());
});

test("7. User disconnect/reconnect (offline changes)", () => {
  const clientA = new CRDT("clientA");
  const clientB = new CRDT("clientB");

  // Start with "Hello"
  const initOps = clientA.localInsert(0, "Hello");
  for (const op of initOps) {
    clientB.applyOperation(op);
  }

  // Client B disconnects. Both clients perform offline edits.
  const opsA = clientA.localInsert(5, " A"); // Client A writes "Hello A"
  const opsB = clientB.localInsert(5, " B"); // Client B writes "Hello B"

  // Client B reconnects. Exchange the offline operations.
  syncClients(clientA, clientB, opsA, opsB);

  // Both must converge to the same text.
  assert.strictEqual(clientA.visibleText(), clientB.visibleText());
  console.log("Offline sync result:", clientA.visibleText());
});

test("8. Joining after 1000 operations", () => {
  const clientA = new CRDT("clientA");

  // Client A performs 1000 operations (inserts and deletes)
  let textLength = 0;
  for (let i = 0; i < 600; i++) {
    const char = String.fromCharCode(65 + (i % 26)); // A-Z
    const offset = Math.floor(Math.random() * (textLength + 1));
    clientA.localInsert(offset, char);
    textLength++;
  }

  for (let i = 0; i < 400; i++) {
    const offset = Math.floor(Math.random() * textLength);
    clientA.localDelete(offset, 1);
    textLength--;
  }

  const finalTextA = clientA.visibleText();
  const historyLog = clientA.getOperationLog();

  assert.strictEqual(historyLog.length, 1000);

  // New Client B joins and receives history log
  const clientB = new CRDT("clientB", historyLog);

  assert.strictEqual(clientB.visibleText(), finalTextA);
  assert.strictEqual(clientB.getDocument().getNodes().length, clientA.getDocument().getNodes().length);
});
