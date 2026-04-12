import 'dotenv/config';
import OpenAI from "openai";

const openai_bt = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

export async function extractCommitment_bt(emailText_bt, emailId_bt) {
  const currentTime_bt = Date.now(); 
  
  const systemPrompt_bt = `
    You are an AI that extracts commitments from email text.

    A commitment is ANY statement where the sender promises to do something in the future.

    ALWAYS treat the following as commitments:
    - "I will ..."
    - "I'll ..."
    - "I am going to ..."
    - "I will send ..."
    - "I will share ..."
    - "I will follow up ..."

    Even if the sentence is simple, it MUST be treated as a commitment.

    ---

    If a commitment exists, return EXACTLY:
    {
      "id": "<generate a unique random string>",
      "emailId": "${emailId_bt}",
      "task": "<short clear action like 'Send report'>",
      "deadline": <Unix timestamp in milliseconds>,
      "status": "pending",
      "draftReply": "<short professional reply to resolve it>"
    }

    ---

    If NO commitment exists, return EXACTLY:
    { "hasCommitment": false }

    ---

    IMPORTANT RULES:
    - NEVER ignore "I will..." statements
    - ALWAYS extract task from them
    - Keep task short and actionable
    - Return ONLY valid JSON
  `;

  try {
    const completion_bt = await openai_bt.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt_bt },
        { role: "user", content: emailText_bt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const rawResponse_bt = completion_bt.choices[0].message.content;
    const parsedData_bt = JSON.parse(rawResponse_bt);

    if (!parsedData_bt || parsedData_bt.hasCommitment === false) {
      return null; 
    }

    return parsedData_bt;

  } catch (error_bt) {
    console.error("🔥 AI Extraction Error:", error_bt);
    
    return {
      id: "mock_" + Date.now(),
      emailId: emailId_bt,
      task: "Mock fallback task (API failed or timed out)",
      deadline: Date.now() + 86400000,
      status: "pending",
      draftReply: "Here is the information requested."
    };
  }
}