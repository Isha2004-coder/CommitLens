const { getPendingCommitments, updateCommitment } = require("../data/storage");
const { sendNotification } = require("../utils/sendNotification");

function startDeadlineChecker() {
  console.log("[Scheduler] Deadline checker started (runs every 5s)");

  setInterval(async () => {
    const now = Date.now();
    const pending = await getPendingCommitments();

    for (const commitment of pending) {
      if (now > commitment.deadline) {
        const updated = await updateCommitment(commitment.id, { status: "missed" });
        console.log(`[Scheduler] Marked as missed: ${commitment.id} — "${commitment.task}"`);
        sendNotification(updated);
      }
    }
  }, 5000);
}

module.exports = { startDeadlineChecker };