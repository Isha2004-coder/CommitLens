/**
 * Thin ESM facade for repo-root tools (e.g. test_extractor.js).
 * Implementation lives in backend/utils/extractCommitmentOpenRouter.js — uses backend/node_modules only.
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { extractCommitment_bt: extractCommitment_bt_impl } = require(
  "./backend/utils/extractCommitmentOpenRouter.js"
);

export async function extractCommitment_bt(emailText_bt, emailId_bt) {
  return extractCommitment_bt_impl(emailText_bt, emailId_bt);
}
