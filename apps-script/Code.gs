var BASE_URL = "https://popsicle-jukebox-oversleep.ngrok-free.dev";
var MY_EMAIL = "jsing138@asu.edu";
var DEFAULT_SCAN_COUNT = 10;
var MAX_SCAN_COUNT = 50;
var MAX_RESULT_PREVIEW_COUNT = 2;
var HOME_TRACKED_LIMIT = 3;
var EMAIL_ANALYSIS_CACHE_TTL_SECS = 21600;

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

function parsePositiveInt_(value, fallback) {
  var parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, MAX_SCAN_COUNT);
}

function getFormInputValue_(e, fieldName) {
  var formInputs = e && e.commonEventObject && e.commonEventObject.formInputs;
  var field = formInputs && formInputs[fieldName];
  if (!field || !field.stringInputs || !field.stringInputs.value) return "";
  return field.stringInputs.value.length ? String(field.stringInputs.value[0]) : "";
}

function getSenderEmail_(sender) {
  var raw = String(sender || "").trim();
  var senderMatch = raw.match(/<(.+?)>/);
  return senderMatch ? senderMatch[1].trim() : raw;
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

function truncateText_(text, maxLen) {
  var value = String(text || "").trim();
  if (!value || value.length <= maxLen) return value;
  return value.slice(0, Math.max(0, maxLen - 1)).trim() + "…";
}

function escapeHtml_(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatCompactDueText_(deadline) {
  if (deadline === undefined || deadline === null || deadline === "") return "";
  var d = typeof deadline === "number" ? deadline : Number(deadline);
  if (isNaN(d)) return "";
  var diff = d - Date.now();
  if (diff < 0) return "Overdue";
  if (diff < 86400000) return "Due soon";
  return "Due " + new Date(d).toLocaleDateString();
}

function buildCompactSummaryLine_(scanSummary) {
  if (!scanSummary) return "";
  return "Scanned " + scanSummary.scannedCount
    + " • Found " + scanSummary.commitmentsFound
    + " • Ignored " + scanSummary.noCommitmentCount;
}

function buildEndOfDay_(dateObj) {
  var d = new Date(dateObj.getTime());
  d.setHours(17, 0, 0, 0);
  return d;
}

function resolveWeekdayDeadline_(weekdayName, referenceDate) {
  var weekdays = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };
  var target = weekdays[String(weekdayName || "").toLowerCase()];
  if (target === undefined) return null;
  var base = new Date(referenceDate.getTime());
  var current = base.getDay();
  var delta = (target - current + 7) % 7;
  base.setDate(base.getDate() + delta);
  return buildEndOfDay_(base);
}

function extractSimpleDeadline_(subject, body, messageDate) {
  var text = (String(subject || "") + "\n" + String(body || "")).toLowerCase();
  var referenceDate = messageDate instanceof Date ? new Date(messageDate.getTime()) : new Date();

  if (/\bdue\s+tomorrow\b|\bby\s+tomorrow\b/.test(text)) {
    referenceDate.setDate(referenceDate.getDate() + 1);
    return buildEndOfDay_(referenceDate);
  }

  if (/\bdue\s+today\b|\bby\s+today\b/.test(text)) {
    return buildEndOfDay_(referenceDate);
  }

  var weekdayMatch = text.match(/\b(?:due|by)\s+(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekdayMatch) {
    return resolveWeekdayDeadline_(weekdayMatch[1], referenceDate);
  }

  var dateMatch = text.match(/\b(?:due|by)\s+(?:on\s+)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
  if (dateMatch) {
    var parsed = dateMatch[1];
    var full = parsed.split("/");
    var month = parseInt(full[0], 10) - 1;
    var day = parseInt(full[1], 10);
    var year = full[2] ? parseInt(full[2], 10) : referenceDate.getFullYear();
    if (year < 100) year += 2000;
    return buildEndOfDay_(new Date(year, month, day));
  }

  return null;
}

function extractSimpleTask_(subject, body) {
  var source = String(subject || "").trim() || String(body || "").trim();
  if (!source) return "";
  var cleaned = source
    .replace(/\b(?:task\s+)?due\s+(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)\b/ig, "")
    .replace(/\bby\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)\b/ig, "")
    .replace(/\b(?:task\s+)?due\s+(?:on\s+)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/ig, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:,-]+|[\s:,-]+$/g, "");

  if (!cleaned) {
    cleaned = source;
  }

  return truncateText_(cleaned, 72);
}

function tryFastExtractCommitment_(message, subject, body, isMine, replyToEmail) {
  var deadlineDate = extractSimpleDeadline_(subject, body, message.getDate());
  if (!deadlineDate) return null;

  var task = extractSimpleTask_(subject, body);
  if (!task) task = "Complete task";

  return {
    id: "local_" + message.getId(),
    emailId: message.getId(),
    task: task,
    deadline: deadlineDate.getTime(),
    status: "pending",
    draftReply: "",
    created: true,
    alreadyExisted: false,
    isMine: isMine,
    replyToEmail: replyToEmail,
    sourceSubject: subject,
    sourceEmailId: message.getId()
  };
}

function getAnalysisCacheKey_(messageId) {
  return "analysis:" + String(messageId || "");
}

function getCachedEmailAnalysis_(messageId) {
  if (!messageId) return null;
  try {
    var raw = CacheService.getUserCache().get(getAnalysisCacheKey_(messageId));
    if (!raw) return null;
    if (raw === "__NONE__") return { found: false };
    var parsed = JSON.parse(raw);
    return parsed ? { found: true, result: parsed } : null;
  } catch (err) {
    Logger.log("Cache read error: " + err);
    return null;
  }
}

function setCachedEmailAnalysis_(messageId, result) {
  if (!messageId) return;
  try {
    var cache = CacheService.getUserCache();
    if (!result) {
      cache.put(getAnalysisCacheKey_(messageId), "__NONE__", EMAIL_ANALYSIS_CACHE_TTL_SECS);
      return;
    }
    cache.put(
      getAnalysisCacheKey_(messageId),
      JSON.stringify(result),
      EMAIL_ANALYSIS_CACHE_TTL_SECS
    );
  } catch (err) {
    Logger.log("Cache write error: " + err);
  }
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
  var result = analyzeMessage_(message);
  syncCalendarForCommitment_(result);
  return buildCard(result, message);
}

function buildHomePage() {
  // Just show commitments directly, skip the loading screen
  var commitments = getAllCommitments();
  return buildListView(commitments);
}

function scanAndRefreshHome() {
  var requestedCount = parsePositiveInt_(getFormInputValue_(arguments[0], "scanCount"), DEFAULT_SCAN_COUNT);
  var scanSummary = scanVisibleEmails(requestedCount);
  // Show the commitments directly after scanning
  var commitments = getAllCommitments();
  return CardService.newActionResponseBuilder()
    .setStateChanged(true)
    .setNavigation(CardService.newNavigation().updateCard(buildListView(commitments, scanSummary)))
    .build();
}

function scanVisibleEmails(scanCount) {
  return scanInboxEmails_(scanCount, 0);
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

function getCommitmentByEmailId_(messageId) {
  if (!messageId) return null;
  var url = BASE_URL + "/commitments?emailId=" + encodeURIComponent(messageId);
  try {
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { "ngrok-skip-browser-warning": "true", "User-Agent": "Mozilla/5.0" }
    });
    if (response.getResponseCode() !== 200) return null;
    var text = response.getContentText();
    if (!text) return null;
    var parsed = JSON.parse(text);
    return parsed || null;
  } catch (err) {
    Logger.log("Lookup by emailId failed: " + err);
    return null;
  }
}

