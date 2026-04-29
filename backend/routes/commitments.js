const express = require("express");
const router = express.Router();
const { getAllCommitments, getCommitmentById, getCommitmentByEmailId, createCommitment, updateCommitment } = require("../data/storage");

// POST /commitments
router.post("/", async (req, res) => {
  const { id, emailId, task, deadline, status, draftReply, isMine, userEmail, calendarSynced, replyToEmail } = req.body;

  if (!id || !emailId || !task || !deadline) {
    return res.status(400).json({ error: "Missing required fields: id, emailId, task, deadline" });
  }

  const existingByEmail = await getCommitmentByEmailId(emailId);
  if (existingByEmail) {
    return res.status(200).json(existingByEmail);
  }

  if (await getCommitmentById(id)) {
    return res.status(409).json({ error: `Commitment with id "${id}" already exists` });
  }

  const commitment = {
    id,
    emailId,
    task,
    deadline,
    status: status || "pending",
    draftReply: draftReply || "",
    ...(isMine !== undefined && { isMine: isMine === true || isMine === "true" }),
    ...(userEmail && { userEmail }),
    ...(calendarSynced !== undefined && { calendarSynced: calendarSynced === true || calendarSynced === "true" }),
    ...(replyToEmail && { replyToEmail }),
  };

  const stored = await createCommitment(commitment);
  const created = stored.id === commitment.id;
  console.log(`[POST] ${created ? "New" : "Existing"} commitment returned: ${stored.id} — "${stored.task}"`);
  return res.status(created ? 201 : 200).json(stored);
});

// GET /commitments
router.get("/", async (req, res) => {
  const { status, emailId } = req.query;

  if (emailId) {
    const existing = await getCommitmentByEmailId(String(emailId));
    return res.status(200).json(existing || null);
  }

  let results = await getAllCommitments();

  if (status) {
    results = results.filter((c) => c.status === status);
  }

  console.log(`[GET] Returning ${results.length} commitment(s)${status ? ` with status="${status}"` : ""}`);
  return res.status(200).json(results);
});

// PATCH /commitments/:id
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { status, draftReply, calendarSynced, isMine, replyToEmail } = req.body;

  if (
    !status &&
    draftReply === undefined &&
    calendarSynced === undefined &&
    isMine === undefined &&
    replyToEmail === undefined
  ) {
    return res.status(400).json({ error: "Provide at least one field to update: status, draftReply, calendarSynced, isMine, or replyToEmail" });
  }

  const updates = {};
  if (status) updates.status = status;
  if (draftReply !== undefined) updates.draftReply = draftReply;
  if (calendarSynced !== undefined) updates.calendarSynced = calendarSynced === true;
  if (isMine !== undefined) updates.isMine = isMine === true || isMine === "true";
  if (replyToEmail !== undefined) updates.replyToEmail = replyToEmail;

  const updated = await updateCommitment(id, updates);
  if (!updated) {
    return res.status(404).json({ error: `Commitment with id "${id}" not found` });
  }

  console.log(`[PATCH] Updated commitment: ${id}`);
  return res.status(200).json(updated);
});

module.exports = router;
