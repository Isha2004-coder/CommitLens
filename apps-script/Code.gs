var BASE_URL = "https://popsicle-jukebox-oversleep.ngrok-free.dev";
var MY_EMAIL = "jsing138@asu.edu";

function getEmailBodyText_(message) {
  var plain = message.getPlainBody() || "";
  if (plain.replace(/\s/g, "").length > 0) return plain;
  var html = message.getBody() || "";
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function hasUsableEmailText_(subject, body) {
  var s = (subject || "").replace(/\s/g, "");
  var b = (body || "").replace(/\s/g, "");
  return s.length > 0 || b.length > 0;
}

function parseReplySubjectBody_(reply) {
  var text = String(reply || "").replace(/\r\n/g, "\n");
  var lines = text.split("\n");
  var subject = "CommitLens";
  var body = text;
  if (lines.length && /^subject\s*:/i.test(lines[0])) {
    subject = lines[0].replace(/^subject\s*:\s*/i, "").trim() || subject;
    var start = lines[1] === "" ? 2 : 1;
    body = lines.slice(start).join("\n").trim() || text;
  }
  return { subject: subject, body: body };
}

function buildGmailComposeUrl_(to, subject, body) {
  var q = "https://mail.google.com/mail/?view=cm&fs=1"
    + "&to=" + encodeURIComponent(to || "")
    + "&su=" + encodeURIComponent(subject || "")
    + "&body=" + encodeURIComponent(body || "");
  if (q.length > 1800) {
    q = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(to || "")
      + "&su=" + encodeURIComponent(subject || "")
      + "&body=" + encodeURIComponent((body || "").slice(0, 1200) + "\n\n[…truncated]");
  }
  return q;
}

function buildAddOn(e) {
  if (!e || !e.gmail || !e.gmail.messageId) return buildHomePage();
  var messageId = e.gmail.messageId;
  var message = GmailApp.getMessageById(messageId);
  var subject = (message.getSubject() || "").trim();
  var body = getEmailBodyText_(message);
  if (!hasUsableEmailText_(subject, body)) return buildCard(null);
  var sender = message.getFrom();
  var senderMatch = sender.match(/<(.+?)>/);
  var senderEmail = senderMatch ? senderMatch[1].trim() : sender.trim();
  var isMine = senderEmail.toLowerCase() === MY_EMAIL.toLowerCase();
  var replyToEmail = isMine ? "" : senderEmail;
  var messageDate = message.getDate();
  var result = sendToBackend(subject, body, isMine, messageDate);
  if (result) {
    result.isMine = isMine;
    result.replyToEmail = replyToEmail;
    if (result.deadline) {
      addToCalendar(result.task, result.deadline, isMine);
    }
  }
  return buildCard(result);
}

function buildHomePage() {
  var commitments = getAllCommitments();
  return buildListView(commitments);
}

function getAllCommitments() {
  var url = BASE_URL + "/commitments";
  Logger.log("Fetching from: " + url);
  try {
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { "ngrok-skip-browser-warning": "true", "User-Agent": "Mozilla/5.0" }
    });
    var code = response.getResponseCode();
    var text = response.getContentText();
    Logger.log("Response code: " + code);
    Logger.log("Response length: " + text.length);
    if (code !== 200) { Logger.log("GET /commitments failed: " + code); return []; }
    var data = JSON.parse(text);
    Logger.log("Parsed data length: " + data.length);
    if (!Array.isArray(data)) return [];
    var seen = {};
    var filtered = data.filter(function(c) {
      if (!c || !c.task) return false;
      if (c.status === "completed") return false;
      var key = c.id || c.task;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
    Logger.log("Filtered commitments: " + filtered.length);
    return filtered;
  } catch (err) { Logger.log("ERROR: " + err); return []; }
}

function sendToBackend(subject, body, isMine, messageDate) {
  var url = BASE_URL + "/extract";
  var bodyTrunc = (body || "").slice(0, 1500);
  var combined = (subject + "\n" + bodyTrunc).trim();
  var payload = {
    subject: subject,
    body: bodyTrunc,
    emailText: combined,
    isMine: isMine === true,
    userEmail: MY_EMAIL
  };
  if (messageDate) {
    try {
      payload.emailSentAt = messageDate instanceof Date
        ? messageDate.toISOString()
        : new Date(messageDate).toISOString();
    } catch (err) { Logger.log("emailSentAt omitted: " + err); }
  }
  try {
    var response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      headers: { "ngrok-skip-browser-warning": "true" }
    });
    var code = response.getResponseCode();
    var text = response.getContentText();
    if (code !== 200 && code !== 201) { Logger.log("POST /extract failed: " + code); return null; }
    var result = JSON.parse(text);
    if (!result.commitment) return null;
    return result.commitment;
  } catch (err) { Logger.log(err); return null; }
}

