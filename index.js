import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import Papa from 'papaparse';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');

const DEFAULTS = {
    port: Number(process.env.PORT || 3000),
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: Number(process.env.SMTP_PORT || 465),
    fileLimit: 5 * 1024 * 1024, // 5 MB
    maxRecipients: 2000,
    defaultDelayMs: 800,
    jobTtlMs: 1000 * 60 * 30,
};

const PROVIDERS = [
    {
        id: 'gmail',
        name: 'Gmail / Google Workspace',
        host: 'smtp.gmail.com',
        port: 465,
        docUrl: 'https://support.google.com/accounts/answer/185833?hl=en',
        note: 'Requires 2FA + App Password',
        badge: 'Popular',
    },
    {
        id: 'outlook',
        name: 'Outlook / Office 365',
        host: 'smtp.office365.com',
        port: 587,
        docUrl: 'https://support.microsoft.com/account-billing/create-an-app-password-for-office-365-3e7c860c-b102-4ead-bd59-3392d7f43b8c',
        note: 'Use TLS with 587',
        badge: 'Business',
    },
    {
        id: 'zoho',
        name: 'Zoho Mail',
        host: 'smtp.zoho.com',
        port: 465,
        docUrl: 'https://www.zoho.com/mail/help/zoho-smtp.html',
        note: 'Enable IMAP/POP in Zoho settings',
        badge: 'India favorite',
    },
    {
        id: 'yahoo',
        name: 'Yahoo Mail',
        host: 'smtp.mail.yahoo.com',
        port: 465,
        docUrl: 'https://help.yahoo.com/kb/SLN15241.html',
        note: 'Needs Yahoo App Password',
    },
    {
        id: 'mailgun',
        name: 'Mailgun',
        host: 'smtp.mailgun.org',
        port: 587,
        docUrl: 'https://www.mailgun.com/blog/using-mailgun-smtp/',
        note: 'Use domain-specific username',
    },
    {
        id: 'sendgrid',
        name: 'SendGrid',
        host: 'smtp.sendgrid.net',
        port: 587,
        docUrl: 'https://docs.sendgrid.com/ui/account-and-settings/smtp-relay',
        note: 'Username: apikey · Password: actual API key',
    },
];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: DEFAULTS.fileLimit },
});

const jobs = new Map();
const MAX_LOGS = 200;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clearJobLater = (jobId) => {
    setTimeout(() => jobs.delete(jobId), DEFAULTS.jobTtlMs);
};

const sanitizeRows = (rows) =>
    rows
        .map((row) =>
            Object.keys(row).reduce((acc, key) => {
                const cleanKey = key?.trim();
                if (!cleanKey) {
                    return acc;
                }
                const value = row[key];
                acc[cleanKey] = typeof value === 'string' ? value.trim() : value;
                return acc;
            }, {}),
        )
        .filter((row) => Object.keys(row).length);

const findEmailColumn = (row) => {
    if (!row) return null;
    const columns = Object.keys(row);
    return (
        columns.find((key) => /email/i.test(key)) ||
        columns.find((key) => /mail/i.test(key)) ||
        null
    );
};

const personalizeTemplate = (html, dataRow) =>
    html.replace(/\$\(([^)]+)\)/g, (_, key) => {
        const cleanedKey = key.trim();
        return dataRow[cleanedKey] ?? '';
    });

const parseCsv = (buffer) =>
    Papa.parse(buffer.toString('utf-8'), {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        transformHeader: (header) => header?.trim(),
    });

const getPublicState = (job) => ({
    id: job.id,
    status: job.status,
    subject: job.subject,
    total: job.total,
    sent: job.sent,
    failed: job.failed,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    delayMs: job.delayMs,
    emailColumn: job.emailColumn,
    sampleColumns: job.sampleColumns,
    logs: job.logs,
});
 
const broadcast = (job) => {
    const payload = JSON.stringify({ type: 'state', data: getPublicState(job) });
    for (const stream of job.streams) {
        stream.write(`data: ${payload}\n\n`);
    }
};
 
const createTransporter = ({ host, port, email, password }) =>
    nodemailer.createTransport({
        host,
        port,
        secure: Number(port) === 465,
        auth: {
            user: email,
            pass: password,
        },
        tls: {
            rejectUnauthorized: false,
        },
    }); 