function markCalendarSynced_(id) {
  if (!id) return;
  var url = BASE_URL + "/commitments/" + id;
  try {
    UrlFetchApp.fetch(url, {
      method: "patch",
      contentType: "application/json",
      payload: JSON.stringify({ calendarSynced: true }),
      muteHttpExceptions: true,
      headers: { "ngrok-skip-browser-warning": "true" }
    });
  } catch (err) {
    Logger.log("Failed to mark calendar synced: " + err);
  }
}

function storeCommitmentDirectly_(commitment) {
  if (!commitment || !commitment.id || !commitment.emailId || !commitment.task || !commitment.deadline) {
    return commitment;
  }
  var url = BASE_URL + "/commitments";
  try {
    var response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        id: commitment.id,
        emailId: commitment.emailId,
        task: commitment.task,
        deadline: commitment.deadline,
        status: commitment.status || "pending",
        draftReply: commitment.draftReply || "",
        isMine: commitment.isMine === true,
        userEmail: MY_EMAIL,
        calendarSynced: commitment.calendarSynced === true,
        replyToEmail: commitment.replyToEmail || ""
      }),
      muteHttpExceptions: true,
      headers: { "ngrok-skip-browser-warning": "true" }
    });
    var code = response.getResponseCode();
    if (code !== 200 && code !== 201) return commitment;
    var text = response.getContentText();
    if (!text) return commitment;
    var parsed = JSON.parse(text);
    if (!parsed) return commitment;
    parsed.created = code === 201;
    parsed.alreadyExisted = code === 200;
    parsed.isMine = commitment.isMine;
    parsed.replyToEmail = commitment.replyToEmail;
    parsed.sourceSubject = commitment.sourceSubject;
    parsed.sourceEmailId = commitment.sourceEmailId;
    return parsed;
  } catch (err) {
    Logger.log("Direct commitment store failed: " + err);
    return commitment;
  }
}

