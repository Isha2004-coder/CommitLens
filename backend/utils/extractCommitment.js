// ─── DEV 2 Extractor Adapter ─────────────────────────────────────────────────
// Replace the body of this function with DEV 2's real OpenAI extractor call.
// Contract: receives emailText (string), returns a commitment object or null.
// ─────────────────────────────────────────────────────────────────────────────

async function extractCommitment(emailText) {
  // TODO: Replace this block with DEV 2's OpenAI extraction logic.
  // Expected return shape:
  // {
  //   task: "string",        — the commitment task detected
  //   deadline: <timestamp>, — Unix ms timestamp of deadline
  //   draftReply: "string"   — optional AI-generated reply draft
  // }
  // Return null if no commitment is detected.

  const commitmentKeywords = ["i'll", "i will", "i'll", "will send", "will share",
    "will complete", "will submit", "by tomorrow", "by end of day",
    "by friday", "promise", "going to send", "will get back"];

  const lower = emailText.toLowerCase();
  const found = commitmentKeywords.some((kw) => lower.includes(kw));

  if (!found) return null;

  return {
    task: emailText.slice(0, 120).trim(),
    deadline: Date.now() + 24 * 60 * 60 * 1000,
    draftReply: `Thank you for your email. I'll follow up as committed.`,
  };
}

module.exports = { extractCommitment };