const runJob = async (job) => {
    try {
        const transporter = createTransporter(job.smtp);
        await transporter.verify();

        job.status = 'running';
        job.startedAt = Date.now();
        broadcast(job);

        for (const row of job.recipients) {
            const to = row[job.emailColumn];
            if (!to) {
                job.failed += 1;
                job.logs.unshift({
                    kind: 'error',
                    message: 'Missing email address in row',
                    email: null,
                    at: Date.now(),
                });
                job.logs = job.logs.slice(0, MAX_LOGS);
                broadcast(job);
                continue;
            }

            const html = personalizeTemplate(job.template, row);
            try {
                await transporter.sendMail({
                    from: job.from,
                    to,
                    subject: job.subject,
                    html,
                });
                job.sent += 1;
                job.logs.unshift({ kind: 'success', email: to, at: Date.now() });
            } catch (error) {
                job.failed += 1;
                job.logs.unshift({
                    kind: 'error',
                    email: to,
                    message: error.message,
                    at: Date.now(),
                });
            }

            job.logs = job.logs.slice(0, MAX_LOGS);
            broadcast(job);
            if (job.delayMs > 0) {
                await sleep(job.delayMs);
            }
        }

        job.status = 'completed';
        job.completedAt = Date.now();
        broadcast(job);
    } catch (error) {
        job.status = 'failed';
        job.completedAt = Date.now();
        job.logs.unshift({
            kind: 'error',
            message: error.message,
            at: Date.now(),
        });
        job.logs = job.logs.slice(0, MAX_LOGS);
        broadcast(job);
    } finally {
        clearJobLater(job.id);
    }
};

app.get('/', (req, res) => {
    res.render('index', {
        defaults: {
            smtpHost: DEFAULTS.smtpHost,
            smtpPort: DEFAULTS.smtpPort,
            delayMs: DEFAULTS.defaultDelayMs,
            maxRecipients: DEFAULTS.maxRecipients,
            maxFileMb: DEFAULTS.fileLimit / (1024 * 1024),
        },
        providers: PROVIDERS,
    });
});

app.post('/api/send', upload.single('contacts'), async (req, res) => {
    try {
        const {
            senderEmail = '',
            senderName = '',
            appPassword = '',
            subject = '',
            message = '',
            smtpHost = DEFAULTS.smtpHost,
            smtpPort = DEFAULTS.smtpPort,
            delayMs = DEFAULTS.defaultDelayMs,
        } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'Please upload a CSV file with your contacts.' });
        }

        if (!senderEmail.trim()) {
            return res.status(400).json({ message: 'Sender email is required.' });
        }

        if (!appPassword.trim()) {
            return res.status(400).json({ message: 'App password is required.' });
        }

        if (!subject.trim()) {
            return res.status(400).json({ message: 'Subject cannot be empty.' });
        }

        if (!message.trim()) {
            return res.status(400).json({ message: 'Message body cannot be empty.' });
        }

        const parsed = parseCsv(req.file.buffer);

        if (parsed.errors?.length) {
            const firstError = parsed.errors[0];
            return res.status(400).json({ message: `CSV error: ${firstError.message}` });
        }

        if (!parsed.data.length) {
            return res.status(400).json({ message: 'The CSV file has no rows.' });
        }

        const sanitizedRows = sanitizeRows(parsed.data);
        const emailColumn = findEmailColumn(sanitizedRows[0]);

        if (!emailColumn) {
            return res.status(400).json({
                message: 'No email column detected. Please include a column named "email".',
            });
        }

        const recipients = sanitizedRows.filter((row) => row[emailColumn]);

        if (!recipients.length) {
            return res
                .status(400)
                .json({ message: 'No recipients with email addresses were found in the CSV.' });
        }

        if (recipients.length > DEFAULTS.maxRecipients) {
            return res.status(400).json({
                message: `This tool currently limits a single campaign to ${DEFAULTS.maxRecipients} recipients. Please split your CSV.`,
            });
        }

        const jobId = crypto.randomUUID();
        const job = {
            id: jobId,
            createdAt: Date.now(),
            status: 'queued',
            subject: subject.trim(),
            template: message,
            total: recipients.length,
            sent: 0,
            failed: 0,
            delayMs: Number.isFinite(Number(delayMs)) ? Math.max(Number(delayMs), 0) : DEFAULTS.defaultDelayMs,
            recipients,
            emailColumn,
            logs: [],
            streams: new Set(),
            from: senderName.trim()
                ? `${senderName.trim()} <${senderEmail.trim()}>`
                : senderEmail.trim(),
            smtp: {
                host: smtpHost || DEFAULTS.smtpHost,
                port: Number(smtpPort) || DEFAULTS.smtpPort,
                email: senderEmail.trim(),
                password: appPassword.trim(),
            },
            sampleColumns: Object.keys(sanitizedRows[0] || {}),
        };

        jobs.set(jobId, job);
        runJob(job);

        return res.status(202).json({ jobId, state: getPublicState(job) });
    } catch (error) {
        console.error('send error', error);
        return res.status(500).json({ message: 'Something went wrong while scheduling your campaign.' });
    }
});

app.get('/api/jobs/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({ message: 'Job not found or has expired.' });
    }
    return res.json(getPublicState(job));
});

app.get('/api/jobs/:jobId/stream', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ type: 'state', data: getPublicState(job) })}\n\n`);

    job.streams.add(res);

    req.on('close', () => {
        job.streams.delete(res);
    });
});

if (process.env.VERCEL !== '1') {
    app.listen(DEFAULTS.port, () => {
        console.log(`Mass Mailer listening on http://localhost:${DEFAULTS.port}`);
    });
}

export default app;