function syncCalendarForCommitment_(commitment) {
  if (!commitment || !commitment.deadline) return;
  if (commitment.calendarSynced === true) return;
  var created = addToCalendar(commitment.task, commitment.deadline, commitment.isMine === true);
  if (created) {
    commitment.calendarSynced = true;
    markCalendarSynced_(commitment.id);
  }
}

function exponentialBackoff(maxRetries, baseDelay, func) {
  for (var i = 0; i < maxRetries; i++) {
    try {
      return func();
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      var delay = baseDelay * Math.pow(2, i);
      Logger.log("Retrying in " + delay + "ms due to: " + e.toString());
      Utilities.sleep(delay);
    }
  }
}

function sendToBackend(subject, body, isMine, messageDate, emailId) {
  var url = BASE_URL + "/extract";
  var bodyTrunc = (body || "").slice(0, 1500);
  var combined = (subject + "\n" + bodyTrunc).trim();
  var payload = {
    subject: subject,
    body: bodyTrunc,
    emailText: combined,
    isMine: isMine === true,
    userEmail: MY_EMAIL,
    emailId: emailId || ""
  };
  if (messageDate) {
    try {
      payload.emailSentAt = messageDate instanceof Date
        ? messageDate.toISOString()
        : new Date(messageDate).toISOString();
    } catch (err) { Logger.log("emailSentAt omitted: " + err); }
  }
  return exponentialBackoff(5, 2000, function() {
    var response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      headers: { "ngrok-skip-browser-warning": "true" }
    });
    var code = response.getResponseCode();
    var text = response.getContentText();
    
    if (code === 429 || code === 503 || text.includes("Bandwidth quota exceeded")) {
      throw new Error("Rate limit or bandwidth exceeded: " + code);
    }
    
    if (code !== 200 && code !== 201) { 
      Logger.log("POST /extract failed: " + code); 
      return null; 
    }
    var result = JSON.parse(text);
    if (!result.commitment) return null;
    result.commitment.created = result.created === true;
    result.commitment.alreadyExisted = result.alreadyExisted === true;
    return result.commitment;
  });
}

function sendBatchToBackend_(emailItems) {
  if (!emailItems || !emailItems.length) return [];
  var url = BASE_URL + "/extract/batch";
  var payload = {
    emails: emailItems.map(function(item) {
      return {
        emailId: item.emailId,
        subject: item.subject,
        body: item.body,
        isMine: item.isMine === true,
        userEmail: MY_EMAIL,
        emailSentAt: item.messageDate instanceof Date
          ? item.messageDate.toISOString()
          : String(item.messageDate || "")
      };
    })
  };

  return exponentialBackoff(3, 1000, function() {
    var response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      headers: { "ngrok-skip-browser-warning": "true" }
    });
    var code = response.getResponseCode();
    var text = response.getContentText();
    if (code === 429 || code === 503 || text.indexOf("Bandwidth quota exceeded") !== -1) {
      throw new Error("Tunnel bandwidth quota exceeded");
    }
    if (code !== 200) {
      throw new Error("POST /extract/batch failed: " + code);
    }

    var parsed = JSON.parse(text);
    var rawResults = parsed && parsed.results;
    if (!rawResults || !rawResults.length) return [];

    return rawResults.map(function(entry) {
      if (!entry) return null;
      var commitment = entry.commitment || null;
      if (commitment) {
        commitment.created = entry.created === true;
        commitment.alreadyExisted = entry.alreadyExisted === true;
      }
      return {
        emailId: entry.emailId || "",
        commitment: commitment,
        created: entry.created === true,
        alreadyExisted: entry.alreadyExisted === true
      };
    });
  });
}

