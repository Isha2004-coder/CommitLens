function sendNotification(commitment) {
  console.log("=================================================");
  console.log("[NOTIFICATION] Missed commitment detected!");
  console.log(`  ID       : ${commitment.id}`);
  console.log(`  Email ID : ${commitment.emailId}`);
  console.log(`  Task     : ${commitment.task}`);
  console.log(`  Deadline : ${new Date(commitment.deadline).toLocaleString()}`);
  console.log(`  Status   : ${commitment.status}`);
  console.log("=================================================");
}

module.exports = { sendNotification };