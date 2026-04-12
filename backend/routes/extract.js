const express = require("express");
const router = express.Router();
const { extractCommitment } = require("../utils/extractorWrapper");
const { createCommitment, getCommitmentById } = require("../data/storage");

function parseOptionalIsMine(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

// POST /extract
router.post("/", async (req, res) => {
  const raw = req.body || {};
  const { subject, body, emailText: emailTextField } = raw;
  const isMineFlag = parseOptionalIsMine(raw.isMine);

  const sub = typeof subject === "string" ? subject.trim() : "";
  const bod = typeof body === "string" ? body.trim() : "";
  const single =
    typeof emailTextField === "string" ? emailTextField.trim() : "";

  const emailText = (single || `${sub}\n${bod}`).trim();

  if (!emailText) {
    return res.status(400).json({ error: "Provide at least subject or body" });
  }

  const emailId = `email_${Date.now()}`;
  console.log(`[Extract] Processing email: "${emailText.slice(0, 60)}..."`);

  const extracted = await extractCommitment(emailText, emailId);

  if (!extracted) {
    console.log("[Extract] No commitment detected");
    return res.status(200).json({ message: "No commitment detected" });
  }

  if (await getCommitmentById(extracted.id)) {
    return res.status(409).json({ error: "Duplicate commitment ID, please retry" });
  }

  const toStore =
    isMineFlag !== undefined ? { ...extracted, isMine: isMineFlag } : extracted;

  await createCommitment(toStore);
  console.log(`[Extract] Commitment stored: ${toStore.id} — "${toStore.task.slice(0, 50)}"`);

  return res.status(201).json({
    message: "Commitment extracted and stored",
    commitment: toStore,
  });
});

module.exports = router;
