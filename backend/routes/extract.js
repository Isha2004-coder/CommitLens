const express = require("express");
const router = express.Router();
const { extractCommitment } = require("../utils/extractCommitment");
const { createCommitment, getCommitmentById } = require("../data/storage");

// POST /extract
router.post("/", async (req, res) => {
  const { subject, body } = req.body;

  if (!subject && !body) {
    return res.status(400).json({ error: "Provide at least subject or body" });
  }

  const emailText = `${subject || ""}\n${body || ""}`.trim();
  console.log(`[Extract] Processing email: "${emailText.slice(0, 60)}..."`);

  const extracted = await extractCommitment(emailText);

  if (!extracted) {
    console.log("[Extract] No commitment detected");
    return res.status(200).json({ message: "No commitment detected" });
  }

  const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const emailId = `email_${Date.now()}`;

  if (await getCommitmentById(id)) {
    return res.status(409).json({ error: "Duplicate commitment ID generated, please retry" });
  }

  const commitment = {
    id,
    emailId,
    task: extracted.task,
    deadline: extracted.deadline,
    status: "pending",
    draftReply: extracted.draftReply || "",
  };

  await createCommitment(commitment);
  console.log(`[Extract] Commitment stored: ${id} — "${commitment.task.slice(0, 50)}"`);

  return res.status(201).json({ message: "Commitment extracted and stored", commitment });
});

module.exports = router;
