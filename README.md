# Mass Mailer

A lightweight, self-hostable mass-mailing studio built with Express, Nodemailer, and EJS. Upload a CSV, paste your HTML template, and track progress live while credentials stay in-memory for the duration of each campaign.

## ✨ Highlights

- **CSV upload with preview** – validates headers, shows column sample, and enforces per-campaign limits.
- **Personalised templates** – use `$(column_name)` anywhere in your subject or HTML body.
- **Per-request SMTP creds** – sender email + app password collected securely per send; nothing is stored on disk.
- **Live delivery telemetry** – real-time progress via Server-Sent Events with automatic polling fallback.
- **Friendly UX** – Tailwind-powered dashboard with delivery controls, placeholder guide, and clear error states.

## 🧱 Stack

- Node.js 18+
- Express 4
- Nodemailer 6
- Papa Parse 5
- Multer for uploads
- EJS for server-side rendering

## 🚀 Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure environment**
   - Duplicate `.env` (already committed with placeholders) if you need overrides.
   - Defaults:
     ```env
     PORT=3000
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=465
     ```
   - These values can be overridden per campaign from the UI.
3. **Run locally**
   ```bash
   npm run start
   # or
   npm run dev
   ```
4. Visit `http://localhost:3000`.

## 📄 CSV Requirements

- First row **must** contain headers.
- Include at least one column named `email` (case-insensitive).
- Maximum rows per send: **2,000** (configurable in `DEFAULTS.maxRecipients`).
- Maximum upload size: **5 MB**.

## 🧩 Template Placeholders

Use the syntax `$(column_name)` anywhere in your subject or HTML body. Examples:

- Subject: `Thanks $(first_name)!`
- Body: `Hi $(first_name), your city is $(city).`

Missing data resolves to an empty string, so emails never break.

## 🔐 Credentials & App Passwords

- The UI asks for **Sender email** and **App password** every time you send.
- For Gmail, enable 2FA and create an App Password at `myaccount.google.com` → *Security* → *App passwords*.
- Credentials are only held in memory while the job runs and are never persisted.

## 📡 API Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/` | Render the dashboard |
| `POST` | `/api/send` | Accept multipart form with CSV + campaign metadata |
| `GET` | `/api/jobs/:id` | Fetch the latest job snapshot |
| `GET` | `/api/jobs/:id/stream` | Server-sent events for live updates |

## 🧰 Deployment

- Works on any Node host. For Vercel, keep `vercel.json` pointing to `index.js` (already configured) and make sure the project runs on Node 18.
- Environment variables on Vercel should mirror `.env` defaults.

## 🩺 Troubleshooting

| Issue | Fix |
| ----- | --- |
| `CSV error: ...` | Ensure UTF-8 CSV with header row and no stray commas. |
| `Campaign failed` immediately | Double-check SMTP host/port and that the app password is valid for the sender email. |
| Emails throttled/blocked | Increase `Delay per email (ms)` to respect your provider's rate limits. |

## ✅ Testing

No automated tests yet—start the server locally and perform a dry run with a test SMTP inbox (e.g., Gmail alias or [Ethereal](https://ethereal.email/)).

---

Questions or ideas? Open an issue or drop a note inside the project board. Happy mailing! 🎉
