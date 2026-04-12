const express = require("express");
const router = express.Router();
const { extractCommitment } = require("../utils/extractorWrapper");

// POST /api/analyze-email  (matches Apps Script exactly)
router.post("/", async (req, res) => {
  const { emailId_bt, emailText_bt, emailDate_bt, userEmail } = req.body;

  if (!emailId_bt || !emailText_bt || !userEmail) {
    return res.status(400).json({ error: "Missing required fields: emailId_bt, emailText_bt, userEmail" });
  }

  const emailId = emailId_bt;
  const emailText = emailText_bt;

  let emailSentAt = undefined;
  if (emailDate_bt !== undefined && emailDate_bt !== null && emailDate_bt !== "") {
    const d = new Date(emailDate_bt);
    if (!Number.isNaN(d.getTime())) {
      emailSentAt = d;
    }
  }

  console.log(`[Analyze-Email] Processing for ${userEmail}: "${emailText.slice(0, 60)}..."`);

  // Extract commitment (NO auto-storage - Apps Script expects analysis only)
  const extracted = await extractCommitment(emailText, emailId, emailSentAt);

  if (!extracted) {
    console.log("[Analyze-Email] No commitment detected");
    return res.status(200).json({ data: null });
  }

  // Add userEmail to result for Apps Script
  extracted.userEmail = userEmail;

  console.log(`[Analyze-Email] Extracted: "${extracted.task}" for ${userEmail}`);
  
  // Match Apps Script expectation: {data: result}
  return res.status(200).json({ data: extracted });
});

module.exports = router;

