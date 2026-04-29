// ─── File-backed store (survives server / ngrok restarts) ─────────────────────
// Swap for AutoDB later by replacing this module’s implementation.

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "commitments-data.json");

function loadCommitments() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    if (e.code !== "ENOENT") {
      console.error("[storage] load error:", e.message);
    }
    return [];
  }
}

let commitments = loadCommitments();

function persist() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(commitments, null, 2), "utf8");
  } catch (e) {
    console.error("[storage] persist error:", e.message);
  }
}

async function createCommitment(commitment) {
  const emailId = typeof commitment.emailId === "string" ? commitment.emailId.trim() : "";
  if (emailId) {
    const existingByEmail = commitments.find((c) => (c.emailId || "") === emailId);
    if (existingByEmail) return existingByEmail;
  }

  const taskKey = (commitment.task || "").toLowerCase().trim();
  const deadline = Number(commitment.deadline);
  const duplicate = commitments.find((c) => {
    if (c.status === "completed") return false;
    const sameTask = (c.task || "").toLowerCase().trim() === taskKey;
    const sameDeadline = Number(c.deadline) === deadline;
    return sameTask && sameDeadline;
  });
  if (duplicate) return duplicate;
  commitments.push(commitment);
  persist();
  return commitment;
}

async function getAllCommitments() {
  return commitments;
}

async function getCommitmentById(id) {
  return commitments.find((c) => c.id === id) || null;
}

async function getCommitmentByEmailId(emailId) {
  return commitments.find((c) => (c.emailId || "") === emailId) || null;
}

async function updateCommitment(id, updates) {
  const idx = commitments.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  commitments[idx] = { ...commitments[idx], ...updates };
  persist();
  return commitments[idx];
}

async function getPendingCommitments() {
  return commitments.filter((c) => c.status === "pending");
}

module.exports = {
  createCommitment,
  getAllCommitments,
  getCommitmentById,
  getCommitmentByEmailId,
  updateCommitment,
  getPendingCommitments,
};