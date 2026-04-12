import OpenAI from "openai";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

app.post("/generate-reply", async (req, res) => {
  const { task, deadline } = req.body;

  try {
    const prompt = `
A user missed a commitment.

Task: ${task}
Deadline: ${new Date(deadline).toLocaleString()}

Write a short professional apology email (2-3 lines).

Do NOT use placeholders like [Recipient's Name], [Your Name], or "Sender".
Use a realistic recipient name (like John) and sign with "Ramneek".
Include a proper subject line.
`;

    const response = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const full = response.choices[0].message.content;

    const lines = full.split("\n").filter(line => line.trim() !== "");

    const subject = lines[0].replace("Subject:", "").trim();
    const greeting = lines[1];
    const message = lines[2];
    const closing = lines[3];
    const signature = lines[4];

    const reply = `${greeting}\n\n${message}\n\n${closing}\n${signature}`;

res.json({ reply });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});


app.post("/generate-reply-text", async (req, res) => {
  const { task, deadline } = req.body;

  try {
    const prompt = `
A user missed a commitment.

Task: ${task}
Deadline: ${new Date(deadline).toLocaleString()}

Write a short professional apology email (2-3 lines).

Do NOT use placeholders. Use name John and sign as Ramneek.
Include subject line.
`;

    const response = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const full = response.choices[0].message.content;
    const lines = full.split("\n").filter(l => l.trim());

    const greeting = lines[1];
    const message = lines[2];
    const closing = lines[3];
    const signature = lines[4];

    const formatted = `${greeting}\n\n${message}\n\n${closing}\n${signature}`;

    res.send(formatted);

  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong");
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});