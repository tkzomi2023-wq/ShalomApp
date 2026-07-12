import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import { supabase } from "./src/lib/supabase";

const app = express();
const PORT = 3000;

app.use(express.json());

const LOGS_FILE_PATH = path.join(process.cwd(), "birthday_logs.json");
const SMTP_CONFIG_FILE = path.join(process.cwd(), "smtp_config.json");

interface SmtpConfig {
  host: string;
  port: string;
  user: string;
  pass: string;
  from?: string;
}

function getSmtpConfig(): SmtpConfig | null {
  // Check env first
  if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM
    };
  }
  // Check file second
  try {
    if (fs.existsSync(SMTP_CONFIG_FILE)) {
      const data = fs.readFileSync(SMTP_CONFIG_FILE, "utf-8");
      return JSON.parse(data) as SmtpConfig;
    }
  } catch (err) {
    console.error("Failed to read SMTP config file:", err);
  }
  return null;
}

interface BirthdayLog {
  id: string;
  timestamp: string;
  celebrants: string[];
  recipientCount: number;
  recipients: string[];
  subject: string;
  body: string;
  status: "sent" | "simulated" | "failed";
  errorMessage?: string;
}

interface LogsStore {
  lastRunDate: string | null;
  logs: BirthdayLog[];
}

// Load logs helper
function loadLogsStore(): LogsStore {
  try {
    if (fs.existsSync(LOGS_FILE_PATH)) {
      const data = fs.readFileSync(LOGS_FILE_PATH, "utf-8");
      return JSON.parse(data) as LogsStore;
    }
  } catch (err) {
    console.error("Failed to read birthday logs file:", err);
  }
  return { lastRunDate: null, logs: [] };
}

// Save logs helper
function saveLogsStore(store: LogsStore) {
  try {
    fs.writeFileSync(LOGS_FILE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write birthday logs file:", err);
  }
}

// Helper to get current date/time components in India Standard Time (IST, UTC+5:30)
function getCurrentISTTime(): { year: number, month: number, date: number, hours: number, minutes: number } {
  const utcDate = new Date();
  // IST is UTC + 5:30 (5.5 * 60 * 60 * 1000 = 19800000 ms)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(utcDate.getTime() + istOffsetMs);
  
  return {
    year: istDate.getUTCFullYear(),
    month: istDate.getUTCMonth() + 1,
    date: istDate.getUTCDate(),
    hours: istDate.getUTCHours(),
    minutes: istDate.getUTCMinutes()
  };
}

// Helper to determine if a date is today in India Standard Time (IST)
const isBirthdayToday = (dobString?: string): boolean => {
  if (!dobString) return false;
  const parts = dobString.split('-');
  if (parts.length === 3) {
    const dobMonth = parseInt(parts[1], 10);
    const dobDay = parseInt(parts[2], 10);
    const ist = getCurrentISTTime();
    return ist.month === dobMonth && ist.date === dobDay;
  }
  
  const dobDate = new Date(dobString);
  if (isNaN(dobDate.getTime())) return false;
  const ist = getCurrentISTTime();
  return (dobDate.getMonth() + 1) === ist.month && dobDate.getDate() === ist.date;
};

// Helper to download external avatar URLs or parse base64 and output embedded CID attachments
async function resolveAvatarForEmail(avatarUrl: string | undefined, id: string | number, cidPrefix: string): Promise<{ src: string; attachment: any | null }> {
  if (!avatarUrl) {
    return { src: "", attachment: null };
  }

  // 1. If it's already a base64 data-URL
  if (avatarUrl.startsWith("data:")) {
    try {
      const match = avatarUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
      if (match) {
        const contentType = match[1];
        const base64Data = match[2];
        const ext = contentType.split('/')[1] || 'png';
        const cid = `${cidPrefix}-${id}`;
        return {
          src: `cid:${cid}`,
          attachment: {
            filename: `avatar-${id}.${ext}`,
            content: Buffer.from(base64Data, "base64"),
            cid: cid
          }
        };
      }
    } catch (e) {
      console.error("Failed to parse base64 avatar URL:", e);
    }
    return { src: avatarUrl, attachment: null };
  }

  // 2. If it's an external HTTP/HTTPS URL
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    try {
      const response = await fetch(avatarUrl);
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "image/png";
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = contentType.split("/")[1] || "png";
        const cid = `${cidPrefix}-${id}`;
        return {
          src: `cid:${cid}`,
          attachment: {
            filename: `avatar-${id}.${ext}`,
            content: buffer,
            cid: cid
          }
        };
      }
    } catch (err) {
      console.warn(`Failed to fetch avatar URL ${avatarUrl} for embedding, falling back to direct URL link:`, err);
    }
  }

  return { src: avatarUrl, attachment: null };
}