function getReply(task, deadline, isMine) {
  var url = BASE_URL + "/generate-reply";
  try {
    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ task: task, deadline: typeof deadline === "number" ? deadline : Number(deadline), isMine: isMine === true }),
      muteHttpExceptions: true,
      headers: { "ngrok-skip-browser-warning": "true" }
    });
    var code = res.getResponseCode();
    var text = res.getContentText();
    if (code !== 200) return "⚠️ Could not generate reply (HTTP " + code + ")";
    var result = JSON.parse(text);
    return result.reply || "⚠️ No reply in response";
  } catch (err) { Logger.log(err); return "⚠️ Failed to generate reply"; }
}

function buildListView(commitments) {
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle("📋 CommitLens (" + commitments.length + " pending)"));
  var section = CardService.newCardSection();
  if (!commitments.length) {
    section.addWidget(CardService.newTextParagraph().setText("✅ All caught up! No pending commitments."));
  } else {
    var showCount = Math.min(commitments.length, 5);
    for (var i = 0; i < showCount; i++) {
      var c = commitments[i];
      section.addWidget(CardService.newTextParagraph().setText("• <b>" + c.task + "</b><br>⏰ " + getDueText(c.deadline)));
      var actionResolve = CardService.newAction().setFunctionName("handleResolve").setParameters({ task: String(c.task), deadline: String(c.deadline), isMine: c.isMine === true ? "true" : "false", replyTo: "" });
      var actionCompose = CardService.newAction().setFunctionName("handleOpenCompose").setParameters({ task: String(c.task), deadline: String(c.deadline), isMine: c.isMine === true ? "true" : "false", replyTo: "" });
      var actionDone = CardService.newAction().setFunctionName("handleMarkDone").setParameters({ id: String(c.id || "") });
      section.addWidget(CardService.newTextButton().setText("Suggest reply").setOnClickAction(actionResolve));
      section.addWidget(CardService.newTextButton().setText("Open in Gmail (edit & send)").setOnClickAction(actionCompose));
      section.addWidget(CardService.newTextButton().setText("✓ Mark as Done").setOnClickAction(actionDone));
      section.addWidget(CardService.newDivider());
    }
    if (commitments.length > 5) {
      section.addWidget(CardService.newTextParagraph().setText("<i>...and " + (commitments.length - 5) + " more</i>"));
    }
  }
  card.addSection(section);
  return card.build();
}

function buildCard(result) {
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle("CommitLens"));
  var section = CardService.newCardSection();
  if (!result) {
    section.addWidget(CardService.newTextParagraph().setText("✅ No commitments found in this email."));
  } else {
    var label = result.isMine ? "⚠️ You committed to:" : "📩 They committed to you:";
    section.addWidget(CardService.newTextParagraph().setText(label + "<br><b>" + result.task + "</b>"));
    section.addWidget(CardService.newTextParagraph().setText("⏰ " + getDueText(result.deadline)));
    var replyTo = String(result.replyToEmail || "");
    var actionResolve = CardService.newAction().setFunctionName("handleResolve").setParameters({ task: String(result.task), deadline: String(result.deadline), isMine: result.isMine === true ? "true" : "false", replyTo: replyTo });
    var actionCompose = CardService.newAction().setFunctionName("handleOpenCompose").setParameters({ task: String(result.task), deadline: String(result.deadline), isMine: result.isMine === true ? "true" : "false", replyTo: replyTo });
    var actionDone = CardService.newAction().setFunctionName("handleMarkDone").setParameters({ id: String(result.id || "") });
    section.addWidget(CardService.newTextButton().setText(result.isMine ? "Suggest reply" : "Suggest follow-up").setOnClickAction(actionResolve));
    section.addWidget(CardService.newTextButton().setText("Open in Gmail (edit & send)").setOnClickAction(actionCompose));
    section.addWidget(CardService.newTextButton().setText("✓ Mark as Done").setOnClickAction(actionDone));
  }
  card.addSection(section);
  return card.build();
}

