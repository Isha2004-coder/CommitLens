/**
 * OpenRouter + OpenAI SDK — runs entirely under backend/ (no repo-root node_modules).
 * Env: OPENAI_API_KEY (loaded by server.js via dotenv before first extract).
 */
const OpenAI = require("openai");

let _queue = Promise.resolve();
let _lastCallAt = 0;
const MIN_GAP_MS = 1000;

function enqueueAI(fn) {
  _queue = _queue.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - _lastCallAt);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    _lastCallAt = Date.now();
    return fn();
  });
  return _queue;
}

const openai_bt = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

function parseJsonResponse_(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    throw new Error("Empty AI response");
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }
    throw err;
  }
}

function resolveReferenceInstant(emailSentAt_bt) {
  if (emailSentAt_bt === undefined || emailSentAt_bt === null) {
    return { date: new Date(), source: "analysis_time" };
  }
  const d =
    emailSentAt_bt instanceof Date
      ? emailSentAt_bt
      : new Date(emailSentAt_bt);
  if (Number.isNaN(d.getTime())) {
    return { date: new Date(), source: "analysis_time_invalid_sent_at" };
  }
  return { date: d, source: "email_sent_time" };
}

async function extractCommitment_bt(emailText_bt, emailId_bt, emailSentAt_bt) {
  const { date: refDate, source: refSource } =
    resolveReferenceInstant(emailSentAt_bt);
  const refHuman = refDate.toString();
  const refIso = refDate.toISOString();

  const timeContext_bt =
    refSource === "email_sent_time"
      ? `The EMAIL was SENT at this moment (this is the only "now" that matters for the message):
${refHuman}
ISO: ${refIso}

Interpret "today", "tomorrow", "this week", "next Friday", "by EOD", etc. relative to THAT moment — not the real-world time when this analysis runs (which may be months later).
If the email is old, the computed deadline may already be in the past; still return the correct calendar instant implied by the wording.`
      : `No email send time was provided. Treat relative phrases as if "now" is approximately:
${refHuman}
(Prefer ISO deadlines consistent with that assumption.)`;

  const systemPrompt_bt = `
    You are an AI that extracts commitments and deadlines from email text.

    A commitment is ANY of the following:
    1. The SENDER promises to do something — "I will...", "I'll...", "I am going to...", "I will send...", "I will follow up..."
    2. The READER is assigned a task or deadline — "Your task is due...", "Please send by...", "We need this by...", "Deadline is...", "Can you send...", "Your report is due..."
    3. A meeting, event, or action with a clear date — "The meeting is tomorrow", "Submit by Friday"

    ALWAYS extract a commitment if:
    - There is a deadline mentioned (tomorrow, Friday, by EOD, by 5pm, etc.)
    - Someone is expected to do something
    - A task is assigned to anyone in the email

    Even simple sentences like "Your task is due tomorrow" or "Please send the report by Friday" MUST be treated as commitments.

    ---

    ${timeContext_bt}

    If a commitment exists, return EXACTLY:
    {
      "id": "<generate a unique random string>",
      "emailId": "${emailId_bt}",
      "task": "<short clear action like 'Send report' or 'Complete task'>",
      "deadline_iso": "<ISO 8601 formatted date string for the deadline>",
      "status": "pending",
      "draftReply": "<short professional reply to acknowledge or resolve it>"
    }

    ---

    If NO commitment or deadline exists at all, return EXACTLY:
    { "hasCommitment": false }

    ---

    IMPORTANT RULES:
    - ALWAYS extract when a deadline is mentioned, even if phrased passively
    - ALWAYS extract when a task is assigned to anyone
    - Keep task short and actionable (e.g. "Send report", "Complete project", "Reply to email")
    - If the email states a specific clock time (e.g. "4:30 PM", "16:30", "by 5:15"), set deadline_iso to that exact local time on the correct calendar day — do NOT round to whole hours
    - If only a date is given with no time, use end of that calendar day in America/Phoenix (Arizona; MST all year, no DST)
    - If the email implies a local date/time but no timezone is given, assume America/Phoenix
    - Return ONLY valid JSON
  `;

  return enqueueAI(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const MAX_RETRIES = 4;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion_bt = await openai_bt.chat.completions.create({
        model: "openrouter/free",
        messages: [
          { role: "system", content: systemPrompt_bt },
          { role: "user", content: emailText_bt },
        ],
        temperature: 0.1,
      });

      const rawResponse_bt = completion_bt.choices[0].message.content;
      const parsedData_bt = parseJsonResponse_(rawResponse_bt);

      if (!parsedData_bt || parsedData_bt.hasCommitment === false) {
        return null;
      }

      if (parsedData_bt.deadline_iso) {
        parsedData_bt.deadline = new Date(parsedData_bt.deadline_iso).getTime();
        delete parsedData_bt.deadline_iso;
      }

      return parsedData_bt;
    } catch (error_bt) {
      const is429 = error_bt?.status === 429;
      if (is429 && attempt < MAX_RETRIES) {
        const resetHeader = error_bt?.headers?.get?.("x-ratelimit-reset");
        const resetMs = resetHeader ? parseInt(resetHeader, 10) : null;
        const delay = resetMs ? Math.max(2000, resetMs - Date.now() + 1500) : Math.pow(2, attempt) * 10000;
        console.warn(`[Extract] Rate limited. Waiting ${Math.round(delay / 1000)}s until reset... (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }
      console.error("🔥 AI Extraction Error:", error_bt);
      return null;
    }
  }
  }); // end enqueueAI
}

async function extractCommitmentsBatch_bt(emailItems_bt) {
  const items = Array.isArray(emailItems_bt) ? emailItems_bt : [];
  if (!items.length) return [];

  const preparedItems = items.map((item, index) => {
    const resolved = resolveReferenceInstant(item.emailSentAt);
    return {
      idx: index,
      emailId: item.emailId,
      subject: item.subject || "",
      body: item.body || "",
      refHuman: resolved.date.toString(),
      refIso: resolved.date.toISOString(),
      hasSentAt: resolved.source === "email_sent_time",
    };
  });

  const systemPrompt_bt = `
You extract commitments and deadlines from multiple emails at once.

Return ONLY valid JSON as an array with exactly one object per input email, in the same order.

For each email:
- If there is a commitment, task, promise, request with expectation, or deadline, return:
  {
    "emailId": "<same email id>",
    "hasCommitment": true,
    "task": "<short actionable task>",
    "deadline_iso": "<ISO 8601 date string>",
    "status": "pending",
    "draftReply": "<short professional reply>"
  }
- If there is no commitment, return:
  {
    "emailId": "<same email id>",
    "hasCommitment": false
  }

Rules:
- Always extract when a deadline is mentioned.
- Always extract when someone is expected to do something.
- Keep task short and actionable.
- Respect each email's own reference time for words like "tomorrow" and "next Friday".
- If only a date is given with no time, use end of that day in America/Phoenix.
- If no timezone is given, assume America/Phoenix.
`;

  const userPayload_bt = preparedItems.map((item) => ({
    emailId: item.emailId,
    referenceTime: item.hasSentAt
      ? {
          type: "email_sent_time",
          human: item.refHuman,
          iso: item.refIso,
        }
      : {
          type: "analysis_time_fallback",
          human: item.refHuman,
          iso: item.refIso,
        },
    email: {
      subject: item.subject,
      body: item.body,
    },
  }));

  return enqueueAI(async () => {
    const completion_bt = await openai_bt.chat.completions.create({
      model: "openrouter/free",
      messages: [
        { role: "system", content: systemPrompt_bt },
        { role: "user", content: JSON.stringify(userPayload_bt) },
      ],
      temperature: 0.1,
    });

    const rawResponse_bt = completion_bt.choices[0].message.content;
    const parsed_bt = parseJsonResponse_(rawResponse_bt);
    if (!Array.isArray(parsed_bt)) {
      throw new Error("Batch extraction response was not an array");
    }

    const parsedByEmailId = {};
    parsed_bt.forEach((entry) => {
      if (entry && entry.emailId) {
        parsedByEmailId[String(entry.emailId)] = entry;
      }
    });

    return preparedItems.map((item) => {
      const parsedItem = parsedByEmailId[item.emailId];
      if (!parsedItem || parsedItem.hasCommitment === false) {
        return null;
      }

      const normalized = {
        id: parsedItem.id || `batch_${item.emailId}`,
        emailId: item.emailId,
        task: parsedItem.task,
        status: parsedItem.status || "pending",
        draftReply: parsedItem.draftReply || "",
      };

      if (parsedItem.deadline_iso) {
        normalized.deadline = new Date(parsedItem.deadline_iso).getTime();
      }

      if (!normalized.task || !normalized.deadline || Number.isNaN(normalized.deadline)) {
        return null;
      }

      return normalized;
    });
  });
}

module.exports = { extractCommitment_bt, extractCommitmentsBatch_bt };