// Check and send birthday emails logic
async function checkAndSendBirthdayEmails(force = false): Promise<{
  checked: boolean;
  celebrantsFound: number;
  emailsSent: boolean;
  status: string;
  log?: BirthdayLog;
}> {
  const store = loadLogsStore();
  const ist = getCurrentISTTime();
  const todayString = `${ist.year}-${String(ist.month).padStart(2, '0')}-${String(ist.date).padStart(2, '0')}`;

  if (store.lastRunDate === todayString && !force) {
    return {
      checked: false,
      celebrantsFound: 0,
      emailsSent: false,
      status: `Already checked and run today (${todayString}). Use force to rerun.`
    };
  }

  // If not forced and we haven't reached 7:30 AM IST yet, skip.
  if (!force) {
    const isTimeToSend = ist.hours > 7 || (ist.hours === 7 && ist.minutes >= 30);
    if (!isTimeToSend) {
      return {
        checked: false,
        celebrantsFound: 0,
        emailsSent: false,
        status: `Skipped: Currently ${String(ist.hours).padStart(2, '0')}:${String(ist.minutes).padStart(2, '0')} IST. Automatic check only runs on or after 7:30 AM IST.`
      };
    }
  }

  try {
    // 1. Fetch approved members from Supabase profiles
    const { data: members, error } = await supabase
      .from("profiles")
      .select("*");

    if (error) {
      throw new Error(`Failed to fetch members from Supabase: ${error.message}`);
    }

    if (!members || members.length === 0) {
      // If there are no members, we just update the last run date and return
      store.lastRunDate = todayString;
      saveLogsStore(store);
      return {
        checked: true,
        celebrantsFound: 0,
        emailsSent: false,
        status: "No registered members found."
      };
    }

    // 2. Identify celebrants who have birthdays today and are approved members
    const approvedMembers = members.filter(m => m.status === "approved");
    const celebrants = approvedMembers.filter(m => m.dob && isBirthdayToday(m.dob));

    // Update the last run date
    store.lastRunDate = todayString;

    if (celebrants.length === 0) {
      saveLogsStore(store);
      return {
        checked: true,
        celebrantsFound: 0,
        emailsSent: false,
        status: "No members have a birthday today."
      };
    }

    // 3. Identify email recipients (approved members with emails and notifications enabled)
    const activeRecipients = approvedMembers.filter(m => m.email && m.email_notifications !== false);
    const recipientEmails = activeRecipients.map(m => m.email.trim().toLowerCase());

    if (recipientEmails.length === 0) {
      saveLogsStore(store);
      return {
        checked: true,
        celebrantsFound: celebrants.length,
        emailsSent: false,
        status: "Celebrants found, but no members have email notifications enabled."
      };
    }

    // 4. Draft the email contents
    const celebrantsNames = celebrants.map(c => c.name);
    const subject = `🎉 Shalom Youth Birthday Celebration Today: ${celebrantsNames.join(", ")}! 🎂`;
    
    // HTML Email Template
    const autoAttachments: any[] = [];
    const celebrantsHtmlPromises = celebrants.map(async (c, idx) => {
      const resolved = await resolveAvatarForEmail(c.avatar, c.id || idx, "avatar-auto");
      if (resolved.attachment) {
        autoAttachments.push(resolved.attachment);
      }
      const avatarSrc = resolved.src;
      return `
      <div style="background-color: #f3f0ff; border-radius: 16px; padding: 20px; margin-bottom: 16px; border: 1px solid #e9d5ff; text-align: center;">
        ${avatarSrc ? `
          <img src="${avatarSrc}" alt="${c.name}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 12px; border: 3px solid #a855f7;" referrerPolicy="no-referrer" />
        ` : `
          <div style="width: 80px; height: 80px; border-radius: 50%; background-color: #a855f7; color: white; line-height: 80px; font-size: 32px; font-weight: bold; margin: 0 auto 12px auto; text-align: center;">
            ${c.name.charAt(0).toUpperCase()}
          </div>
        `}
        <h3 style="margin: 0 0 4px 0; color: #581c87; font-size: 20px; font-family: sans-serif;">${c.name}</h3>
        <p style="margin: 0; color: #701a75; font-size: 14px; font-family: sans-serif; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">${c.role || 'Member'}</p>
      </div>
    `;
    });
    const celebrantsHtmlParts = await Promise.all(celebrantsHtmlPromises);
    const celebrantsHtml = celebrantsHtmlParts.join("");

    const appUrl = process.env.APP_URL || "http://localhost:3000";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Shalom Youth Birthday Celebration</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #ec4899, #8b5cf6, #6366f1); padding: 40px 20px; text-align: center; color: white;">
              <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; background-color: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 100px;">Shalom Youth Fellowship</span>
              <h1 style="margin: 15px 0 0 0; font-size: 32px; font-weight: 800; letter-spacing: -0.025em; text-shadow: 0 2px 4px rgba(0,0,0,0.15);">Birthday Celebration! 🎉</h1>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                Today is a very special day! We are overjoyed to celebrate the birthday of our beloved Shalom Youth member${celebrants.length > 1 ? 's' : ''}. Let's lift them up in our prayers, send them some love, and celebrate their special day together!
              </p>
              
              <!-- Celebrants List -->
              ${celebrantsHtml}

              <!-- Encouraging Word -->
              <div style="background-color: #f9fafb; border-left: 4px solid #8b5cf6; border-radius: 4px; padding: 16px; margin: 24px 0; font-style: italic; color: #4b5563;">
                "The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you; the Lord turn his face toward you and give you peace." 
                <div style="text-align: right; font-weight: bold; font-size: 12px; margin-top: 8px; color: #6b7280; font-style: normal;">— Numbers 6:24-26</div>
              </div>

              <!-- Action Link -->
              <div style="text-align: center; margin: 30px 0 10px 0;">
                <a href="${appUrl}" style="background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; text-decoration: none; padding: 14px 32px; font-weight: bold; font-size: 16px; border-radius: 100px; display: inline-block; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">
                  Send a Birthday Wish! 🎁
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #4b5563;">Shalom Youth Fellowship</p>
              <p style="margin: 0;">You are receiving this email because you are a registered and approved member of Shalom Youth.</p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // 5. Attempt Email Dispatch
    const smtpConfig = getSmtpConfig();
    let isSmtpConfigured = !!smtpConfig;

    let sendStatus: "sent" | "simulated" | "failed" = "simulated";
    let errorMsg: string | undefined = undefined;

    if (smtpConfig) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: parseInt(smtpConfig.port || "587"),
          secure: smtpConfig.port === "465",
          auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
          },
        });

        const fromAddress = smtpConfig.from || `"Shalom Youth Fellowship" <${smtpConfig.user}>`;

        await transporter.sendMail({
          from: fromAddress,
          to: fromAddress, // Send to sender
          bcc: recipientEmails, // BCC to prevent exposing emails
          subject: subject,
          html: htmlContent,
          attachments: autoAttachments,
        });

        sendStatus = "sent";
        console.log(`[SMTP] Successfully dispatched daily birthday emails for: ${celebrantsNames.join(", ")}`);
      } catch (err: any) {
        console.error("[SMTP] Error sending birthday emails, falling back to simulated:", err);
        sendStatus = "failed";
        errorMsg = err?.message || String(err);
      }
    } else {
      // Simulated Output in server console
      console.log("\n==================================================");
      console.log("📢 [SIMULATED EMAIL DISPATCH]");
      console.log(`SUBJECT: ${subject}`);
      console.log(`RECIPIENTS (${recipientEmails.length}): ${recipientEmails.join(", ")}`);
      console.log(`CELEBRANTS: ${celebrantsNames.join(", ")}`);
      console.log("==================================================\n");
    }

    // 6. Record the log entry
    const logEntry: BirthdayLog = {
      id: crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      celebrants: celebrantsNames,
      recipientCount: recipientEmails.length,
      recipients: recipientEmails,
      subject,
      body: htmlContent,
      status: sendStatus,
      errorMessage: errorMsg
    };

    // Keep up to 50 logs
    store.logs.unshift(logEntry);
    if (store.logs.length > 50) {
      store.logs = store.logs.slice(0, 50);
    }

    saveLogsStore(store);

    return {
      checked: true,
      celebrantsFound: celebrants.length,
      emailsSent: sendStatus === "sent",
      status: sendStatus === "sent" 
        ? `Successfully sent birthday emails for: ${celebrantsNames.join(", ")}.`
        : `Simulated birthday email dispatch for: ${celebrantsNames.join(", ")}.`,
      log: logEntry
    };

  } catch (err: any) {
    console.error("Error running daily birthday task:", err);
    return {
      checked: true,
      celebrantsFound: 0,
      emailsSent: false,
      status: `Error: ${err.message || err}`
    };
  }
}

