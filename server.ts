import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import { supabase } from "./src/lib/supabase";
import { GoogleGenAI, Type } from "@google/genai";
import { createFootballRouter, initFootballSchedulers } from "./src/lib/footballServer";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Request logging middleware to diagnose route mismatch or host resolving issues
app.use((req, res, next) => {
  const logLine = `${new Date().toISOString()} | ${req.method} | ${req.originalUrl} | Host: ${req.headers.host} | Origin: ${req.headers.origin || "N/A"}\n`;
  try {
    fs.appendFileSync(path.join(process.cwd(), "server_request_log.txt"), logLine);
  } catch (err) {}
  next();
});

// Client logging endpoint to capture frontend variables and errors
app.post("/api/client-log", (req, res) => {
  try {
    const { log } = req.body;
    const logLine = `${new Date().toISOString()} | CLIENT_LOG | ${log}\n`;
    fs.appendFileSync(path.join(process.cwd(), "server_request_log.txt"), logLine);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mount Football router
app.use("/api/football", createFootballRouter());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const LOGS_FILE_PATH = path.join(process.cwd(), "birthday_logs.json");
const SMTP_CONFIG_FILE = path.join(process.cwd(), "smtp_config.json");
const META_CONFIG_FILE = path.join(process.cwd(), "meta_config.json");

interface MetaConfig {
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
  favicon: string;
  siteUrl: string;
}

const defaultMeta: MetaConfig = {
  title: "Shalom Youth Fellowship - JSAG",
  description: "Connecting youth, empowering faith, and celebrating fellowship at Shalom Youth Fellowship (Assembly of God Church)",
  keywords: "Shalom Youth, Youth Fellowship, Mizoram Assemblies of God Church, JSAG, CA, Christian Youth",
  ogImage: "/og-image.png",
  favicon: "/favicon.ico",
  siteUrl: "https://shalomyouth.netlify.app"
};

function getMetaConfig(): MetaConfig {
  try {
    if (fs.existsSync(META_CONFIG_FILE)) {
      const data = fs.readFileSync(META_CONFIG_FILE, "utf-8");
      return { ...defaultMeta, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error("Failed to read meta config file:", err);
  }
  return defaultMeta;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function injectMetaTags(html: string, config: MetaConfig): string {
  let cleanHtml = html.replace(/<title>[\s\S]*?<\/title>/gi, "");
  cleanHtml = cleanHtml.replace(/<meta name="description"[\s\S]*?>/gi, "");
  cleanHtml = cleanHtml.replace(/<meta name="keywords"[\s\S]*?>/gi, "");
  cleanHtml = cleanHtml.replace(/<meta property="og:[\s\S]*?>/gi, "");
  cleanHtml = cleanHtml.replace(/<meta name="twitter:[\s\S]*?>/gi, "");
  cleanHtml = cleanHtml.replace(/<link rel="icon"[\s\S]*?>/gi, "");
  cleanHtml = cleanHtml.replace(/<link rel="shortcut icon"[\s\S]*?>/gi, "");

  const metaString = `
    <title>${escapeHtml(config.title)}</title>
    <meta name="description" content="${escapeHtml(config.description)}" />
    <meta name="keywords" content="${escapeHtml(config.keywords)}" />
    <link rel="icon" href="${escapeHtml(config.favicon)}" />
    <link rel="shortcut icon" href="${escapeHtml(config.favicon)}" />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(config.siteUrl)}" />
    <meta property="og:title" content="${escapeHtml(config.title)}" />
    <meta property="og:description" content="${escapeHtml(config.description)}" />
    <meta property="og:image" content="${escapeHtml(config.ogImage)}" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${escapeHtml(config.siteUrl)}" />
    <meta name="twitter:title" content="${escapeHtml(config.title)}" />
    <meta name="twitter:description" content="${escapeHtml(config.description)}" />
    <meta name="twitter:image" content="${escapeHtml(config.ogImage)}" />
  `;

  if (cleanHtml.includes("<head>")) {
    return cleanHtml.replace("<head>", `<head>${metaString}`);
  }
  return cleanHtml;
}

interface SmtpConfig {
  host: string;
  port: string;
  user: string;
  pass: string;
  from?: string;
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  // Always query Supabase first as the primary truth for SMTP configurations
  try {
    const { data, error } = await supabase
      .from("smtp_configs")
      .select("*")
      .eq("id", "singleton")
      .single();

    if (!error && data && data.host && data.port && data.user && data.pass) {
      const dbConfig: SmtpConfig = {
        host: data.host,
        port: data.port,
        user: data.user,
        pass: data.pass,
        from: data.from
      };
      // Cache locally for offline resilience
      fs.writeFileSync(SMTP_CONFIG_FILE, JSON.stringify(dbConfig, null, 2), "utf-8");
      return dbConfig;
    }
  } catch (err: any) {
    console.error("Failed to fetch SMTP config from Supabase in getSmtpConfig:", err?.message || err);
  }

  // If Supabase query failed or returned no data, verify if the database connection itself is healthy and live
  let isDbConnected = false;
  try {
    const { error } = await supabase.from("profiles").select("id").limit(1);
    if (!error) {
      isDbConnected = true;
    }
  } catch (e) {
    isDbConnected = false;
  }

  // If the database is completely offline or unreachable, do NOT return any fallback or cached configs.
  // This ensures the fields are empty when the Supabase connection is not there.
  if (!isDbConnected) {
    return null;
  }

  const isDefaultPlaceholder = (user?: string) => {
    return !user || user.toLowerCase() === "jsagaizawl@gmail.com";
  };

  // Check env second
  if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
    if (!isDefaultPlaceholder(process.env.SMTP_USER)) {
      return {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM
      };
    }
  }

  // Check file third
  try {
    if (fs.existsSync(SMTP_CONFIG_FILE)) {
      const fileData = fs.readFileSync(SMTP_CONFIG_FILE, "utf-8");
      const config = JSON.parse(fileData) as SmtpConfig;
      if (config && config.host && config.port && config.user && config.pass) {
        if (!isDefaultPlaceholder(config.user)) {
          return config;
        }
      }
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
  status: "sent" | "simulated" | "failed" | "checked_no_birthdays";
  errorMessage?: string;
}

interface LogsStore {
  lastRunDate: string | null;
  lastUpcomingRunDate?: string | null;
  logs: BirthdayLog[];
}

// Load logs helper
function loadLogsStore(): LogsStore {
  try {
    if (fs.existsSync(LOGS_FILE_PATH)) {
      const data = fs.readFileSync(LOGS_FILE_PATH, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed) {
        return {
          lastRunDate: parsed.lastRunDate || null,
          lastUpcomingRunDate: parsed.lastUpcomingRunDate || null,
          logs: Array.isArray(parsed.logs) ? parsed.logs : []
        };
      }
    }
  } catch (err) {
    console.error("Failed to read birthday logs file:", err);
  }
  return { lastRunDate: null, lastUpcomingRunDate: null, logs: [] };
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
    const dobYear = parseInt(parts[0], 10);
    const dobMonth = parseInt(parts[1], 10);
    const dobDay = parseInt(parts[2], 10);
    const ist = getCurrentISTTime();
    
    // Skip if the birthday year is the current year or in the future
    if (dobYear >= ist.year) return false;
    
    return ist.month === dobMonth && ist.date === dobDay;
  }
  
  const dobDate = new Date(dobString);
  if (isNaN(dobDate.getTime())) return false;
  const ist = getCurrentISTTime();
  if (dobDate.getFullYear() >= ist.year) return false;
  return (dobDate.getMonth() + 1) === ist.month && dobDate.getDate() === ist.date;
};

// Helper to calculate target month/day for N days ahead in India Standard Time (IST)
function getISTDateInDays(daysAhead: number): { month: number; date: number } {
  const utcDate = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const targetDate = new Date(utcDate.getTime() + istOffsetMs + (daysAhead * 24 * 60 * 60 * 1000));
  return {
    month: targetDate.getUTCMonth() + 1,
    date: targetDate.getUTCDate()
  };
}

// Helper to determine if a member's birthday is upcoming in N days in India Standard Time (IST)
const isBirthdayInNDays = (dobString: string | undefined, daysAhead: number): boolean => {
  if (!dobString) return false;
  const parts = dobString.split('-');
  if (parts.length === 3) {
    const dobMonth = parseInt(parts[1], 10);
    const dobDay = parseInt(parts[2], 10);
    const target = getISTDateInDays(daysAhead);
    return target.month === dobMonth && target.date === dobDay;
  }
  
  const dobDate = new Date(dobString);
  if (isNaN(dobDate.getTime())) return false;
  const target = getISTDateInDays(daysAhead);
  return (dobDate.getMonth() + 1) === target.month && dobDate.getDate() === target.date;
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
      const logEntry: BirthdayLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        timestamp: new Date().toISOString(),
        celebrants: [],
        recipientCount: 0,
        recipients: [],
        subject: "No Birthdays Today",
        body: "<div style='padding: 20px; font-family: sans-serif; text-align: center; color: #6b7280; font-weight: bold;'>Today's automated system scan found no active member birthdays in the database.</div>",
        status: "checked_no_birthdays"
      };
      store.logs.unshift(logEntry);
      if (store.logs.length > 50) {
        store.logs = store.logs.slice(0, 50);
      }
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

    // 4. Send a separate email for each celebrant
    const smtpConfig = await getSmtpConfig();
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    for (const c of celebrants) {
      const celebrantsNames = [c.name];
      const subject = `🎉 Happy Birthday, ${c.name}! 🎂 - Shalom Youth Fellowship`;

      const autoAttachments: any[] = [];
      const resolved = await resolveAvatarForEmail(c.avatar, c.id, "avatar-auto");
      if (resolved.attachment) {
        autoAttachments.push(resolved.attachment);
      }
      const avatarSrc = resolved.src;

      const celebrantsHtml = `
      <div style="background-color: #f3f0ff; border-radius: 16px; padding: 20px; margin-bottom: 16px; border: 1px solid #e9d5ff; text-align: center;">
        ${avatarSrc ? `
          <img src="${avatarSrc}" alt="${c.name}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 12px; border: 3px solid #a855f7;" referrerPolicy="no-referrer" />
        ` : `
          <div style="width: 80px; height: 80px; border-radius: 50%; background-color: #a855f7; color: white; line-height: 80px; font-size: 32px; font-weight: bold; margin: 0 auto 12px auto; text-align: center;">
            ${c.name.charAt(0).toUpperCase()}
          </div>
        `}
        <h3 style="margin: 0 0 4px 0; color: #581c87; font-size: 20px; font-family: sans-serif; font-weight: bold;">${c.name}</h3>
        <p style="margin: 0; color: #701a75; font-size: 14px; font-family: sans-serif; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">${c.role || 'Member'}</p>
      </div>
      `;

      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Happy Birthday, ${c.name}! 🎂</title>
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
                <img src="${avatarSrc}" alt="${c.name}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 4px solid #fbcfe8; margin: 0 auto 24px auto;" referrerPolicy="no-referrer" />
              ` : `
                <div style="width: 100px; height: 100px; border-radius: 50%; background-color: #fbcfe8; color: #db2777; line-height: 100px; font-size: 40px; font-weight: bold; margin: 0 auto 24px auto; text-align: center;">
                  🎂
                </div>
              `}
              <h2 style="margin: 0 0 15px 0; font-size: 24px; font-weight: 800; color: #1c1917; letter-spacing: -0.025em;">Dear ${c.name},</h2>
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
          console.log(`[SMTP] Successfully dispatched daily birthday email for: ${c.name}`);
        } catch (err: any) {
          console.error(`[SMTP] Error sending birthday email for ${c.name}, falling back to simulated:`, err);
          sendStatus = "failed";
          errorMsg = err?.message || String(err);
        }
      } else {
        console.log("\n==================================================");
        console.log("📢 [SIMULATED EMAIL DISPATCH]");
        console.log(`SUBJECT: ${subject}`);
        console.log(`RECIPIENTS (${recipientEmails.length}): ${recipientEmails.join(", ")}`);
        console.log(`CELEBRANT: ${c.name}`);
        console.log("==================================================\n");
      }

      // Record the log entry
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

      store.logs.unshift(logEntry);
    }

    if (store.logs.length > 50) {
      store.logs = store.logs.slice(0, 50);
    }

    saveLogsStore(store);

    return {
      checked: true,
      celebrantsFound: celebrants.length,
      emailsSent: !!smtpConfig,
      status: `Successfully processed ${celebrants.length} individual celebrant(s).`
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

// Check and notify upcoming birthdays (3 days ahead) to secretaries and admins
async function checkAndNotifyUpcomingBirthdays(force = false): Promise<{
  checked: boolean;
  upcomingFound: number;
  emailsSent: boolean;
  status: string;
}> {
  const store = loadLogsStore();
  const ist = getCurrentISTTime();
  const todayString = `${ist.year}-${String(ist.month).padStart(2, '0')}-${String(ist.date).padStart(2, '0')}`;

  // If already run today and not forced, skip
  if (store.lastUpcomingRunDate === todayString && !force) {
    return {
      checked: false,
      upcomingFound: 0,
      emailsSent: false,
      status: `Upcoming check already completed today (${todayString}).`
    };
  }

  // Same time check as daily birthdays (on or after 7:30 AM IST) unless forced
  if (!force) {
    const isTimeToSend = ist.hours > 7 || (ist.hours === 7 && ist.minutes >= 30);
    if (!isTimeToSend) {
      return {
        checked: false,
        upcomingFound: 0,
        emailsSent: false,
        status: `Skipped: Currently ${String(ist.hours).padStart(2, '0')}:${String(ist.minutes).padStart(2, '0')} IST. Automatic upcoming check only runs on or after 7:30 AM IST.`
      };
    }
  }

  try {
    // 1. Fetch approved members from Supabase profiles
    const { data: members, error } = await supabase
      .from("profiles")
      .select("*");

    if (error) {
      throw new Error(`Failed to fetch members for upcoming birthdays: ${error.message}`);
    }

    if (!members || members.length === 0) {
      store.lastUpcomingRunDate = todayString;
      saveLogsStore(store);
      return {
        checked: true,
        upcomingFound: 0,
        emailsSent: false,
        status: "No registered members found."
      };
    }

    const approvedMembers = members.filter(m => m.status === "approved");

    // 2. Find members whose birthday is exactly 3 days from now
    const upcomingCelebrants = approvedMembers.filter(m => m.dob && isBirthdayInNDays(m.dob, 3));

    store.lastUpcomingRunDate = todayString;
    saveLogsStore(store);

    if (upcomingCelebrants.length === 0) {
      return {
        checked: true,
        upcomingFound: 0,
        emailsSent: false,
        status: "No upcoming birthdays in 3 days today."
      };
    }

    // 3. Find admin/secretary emails
    const adminsAndSecretaries = approvedMembers.filter(m => 
      m.role === "Admin" || 
      m.role === "Secretary" || 
      m.role === "Assistant Secretary" || 
      m.email?.toLowerCase() === "tkpaite2016@gmail.com"
    );

    const adminEmails = Array.from(new Set(
      adminsAndSecretaries
        .map(m => m.email?.trim().toLowerCase())
        .filter(Boolean)
    ));

    if (adminEmails.length === 0) {
      adminEmails.push("tkpaite2016@gmail.com"); // Fallback admin email
    }

    const smtpConfig = await getSmtpConfig();
    if (!smtpConfig) {
      console.log("[SMTP] Cannot notify upcoming birthdays: SMTP config not found or invalid.");
      return {
        checked: true,
        upcomingFound: upcomingCelebrants.length,
        emailsSent: false,
        status: "SMTP not configured. Skipped sending notifications."
      };
    }

    // 4. Send email notification to admins/secretaries
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

    for (const c of upcomingCelebrants) {
      const subject = `🔔 Birthday Alert: ${c.name} has a birthday in 3 days! 🎂`;
      const appUrl = process.env.APP_URL || "https://shalomyouth.netlify.app";

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Upcoming Birthday Alert</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #fafaf9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 550px; margin: 30px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #f5f5f4;">
            <tr>
              <td style="background: linear-gradient(135deg, #4f46e5, #818cf8); padding: 40px 30px; text-align: center; color: white;">
                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; background-color: rgba(255, 255, 255, 0.2); padding: 6px 16px; border-radius: 100px; display: inline-block; margin-bottom: 15px;">
                  Upcoming Celebration Alert 🔔
                </div>
                <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.2;">Birthday Upcoming in 3 Days!</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 40px 35px;">
                <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #44403c;">
                  Hello Secretary / Admin,
                </p>
                <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #44403c;">
                  This is an automated notification to alert you that the following member has an upcoming birthday in <strong>3 days</strong>. Please prepare to celebrate and welcome them:
                </p>

                <!-- Member Card -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fafaf9; border-radius: 16px; border: 1px solid #e7e5e4; margin-bottom: 30px;">
                  <tr>
                    <td style="padding: 20px; text-align: center; width: 100px; vertical-align: top;">
                      ${c.avatar ? `
                        <img src="${c.avatar}" alt="${c.name}" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 3px solid #e0e7ff;" />
                      ` : `
                        <div style="width: 70px; height: 70px; border-radius: 50%; background-color: #e0e7ff; color: #4f46e5; line-height: 70px; font-size: 28px; font-weight: bold; text-align: center;">
                          ${c.name.charAt(0).toUpperCase()}
                        </div>
                      `}
                    </td>
                    <td style="padding: 20px 20px 20px 0; vertical-align: top;">
                      <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 800; color: #1c1917;">${c.name}</h3>
                      <p style="margin: 0 0 12px 0; font-size: 13px; color: #4f46e5; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">${c.role || 'Member'}</p>
                      
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; color: #57534e; line-height: 1.6;">
                        <tr>
                          <td style="width: 90px; font-weight: bold; padding-bottom: 4px;">Date of Birth:</td>
                          <td style="padding-bottom: 4px;">${c.dob}</td>
                        </tr>
                        ${c.bial ? `
                        <tr>
                          <td style="font-weight: bold; padding-bottom: 4px;">Bial (Branch):</td>
                          <td style="padding-bottom: 4px;">${c.bial}</td>
                        </tr>
                        ` : ''}
                        ${c.phone ? `
                        <tr>
                          <td style="font-weight: bold; padding-bottom: 4px;">Phone:</td>
                          <td style="padding-bottom: 4px;">${c.phone}</td>
                        </tr>
                        ` : ''}
                        ${c.email ? `
                        <tr>
                          <td style="font-weight: bold;">Email:</td>
                          <td>${c.email}</td>
                        </tr>
                        ` : ''}
                      </table>
                    </td>
                  </tr>
                </table>

                <div style="text-align: center; margin: 30px 0 10px 0;">
                  <a href="${appUrl}" style="background-color: #4f46e5; color: white; text-decoration: none; padding: 12px 28px; font-weight: bold; font-size: 14px; border-radius: 12px; display: inline-block;">
                    Open Shalom Youth Portal 🚀
                  </a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background-color: #fafaf9; padding: 24px; text-align: center; border-top: 1px solid #f5f5f4; color: #78716c; font-size: 12px;">
                <p style="margin: 0 0 4px 0; font-weight: 800; color: #44403c;">Shalom Youth Fellowship</p>
                <p style="margin: 0;">This email was automatically generated and sent to the Secretary & Admin list.</p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      // Send to all administrators/secretaries directly
      for (const adminEmail of adminEmails) {
        await transporter.sendMail({
          from: fromAddress,
          to: adminEmail,
          subject: subject,
          html: htmlContent,
        });
        console.log(`[SMTP] Successfully sent upcoming birthday alert for ${c.name} to admin ${adminEmail}`);
      }
    }

    return {
      checked: true,
      upcomingFound: upcomingCelebrants.length,
      emailsSent: true,
      status: `Successfully notified admins/secretaries about ${upcomingCelebrants.length} upcoming birthday(s).`
    };

  } catch (err: any) {
    console.error("Error running upcoming birthday check task:", err);
    return {
      checked: true,
      upcomingFound: 0,
      emailsSent: false,
      status: `Error: ${err.message || err}`
    };
  }
}

// REST API endpoint to retrieve birthday logs
app.get("/api/birthday-email/status", async (req, res) => {
  const store = loadLogsStore();
  const smtpConfig = await getSmtpConfig();
  res.json({
    lastRunDate: store.lastRunDate,
    logs: store.logs,
    smtpConfigured: !!smtpConfig
  });
});

// REST API endpoint to load SMTP configuration (Only accessible to tkpaite2016@gmail.com)
app.get("/api/birthday-email/smtp-config", async (req, res) => {
  const requesterEmail = req.query.email as string;
  if (!requesterEmail || requesterEmail.toLowerCase() !== "tkpaite2016@gmail.com") {
    return res.status(403).json({ error: "Access Denied: SMTP configurations are restricted." });
  }

  const config = await getSmtpConfig();
  if (config) {
    res.json({
      host: config.host,
      port: config.port,
      user: config.user,
      from: config.from,
      hasPassword: !!config.pass,
      pass: config.pass || ""
    });
  } else {
    res.json(null);
  }
});

// REST API endpoint to save SMTP configuration (Only accessible to tkpaite2016@gmail.com)
app.post("/api/birthday-email/smtp-config", async (req, res) => {
  const { requesterEmail, host, port, user, pass, from } = req.body;
  if (!requesterEmail || requesterEmail.toLowerCase() !== "tkpaite2016@gmail.com") {
    return res.status(403).json({ error: "Access Denied: SMTP configurations are restricted." });
  }

  try {
    const existing = await getSmtpConfig();
    const finalPass = (pass !== undefined && pass !== null) ? pass : (existing?.pass || "");
    const config: SmtpConfig = { host, port, user, pass: finalPass, from };
    
    // 1. Save locally
    fs.writeFileSync(SMTP_CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");

    // 2. Upsert in Supabase for persistence across deployments/restarts
    const { error: dbError } = await supabase
      .from("smtp_configs")
      .upsert({
        id: "singleton",
        host,
        port,
        user,
        pass: finalPass,
        from,
        updated_at: new Date().toISOString()
      });

    if (dbError) {
      console.warn("[SMTP Config Sync] Supabase upsert failed (operating on local file fallback):", dbError.message);
    }

    res.json({ 
      success: true, 
      message: "SMTP configuration successfully updated and persisted to database.",
      dbSynced: !dbError
    });
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

  const smtpConfig = await getSmtpConfig();
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
    
    // Also trigger the upcoming birthday email notification system
    try {
      await checkAndNotifyUpcomingBirthdays(force);
    } catch (upcomingErr: any) {
      console.error("[Scheduler] Manual upcoming birthday alert trigger failed:", upcomingErr);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to trigger birthday check" });
  }
});

// REST API endpoint to trigger a test preview email to an admin's own address
app.post("/api/birthday-email/preview-email", async (req, res) => {
  const { adminEmail, smtpConfig } = req.body;

  if (!adminEmail || adminEmail.toLowerCase() !== "tkpaite2016@gmail.com") {
    return res.status(403).json({ error: "Access Denied: Only administrators can trigger test emails." });
  }

  // Determine which SMTP configuration to use
  const savedSmtpConfig = await getSmtpConfig();
  const host = smtpConfig?.host || savedSmtpConfig?.host;
  const port = smtpConfig?.port || savedSmtpConfig?.port;
  const user = smtpConfig?.user || savedSmtpConfig?.user;
  const pass = smtpConfig?.pass || savedSmtpConfig?.pass;
  const from = smtpConfig?.from || savedSmtpConfig?.from;

  if (!host || !port || !user || !pass) {
    return res.status(400).json({ error: "SMTP is not fully configured yet. Please enter Host, Port, Username, and Password." });
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port || "587"),
      secure: port === "465",
      auth: {
        user,
        pass,
      },
    });

    const fromAddress = from || `"Shalom Youth Fellowship" <${user}>`;

    const testCelebrant = {
      name: "Test Member (John Doe)",
      role: "Youth Member",
    };

    const appUrl = process.env.APP_URL || "https://shalomyouth.netlify.app";

    const celebrantsHtml = `
      <div style="background-color: #f3f0ff; border-radius: 16px; padding: 20px; margin-bottom: 16px; border: 1px solid #e9d5ff; text-align: center;">
        <div style="width: 80px; height: 80px; border-radius: 50%; background-color: #a855f7; color: white; line-height: 80px; font-size: 32px; font-weight: bold; margin: 0 auto 12px auto; text-align: center;">
          J
        </div>
        <h3 style="margin: 0 0 4px 0; color: #581c87; font-size: 20px; font-family: sans-serif; font-weight: bold;">${testCelebrant.name}</h3>
        <p style="margin: 0; color: #701a75; font-size: 14px; font-family: sans-serif; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">${testCelebrant.role}</p>
      </div>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Shalom Youth Birthday Celebration [TEST PREVIEW]</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
          <tr>
            <td style="background-color: #f59e0b; padding: 10px; text-align: center; color: white; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; font-family: sans-serif;">
              ⚠️ SMTP Configuration Test Preview Email
            </td>
          </tr>
          <tr>
            <td style="background: linear-gradient(135deg, #ec4899, #8b5cf6, #6366f1); padding: 40px 20px; text-align: center; color: white;">
              <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; background-color: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 100px; font-family: sans-serif;">Shalom Youth Fellowship</span>
              <h1 style="margin: 15px 0 0 0; font-size: 32px; font-weight: 800; letter-spacing: -0.025em; text-shadow: 0 2px 4px rgba(0,0,0,0.15); font-family: sans-serif;">Birthday Celebration! 🎉</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #374151; font-family: sans-serif;">
                This is a test email sent from the <strong>Shalom Youth Fellowship Profile & Birthday Portal</strong> to verify that your SMTP configuration and email template are functioning perfectly.
              </p>
              ${celebrantsHtml}
              <div style="background-color: #f9fafb; border-left: 4px solid #8b5cf6; border-radius: 4px; padding: 16px; margin: 24px 0; font-style: italic; color: #4b5563; font-family: sans-serif;">
                "The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you; the Lord turn his face toward you and give you peace." 
                <div style="text-align: right; font-weight: bold; font-size: 12px; margin-top: 8px; color: #6b7280; font-style: normal;">— Numbers 6:24-26</div>
              </div>
              <div style="text-align: center; margin: 30px 0 10px 0;">
                <a href="${appUrl}" style="background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; text-decoration: none; padding: 14px 32px; font-weight: bold; font-size: 16px; border-radius: 100px; display: inline-block; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3); font-family: sans-serif;">
                  Send a Birthday Wish! 🎁
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; font-family: sans-serif;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #4b5563;">Shalom Youth Fellowship</p>
              <p style="margin: 0;">You are receiving this test email because you are configuring SMTP on the Shalom Youth admin panel.</p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: fromAddress,
      to: adminEmail,
      subject: `[TEST PREVIEW] 🎉 Shalom Youth Birthday Celebration! 🎂`,
      html: htmlContent,
    });

    res.json({ success: true, message: `A preview email has been successfully sent to ${adminEmail}!` });
  } catch (err: any) {
    console.error("Error sending preview email:", err);
    res.status(500).json({ error: err.message || "Failed to send SMTP test preview email." });
  }
});

// Start background interval check loop
// Runs every 15 minutes to accurately catch the 7:30 AM IST window
setInterval(() => {
  console.log("[Scheduler] Running automatic daily birthday check tick...");
  checkAndSendBirthdayEmails(false).catch(err => {
    console.error("[Scheduler] Error running background birthday check:", err);
  });
  checkAndNotifyUpcomingBirthdays(false).catch(err => {
    console.error("[Scheduler] Error running background upcoming birthday check:", err);
  });
}, 15 * 60 * 1000); // 15 minutes

// Also trigger immediate check on server boot after 10 seconds to allow standard server startup first
setTimeout(() => {
  console.log("[Scheduler] Running initial boot-up birthday check...");
  checkAndSendBirthdayEmails(false).catch(err => {
    console.error("[Scheduler] Error running initial birthday check:", err);
  });
  checkAndNotifyUpcomingBirthdays(false).catch(err => {
    console.error("[Scheduler] Error running initial upcoming birthday check:", err);
  });
}, 10000);

// Helper to pull meta config from Supabase on server boot
async function syncMetaConfigFromDb() {
  try {
    const { data, error } = await supabase
      .from("meta_configs")
      .select("*")
      .eq("id", "singleton")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        console.log("[MetaConfig Sync] No meta_config row found in Supabase. Initializing table with default JSAG settings...");
        const { error: insertError } = await supabase
          .from("meta_configs")
          .insert({
            id: "singleton",
            title: defaultMeta.title,
            description: defaultMeta.description,
            keywords: defaultMeta.keywords,
            og_image: defaultMeta.ogImage,
            favicon: defaultMeta.favicon,
            site_url: defaultMeta.siteUrl,
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error("[MetaConfig Sync] Failed to insert default JSAG meta configurations in Supabase:", insertError.message);
        } else {
          console.log("[MetaConfig Sync] Successfully populated 'meta_configs' table with default JSAG configurations.");
        }
      } else {
        console.log("[MetaConfig Sync] Supabase table 'meta_configs' select returned error (may not be created yet):", error.message);
      }
      return;
    }

    if (data) {
      const dbConfig: MetaConfig = {
        title: data.title || defaultMeta.title,
        description: data.description || defaultMeta.description,
        keywords: data.keywords || defaultMeta.keywords,
        ogImage: data.og_image || defaultMeta.ogImage,
        favicon: data.favicon || defaultMeta.favicon,
        siteUrl: data.site_url || defaultMeta.siteUrl
      };
      fs.writeFileSync(META_CONFIG_FILE, JSON.stringify(dbConfig, null, 2), "utf-8");
      console.log("[MetaConfig Sync] Successfully synchronized metadata settings from Supabase database to local cache.");
    }
  } catch (err: any) {
    console.error("[MetaConfig Sync] Error pulling meta config from Supabase:", err.message || err);
  }
}

// Helper to pull SMTP config from Supabase on server boot
async function syncSmtpConfigFromDb() {
  try {
    const { data, error } = await supabase
      .from("smtp_configs")
      .select("*")
      .eq("id", "singleton")
      .single();

    if (error) {
      console.log("[SMTP Config Sync] Supabase table 'smtp_configs' select returned error (may not be created yet):", error.message);
      return;
    }

    if (data) {
      const dbConfig: SmtpConfig = {
        host: data.host,
        port: data.port,
        user: data.user,
        pass: data.pass,
        from: data.from
      };
      fs.writeFileSync(SMTP_CONFIG_FILE, JSON.stringify(dbConfig, null, 2), "utf-8");
      console.log("[SMTP Config Sync] Successfully synchronized SMTP credentials from Supabase database to local cache.");
    }
  } catch (err: any) {
    console.error("[SMTP Config Sync] Error pulling SMTP config from Supabase:", err.message || err);
  }
}

// Trigger initial configurations synchronization 3 seconds after server start
setTimeout(() => {
  console.log("[Scheduler] Performing initial meta & SMTP configurations sync with Supabase...");
  syncMetaConfigFromDb().catch(err => {
    console.error("[Scheduler] Meta configurations sync error:", err);
  });
  syncSmtpConfigFromDb().catch(err => {
    console.error("[Scheduler] SMTP configurations sync error:", err);
  });
  // Initialize Football prediction background sync schedules
  initFootballSchedulers();
}, 3000);


// REST API endpoints for Website Meta / OG Configurations
app.get("/api/meta-config", (req, res) => {
  res.json(getMetaConfig());
});

app.post("/api/meta-config", async (req, res) => {
  const { requesterEmail, title, description, keywords, ogImage, favicon, siteUrl } = req.body;
  if (!requesterEmail || requesterEmail.toLowerCase() !== "tkpaite2016@gmail.com") {
    return res.status(403).json({ error: "Access Denied: Meta configuration is restricted to tkpaite2016@gmail.com." });
  }

  try {
    const config: MetaConfig = { title, description, keywords, ogImage, favicon, siteUrl };
    // 1. Persist locally first
    fs.writeFileSync(META_CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");

    // 2. Persist in Supabase Database
    const { error: dbError } = await supabase
      .from("meta_configs")
      .upsert({
        id: "singleton",
        title,
        description,
        keywords,
        og_image: ogImage,
        favicon,
        site_url: siteUrl,
        updated_at: new Date().toISOString()
      });

    if (dbError) {
      console.warn("[MetaConfig Sync] DB upsert failed, operating on local cache:", dbError.message);
      return res.json({
        success: true,
        message: "Meta configurations saved locally, but database sync was skipped. (Ensure the 'meta_configs' table exists in Supabase by running the setup SQL)",
        dbSynced: false
      });
    }

    res.json({
      success: true,
      message: "Meta configurations successfully saved and synchronized in the Supabase database too!",
      dbSynced: true
    });
  } catch (err: any) {
    console.error("[MetaConfig Sync] Error during meta configuration save:", err);
    res.status(500).json({ error: err.message || "Failed to save meta configurations" });
  }
});


// Smart Face Detection & Crop Parameter Generator Endpoint using Gemini
app.post("/api/detect-face", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image data provided" });
    }

    let base64Data = image;
    let mimeType = "image/jpeg";

    if (image.startsWith("data:")) {
      const parts = image.split(";base64,");
      if (parts.length === 2) {
        mimeType = parts[0].substring(5);
        base64Data = parts[1];
      }
    }

    const imagePart = {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    };

    const promptText = `
Locate the primary person's face/head in this photo. Determine the optimal cropping bounding box to produce a professional passport-style headshot (which includes the entire head, face, neck, and upper chest/shoulders, with balanced space above the head). Ensure the aspect ratio is exactly 1:1 (square).

Return the bounding box coordinates normalized as float values between 0.0 and 1.0 relative to the image boundaries:
- top: distance from top of image (0.0 to 1.0)
- left: distance from left of image (0.0 to 1.0)
- right: distance from left of image to the right edge of crop box (0.0 to 1.0)
- bottom: distance from top of image to the bottom edge of crop box (0.0 to 1.0)
`;

    const modelsToTry = [
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash",
      "gemini-flash-latest"
    ];

    let result = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      let success = false;
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[FaceDetection] Attempting face detection with model: ${modelName} (Attempt ${attempt}/${maxRetries})`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [imagePart, promptText],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  top: { type: Type.NUMBER, description: "Top coordinate of the crop box (0.0 to 1.0)" },
                  left: { type: Type.NUMBER, description: "Left coordinate of the crop box (0.0 to 1.0)" },
                  right: { type: Type.NUMBER, description: "Right coordinate of the crop box (0.0 to 1.0)" },
                  bottom: { type: Type.NUMBER, description: "Bottom coordinate of the crop box (0.0 to 1.0)" },
                },
                required: ["top", "left", "right", "bottom"],
              },
            },
          });

          const jsonText = response.text || "";
          const parsed = JSON.parse(jsonText.trim());
          if (
            typeof parsed.top === "number" &&
            typeof parsed.left === "number" &&
            typeof parsed.right === "number" &&
            typeof parsed.bottom === "number"
          ) {
            result = parsed;
            console.log(`[FaceDetection] Success with model: ${modelName}. Result:`, result);
            success = true;
            break;
          }
        } catch (err: any) {
          console.warn(`[FaceDetection] Model ${modelName} attempt ${attempt} failed:`, err.message || err);
          lastError = err;
          
          const isRetriable = 
            err.message?.includes("503") || 
            err.message?.includes("UNAVAILABLE") || 
            err.message?.includes("high demand") || 
            err.message?.includes("429");
            
          if (isRetriable && attempt < maxRetries) {
            const backoff = 500 * Math.pow(2, attempt - 1);
            console.log(`[FaceDetection] Temporary error. Retrying ${modelName} in ${backoff}ms...`);
            await new Promise((resolve) => setTimeout(resolve, backoff));
          } else {
            break;
          }
        }
      }
      if (success) break;
      
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (!result) {
      console.warn(
        `[FaceDetection] All Gemini face-detection models failed. Falling back to default centered square bounding box. Last error:`,
        lastError ? lastError.message || lastError : "unknown"
      );
      // Fallback to a default centered square bounding box
      result = {
        top: 0.15,
        left: 0.15,
        right: 0.85,
        bottom: 0.85
      };
    }

    res.json(result);
  } catch (err: any) {
    console.error("[FaceDetection] Fatal error in face-detection endpoint:", err);
    // If anything fails in the outer try, return the default crop box instead of 500 error to ensure flawless UX
    res.json({
      top: 0.15,
      left: 0.15,
      right: 0.85,
      bottom: 0.85
    });
  }
});

// Explicit API Route Handlers for 404 and 500 Errors (ensures strict JSON responses)
app.use("/api/*", (req: express.Request, res: express.Response) => {
  res.status(404).json({ error: `API route ${req.method} ${req.baseUrl || req.originalUrl} not found` });
});

app.use("/api/*", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[API Middleware Error Handler]:", err);
  res.status(500).json({ error: err.message || "An unexpected API error occurred" });
});


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
      const htmlPath = path.join(distPath, "index.html");
      try {
        if (fs.existsSync(htmlPath)) {
          let html = fs.readFileSync(htmlPath, "utf-8");
          const config = getMetaConfig();
          html = injectMetaTags(html, config);
          res.send(html);
        } else {
          res.status(404).send("Not Found");
        }
      } catch (err) {
        console.error("Failed to serve injected HTML:", err);
        res.sendFile(htmlPath);
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