function analyzeMessage_(message) {
  var subject = (message.getSubject() || "").trim();
  var body = getEmailBodyText_(message);
  if (!hasUsableEmailText_(subject, body)) return null;
  var messageId = message.getId();
  var cached = getCachedEmailAnalysis_(messageId);
  if (cached) {
    return cached.found ? cached.result : null;
  }
  var senderEmail = getSenderEmail_(message.getFrom());
  var isMine = senderEmail.toLowerCase() === MY_EMAIL.toLowerCase();
  var replyToEmail = isMine ? "" : senderEmail;
  var existing = getCommitmentByEmailId_(messageId);
  if (existing) {
    existing.created = false;
    existing.alreadyExisted = true;
    existing.isMine = isMine;
    existing.replyToEmail = replyToEmail;
    existing.sourceSubject = subject;
    existing.sourceEmailId = messageId;
    setCachedEmailAnalysis_(messageId, existing);
    return existing;
  }
  var fastResult = tryFastExtractCommitment_(message, subject, body, isMine, replyToEmail);
  if (fastResult) {
    var storedFastResult = storeCommitmentDirectly_(fastResult);
    setCachedEmailAnalysis_(messageId, storedFastResult);
    return storedFastResult;
  }
  var result = sendToBackend(subject, body, isMine, message.getDate(), messageId);
  if (!result) {
    setCachedEmailAnalysis_(messageId, null);
    return null;
  }
  result.isMine = isMine;
  result.replyToEmail = replyToEmail;
  result.sourceSubject = subject;
  result.sourceEmailId = messageId;
  setCachedEmailAnalysis_(messageId, result);
  return result;
}

function scanInboxEmails_(scanCount, sleepMs) {
  var requestedCount = parsePositiveInt_(scanCount, DEFAULT_SCAN_COUNT);
  var threads = GmailApp.getInboxThreads(0, requestedCount);
  var summary = {
    requestedCount: requestedCount,
    scannedCount: 0,
    commitmentsFound: 0,
    newCommitments: 0,
    existingCommitments: 0,
    noCommitmentCount: 0,
    error: "",
    items: []
  };

  var batchItems = [];

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    if (!messages.length) continue;

    var message = messages[messages.length - 1];
    var subject = (message.getSubject() || "").trim();
    var body = getEmailBodyText_(message);
    if (!hasUsableEmailText_(subject, body)) continue;
    var senderEmail = getSenderEmail_(message.getFrom());
    var isMine = senderEmail.toLowerCase() === MY_EMAIL.toLowerCase();
    batchItems.push({
      emailId: message.getId(),
      subject: subject,
      body: (body || "").slice(0, 700),
      isMine: isMine,
      messageDate: message.getDate(),
      sourceSubject: subject
    });
    summary.scannedCount++;
  }

  var batchResults = [];
  try {
    batchResults = sendBatchToBackend_(batchItems);
  } catch (err) {
    summary.error = String(err);
    Logger.log("[Scanner] Batch scan failed: " + err);
    return summary;
  }
  for (var j = 0; j < batchItems.length; j++) {
    var sourceItem = batchItems[j];
    var batchEntry = batchResults[j];
    var result = batchEntry && batchEntry.commitment;

    if (!result) {
      summary.noCommitmentCount++;
      setCachedEmailAnalysis_(sourceItem.emailId, null);
      summary.items.push({
        subject: sourceItem.sourceSubject || "",
        found: false
      });
      continue;
    }

    result.isMine = sourceItem.isMine;
    result.sourceSubject = sourceItem.sourceSubject;
    setCachedEmailAnalysis_(sourceItem.emailId, result);
    summary.commitmentsFound++;
    if (result.created) {
      summary.newCommitments++;
    } else {
      summary.existingCommitments++;
    }
    summary.items.push({
      task: result.task,
      deadline: result.deadline,
      subject: result.sourceSubject || "",
      isMine: result.isMine === true,
      created: result.created === true,
      found: true
    });
    syncCalendarForCommitment_(result);
  }

  Logger.log("[Scanner] Requested " + requestedCount + ", scanned " + summary.scannedCount + ", found " + summary.commitmentsFound);
  return summary;
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

