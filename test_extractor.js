import "dotenv/config";
import { extractCommitment_bt } from "./extractor.js";

function assertShape_bt(result_bt, expectedEmailId_bt) {
  if (!result_bt || typeof result_bt !== 'object') {
    throw new Error('Expected non-null object from extractor');
  }
  if (result_bt.emailId !== expectedEmailId_bt) {
    throw new Error(`emailId mismatch: got ${result_bt.emailId}, expected ${expectedEmailId_bt}`);
  }
  if (typeof result_bt.task !== 'string' || !result_bt.task.trim()) {
    throw new Error('task must be a non-empty string');
  }
  if (typeof result_bt.deadline !== 'number' || Number.isNaN(result_bt.deadline)) {
    throw new Error('deadline must be a numeric timestamp (ms)');
  }
  if (result_bt.status !== 'pending') {
    throw new Error(`status should be "pending", got ${result_bt.status}`);
  }
  if (typeof result_bt.draftReply !== 'string') {
    throw new Error('draftReply must be a string');
  }
  if (typeof result_bt.id !== 'string' || !result_bt.id.trim()) {
    throw new Error('id must be a non-empty string');
  }
}

async function runTest_bt() {
  console.log('Running AI Extraction test...');

  const sampleEmail_bt =
    'Hey team, great meeting today. I will send you the final architecture diagram by tomorrow at 5 PM.';
  const emailId_bt = 'msg-12345';

  console.time('Extraction Time');
  const result_bt = await extractCommitment_bt(sampleEmail_bt, emailId_bt);
  console.timeEnd('Extraction Time');

  assertShape_bt(result_bt, emailId_bt);

  console.log('\nShape check: OK (matches storage / API expectations)');
  console.log('\nResult (as stored or returned to clients):');
  console.dir(result_bt, { depth: null, colors: true });
}

runTest_bt().catch((err_bt) => {
  console.error('Test failed:', err_bt.message);
  process.exit(1);
});