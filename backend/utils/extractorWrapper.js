const { extractCommitment_bt } = require("./extractCommitmentOpenRouter");

async function extractCommitment(emailText, emailId, emailSentAt) {
  return extractCommitment_bt(emailText, emailId, emailSentAt);
}

module.exports = { extractCommitment };
