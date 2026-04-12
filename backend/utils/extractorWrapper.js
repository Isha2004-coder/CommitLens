async function extractCommitment(emailText, emailId) {
  const { extractCommitment_bt } = await import("../../extractor.js");
  return extractCommitment_bt(emailText, emailId);
}

module.exports = { extractCommitment };
