const express = require("express");
const router = express.Router();
const { extractCommitment } = require("../utils/extractorWrapper");
const { createCommitment, getCommitmentById } = require("../data/storage");

// POST /extract
router.post("/", async (req, res) => {
  const { subject, body } = req.body;

  if (!subject && !body) {
    return res.status(400).json({ error: "Provide at least subject or body" });
  }

  const emailId = `email_${Date.now()}`;
  const emailText = `${subject || ""}\n${body || ""}`.trim();
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
