import { extractCommitment_bt } from './extractor.js';

async function runTest_bt() {
  console.log("Running AI Extraction test...");
  
  const sampleEmail_bt = "Hey team, great meeting today. I will send you the final architecture diagram by tomorrow at 5 PM.";
  
  console.time("Extraction Time");
  const result_bt = await extractCommitment_bt(sampleEmail_bt, "msg-12345");
  console.timeEnd("Extraction Time");
  
  console.log("\n📦 Result sent to Dev 3's DB:");
  console.dir(result_bt, { depth: null, colors: true });
}

runTest_bt();