const express = require("express");
const router = express.Router();
const { extractCommitment, extractCommitmentsBatch } = require("../utils/extractorWrapper");
const { createCommitment, getCommitmentByEmailId, getCommitmentById } = require("../data/storage");

function parseOptionalIsMine(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function buildStoredCommitment(rawCommitment, isMineFlag, userEmail) {
  return {
    ...rawCommitment,
    ...(isMineFlag !== undefined && { isMine: isMineFlag }),
    ...(userEmail && { userEmail }),
  };
}

async function storeOrReuseCommitment(commitment, isMineFlag, userEmail) {
  const toStore = buildStoredCommitment(commitment, isMineFlag, userEmail);
  const storedCommitment = await createCommitment(toStore);
  const created = storedCommitment.id === toStore.id;
  return {
    commitment: storedCommitment,
    created,
    alreadyExisted: !created,
  };
}

router.post("/batch", async (req, res) => {
  const rawItems = req.body && Array.isArray(req.body.emails) ? req.body.emails : [];
  if (!rawItems.length) {
    return res.status(400).json({ error: "Provide emails[]" });
  }

  const normalized = rawItems
    .map((item) => {
      const subject = typeof item.subject === "string" ? item.subject.trim() : "";
      const body = typeof item.body === "string" ? item.body.trim() : "";
      const emailId = typeof item.emailId === "string" ? item.emailId.trim() : "";
      const userEmail = typeof item.userEmail === "string" ? item.userEmail.trim() : undefined;
      const isMineFlag = parseOptionalIsMine(item.isMine);
      const emailText = `${subject}\n${body}`.trim();
      if (!emailId || !emailText) return null;

      let emailSentAt = undefined;
      if (item.emailSentAt !== undefined && item.emailSentAt !== null && item.emailSentAt !== "") {
        const d = new Date(item.emailSentAt);
        if (!Number.isNaN(d.getTime())) {
          emailSentAt = d;
        }
      }

      return {
        emailId,
        subject,
        body,
        emailText,
        emailSentAt,
        isMineFlag,
        userEmail,
      };
    })
    .filter(Boolean);

  if (!normalized.length) {
    return res.status(400).json({ error: "No valid emails to scan" });
  }

  const results = new Array(normalized.length).fill(null);
  const toExtract = [];
  const extractionIndexes = [];

  for (let i = 0; i < normalized.length; i++) {
    const item = normalized[i];
    const existing = await getCommitmentByEmailId(item.emailId);
    if (existing) {
      results[i] = {
        emailId: item.emailId,
        commitment: existing,
        created: false,
        alreadyExisted: true,
      };
      continue;
    }
    toExtract.push({
      emailId: item.emailId,
      subject: item.subject,
      body: item.body,
      emailSentAt: item.emailSentAt,
    });
    extractionIndexes.push(i);
  }

  if (toExtract.length) {
    const extractedBatch = await extractCommitmentsBatch(toExtract);

    for (let j = 0; j < extractionIndexes.length; j++) {
      const resultIndex = extractionIndexes[j];
      const sourceItem = normalized[resultIndex];
      const extracted = extractedBatch[j];

      if (!extracted) {
        results[resultIndex] = {
          emailId: sourceItem.emailId,
          commitment: null,
          created: false,
          alreadyExisted: false,
        };
        continue;
      }

      if (await getCommitmentById(extracted.id)) {
        extracted.id = `${extracted.id}_${Date.now()}_${j}`;
      }

      const stored = await storeOrReuseCommitment(
        extracted,
        sourceItem.isMineFlag,
        sourceItem.userEmail
      );

      results[resultIndex] = {
        emailId: sourceItem.emailId,
        commitment: stored.commitment,
        created: stored.created,
        alreadyExisted: stored.alreadyExisted,
      };
    }
  }

  return res.status(200).json({ results });
});

// POST /extract
router.post("/", async (req, res) => {
  const raw = req.body || {};
  const { subject, body, emailText: emailTextField } = raw;
  const isMineFlag = parseOptionalIsMine(raw.isMine);
  const userEmail = typeof raw.userEmail === "string" ? raw.userEmail.trim() : undefined;
  const providedEmailId =
    typeof raw.emailId === "string" && raw.emailId.trim()
      ? raw.emailId.trim()
      : `email_${Date.now()}`;

  const sub = typeof subject === "string" ? subject.trim() : "";
  const bod = typeof body === "string" ? body.trim() : "";
  const single =
    typeof emailTextField === "string" ? emailTextField.trim() : "";

  const emailText = (single || `${sub}\n${bod}`).trim();

  if (!emailText) {
    return res.status(400).json({ error: "Provide at least subject or body" });
  }

  const existingByEmailId = await getCommitmentByEmailId(providedEmailId);
  if (existingByEmailId) {
    return res.status(200).json({
      message: "Commitment already tracked for this email",
      commitment: existingByEmailId,
      created: false,
      alreadyExisted: true,
    });
  }

  const emailId = providedEmailId;
  console.log(`[Extract] Processing email: "${emailText.slice(0, 60)}..."`);

  const sentRaw =
    raw.emailSentAt ?? raw.messageDate ?? raw.emailDate ?? raw.emailDate_bt;
  let emailSentAt = undefined;
  if (sentRaw !== undefined && sentRaw !== null && sentRaw !== "") {
    const d = new Date(sentRaw);
    if (!Number.isNaN(d.getTime())) {
      emailSentAt = d;
    }
  }

  const extracted = await extractCommitment(emailText, emailId, emailSentAt);

  if (!extracted) {
    console.log("[Extract] No commitment detected");
    return res.status(200).json({ message: "No commitment detected" });
  }

  if (await getCommitmentById(extracted.id)) {
    return res.status(409).json({ error: "Duplicate commitment ID, please retry" });
  }

  const stored = await storeOrReuseCommitment(extracted, isMineFlag, userEmail);
  console.log(
    `[Extract] Commitment ${stored.created ? "stored" : "reused"}: ${stored.commitment.id} — "${stored.commitment.task.slice(0, 50)}"`
  );

  return res.status(stored.created ? 201 : 200).json({
    message: stored.created ? "Commitment extracted and stored" : "Matching commitment already tracked",
    commitment: stored.commitment,
    created: stored.created,
    alreadyExisted: stored.alreadyExisted,
  });
});

module.exports = router;
