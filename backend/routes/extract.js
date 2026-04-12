const express = require("express");
const router = express.Router();
const { extractCommitment } = require("../utils/extractorWrapper");
const { createCommitment, getCommitmentById } = require("../data/storage");

// POST /extract
router.post("/", async (req, res) => {
  const raw = req.body || {};
  const { subject, body, emailText: emailTextField } = raw;

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

  await createCommitment(extracted);
  console.log(`[Extract] Commitment stored: ${extracted.id} — "${extracted.task.slice(0, 50)}"`);

  return res.status(201).json({ message: "Commitment extracted and stored", commitment: extracted });
});

module.exports = router;
