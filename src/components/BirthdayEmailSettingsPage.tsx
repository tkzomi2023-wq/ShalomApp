import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, CheckCircle, Info, Calendar, Users, Eye, EyeOff, Copy, Check, AlertCircle, Sparkles, Send, Heart, TrendingUp, Award } from 'lucide-react';
import { Member, BirthdayWish } from '../types';
import { db } from '../lib/supabase';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';

interface BirthdayLog {
  id: string;
  timestamp: string;
  celebrants: string[];
  recipientCount: number;
  recipients: string[];
  subject: string;
  body: string;
  status: 'sent' | 'simulated' | 'failed';
  errorMessage?: string;
}

interface StatusResponse {
  lastRunDate: string | null;
  logs: BirthdayLog[];
  smtpConfigured: boolean;
}

interface BirthdayEmailSettingsPageProps {
  currentUser: Member;
  members?: Member[];
}

export default function BirthdayEmailSettingsPage({ currentUser, members = [] }: BirthdayEmailSettingsPageProps) {
  const [statusData, setStatusData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [forceRerun, setForceRerun] = useState<boolean>(false);
  const [apiFeedback, setApiFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedLogForPreview, setSelectedLogForPreview] = useState<BirthdayLog | null>(null);
  const [allWishes, setAllWishes] = useState<BirthdayWish[]>([]);
  const [wishesLoading, setWishesLoading] = useState<boolean>(true);

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

  // Individual Wish Email States
  const [sendingWishEmail, setSendingWishEmail] = useState<boolean>(false);
  const [wishFeedback, setWishFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

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
      const res = await fetch('/api/birthday-email/status');
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
      }
    } catch (err) {
      console.error('Failed to fetch birthday email status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSmtpConfig = async () => {
    if (currentUser?.email?.toLowerCase() !== 'tkpaite2016@gmail.com') return;
    try {
      const res = await fetch(`/api/birthday-email/smtp-config?email=${encodeURIComponent(currentUser.email)}`);
      if (res.ok) {
        const data = await res.json();
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
        }
      }
    } catch (err) {
      console.error('Failed to fetch SMTP config:', err);
    }
  };

  const handleSaveSmtpConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSmtpLoading(true);
      setSmtpFeedback(null);
      
      const res = await fetch('/api/birthday-email/smtp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterEmail: currentUser.email,
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass === '••••••••••••' ? undefined : smtpPass,
          from: smtpFrom
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSmtpFeedback({ type: 'success', message: 'SMTP settings successfully updated!' });
        fetchStatus();
      } else {
        setSmtpFeedback({ type: 'error', message: data.error || 'Failed to save SMTP configurations.' });
      }
    } catch (err: any) {
      setSmtpFeedback({ type: 'error', message: err?.message || 'A network error occurred.' });
    } finally {
      setSmtpLoading(false);
    }
  };

  const handleSendBirthdayWishEmail = async () => {
    if (!selectedLogForPreview) return;
    try {
      setSendingWishEmail(true);
      setWishFeedback(null);
      const res = await fetch('/api/birthday-email/send-wish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          celebrants: selectedLogForPreview.celebrants
        })
      });

      const data = await res.json();
      if (res.ok) {
        setWishFeedback({
          type: 'success',
          message: `Successfully emailed custom birthday cards to ${selectedLogForPreview.celebrants.join(', ')}!`
        });
      } else {
        setWishFeedback({
          type: 'error',
          message: data.error || 'Failed to send birthday wishes email. Ensure SMTP is configured.'
        });
      }
    } catch (err: any) {
      setWishFeedback({
        type: 'error',
        message: err?.message || 'A network error occurred.'
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

  const handleTriggerCheck = async () => {
    try {
      setTriggering(true);
      setApiFeedback(null);
      const res = await fetch('/api/birthday-email/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: forceRerun })
      });

      const result = await res.json();

      if (res.ok) {
        setApiFeedback({
          type: 'success',
          message: result.status || 'Birthday task ran successfully!'
        });
        fetchStatus();
        fetchAllWishes();
      } else {
        setApiFeedback({
          type: 'error',
          message: result.error || 'Failed to trigger birthday check.'
        });
      }
    } catch (err: any) {
      setApiFeedback({
        type: 'error',
        message: err?.message || 'A network error occurred.'
      });
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
          ) : !statusData || statusData.logs.length === 0 ? (
            <div className="py-12 text-center bg-stone-50 rounded-2xl border border-stone-100 text-stone-400 text-xs flex flex-col items-center justify-center gap-2">
              <Info className="w-8 h-8 text-stone-300" />
              <span className="font-bold text-stone-500">No logs found</span>
              <span>Daily checks will log detailed reports here once triggered.</span>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
              {statusData.logs.map((log) => (
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
                      {log.status === 'failed' && (
                        <span className="bg-rose-100 text-rose-800 text-[9px] font-black p-0.5 px-2 rounded-full border border-rose-200">
                          Failed
                        </span>
                      )}
                    </div>
                    
                    <div className="font-extrabold text-xs text-stone-800">
                      Celebrants: <span className="text-purple-600 text-sm">{log.celebrants.join(', ')}</span> 🎂
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-500">
                      <Users className="w-3.5 h-3.5 text-stone-400" />
                      <span>Emailed to {log.recipientCount} approved members</span>
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

              <button
                type="submit"
                disabled={smtpLoading}
                className="flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-extrabold text-xs p-3 px-6 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>{smtpLoading ? "Saving..." : "Save SMTP Configuration"}</span>
              </button>

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