// REST API endpoint to retrieve birthday logs
app.get("/api/birthday-email/status", (req, res) => {
  const store = loadLogsStore();
  const smtpConfig = getSmtpConfig();
  res.json({
    lastRunDate: store.lastRunDate,
    logs: store.logs,
    smtpConfigured: !!smtpConfig
  });
});

// REST API endpoint to load SMTP configuration (Only accessible to tkpaite2016@gmail.com)
app.get("/api/birthday-email/smtp-config", (req, res) => {
  const requesterEmail = req.query.email as string;
  if (!requesterEmail || requesterEmail.toLowerCase() !== "tkpaite2016@gmail.com") {
    return res.status(403).json({ error: "Access Denied: SMTP configurations are restricted." });
  }

  const config = getSmtpConfig();
  if (config) {
    res.json({
      host: config.host,
      port: config.port,
      user: config.user,
      from: config.from,
      hasPassword: !!config.pass
    });
  } else {
    res.json(null);
  }
});

// REST API endpoint to save SMTP configuration (Only accessible to tkpaite2016@gmail.com)
app.post("/api/birthday-email/smtp-config", (req, res) => {
  const { requesterEmail, host, port, user, pass, from } = req.body;
  if (!requesterEmail || requesterEmail.toLowerCase() !== "tkpaite2016@gmail.com") {
    return res.status(403).json({ error: "Access Denied: SMTP configurations are restricted." });
  }

  try {
    const config: SmtpConfig = { host, port, user, pass, from };
    fs.writeFileSync(SMTP_CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
    res.json({ success: true, message: "SMTP configuration successfully updated." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save SMTP configurations" });
  }
});

// REST API endpoint to send a beautiful custom birthday wish card directly to the celebrants
app.post("/api/birthday-email/send-wish", async (req, res) => {
  const { celebrants } = req.body; // Array of celebrant names
  
  if (!celebrants || !Array.isArray(celebrants) || celebrants.length === 0) {
    return res.status(400).json({ error: "No celebrants specified." });
  }

  const smtpConfig = getSmtpConfig();
  if (!smtpConfig) {
    return res.status(400).json({ 
      error: "SMTP is not configured yet. Please configure SMTP settings using the administrator panel first." 
    });
  }

  try {
    // Fetch all members to find the actual email addresses for these celebrant names
    const { data: members, error } = await supabase
      .from("profiles")
      .select("*");

    if (error) {
      throw new Error(`Failed to fetch members to locate emails: ${error.message}`);
    }

    const approvedMembers = members ? members.filter(m => m.status === "approved") : [];
    // Match either by name or id
    const matchedCelebrants = approvedMembers.filter(m => 
      celebrants.includes(m.name) || celebrants.includes(m.id)
    );

    if (matchedCelebrants.length === 0) {
      return res.status(404).json({ error: "No matching approved celebrant profiles found with valid emails." });
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port || "587"),
      secure: smtpConfig.port === "465",
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });

    const fromAddress = smtpConfig.from || `"Shalom Youth Fellowship" <${smtpConfig.user}>`;
    const results = [];

    for (const celebrant of matchedCelebrants) {
      if (!celebrant.email) {
        results.push({ name: celebrant.name, status: "skipped", reason: "No email address" });
        continue;
      }

      const wishAttachments: any[] = [];
      const resolved = await resolveAvatarForEmail(celebrant.avatar, celebrant.id, "avatar-wish");
      if (resolved.attachment) {
        wishAttachments.push(resolved.attachment);
      }
      const avatarSrc = resolved.src;

      // Render the gorgeous custom-designed birthday card HTML
      const celebrantCardHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Happy Birthday, ${celebrant.name}! 🎂</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #fafaf9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 550px; margin: 30px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #f5f5f4;">
            <tr>
              <td style="background: linear-gradient(135deg, #ec4899, #f43f5e, #f59e0b); padding: 50px 30px; text-align: center; color: white;">
                <div style="font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; background-color: rgba(255, 255, 255, 0.25); padding: 6px 16px; border-radius: 100px; display: inline-block; margin-bottom: 20px;">
                  Happy Birthday! ✨
                </div>
                <h1 style="margin: 0; font-size: 34px; font-weight: 900; letter-spacing: -0.03em; line-height: 1.1;">Wishing You A Wonderful Year Ahead!</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 40px 35px; text-align: center;">
                ${avatarSrc ? `
                  <img src="${avatarSrc}" alt="${celebrant.name}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 4px solid #fbcfe8; margin: 0 auto 24px auto;" referrerPolicy="no-referrer" />
                ` : `
                  <div style="width: 100px; height: 100px; border-radius: 50%; background-color: #fbcfe8; color: #db2777; line-height: 100px; font-size: 40px; font-weight: bold; margin: 0 auto 24px auto; text-align: center;">
                    🎂
                  </div>
                `}
                <h2 style="margin: 0 0 15px 0; font-size: 24px; font-weight: 800; color: #1c1917; letter-spacing: -0.025em;">Dear ${celebrant.name},</h2>
                <p style="margin: 0 0 30px 0; font-size: 15px; line-height: 1.7; color: #57534e;">
                  On behalf of the entire <strong>Shalom Youth Fellowship</strong>, we want to wish you the happiest of birthdays today! May your day be filled with endless joy, laughter, and precious memories. We are so blessed and grateful to have you as part of our community. Thank you for your warmth, energy, and dedication!
                </p>
                
                <div style="background-color: #fafaf9; border: 1px dashed #e7e5e4; border-radius: 16px; padding: 25px; margin: 30px 0; text-align: center;">
                  <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 800; color: #db2777; text-transform: uppercase; letter-spacing: 0.1em;">Daily Blessing</p>
                  <p style="margin: 0; font-size: 15px; font-style: italic; color: #44403c; line-height: 1.6;">
                    "The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you; the Lord turn his face toward you and give you peace."
                  </p>
                  <p style="margin: 8px 0 0 0; font-weight: bold; font-size: 12px; color: #78716c;">— Numbers 6:24-26</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background-color: #fafaf9; padding: 30px; text-align: center; border-top: 1px solid #f5f5f4; color: #78716c; font-size: 12px;">
                <p style="margin: 0 0 4px 0; font-weight: 800; color: #44403c; text-transform: uppercase; letter-spacing: 0.05em;">Shalom Youth Fellowship</p>
                <p style="margin: 0;">Spreading love, light, and fellowship together.</p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: fromAddress,
        to: celebrant.email.trim(),
        subject: `🎉 Happy Birthday, ${celebrant.name}! 🎂 - Shalom Youth Fellowship`,
        html: celebrantCardHtml,
        attachments: wishAttachments,
      });

      results.push({ name: celebrant.name, email: celebrant.email, status: "sent" });
    }

    res.json({ success: true, results });
  } catch (err: any) {
    console.error("Error sending birthday wishes:", err);
    res.status(500).json({ error: err.message || "Failed to send birthday wishes via SMTP" });
  }
});

// REST API endpoint to manually trigger birthday check & mail dispatch
app.post("/api/birthday-email/trigger", async (req, res) => {
  try {
    const force = req.body.force === true;
    const result = await checkAndSendBirthdayEmails(force);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to trigger birthday check" });
  }
});

// Start background interval check loop
// Runs every 15 minutes to accurately catch the 7:30 AM IST window
setInterval(() => {
  console.log("[Scheduler] Running automatic daily birthday check tick...");
  checkAndSendBirthdayEmails(false).catch(err => {
    console.error("[Scheduler] Error running background birthday check:", err);
  });
}, 15 * 60 * 1000); // 15 minutes

// Also trigger immediate check on server boot after 10 seconds to allow standard server startup first
setTimeout(() => {
  console.log("[Scheduler] Running initial boot-up birthday check...");
  checkAndSendBirthdayEmails(false).catch(err => {
    console.error("[Scheduler] Error running initial birthday check:", err);
  });
}, 10000);


// Vite integration middleware & static hosting
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