function buildListView(commitments, scanSummary) {
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle("CommitLens"));
  var section = CardService.newCardSection();
  
  section.addWidget(
    CardService.newTextInput()
      .setFieldName("scanCount")
      .setTitle("Emails to scan")
      .setHint("Enter a number like 10")
      .setValue(String(scanSummary && scanSummary.requestedCount ? scanSummary.requestedCount : DEFAULT_SCAN_COUNT))
  );

  var scanAction = CardService.newAction().setFunctionName("scanAndRefreshHome");
  section.addWidget(CardService.newTextButton().setText("Scan inbox").setOnClickAction(scanAction));
  section.addWidget(CardService.newDivider());

  if (scanSummary) {
    if (scanSummary.error) {
      section.addWidget(
        CardService.newTextParagraph().setText(
          "<b>Scan error</b><br>" + escapeHtml_(scanSummary.error)
        )
      );
      section.addWidget(CardService.newDivider());
    }
    var lastScanText = "<b>Last scan</b><br>"
      + escapeHtml_(buildCompactSummaryLine_(scanSummary))
      + "<br><font color=\"#5f6368\">New " + scanSummary.newCommitments + " • Already tracked " + scanSummary.existingCommitments + "</font>";
    section.addWidget(CardService.newTextParagraph().setText(lastScanText));

    var foundItems = scanSummary.items.filter(function(item) { return item.found; });
    if (foundItems.length) {
      var foundPreview = [];
      var foundLimit = Math.min(foundItems.length, MAX_RESULT_PREVIEW_COUNT);
      for (var j = 0; j < foundLimit; j++) {
        var item = foundItems[j];
        foundPreview.push(
          "• <b>" + escapeHtml_(truncateText_(item.task, 60)) + "</b> <font color=\"#188038\">"
          + escapeHtml_(formatCompactDueText_(item.deadline)) + "</font>"
        );
      }
      var foundText = "<b>Latest from scan</b><br>" + foundPreview.join("<br>");
      if (foundItems.length > MAX_RESULT_PREVIEW_COUNT) {
        foundText += "<br><font color=\"#5f6368\">+" + (foundItems.length - MAX_RESULT_PREVIEW_COUNT) + " more</font>";
      }
      section.addWidget(CardService.newTextParagraph().setText(foundText));
    }

    section.addWidget(CardService.newDivider());
  }

  section.addWidget(
    CardService.newTextParagraph().setText(
      "<b>Tracked commitments</b><br><font color=\"#5f6368\">" + commitments.length + " pending</font>"
    )
  );

  if (!commitments.length) {
    section.addWidget(CardService.newTextParagraph().setText("✅ All caught up! No pending commitments."));
  } else {
    var showCount = Math.min(commitments.length, HOME_TRACKED_LIMIT);
    for (var i = 0; i < showCount; i++) {
      var c = commitments[i];
      section.addWidget(
        CardService.newTextParagraph().setText(
          "<b>" + escapeHtml_(truncateText_(c.task, 62)) + "</b><br><font color=\"#188038\">"
          + escapeHtml_(formatCompactDueText_(c.deadline)) + "</font>"
        )
      );
      var actionResolve = CardService.newAction().setFunctionName("handleResolve").setParameters({ task: String(c.task), deadline: String(c.deadline), isMine: c.isMine === true ? "true" : "false", replyTo: "" });
      var actionCompose = CardService.newAction().setFunctionName("handleOpenCompose").setParameters({ task: String(c.task), deadline: String(c.deadline), isMine: c.isMine === true ? "true" : "false", replyTo: "" });
      var actionDone = CardService.newAction().setFunctionName("handleMarkDone").setParameters({ id: String(c.id || "") });
      section.addWidget(
        CardService.newButtonSet()
          .addButton(CardService.newTextButton().setText(c.isMine === true ? "Update" : "Reply").setOnClickAction(actionResolve))
          .addButton(CardService.newTextButton().setText("Open").setOnClickAction(actionCompose))
          .addButton(CardService.newTextButton().setText("Done").setOnClickAction(actionDone))
      );
      section.addWidget(CardService.newDivider());
    }
    if (commitments.length > HOME_TRACKED_LIMIT) {
      section.addWidget(CardService.newTextParagraph().setText("<font color=\"#5f6368\">+" + (commitments.length - HOME_TRACKED_LIMIT) + " more tracked commitments</font>"));
    }
  }
  card.addSection(section);
  return card.build();
}

