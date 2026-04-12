require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { startDeadlineChecker } = require("./jobs/deadlineChecker");
const commitmentsRouter = require("./routes/commitments");
const extractRouter = require("./routes/extract");
const generateReplyRouter = require("./routes/generateReply");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.status(200).json({ message: "CommitLens backend is running" });
});

// Routes
app.use("/commitments", commitmentsRouter);
app.use("/extract", extractRouter);
app.use("/generate-reply", generateReplyRouter);

// Start scheduler
startDeadlineChecker();

app.listen(PORT, () => {
  console.log(`[Server] CommitLens backend running on http://localhost:${PORT}`);
});