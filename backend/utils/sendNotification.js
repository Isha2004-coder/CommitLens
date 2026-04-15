const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

async function sendNotification(commitment) {
  const to = commitment.userEmail || process.env.GMAIL_USER;
  const deadlineStr = commitment.deadline
    ? new Date(commitment.deadline).toLocaleString("en-US", { timeZone: "America/Phoenix" })
    : "Unknown";

  const label = commitment.isMine
    ? "You committed to"
    : "They committed to you";

  console.log(`[NOTIFICATION] Sending missed commitment email to ${to}`);

  try {
    await transporter.sendMail({
      from: `"CommitLens" <${process.env.GMAIL_USER}>`,
      to,
      subject: `⚠️ Missed commitment: ${commitment.task}`,
      text: `Hi,\n\nCommitLens detected a missed commitment:\n\n${label}: ${commitment.task}\nDeadline was: ${deadlineStr} (Arizona time)\n\nOpen Gmail to follow up or generate a reply.\n\n— CommitLens`,
      html: `
        <div style="font-family:sans-serif;max-width:480px">
          <h2 style="color:#c0392b">⚠️ Missed Commitment</h2>
          <p><b>${label}:</b></p>
          <p style="font-size:18px;font-weight:bold">${commitment.task}</p>
          <p>⏰ Deadline was: <b>${deadlineStr}</b> (Arizona time)</p>
          <p style="color:#888;font-size:12px">Open Gmail to follow up or generate a reply using CommitLens.</p>
        </div>
      `,
    });
    console.log(`[NOTIFICATION] Email sent to ${to}`);
  } catch (err) {
    console.error("[NOTIFICATION] Failed to send email:", err.message);
  }
}

module.exports = { sendNotification };