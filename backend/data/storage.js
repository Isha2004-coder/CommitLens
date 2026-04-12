// ─── In-Memory Store (AutoDB adapter placeholder) ───────────────────────────
// To swap in AutoDB: replace the array operations below with AutoDB SDK calls.
// All other files import from this module only — zero changes needed elsewhere.

const commitments = [];

async function createCommitment(commitment) {
  commitments.push(commitment);
  return commitment;
}

async function getAllCommitments() {
  return commitments;
}

async function getCommitmentById(id) {
  return commitments.find((c) => c.id === id) || null;
}

async function updateCommitment(id, updates) {
  const idx = commitments.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  commitments[idx] = { ...commitments[idx], ...updates };
  return commitments[idx];
}

async function getPendingCommitments() {
  return commitments.filter((c) => c.status === "pending");
}

module.exports = {
  createCommitment,
  getAllCommitments,
  getCommitmentById,
  updateCommitment,
  getPendingCommitments,
};
