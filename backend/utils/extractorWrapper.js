const { extractCommitment_bt, extractCommitmentsBatch_bt } = require("./extractCommitmentOpenRouter");

async function extractCommitment(emailText, emailId, emailSentAt) {
  return extractCommitment_bt(emailText, emailId, emailSentAt);
}

async function extractCommitmentsBatch(emailItems) {
  return extractCommitmentsBatch_bt(emailItems);
}

module.exports = { extractCommitment, extractCommitmentsBatch };