function buildCard(result, message) {
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle("CommitLens"));
  var section = CardService.newCardSection();
  if (message) {
    var clickedSubject = (message.getSubject() || "").trim() || "(No subject)";
    section.addWidget(CardService.newTextParagraph().setText("<font color=\"#5f6368\">Selected email</font><br><b>" + escapeHtml_(truncateText_(clickedSubject, 72)) + "</b>"));
    section.addWidget(CardService.newDivider());
  }
  if (!result) {
    section.addWidget(CardService.newTextParagraph().setText("✅ No commitments found in this email."));
  } else {
    var label = result.isMine ? "You committed" : "Needs follow-up";
    section.addWidget(CardService.newTextParagraph().setText("<font color=\"#5f6368\">" + label + "</font><br><b>" + escapeHtml_(truncateText_(result.task, 72)) + "</b>"));
    section.addWidget(CardService.newTextParagraph().setText("<font color=\"#188038\">" + escapeHtml_(formatCompactDueText_(result.deadline)) + "</font>"));
    if (result.created === false) {
      section.addWidget(CardService.newTextParagraph().setText("<i>This commitment was already tracked from an earlier scan.</i>"));
    }
    var replyTo = String(result.replyToEmail || "");
    var actionResolve = CardService.newAction().setFunctionName("handleResolve").setParameters({ task: String(result.task), deadline: String(result.deadline), isMine: result.isMine === true ? "true" : "false", replyTo: replyTo });
    var actionCompose = CardService.newAction().setFunctionName("handleOpenCompose").setParameters({ task: String(result.task), deadline: String(result.deadline), isMine: result.isMine === true ? "true" : "false", replyTo: replyTo });
    var actionDone = CardService.newAction().setFunctionName("handleMarkDone").setParameters({ id: String(result.id || "") });
    section.addWidget(
      CardService.newButtonSet()
        .addButton(CardService.newTextButton().setText(result.isMine ? "Update" : "Reply").setOnClickAction(actionResolve))
        .addButton(CardService.newTextButton().setText("Open").setOnClickAction(actionCompose))
        .addButton(CardService.newTextButton().setText("Done").setOnClickAction(actionDone))
    );
  }
  card.addSection(section);
  return card.build();
}

function handleResolve(e) {
  var task = e.parameters.task;
  var deadline = Number(e.parameters.deadline);
  var isMine = e.parameters.isMine === "true";
  var reply = getReply(task, deadline, isMine);
  var parsed = parseReplySubjectBody_(reply);
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle("CommitLens"));
  var section = CardService.newCardSection();

  section.addWidget(
    CardService.newTextParagraph().setText(
      "<font color=\"#5f6368\">" + (isMine ? "Draft update" : "Suggested reply") + "</font><br><b>"
      + escapeHtml_(truncateText_(parsed.subject || "CommitLens", 72))
      + "</b>"
    )
  );
  section.addWidget(CardService.newDivider());
  section.addWidget(
    CardService.newTextParagraph().setText(
      "<font color=\"#5f6368\">Message</font><br>"
      + escapeHtml_(String(parsed.body || "").trim()).replace(/\n/g, "<br>")
    )
  );

  var actionCompose = CardService.newAction().setFunctionName("handleOpenCompose").setParameters({ task: String(task), deadline: String(deadline), isMine: isMine ? "true" : "false", replyTo: String(e.parameters.replyTo || "") });
  section.addWidget(
    CardService.newButtonSet()
      .addButton(CardService.newTextButton().setText(isMine ? "Open draft" : "Open in Gmail").setOnClickAction(actionCompose))
  );
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
    return true;
  } catch (err) {
    Logger.log("Calendar error: " + err);
    return false;
  }
}

// ─── Background Scanner ──────────────────────────────────────────────────────

function scanRecentEmails() {
  var summary = scanInboxEmails_(DEFAULT_SCAN_COUNT, 10000);
  Logger.log("[Background Scanner] Requested " + summary.requestedCount + ", scanned " + summary.scannedCount + ", found " + summary.commitmentsFound);
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
