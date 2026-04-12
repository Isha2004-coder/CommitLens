# CommitLens

> AI-powered Gmail assistant that automatically detects, tracks, and reminds you of commitments and deadlines buried in your emails.

---

## What It Does

CommitLens lives inside Gmail as a sidebar add-on. It uses GPT-4o-mini to scan your emails, extract any commitments or deadlines, store them in a backend, create Google Calendar events with reminders, and send email alerts when a deadline is missed — all automatically.

---

## Features

- **AI Commitment Extraction** — Detects both outgoing promises ("I will send...") and incoming deadlines ("Your report is due tomorrow")
- **Gmail Sidebar Panel** — Shows detected task, deadline, and action buttons directly inside Gmail
- **Suggest Reply** — AI-generated context-aware follow-up or acknowledgment reply
- **Open in Gmail** — Pre-filled compose window with subject and body ready to send
- **Mark as Done** — One-click to resolve and remove a commitment from the list
- **Hourly Background Scanner** — Automatically scans last 10 inbox emails every hour, no user interaction needed
- **Google Calendar Integration** — Auto-creates calendar events with 30-minute popup reminders at the deadline
- **Email Alerts** — Nodemailer sends an HTML email alert when a deadline is missed

---

## Tech Stack

| Layer | Technology |
|---|---|
| Gmail Add-on | Google Apps Script |
| AI Extraction | OpenAI GPT-4o-mini via OpenRouter |
| Backend | Node.js + Express |
| Storage | File-backed JSON (`commitments-data.json`) |
| Notifications | Nodemailer + Gmail SMTP |
| Calendar | Google Calendar API (CalendarApp) |
| Tunnel | ngrok |

---

## Project Structure

```
CommitLens/
├── apps-script/          # Gmail Add-on (Google Apps Script)
│   ├── Code.gs           # Main add-on logic, UI, scanner, calendar
│   ├── BackendConfig.gs  # Backend URL config
│   └── appsscript.json   # Manifest with OAuth scopes
├── backend/              # Node.js Express backend
│   ├── server.js         # App entry point
│   ├── routes/
│   │   ├── extract.js        # POST /extract — AI extraction + storage
│   │   ├── commitments.js    # GET/PATCH /commitments
│   │   ├── generateReply.js  # POST /generate-reply
│   │   └── analyze-email.js  # POST /api/analyze-email
│   ├── utils/
│   │   ├── extractCommitmentOpenRouter.js  # OpenAI extraction logic
│   │   ├── sendNotification.js             # Nodemailer email alerts
│   │   └── extractorWrapper.js            # ESM/CJS bridge
│   ├── data/
│   │   └── storage.js        # File-backed JSON storage adapter
│   └── jobs/
│       └── deadlineChecker.js  # Background scheduler (every 5s)
└── extractor.js          # Root ES module extractor (original)
```

---

## Setup

### 1. Backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:
```
OPENAI_API_KEY=your_openrouter_api_key
GMAIL_USER=your_gmail@gmail.com
GMAIL_PASS=your_gmail_app_password
PORT=3000
```

Start the backend:
```bash
npm run dev
```

### 2. Expose with ngrok

```bash
ngrok http 3000
```

Copy the public URL (e.g. `https://your-tunnel.ngrok-free.app`).

### 3. Gmail Add-on

1. Go to [script.google.com](https://script.google.com) → New project
2. Create three files: `Code.gs`, `BackendConfig.gs`, `appsscript.json`
3. Paste contents from `apps-script/` folder
4. Update `BASE_URL` in `Code.gs` with your ngrok URL
5. Update `MY_EMAIL` in `Code.gs` with your Gmail address
6. Click **Deploy** → **Test deployments** → **Install**
7. Authorize permissions when prompted

### 4. Set Up Hourly Scanner

In Apps Script editor:
1. Select `setupHourlyTrigger` from the function dropdown
2. Click **Run**

---

## How the Full Pipeline Works

```
Email arrives in inbox
       ↓
Hourly scanner (Apps Script) picks it up
       ↓
Sends to POST /extract (backend)
       ↓
GPT-4o-mini extracts task + deadline
       ↓
Stored in commitments-data.json
       ↓
Google Calendar event created with reminder
       ↓
If deadline passes → Nodemailer sends email alert
```

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | `/extract` | Extract commitment from email text |
| GET | `/commitments` | Get all tracked commitments |
| PATCH | `/commitments/:id` | Update commitment status |
| POST | `/generate-reply` | Generate AI reply for a commitment |
| POST | `/api/analyze-email` | Analyze email without storing |
| GET | `/health` | Health check |

---

## Environment Variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenRouter API key |
| `GMAIL_USER` | Gmail address for sending alerts |
| `GMAIL_PASS` | Gmail App Password (16 chars, requires 2FA) |
| `PORT` | Backend port (default: 3000) |
