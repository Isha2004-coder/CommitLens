const { extractCommitment_bt } = require("./extractCommitmentOpenRouter");

async function extractCommitment(emailText, emailId) {
  return extractCommitment_bt(emailText, emailId);
}

module.exports = { extractCommitment };
