const commitments = [];

function getAllCommitments() {
  return commitments;
}

function getCommitmentById(id) {
  return commitments.find((c) => c.id === id);
}

function addCommitment(commitment) {
  commitments.push(commitment);
  return commitment;
}

function updateCommitment(id, updates) {
  const idx = commitments.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  commitments[idx] = { ...commitments[idx], ...updates };
  return commitments[idx];
}

module.exports = { commitments, getAllCommitments, getCommitmentById, addCommitment, updateCommitment };