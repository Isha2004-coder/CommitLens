/**
 * extractor.js lives at repo root and imports `openai` from ../node_modules.
 * Warn if the parent CommitLens install was skipped (common after only `cd backend && npm install`).
 */
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..", "..");
const openaiDir = path.join(repoRoot, "node_modules", "openai");

if (!fs.existsSync(openaiDir)) {
  console.warn(
    "\n[CommitLens] Missing %s\n  Run once from the CommitLens repo root:\n  cd .. && npm install\n",
    path.relative(process.cwd(), openaiDir)
  );
}
