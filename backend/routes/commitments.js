const express = require("express");
const router = express.Router();
const { getAllCommitments, getCommitmentById, createCommitment, updateCommitment } = require("../data/storage");

// POST /commitments
router.post("/", async (req, res) => {
  const { id, emailId, task, deadline, status, draftReply } = req.body;

  if (!id || !emailId || !task || !deadline) {
    return res.status(400).json({ error: "Missing required fields: id, emailId, task, deadline" });
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
  };

  await createCommitment(commitment);
  console.log(`[POST] New commitment added: ${id} — "${task}"`);
  return res.status(201).json(commitment);
});

// GET /commitments
router.get("/", async (req, res) => {
  const { status } = req.query;
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
  const { status, draftReply } = req.body;

  if (!status && draftReply === undefined) {
    return res.status(400).json({ error: "Provide at least one field to update: status or draftReply" });
  }

  const updates = {};
  if (status) updates.status = status;
  if (draftReply !== undefined) updates.draftReply = draftReply;

  const updated = await updateCommitment(id, updates);
  if (!updated) {
    return res.status(404).json({ error: `Commitment with id "${id}" not found` });
  }

  console.log(`[PATCH] Updated commitment: ${id}`);
  return res.status(200).json(updated);
});

module.exports = router;