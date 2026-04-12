import 'dotenv/config';
import OpenAI from "openai";

const openai_bt = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  export async function extractCommitment_bt(emailText_bt, emailId_bt) {
    const currentTime_bt = Date.now(); 
    
    const systemPrompt_bt = `
      You are an AI that extracts commitments or promises from emails.
      Analyze the text and determine if the sender made a commitment with a deadline.
      The current Unix timestamp in milliseconds is ${currentTime_bt}. Use this to calculate deadlines.
      
      If a commitment is found, return a JSON object matching this EXACT schema:
      {
        "id": "<generate a unique random string>",
        "emailId": "${emailId_bt}",
        "task": "<short description of the promise>",
        "deadline": <Unix timestamp in milliseconds for the deadline>,
        "status": "pending",
        "draftReply": "<a polite, short AI-generated draft to resolve this later>"
      }
      
      If NO commitment is found, return exactly: { "hasCommitment": false }
      DO NOT wrap the response in markdown blocks. Return ONLY valid JSON.
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

    if (parsedData_bt.hasCommitment === false) {
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