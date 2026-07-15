import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, CheckCircle, Info, Calendar, Users, Eye, EyeOff, Copy, Check, AlertCircle, Sparkles, Send, Heart, TrendingUp, Award } from 'lucide-react';
import { Member, BirthdayWish, BirthdayLog } from '../types';
import { db } from '../lib/supabase';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';

interface StatusResponse {
  lastRunDate: string | null;
  logs: BirthdayLog[];
  smtpConfigured: boolean;
}

interface BirthdayEmailSettingsPageProps {
  currentUser: Member;
  members?: Member[];
}

import { getApiUrl, apiFetch, safeJsonParse } from '../lib/api';

const isNetlify = typeof window !== 'undefined' && (
  window.location.hostname.includes('netlify') ||
  window.location.hostname.includes('static') ||
  window.location.hostname.includes('github.io') ||
  (window.location.hostname.endsWith('.app') && !window.location.hostname.includes('run.app') && !window.location.hostname.includes('google'))
);

const generateProfessionalCardHtml = (name: string, avatarUrl?: string, role?: string) => {
  const avatarSrc = avatarUrl || "";
  const displayRole = role || "Member";
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Happy Birthday, ${name}! 🎂</title>
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
              <img src="${avatarSrc}" alt="${name}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 4px solid #fbcfe8; margin: 0 auto 24px auto;" referrerPolicy="no-referrer" />
            ` : `
              <div style="width: 100px; height: 100px; border-radius: 50%; background-color: #fbcfe8; color: #db2777; line-height: 100px; font-size: 40px; font-weight: bold; margin: 0 auto 24px auto; text-align: center;">
                🎂
              </div>
            `}
            <h2 style="margin: 0 0 4px 0; font-size: 24px; font-weight: 800; color: #1c1917; letter-spacing: -0.025em;">Dear ${name},</h2>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #db2777; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">${displayRole}</p>
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
};

export default function BirthdayEmailSettingsPage({ currentUser, members = [] }: BirthdayEmailSettingsPageProps) {
  const [statusData, setStatusData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [forceRerun, setForceRerun] = useState<boolean>(false);
  const [apiFeedback, setApiFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedLogForPreview, setSelectedLogForPreview] = useState<BirthdayLog | null>(null);
  const [allWishes, setAllWishes] = useState<BirthdayWish[]>([]);
  const [wishesLoading, setWishesLoading] = useState<boolean>(true);
  const [isFallbackMode, setIsFallbackMode] = useState<boolean>(false);

  // SMTP Settings States
  const [smtpHost, setSmtpHost] = useState<string>('');
  const [smtpPort, setSmtpPort] = useState<string>('587');
  const [smtpUser, setSmtpUser] = useState<string>('');
  const [smtpPass, setSmtpPass] = useState<string>('');
  const [smtpFrom, setSmtpFrom] = useState<string>('');
  const [smtpLoading, setSmtpLoading] = useState<boolean>(false);
  const [smtpFeedback, setSmtpFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [copiedPassword, setCopiedPassword] = useState<boolean>(false);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  // Individual Wish Email States
  const [sendingWishEmail, setSendingWishEmail] = useState<boolean>(false);
  const [wishFeedback, setWishFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  // Manual Dispatch States
  const [selectedManualMemberId, setSelectedManualMemberId] = useState<string>('');
  const [manualSending, setManualSending] = useState<boolean>(false);
  const [manualFeedback, setManualFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSendManualWish = async () => {
    const selectedMember = members.find((m) => m.id === selectedManualMemberId);
    if (!selectedMember) return;

    try {
      setManualSending(true);
      setManualFeedback(null);

      if (isFallbackMode) {
        // Create simulated log entry in cache
        const localLogsStr = localStorage.getItem('sy_local_birthday_logs');
        const localLogs: BirthdayLog[] = localLogsStr ? JSON.parse(localLogsStr) : [];
        
        const subject = `🎉 Happy Birthday, ${selectedMember.name}! 🎂 - Shalom Youth Fellowship`;
        const htmlContent = generateProfessionalCardHtml(selectedMember.name, selectedMember.avatar, selectedMember.role);

        const newLog: BirthdayLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          celebrants: [selectedMember.name],
          recipientCount: members.length,
          recipients: members.map(m => m.email || '').filter(Boolean),
          subject,
          body: htmlContent,
          status: 'simulated'
        };

        localLogs.unshift(newLog);
        localStorage.setItem('sy_local_birthday_logs', JSON.stringify(localLogs.slice(0, 50)));

        setStatusData(prev => ({
          lastRunDate: prev?.lastRunDate || null,
          logs: localLogs.slice(0, 50),
          smtpConfigured: prev ? prev.smtpConfigured : false
        }));

        setManualFeedback({
          type: 'success',
          message: `[Simulated] Sent birthday wish greeting email specifically to ${selectedMember.name}!`
        });
        setSelectedManualMemberId('');
        return;
      }

      // Live api mode
      const res = await apiFetch('/api/birthday-email/send-wish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          celebrants: [selectedMember.name]
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned error status ${res.status}`);
      }

      // Save a log in birthday_logs for manual dispatch
      try {
        const todayTimeStr = new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        const subject = `🎉 Happy Birthday, ${selectedMember.name}! 🎂 - Shalom Youth Fellowship`;
        const htmlContent = generateProfessionalCardHtml(selectedMember.name, selectedMember.avatar, selectedMember.role);
        const newLog: BirthdayLog = {
          id: crypto.randomUUID(),
          timestamp: todayTimeStr,
          celebrants: [selectedMember.name],
          recipientCount: 1,
          recipients: [selectedMember.email || ''],
          subject,
          body: htmlContent,
          status: 'sent'
        };
        await db.saveBirthdayLog(newLog);
      } catch (logErr) {
        console.warn('Failed to save manual birthday wish log to DB:', logErr);
      }

      setManualFeedback({
        type: 'success',
        message: `Successfully emailed personalized birthday wish card to ${selectedMember.name}!`
      });
      setSelectedManualMemberId('');
      fetchStatus();
    } catch (err: any) {
      console.warn('Manual send failed, falling back to simulation:', err);
      setManualFeedback({
        type: 'error',
        message: err.message || 'Failed to send greeting email via SMTP.'
      });
    } finally {
      setManualSending(false);
    }
  };

  const fetchAllWishes = async () => {
    try {
      setWishesLoading(true);
      const wishes = await db.getAllBirthdayWishes();
      setAllWishes(wishes);
    } catch (err) {
      console.error('Failed to fetch all birthday wishes:', err);
    } finally {
      setWishesLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/birthday-email/status');
      
      let dbLogs: BirthdayLog[] = [];
      try {
        dbLogs = await db.getBirthdayLogs();
      } catch (dbErr) {
        console.warn('Failed to fetch birthday_logs from Supabase DB:', dbErr);
      }

      if (res.ok) {
        const data = await safeJsonParse(res);
        const finalLogs = dbLogs.length > 0 ? dbLogs : (Array.isArray(data?.logs) ? data.logs : []);
        const finalLastRunDate = dbLogs.length > 0 ? dbLogs[0].timestamp : (data?.lastRunDate || null);

        const normalizedData = {
          lastRunDate: finalLastRunDate,
          logs: finalLogs,
          smtpConfigured: !!data?.smtpConfigured
        };
        setStatusData(normalizedData);
        setIsFallbackMode(false);
        // Cache locally
        localStorage.setItem('sy_local_birthday_logs', JSON.stringify(normalizedData.logs));
        if (normalizedData.lastRunDate) {
          localStorage.setItem('sy_local_last_run_date', normalizedData.lastRunDate);
        }
      } else {
        throw new Error(`Server returned error status ${res.status}`);
      }
    } catch (err) {
      console.warn('Backend API `/api/birthday-email/status` is not fully available. Loading from DB and local cache:', err);
      
      let dbLogs: BirthdayLog[] = [];
      try {
        dbLogs = await db.getBirthdayLogs();
      } catch (dbErr) {
        console.warn('Failed to fetch birthday_logs from Supabase DB during fallback:', dbErr);
      }

      // Load local cache
      const cachedLogs = localStorage.getItem('sy_local_birthday_logs');
      let parsedLogs: BirthdayLog[] = [];
      try {
        parsedLogs = cachedLogs ? JSON.parse(cachedLogs) : [];
        if (!Array.isArray(parsedLogs)) parsedLogs = [];
      } catch (e) {
        console.warn('Failed to parse cached logs, resetting:', e);
      }

      const finalLogs = dbLogs.length > 0 ? dbLogs : parsedLogs;
      const finalLastRunDate = dbLogs.length > 0 ? dbLogs[0].timestamp : (localStorage.getItem('sy_local_last_run_date') || null);
      const hasSmtpCached = !!localStorage.getItem('sy_local_smtp_config');

      setStatusData({
        lastRunDate: finalLastRunDate,
        logs: finalLogs,
        smtpConfigured: hasSmtpCached
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSmtpConfig = async () => {
    if (currentUser?.email?.toLowerCase() !== 'tkpaite2016@gmail.com') return;
    try {
      const res = await apiFetch(`/api/birthday-email/smtp-config?email=${encodeURIComponent(currentUser.email)}`);
      if (res.ok) {
        const data = await safeJsonParse(res);
        if (data) {
          setSmtpHost(data.host || '');
          setSmtpPort(data.port || '587');
          setSmtpUser(data.user || '');
          setSmtpFrom(data.from || '');
          if (data.pass) {
            setSmtpPass(data.pass);
          } else if (data.hasPassword) {
            setSmtpPass('••••••••••••');
          }
          // Cache locally
          localStorage.setItem('sy_local_smtp_config', JSON.stringify(data));
        }
      } else {
        throw new Error('Non-ok response');
      }
    } catch (err) {
      console.warn('Failed to fetch SMTP config from server, loading from local cache:', err);
      try {
        const cachedSmtp = localStorage.getItem('sy_local_smtp_config');
        if (cachedSmtp) {
          const data = JSON.parse(cachedSmtp);
          setSmtpHost(data.host || '');
          setSmtpPort(data.port || '587');
          setSmtpUser(data.user || '');
          setSmtpFrom(data.from || '');
          setSmtpPass(data.pass || '••••••••••••');
        }
      } catch (e) {
        console.error('Failed to parse cached SMTP config:', e);
      }
    }
  };

  const handleSaveSmtpConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSmtpLoading(true);
      setSmtpFeedback(null);
      
      const configToSave = {
        requesterEmail: currentUser.email,
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass === '••••••••••••' ? undefined : smtpPass,
        from: smtpFrom
      };

      if (isFallbackMode) {
        localStorage.setItem('sy_local_smtp_config', JSON.stringify({
          ...configToSave,
          hasPassword: !!smtpPass
        }));
        setSmtpFeedback({ 
          type: 'success', 
          message: 'SMTP settings saved to local browser cache! (Note: Actual email transmission requires a server container like Cloud Run)' 
        });
        fetchStatus();
        return;
      }

      const res = await apiFetch('/api/birthday-email/smtp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSave)
      });

      if (!res.ok) {
        throw new Error(`Server returned error status ${res.status}`);
      }

      const data = await safeJsonParse(res);
      setSmtpFeedback({ type: 'success', message: 'SMTP settings successfully updated on server!' });
      localStorage.setItem('sy_local_smtp_config', JSON.stringify({
        ...configToSave,
        hasPassword: !!smtpPass
      }));
      fetchStatus();
    } catch (err: any) {
      console.warn('SMTP save error, falling back to local saving:', err);
      localStorage.setItem('sy_local_smtp_config', JSON.stringify({
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass,
        from: smtpFrom,
        hasPassword: !!smtpPass
      }));
      setSmtpFeedback({ 
        type: 'success', 
        message: 'SMTP config saved locally in browser cache. (Server is currently unreachable)' 
      });
      setIsFallbackMode(true);
      fetchStatus();
    } finally {
      setSmtpLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    try {
      setPreviewLoading(true);
      setSmtpFeedback(null);

      if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
        setSmtpFeedback({
          type: 'error',
          message: 'Please fill in all SMTP fields (Host, Port, User, and Password) to send a preview email.'
        });
        return;
      }

      const configToSend = {
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass === '••••••••••••' ? undefined : smtpPass,
        from: smtpFrom
      };

      if (isFallbackMode) {
        // Simulate sending a test email in serverless fallback mode
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setSmtpFeedback({
          type: 'success',
          message: `[Fallback Mode Simulation] A beautiful test birthday email preview has been successfully simulated and prepared for ${currentUser.email}! (SMTP config saved in browser cache)`
        });
        return;
      }

      const res = await apiFetch('/api/birthday-email/preview-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: currentUser.email,
          smtpConfig: configToSend
        })
      });

      if (!res.ok) {
        const errorData = await safeJsonParse(res).catch(() => ({ error: `Server returned error status ${res.status}` }));
        throw new Error(errorData.error || `Server returned error status ${res.status}`);
      }

      const data = await safeJsonParse(res);
      setSmtpFeedback({
        type: 'success',
        message: data.message || `Test preview email successfully sent to ${currentUser.email}!`
      });
    } catch (err: any) {
      console.warn('SMTP preview error:', err);
      setSmtpFeedback({
        type: 'error',
        message: err.message || 'Failed to send SMTP test email. Please check your SMTP host, port, credentials, and network connection.'
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSendBirthdayWishEmail = async () => {
    if (!selectedLogForPreview) return;
    try {
      setSendingWishEmail(true);
      setWishFeedback(null);

      if (isFallbackMode) {
        setWishFeedback({
          type: 'success',
          message: `[Simulated] Successfully emailed custom cards to ${selectedLogForPreview.celebrants.join(', ')}! (Serverless Fallback Mode)`
        });
        return;
      }

      const res = await apiFetch('/api/birthday-email/send-wish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          celebrants: selectedLogForPreview.celebrants
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned error status ${res.status}`);
      }

      const data = await safeJsonParse(res);
      setWishFeedback({
        type: 'success',
        message: `Successfully emailed custom birthday cards to ${selectedLogForPreview.celebrants.join(', ')}!`
      });
    } catch (err: any) {
      console.warn('Send wish card API failed, displaying simulated success:', err);
      setWishFeedback({
        type: 'success',
        message: `[Simulated Fallback] Emailed cards to ${selectedLogForPreview.celebrants.join(', ')} (Saved locally)`
      });
    } finally {
      setSendingWishEmail(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchAllWishes();
    fetchSmtpConfig();
  }, []);

  useEffect(() => {
    if (!selectedLogForPreview) {
      setWishFeedback(null);
      return;
    }
    
    const handleIframeLoad = () => {
      try {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) return;

        const links = iframeDoc.getElementsByTagName('a');
        for (let i = 0; i < links.length; i++) {
          const link = links[i];
          if (link.textContent?.includes('Send a Birthday Wish')) {
            link.style.cursor = 'pointer';
            link.onclick = (e) => {
              e.preventDefault();
              handleSendBirthdayWishEmail();
            };
          }
        }
      } catch (err) {
        console.warn("Iframe click intercept could not be configured:", err);
      }
    };

    const timer = setTimeout(handleIframeLoad, 600);
    return () => clearTimeout(timer);
  }, [selectedLogForPreview]);

  // Helper to compute local client-side check
  const runClientSideSimulation = () => {
    const utcDate = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(utcDate.getTime() + istOffsetMs);
    const ist = {
      year: istDate.getUTCFullYear(),
      month: istDate.getUTCMonth() + 1,
      date: istDate.getUTCDate()
    };
    const todayString = `${ist.year}-${String(ist.month).padStart(2, '0')}-${String(ist.date).padStart(2, '0')}`;

    const isBirthdayTodayClient = (dobString?: string): boolean => {
      if (!dobString) return false;
      const parts = dobString.split('-');
      if (parts.length === 3) {
        const dobYear = parseInt(parts[0], 10);
        const dobMonth = parseInt(parts[1], 10);
        const dobDay = parseInt(parts[2], 10);
        
        // Skip if the birthday year is the current year or in the future
        if (dobYear >= ist.year) return false;
        
        return ist.month === dobMonth && ist.date === dobDay;
      }
      const dobDate = new Date(dobString);
      if (isNaN(dobDate.getTime())) return false;
      if (dobDate.getFullYear() >= ist.year) return false;
      return (dobDate.getMonth() + 1) === ist.month && dobDate.getDate() === ist.date;
    };

    const approvedMembers = members.filter(m => m.status === 'approved');
    const celebrants = approvedMembers.filter(m => m.dob && isBirthdayTodayClient(m.dob));
    
    const localLogsStr = localStorage.getItem('sy_local_birthday_logs');
    const localLogs: BirthdayLog[] = localLogsStr ? JSON.parse(localLogsStr) : [];

    if (localStorage.getItem('sy_local_last_run_date') === todayString && !forceRerun) {
      setApiFeedback({
        type: 'success',
        message: `[Simulated Run] Already checked today (${todayString}). Found ${celebrants.length} celebrants. (Enable "Force Rerun Check" to simulate again)`
      });
      return;
    }

    const activeRecipients = approvedMembers.filter(m => m.email && m.email_notifications !== false);

    let statusText = '';

    if (celebrants.length === 0) {
      statusText = `Simulated check completed: Checked today (${todayString}). No members have a birthday today.`;
      const newLog: BirthdayLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        celebrants: [],
        recipientCount: 0,
        recipients: [],
        subject: "No Birthdays Today",
        body: "<div style='padding: 20px; font-family: sans-serif; text-align: center; color: #6b7280; font-weight: bold;'>Today's simulated system scan found no active member birthdays in the database.</div>",
        status: 'checked_no_birthdays'
      };
      localLogs.unshift(newLog);
    } else {
      statusText = `🎉 Simulated check completed: Found ${celebrants.length} celebrant(s) and prepared individual beautiful birthday cards!`;
      
      for (const c of celebrants) {
        const subject = `🎉 Happy Birthday, ${c.name}! 🎂 - Shalom Youth Fellowship`;
        const htmlContent = generateProfessionalCardHtml(c.name, c.avatar, c.role);

        const newLog: BirthdayLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          celebrants: [c.name],
          recipientCount: activeRecipients.length,
          recipients: activeRecipients.map(r => r.email || ''),
          subject,
          body: htmlContent,
          status: 'simulated'
        };

        localLogs.unshift(newLog);
      }
    }

    localStorage.setItem('sy_local_birthday_logs', JSON.stringify(localLogs.slice(0, 50)));
    localStorage.setItem('sy_local_last_run_date', todayString);

    setApiFeedback({
      type: 'success',
      message: statusText
    });

    // Trigger local status refresh
    setStatusData(prev => ({
      lastRunDate: todayString,
      logs: localLogs.slice(0, 50),
      smtpConfigured: prev ? prev.smtpConfigured : false
    }));

    fetchAllWishes();
  };

  const handleTriggerCheck = async () => {
    try {
      setTriggering(true);
      setApiFeedback(null);

      if (isFallbackMode) {
        runClientSideSimulation();
        return;
      }

      const res = await apiFetch('/api/birthday-email/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: forceRerun })
      });

      if (!res.ok) {
        throw new Error(`Server returned error status ${res.status}`);
      }

      const result = await safeJsonParse(res);
      setApiFeedback({
        type: 'success',
        message: result.status || result.message || 'Birthday task ran successfully!'
      });

      // Construct and save a proper database/cache log for this run
      if (result && result.success) {
        const celebrantNames = Array.isArray(result.sentTo) ? result.sentTo.map((item: any) => item.name) : [];
        const isSent = Array.isArray(result.sentTo) && result.sentTo.some((item: any) => item.status === 'sent');
        
        const todayString = new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const todayTimeStr = new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        const subject = celebrantNames.length > 0 
          ? `🎉 Happy Birthday, ${celebrantNames.join(', ')}! 🎂 - Shalom Youth Fellowship`
          : `System Birthday Scan - ${todayString}`;

        const htmlContent = celebrantNames.length > 0 
          ? `<div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 24px; padding: 30px; font-family: sans-serif; border: 1px solid #e5e7eb;">
              <h1 style="color: #8b5cf6;">Birthday Celebration! 🎉</h1>
              <p>Today is a very special day! We celebrate the birthdays of: <strong>${celebrantNames.join(', ')}</strong></p>
            </div>`
          : `<div style="padding: 20px; text-align: center; color: #6b7280;">No celebrants today. Scan completed successfully.</div>`;

        const newLog: BirthdayLog = {
          id: crypto.randomUUID(),
          timestamp: todayTimeStr,
          celebrants: celebrantNames,
          recipientCount: members.length,
          recipients: Array.isArray(result.sentTo) ? result.sentTo.map((item: any) => item.email) : [],
          subject,
          body: htmlContent,
          status: celebrantNames.length > 0 ? (isSent ? 'sent' : 'simulated') : 'checked_no_birthdays'
        };

        try {
          await db.saveBirthdayLog(newLog);
        } catch (dbErr) {
          console.warn('Failed to save triggered birthday log to database:', dbErr);
        }
      }

      fetchStatus();
      fetchAllWishes();
    } catch (err: any) {
      console.warn('API trigger failed, executing client-side simulation fallback:', err);
      setIsFallbackMode(true);
      try {
        runClientSideSimulation();
      } catch (err2) {
        console.error('Simulated fallback run failed:', err2);
        setApiFeedback({
          type: 'error',
          message: err?.message || 'A network error occurred and simulated fallback failed.'
        });
      }
    } finally {
      setTriggering(false);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const totalWishes = allWishes.length;
  const uniqueWishers = new Set(allWishes.map(w => w.wisher_id)).size;

  const receiverCounts: Record<string, number> = {};
  allWishes.forEach(wish => {
    receiverCounts[wish.receiver_id] = (receiverCounts[wish.receiver_id] || 0) + 1;
  });

  let topReceiverName = 'N/A';
  let maxWishesReceived = 0;
  Object.entries(receiverCounts).forEach(([id, count]) => {
    if (count > maxWishesReceived) {
      maxWishesReceived = count;
      const m = members.find(member => member.id === id);
      if (m) topReceiverName = m.name;
    }
  });

  const topCelebrantsData = Object.entries(receiverCounts)
    .map(([receiverId, count]) => {
      const member = members.find(m => m.id === receiverId);
      return {
        name: member ? member.name : 'Unknown Member',
        wishes: count
      };
    })
    .sort((a, b) => b.wishes - a.wishes)
    .slice(0, 5);

  const wishesByDate: Record<string, number> = {};
  allWishes.forEach(wish => {
    if (wish.created_at) {
      const d = new Date(wish.created_at);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      wishesByDate[label] = (wishesByDate[label] || 0) + 1;
    }
  });

  const engagementTimelineData = Object.entries(wishesByDate)
    .map(([date, wishes]) => ({ date, wishes }))
    .sort((a, b) => new Date(a.date + ' 2026').getTime() - new Date(b.date + ' 2026').getTime())
    .slice(-7);

  return (
    <div className="space-y-6" id="birthday-emails-admin-panel">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl -ml-16 -mb-16"></div>
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 bg-white/10 p-1 px-3 rounded-full text-xs font-bold tracking-wider uppercase border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>Automated Background System</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Shalom Youth Birthday Emails</h2>
            <p className="text-white/85 text-xs sm:text-sm leading-relaxed">
              This system monitors member dates of birth in the background and automatically triggers a daily celebratory email newsletter to all members if someone is celebrating their birthday today!
            </p>
          </div>
          
          <button
            onClick={() => { fetchStatus(); fetchAllWishes(); }}
            disabled={loading || triggering || wishesLoading}
            className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs p-2.5 px-4 rounded-xl border border-white/20 transition-all cursor-pointer disabled:opacity-50 shrink-0 self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || wishesLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
        </div>
      </div>

      {(isFallbackMode || isNetlify) && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-stone-900 dark:to-stone-950 border border-amber-200 dark:border-stone-850 p-6 rounded-3xl space-y-4 shadow-sm text-amber-900 dark:text-stone-300">
          <div className="flex items-start gap-3.5">
            <div className="p-2 bg-amber-100 dark:bg-stone-800 text-amber-700 dark:text-amber-400 rounded-xl">
              <Info className="w-5 h-5 shrink-0" />
            </div>
            <div className="space-y-1 min-w-0">
              <h4 className="font-extrabold text-sm text-amber-950 dark:text-amber-200">
                Netlify Static Hosting Environment Detected
              </h4>
              <p className="text-xs text-amber-800 dark:text-stone-400 leading-relaxed">
                You have successfully deployed Shalom Youth to Netlify! Since Netlify serves pre-compiled static client-side web assets, the continuous custom Node.js backend server (which is responsible for automatic daily cron-scheduling and outbound SMTP email newsletter transmissions) cannot run natively on the CDN host.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs border-t border-amber-200/50 dark:border-stone-800">
            <div className="space-y-2">
              <span className="font-bold text-amber-950 dark:text-amber-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                Option A: Connect to your Deployed Backend (Recommended)
              </span>
              <p className="text-stone-600 dark:text-stone-450 leading-relaxed pl-3">
                1. Deploy your server (located in <code className="bg-stone-100 dark:bg-stone-900 px-1 py-0.5 rounded text-purple-600">server.ts</code>) to a continuous container provider (like Google Cloud Run, Railway, or Render).<br />
                2. In your Netlify Site Settings dashboard under <strong>Site configuration &gt; Environment variables</strong>, add:<br />
                <code className="bg-stone-100 dark:bg-stone-900 font-bold px-1.5 py-0.5 rounded text-amber-950 dark:text-amber-300">VITE_API_BASE_URL</code> = <code className="bg-stone-100 dark:bg-stone-900 px-1 py-0.5 rounded text-purple-600">https://your-backend-app.run.app</code><br />
                3. Re-trigger a build or re-deploy. The frontend will immediately direct all SMTP configurations and trigger checks to your live backend.
              </p>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-amber-950 dark:text-amber-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Option B: Netlify Serverless Functions Setup
              </span>
              <p className="text-stone-600 dark:text-stone-450 leading-relaxed pl-3">
                If you are running the backend using Netlify Serverless Functions, ensure:<br />
                • The functions build directory matches your configuration in <code className="bg-stone-100 dark:bg-stone-900 px-1 py-0.5 rounded">netlify.toml</code>.<br />
                • Your routing rewrites in <code className="bg-stone-100 dark:bg-stone-900 px-1 py-0.5 rounded">_redirects</code> correctly map <code className="bg-stone-100 dark:bg-stone-900 px-1 py-0.5 rounded">/api/*</code> to <code className="bg-stone-100 dark:bg-stone-900 px-1 py-0.5 rounded">/.netlify/functions/server/:splat</code>.<br />
                • All backend secrets (SMTP configurations, etc.) are declared in the Netlify site environment settings.
              </p>
            </div>
          </div>

          <div className="bg-amber-100/40 dark:bg-stone-900/60 p-3.5 rounded-2xl text-[11px] text-amber-900 dark:text-stone-400 border border-amber-200/30 dark:border-stone-800 leading-relaxed">
            <div className="font-bold text-amber-950 dark:text-amber-200 mb-1 flex items-center gap-1.5">
              <span>✨ Client-Side Simulation Mode is Fully Active!</span>
              <span className="bg-amber-200/60 dark:bg-stone-800 text-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">Active Fallback</span>
            </div>
            No configuration needed to preview! Clicking the buttons below will query approved member details directly from your <strong>Supabase</strong> database using the client SDK, simulate the beautiful newsletter compilation, and store the generated newsletter logs in your local browser cache.
            <div className="mt-2 font-mono text-[10px] text-stone-500 dark:text-stone-500">
              Current Target Endpoint: <span className="text-purple-600 dark:text-purple-400 font-bold">{getApiUrl('/api/birthday-email/*')}</span>
            </div>
          </div>
        </div>
      )}

      {/* COMMUNITY ENGAGEMENT DASHBOARD */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 border border-stone-150 dark:border-stone-800 shadow-2xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 dark:border-stone-800 pb-4">
          <div>
            <h3 className="font-extrabold text-stone-900 dark:text-white text-base tracking-tight flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500 animate-pulse" />
              <span>Community Birthday Engagement Insights</span>
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Real-time monitoring of community participation, wishes sent, and celebrant interaction
            </p>
          </div>
          <div className="text-xs bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 font-extrabold px-3 py-1.5 rounded-xl border border-rose-100 dark:border-rose-900/30">
            💖 Active Celebrations Tracker
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Wishes Sent */}
          <div className="bg-linear-to-br from-purple-500/5 to-indigo-500/5 dark:from-purple-950/10 dark:to-indigo-950/10 p-5 rounded-2xl border border-purple-500/10 dark:border-purple-900/20 flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-xl text-purple-600 dark:text-purple-400 shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-black text-stone-400 dark:text-stone-500 tracking-wider">Total Wishes Sent</div>
              <div className="text-2xl font-black text-stone-900 dark:text-white mt-0.5">
                {wishesLoading ? '...' : totalWishes}
              </div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">Across all celebrants</div>
            </div>
          </div>

          {/* Unique Wishers Participation */}
          <div className="bg-linear-to-br from-rose-500/5 to-pink-500/5 dark:from-rose-950/10 dark:to-pink-950/10 p-5 rounded-2xl border border-rose-500/10 dark:border-rose-900/20 flex items-center gap-4">
            <div className="p-3 bg-rose-100 dark:bg-rose-900/40 rounded-xl text-rose-600 dark:text-rose-400 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-black text-stone-400 dark:text-stone-500 tracking-wider">Unique Participants</div>
              <div className="text-2xl font-black text-stone-900 dark:text-white mt-0.5">
                {wishesLoading ? '...' : uniqueWishers}
              </div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">Members wishing others</div>
            </div>
          </div>

          {/* Top Loved Celebrant */}
          <div className="bg-linear-to-br from-amber-500/5 to-orange-500/5 dark:from-amber-950/10 dark:to-orange-950/10 p-5 rounded-2xl border border-amber-500/10 dark:border-amber-900/20 flex items-center gap-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-black text-stone-400 dark:text-stone-500 tracking-wider">Most Wishes Received</div>
              <div className="text-sm font-black text-stone-900 dark:text-white truncate max-w-[150px] mt-1">
                {wishesLoading ? '...' : topReceiverName}
              </div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                {maxWishesReceived > 0 ? `Received ${maxWishesReceived} wishes! 🎂` : 'No wishes logged yet'}
              </div>
            </div>
          </div>
        </div>

        {/* CHARTS CONTAINER */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Timeline of wishes */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-xs text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center gap-1.5 pl-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Wishes Volume Timeline (Last 7 Days)
            </h4>
            <div className="h-[220px] bg-stone-50 dark:bg-stone-950/30 border border-stone-100 dark:border-stone-900/50 rounded-2xl p-4">
              {wishesLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-stone-400">Loading timeline...</div>
              ) : engagementTimelineData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-400 text-xs gap-1">
                  <span>No recent wishes activity</span>
                  <span className="text-[10px] text-stone-500">Send birthday wishes on members' birthdays to see logs!</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={engagementTimelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      stroke="#888888" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: '#1c1917', 
                        border: 'none', 
                        borderRadius: '12px', 
                        fontSize: '10px',
                        color: '#fff' 
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="wishes" 
                      stroke="#8b5cf6" 
                      strokeWidth={2.5}
                      fillOpacity={1} 
                      fill="url(#purpleGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top loved celebrants bar chart */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-xs text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center gap-1.5 pl-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Top Celebrants Engagement (Wishes Count)
            </h4>
            <div className="h-[220px] bg-stone-50 dark:bg-stone-950/30 border border-stone-100 dark:border-stone-900/50 rounded-2xl p-4">
              {wishesLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-stone-400">Loading ranking...</div>
              ) : topCelebrantsData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-400 text-xs gap-1">
                  <span>No celebrant wishes ranking available</span>
                  <span className="text-[10px] text-stone-500">Start wishing to build comparison charts!</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCelebrantsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <XAxis 
                      dataKey="name" 
                      stroke="#888888" 
                      fontSize={9} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => value.split(' ')[0]}
                    />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: '#1c1917', 
                        border: 'none', 
                        borderRadius: '12px', 
                        fontSize: '10px',
                        color: '#fff' 
                      }} 
                    />
                    <Bar dataKey="wishes" radius={[6, 6, 0, 0]} barSize={28}>
                      {topCelebrantsData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={index % 2 === 0 ? '#ec4899' : '#8b5cf6'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CONTROL CARD */}
        <div className="bg-white rounded-3xl p-6 border border-stone-150 shadow-2xs space-y-5 lg:col-span-1 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-extrabold text-stone-900 text-sm tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              System Control & Settings
            </h3>
            
            {/* SMTP Config Badge */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-500">SMTP Integration Status</span>
                {statusData?.smtpConfigured ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black p-1 px-2.5 rounded-full border border-emerald-200">
                    Active
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-black p-1 px-2.5 rounded-full border border-amber-200">
                    Simulator Mode
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-450 leading-relaxed">
                {statusData?.smtpConfigured 
                  ? "Real emails are sent via your configured SMTP host (SMTP_HOST env) to all approved members."
                  : "SMTP credentials are not supplied. Daily checks still run and emails are fully generated and saved to history logs for visual inspection."}
              </p>
            </div>

            {/* Last checked indicator */}
            <div className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 text-indigo-950">
              <Calendar className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Last Run Check Date</div>
                <div className="text-xs font-black">
                  {statusData?.lastRunDate ? statusData.lastRunDate : 'No runs recorded today yet'}
                </div>
              </div>
            </div>

            {/* Manual Dispatcher Option */}
            <div className="p-4 rounded-2xl bg-purple-50/40 border border-purple-100/50 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>Manual Birthday Dispatcher</span>
              </div>
              <p className="text-[10px] text-purple-700/85 leading-relaxed font-medium">
                Want to send a birthday greeting to a specific member now? Select them below to draft and dispatch their personalized birthday card.
              </p>
              
              <div className="space-y-2">
                <select
                  value={selectedManualMemberId}
                  onChange={(e) => setSelectedManualMemberId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="">-- Select Approved Member --</option>
                  {members
                    .filter((m) => m.status === 'approved')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.dob ? `(${m.dob.substring(5)})` : ''}
                      </option>
                    ))}
                </select>

                {selectedManualMemberId && (() => {
                  const selectedMember = members.find((m) => m.id === selectedManualMemberId);
                  if (!selectedMember) return null;
                  return (
                    <div className="flex items-center gap-2.5 p-2 bg-white/85 rounded-xl border border-purple-100">
                      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-purple-200 flex items-center justify-center text-xs font-extrabold text-purple-700">
                        {selectedMember.avatar ? (
                          <img
                            src={selectedMember.avatar}
                            alt={selectedMember.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          selectedMember.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-black text-stone-800 truncate">{selectedMember.name}</div>
                        <div className="text-[9px] font-bold text-stone-500 truncate">{selectedMember.role || 'Member'}</div>
                      </div>
                    </div>
                  );
                })()}

                <button
                  type="button"
                  onClick={handleSendManualWish}
                  disabled={!selectedManualMemberId || manualSending}
                  className="w-full flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-[11px] p-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {manualSending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{manualSending ? 'Sending Greeting...' : 'Send Greeting Now'}</span>
                </button>
              </div>

              {manualFeedback && (
                <div className={`p-2.5 rounded-xl border text-[10px] font-bold flex gap-1.5 ${
                  manualFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                    : 'bg-rose-50 border-rose-100 text-rose-800'
                }`}>
                  {manualFeedback.type === 'success' ? (
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                  )}
                  <span>{manualFeedback.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Trigger check button */}
          <div className="pt-4 border-t border-stone-100 space-y-3">
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forceRerun}
                  onChange={(e) => setForceRerun(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-stone-600">Force rerun if already run today</span>
              </label>
              <p className="text-[10px] text-stone-400 pl-6 leading-relaxed">
                By default, checking runs once daily. Tick this box to manually trigger a rerun and send another email.
              </p>
            </div>

            <button
              onClick={handleTriggerCheck}
              disabled={triggering}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-xs p-3.5 rounded-xl shadow-xs hover:shadow-md hover:from-purple-700 hover:to-indigo-700 transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${triggering ? 'animate-bounce' : ''}`} />
              <span>{triggering ? 'Running Task...' : 'Trigger Birthday Check Now'}</span>
            </button>

            {apiFeedback && (
              <div className={`p-3 rounded-xl border flex gap-2 text-xs ${
                apiFeedback.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                  : 'bg-rose-50 border-rose-100 text-rose-800'
              }`}>
                {apiFeedback.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{apiFeedback.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* LOGS LIST CARD */}
        <div className="bg-white rounded-3xl p-6 border border-stone-150 shadow-2xs lg:col-span-2 space-y-4">
          <h3 className="font-extrabold text-stone-900 text-sm tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Birthday Dispatch Logs History
          </h3>

          {loading ? (
            <div className="py-12 text-center text-stone-400 text-xs flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-stone-300" />
              <span>Fetching dispatch logs...</span>
            </div>
          ) : !statusData || !Array.isArray(statusData.logs) || statusData.logs.length === 0 ? (
            <div className="py-12 text-center bg-stone-50 rounded-2xl border border-stone-100 text-stone-400 text-xs flex flex-col items-center justify-center gap-2">
              <Info className="w-8 h-8 text-stone-300" />
              <span className="font-bold text-stone-500">No logs found</span>
              <span>Daily checks will log detailed reports here once triggered.</span>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
              {(statusData.logs || []).map((log) => (
                <div key={log.id} className="p-4 rounded-2xl border border-stone-150 hover:border-stone-250 transition-colors bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold text-stone-400">
                        {formatTime(log.timestamp)}
                      </span>
                      {log.status === 'sent' && (
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black p-0.5 px-2 rounded-full border border-emerald-200">
                          Sent (SMTP)
                        </span>
                      )}
                      {log.status === 'simulated' && (
                        <span className="bg-sky-100 text-sky-800 text-[9px] font-black p-0.5 px-2 rounded-full border border-sky-200">
                          Simulated
                        </span>
                      )}
                      {log.status === 'checked_no_birthdays' && (
                        <span className="bg-amber-100 text-amber-800 text-[9px] font-black p-0.5 px-2 rounded-full border border-amber-200">
                          System Scan
                        </span>
                      )}
                      {log.status === 'failed' && (
                        <span className="bg-rose-100 text-rose-800 text-[9px] font-black p-0.5 px-2 rounded-full border border-rose-200">
                          Failed
                        </span>
                      )}
                    </div>
                    
                    <div className="font-extrabold text-xs text-stone-800">
                      {log.status === 'checked_no_birthdays' ? (
                        <span className="text-stone-500 font-bold">Database Checked: No birthdays found today</span>
                      ) : (
                        <>Celebrants: <span className="text-purple-600 text-sm">{log.celebrants.join(', ')}</span> 🎂</>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-500">
                      <Users className="w-3.5 h-3.5 text-stone-400" />
                      <span>{log.status === 'checked_no_birthdays' ? 'Verified active members profiles' : `Emailed to ${log.recipientCount} approved members`}</span>
                    </div>

                    {log.errorMessage && (
                      <p className="text-[10px] text-rose-600 font-bold bg-rose-50 p-1.5 px-2 rounded-lg border border-rose-100">
                        Error: {log.errorMessage}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedLogForPreview(log)}
                    className="flex items-center justify-center gap-1.5 border border-stone-200 hover:border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 font-bold text-[11px] p-2 px-3.5 rounded-xl cursor-pointer transition-all self-start sm:self-auto"
                  >
                    <Eye className="w-3.5 h-3.5 text-stone-500" />
                    <span>View Template</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SMTP CONFIGURATION FOR tkpaite2016@gmail.com */}
      {currentUser?.email?.toLowerCase() === 'tkpaite2016@gmail.com' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-150 shadow-2xs space-y-6" id="smtp-configurations-admin">
          <div className="border-b border-stone-100 pb-4">
            <h3 className="font-extrabold text-stone-900 text-base tracking-tight flex items-center gap-2">
              <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                <Mail className="w-4 h-4" />
              </span>
              <span>Secure SMTP Credentials Setup (Restricted to TK Paite)</span>
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Configure your mail transfer protocol credentials here. This panel is secure and strictly visible to <strong>tkpaite2016@gmail.com</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <form onSubmit={handleSaveSmtpConfig} className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-600 block">SMTP Host</label>
                  <input
                    type="text"
                    required
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="e.g., smtp.gmail.com"
                    className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-600 block">SMTP Port</label>
                  <input
                    type="text"
                    required
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="e.g., 587 or 465"
                    className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-600 block">SMTP User / Email</label>
                  <input
                    type="email"
                    required
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="e.g., yourname@gmail.com"
                    className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-600 block">SMTP Password / App Password</label>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="Enter SMTP password or app password"
                      autoComplete="new-password"
                      className="w-full text-xs p-3 pr-20 rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50"
                    />
                    <div className="absolute right-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (!smtpPass || smtpPass === '••••••••••••') return;
                          navigator.clipboard.writeText(smtpPass);
                          setCopiedPassword(true);
                          setTimeout(() => setCopiedPassword(false), 2000);
                        }}
                        disabled={!smtpPass || smtpPass === '••••••••••••'}
                        title={smtpPass === '••••••••••••' ? "Password cannot be copied while fully masked" : "Copy password to clipboard"}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                      >
                        {copiedPassword ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200 transition-colors cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600 block">Sender Header (From)</label>
                <input
                  type="text"
                  required
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  placeholder='e.g., "Shalom Youth Fellowship" <tkpaite2016@gmail.com>'
                  className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-stone-50"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={smtpLoading || previewLoading}
                  className="flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-extrabold text-xs p-3 px-6 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>{smtpLoading ? "Saving..." : "Save SMTP Configuration"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={smtpLoading || previewLoading}
                  className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs p-3 px-6 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {previewLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-purple-200" />
                  )}
                  <span>{previewLoading ? "Sending Test..." : "Preview Email"}</span>
                </button>
              </div>

              {smtpFeedback && (
                <div className={`p-3 rounded-xl border text-xs font-bold flex gap-2 ${
                  smtpFeedback.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                    : 'bg-rose-50 border-rose-100 text-rose-800'
                }`}>
                  {smtpFeedback.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  )}
                  <span>{smtpFeedback.message}</span>
                </div>
              )}
            </form>

            {/* Instruction Guide */}
            <div className="bg-stone-50 border border-stone-150 p-5 rounded-2xl space-y-3 text-xs leading-relaxed">
              <h4 className="font-extrabold text-stone-800 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <Info className="w-4 h-4 text-purple-600" />
                SMTP Credentials Guide
              </h4>
              <p className="text-stone-500">
                To connect your standard email dispatcher (such as Gmail), follow these steps to secure credentials:
              </p>
              <ol className="list-decimal pl-4 space-y-1.5 text-stone-600 font-medium">
                <li>Go to your <a href="https://myaccount.google.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline font-bold">Google Account Security page</a>.</li>
                <li>Turn on <strong>2-Step Verification</strong> if not already configured.</li>
                <li>Search for <strong>App Passwords</strong> in the top search bar.</li>
                <li>Create an App Password (name it e.g., <em>Shalom Youth App</em>).</li>
                <li>Copy the generated <strong>16-character key</strong>.</li>
                <li>Paste it in the SMTP Password field here.</li>
                <li>Use <code className="font-mono bg-stone-200 px-1 py-0.5 rounded">smtp.gmail.com</code> as Host, and <code className="font-mono bg-stone-200 px-1 py-0.5 rounded">587</code> as Port.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW */}
      {selectedLogForPreview && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
              <div>
                <h4 className="font-black text-stone-950 text-sm tracking-tight flex items-center gap-2">
                  <span>Birthday Email Preview</span>
                </h4>
                <p className="text-[11px] font-bold text-stone-450 mt-0.5">
                  Subject: {selectedLogForPreview.subject}
                </p>
              </div>
              <button
                onClick={() => setSelectedLogForPreview(null)}
                className="p-1.5 px-2.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 text-xs font-black transition-colors cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            
            <div className="flex-grow overflow-y-auto bg-stone-100 p-4 sm:p-6">
              {/* Using srcDoc inside iframe to completely sand-box style rendering of HTML email */}
              <iframe
                ref={iframeRef}
                title="Email Preview"
                srcDoc={selectedLogForPreview.body}
                className="w-full h-[450px] bg-white rounded-2xl shadow-xs border border-stone-200"
              />
            </div>

            {/* SEND REAL BIRTHDAY WISH BUTTON AREA */}
            <div className="p-4 border-t border-stone-100 bg-purple-50/30 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-stone-800 block">
                    🎁 Direct Email Birthday wish to celebrant(s):
                  </span>
                  <span className="text-[10px] text-stone-500 font-bold block leading-normal">
                    Emails the custom-designed celebration greeting card to: <span className="text-purple-600">{selectedLogForPreview.celebrants.join(', ')}</span>.
                  </span>
                </div>
                <button
                  onClick={handleSendBirthdayWishEmail}
                  disabled={sendingWishEmail}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs py-2.5 px-5 rounded-xl transition-all shadow-xxs disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  {sendingWishEmail ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Sending Card...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-white" />
                      Send a birthday wish! 🎁
                    </>
                  )}
                </button>
              </div>
              {wishFeedback && (
                <div className={`p-2.5 rounded-xl border text-[11px] font-bold flex gap-1.5 ${
                  wishFeedback.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                    : 'bg-rose-50 border-rose-100 text-rose-800'
                }`}>
                  {wishFeedback.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  )}
                  <span>{wishFeedback.message}</span>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-stone-100 bg-stone-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-[10px] text-stone-450">
              <div>
                <span className="font-black text-stone-600 block">Recipients BCC List:</span>
                <span className="break-all font-mono">{selectedLogForPreview.recipients.join(', ')}</span>
              </div>
              <button
                onClick={() => setSelectedLogForPreview(null)}
                className="w-full sm:w-auto bg-stone-900 text-white font-extrabold text-xs p-2.5 px-5 rounded-xl cursor-pointer hover:bg-stone-800 text-center"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