function handleResolve(e) {
  var task = e.parameters.task;
  var deadline = Number(e.parameters.deadline);
  var isMine = e.parameters.isMine === "true";
  var reply = getReply(task, deadline, isMine);
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle("CommitLens"));
  var section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph().setText("🤖 <b>Suggested reply:</b><br><br>" + String(reply).replace(/\n/g, "<br>")));
  var actionCompose = CardService.newAction().setFunctionName("handleOpenCompose").setParameters({ task: String(task), deadline: String(deadline), isMine: isMine ? "true" : "false", replyTo: String(e.parameters.replyTo || "") });
  section.addWidget(CardService.newTextButton().setText("Open in Gmail (edit & send)").setOnClickAction(actionCompose));
  card.addSection(section);
  return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().updateCard(card.build())).build();
}

function handleOpenCompose(e) {
  var task = e.parameters.task;
  var deadline = Number(e.parameters.deadline);
  var isMine = e.parameters.isMine === "true";
  var replyTo = String(e.parameters.replyTo || "");
  var reply = getReply(task, deadline, isMine);
  var parsed = parseReplySubjectBody_(reply);
  var url = buildGmailComposeUrl_(replyTo, parsed.subject, parsed.body);
  return CardService.newActionResponseBuilder().setOpenLink(CardService.newOpenLink().setUrl(url).setOpenAs(CardService.OpenAs.FULL_SIZE)).build();
}

function handleMarkDone(e) {
  var id = e.parameters.id;
  var url = BASE_URL + "/commitments/" + id;
  try {
    UrlFetchApp.fetch(url, {
      method: "patch",
      contentType: "application/json",
      payload: JSON.stringify({ status: "completed" }),
      muteHttpExceptions: true,
      headers: { "ngrok-skip-browser-warning": "true" }
    });
  } catch (err) { Logger.log(err); }
  var commitments = getAllCommitments();
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(buildListView(commitments)))
    .build();
}

function getDueText(deadline) {
  if (deadline === undefined || deadline === null || deadline === "") return "";
  var d = typeof deadline === "number" ? deadline : Number(deadline);
  if (isNaN(d)) return "";
  var diff = d - Date.now();
  if (diff < 0) return "🔴 Overdue";
  if (diff < 86400000) return "🟡 Due soon";
  return "🟢 Due on " + new Date(d).toLocaleDateString();
}

// ─── Calendar Integration ────────────────────────────────────────────────────

function addToCalendar(task, deadlineMs, isMine) {
  try {
    var deadline = new Date(deadlineMs);
    var start = new Date(deadline.getTime() - 30 * 60 * 1000);
    var title = (isMine ? "⚠️ You promised: " : "📩 Follow up: ") + task;
    var event = CalendarApp.getDefaultCalendar().createEvent(title, start, deadline);
    event.addPopupReminder(30);
    event.addPopupReminder(0);
    Logger.log("Calendar event created: " + title);
  } catch (err) {
    Logger.log("Calendar error: " + err);
  }
}

// ─── Background Scanner ──────────────────────────────────────────────────────

function scanRecentEmails() {
  var threads = GmailApp.getInboxThreads(0, 10);
  var processed = 0;
  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    var message = messages[messages.length - 1];
    var subject = (message.getSubject() || "").trim();
    var body = getEmailBodyText_(message);
    if (!hasUsableEmailText_(subject, body)) continue;
    var sender = message.getFrom();
    var senderMatch = sender.match(/<(.+?)>/);
    var senderEmail = senderMatch ? senderMatch[1].trim() : sender.trim();
    var isMine = senderEmail.toLowerCase() === MY_EMAIL.toLowerCase();
    var messageDate = message.getDate();
    var result = sendToBackend(subject, body, isMine, messageDate);
    if (result && result.deadline) {
      addToCalendar(result.task, result.deadline, isMine);
    }
    processed++;
    Utilities.sleep(10000);
  }
  Logger.log("[Scanner] Processed " + processed + " emails");
}

function setupHourlyTrigger() {
  ScriptApp.newTrigger("scanRecentEmails")
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log("Hourly trigger created");
}

function removeAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  Logger.log("All triggers removed");
}
