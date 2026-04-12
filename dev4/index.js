import OpenAI from "openai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

let transporter;

async function createTransporter() {
  const testAccount = await nodemailer.createTestAccount();

  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

async function sendEmail(reply) {
  const info = await transporter.sendMail({
    from: '"CommitLens" <test@ethereal.email>',
    to: "test@example.com",
    subject: "⚠️ Missed Commitment",
    text: reply,
  });

  console.log("\nEmail sent!");
  console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
}

async function generateReply() {
  const prompt = `
A user missed a commitment.

Task: send the report
Deadline: yesterday

Write a short professional apology email (2-3 lines).
`;

  const response = await openai.chat.completions.create({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  const reply = response.choices[0].message.content;

  console.log("\nAI Reply:\n");
  console.log(reply);

  console.log("\n--- COPY THIS FOR GMAIL DRAFT ---\n");
  console.log(reply);

  await sendEmail(reply);
}

async function main() {
  await createTransporter();
  await generateReply();
}

main();