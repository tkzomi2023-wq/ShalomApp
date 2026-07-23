/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dedicated Call History & Communication Analytics view.
 * Displays list of incoming, outgoing, missed, rejected calls with callbacks and admin stats.
 */

import React, { useState, useEffect } from 'react';
import { useCalling } from '../../context/CallingContext';
import { useAuth } from '../../lib/auth';
import { callingService } from '../../lib/callingService';
import { CallRecord, CommunicationStats } from '../../types/calling';
import { Member, formatMemberName, getCleanAvatar, isOBUser } from '../../types';
import { supabase } from '../../lib/supabase';
import { CommunicationSettingsModal } from './CommunicationSettingsModal';
import { 
  PhoneCall, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed, 
  PhoneOff, 
  Video, 
  Search, 
  Filter, 
  Trash2, 
  Clock, 
  Calendar, 
  TrendingUp, 
  Activity, 
  Settings, 
  RefreshCw, 
  CheckCircle2, 
  Sparkles,
  BarChart2,
  Phone
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const CallHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const { startCall, markNotificationsAsRead, refreshHistory } = useCalling();

  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [stats, setStats] = useState<CommunicationStats | null>(null);
  const [membersMap, setMembersMap] = useState<Map<string, Member>>(new Map());
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'incoming' | 'outgoing' | 'missed' | 'video'>('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    markNotificationsAsRead();
    loadCallData();
  }, [user?.id]);

  const loadCallData = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const history = await callingService.getCallHistory(user.id);
      setCalls(history);

      const computedStats = await callingService.getStats(user.id);
      setStats(computedStats);

      // Fetch member directory for one-click callback
      const { data: memberList } = await supabase.from('profiles').select('*');
      if (memberList) {
        setMembersMap(new Map(memberList.map(m => [m.id, m as Member])));
      }
    } catch (e) {
      console.error('Error loading call history:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (callId: string) => {
    if (confirm('Delete this call record from history?')) {
      await callingService.deleteCallHistoryItem(callId);
      setCalls(prev => prev.filter(c => c.id !== callId));
    }
  };

  const handleCallback = (otherUserId: string, type: 'voice' | 'video') => {
    const target = membersMap.get(otherUserId);
    if (target) {
      startCall(target, type);
    } else {
      alert('Member details not found in directory.');
    }
  };

  const filteredCalls = calls.filter(c => {
    const isCaller = c.caller_id === user?.id;
    const otherName = isCaller ? (c.receiver_name || '') : (c.caller_name || '');
    
    const matchesSearch = otherName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'incoming') return c.receiver_id === user?.id && (c.status === 'accepted' || c.status === 'ended' || (c.duration && c.duration > 0));
    if (filterType === 'outgoing') return c.caller_id === user?.id;
    if (filterType === 'missed') return c.status === 'missed' || c.status === 'declined' || c.status === 'cancelled' || (!c.duration && c.status !== 'accepted' && c.status !== 'ended');
    if (filterType === 'video') return c.call_type === 'video';

    return true;
  });

  const formatDuration = (secs?: number) => {
    if (!secs || secs === 0) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const isUserAdmin = user ? isOBUser(user.role) : false;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 animate-in fade-in">
      
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>REAL-TIME VOICE & VIDEO CALLING</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Call Logs & Communication Hub
          </h1>
          <p className="text-stone-400 text-xs sm:text-sm">
            High-definition peer-to-peer WebRTC calls with zero server audio latency, complete call history, and media preferences.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold flex items-center gap-2 border border-stone-700 transition-all cursor-pointer shadow-md"
          >
            <Settings className="w-4 h-4 text-emerald-400" />
            <span>Settings</span>
          </button>
          <button
            onClick={loadCallData}
            className="p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-md"
            title="Refresh History"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-2xl">
            <PhoneCall className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black text-stone-900 dark:text-white block">{stats?.totalCalls || 0}</span>
            <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Total Calls</span>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400 rounded-2xl">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black text-stone-900 dark:text-white block">{stats?.videoCallsCount || 0}</span>
            <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Video Sessions</span>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 rounded-2xl">
            <PhoneMissed className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black text-stone-900 dark:text-white block">{stats?.missedCallsCount || 0}</span>
            <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Missed / Rejected</span>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 rounded-2xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black text-stone-900 dark:text-white block">{formatDuration(stats?.totalDurationSeconds)}</span>
            <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Total Talk Time</span>
          </div>
        </div>
      </div>

      {/* Admin Analytics Chart */}
      {isUserAdmin && stats?.dailyCalls && stats.dailyCalls.length > 0 && (
        <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-stone-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Communication Activity Breakdown (Last 7 Days)
            </h3>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full">
              Success Rate: {stats.callSuccessRate}%
            </span>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.dailyCalls}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" stroke="#888888" fontSize={12} />
                <YAxis stroke="#888888" fontSize={12} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1c1917', 
                    borderRadius: '12px', 
                    border: 'none', 
                    color: '#fff', 
                    fontSize: '12px' 
                  }} 
                />
                <Bar dataKey="voice" name="Voice Calls" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="video" name="Video Calls" fill="#0284c7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Main Call Logs Table & Controls */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xs p-6 space-y-6">
        
        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search call logs by member name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'incoming', 'outgoing', 'missed', 'video'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer whitespace-nowrap ${
                  filterType === type
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* History List */}
        {loading ? (
          <div className="py-12 text-center text-stone-400 text-xs">Loading call history...</div>
        ) : filteredCalls.length === 0 ? (
          <div className="py-12 text-center text-stone-400 dark:text-stone-500 space-y-2">
            <PhoneCall className="w-8 h-8 mx-auto opacity-30 text-stone-400" />
            <p className="text-sm font-semibold">No call records found</p>
            <p className="text-xs">Your voice and video call logs will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800/80">
            {filteredCalls.map(c => {
              const isCaller = c.caller_id === user?.id;
              const otherUserId = isCaller ? c.receiver_id : c.caller_id;
              const otherName = isCaller ? (c.receiver_name || 'Fellow Member') : (c.caller_name || 'Fellow Member');
              const otherAvatar = getCleanAvatar(isCaller ? c.receiver_avatar : c.caller_avatar);

              const isAnswered = c.status === 'accepted' || c.status === 'ended' || (c.duration && c.duration > 0);
              let statusIcon = <PhoneIncoming className="w-4 h-4 text-emerald-500" />;
              let statusText = 'Incoming Call';

              if (isCaller) {
                if (isAnswered) {
                  statusIcon = <PhoneOutgoing className="w-4 h-4 text-sky-500" />;
                  statusText = 'Outgoing Call';
                } else {
                  statusIcon = <PhoneOutgoing className="w-4 h-4 text-amber-500" />;
                  statusText = 'Outgoing Call (Missed)';
                }
              } else {
                if (isAnswered) {
                  statusIcon = <PhoneIncoming className="w-4 h-4 text-emerald-500" />;
                  statusText = 'Incoming Call';
                } else {
                  statusIcon = <PhoneMissed className="w-4 h-4 text-rose-500" />;
                  statusText = c.status === 'declined' ? 'Rejected Call (Incoming)' : 'Missed Call (Incoming)';
                }
              }

              return (
                <div key={c.id} className="py-4 flex items-center justify-between gap-4 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 px-3 rounded-2xl transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {otherAvatar ? (
                      <img src={otherAvatar} alt={otherName} className="w-11 h-11 rounded-full object-cover ring-2 ring-stone-200 dark:ring-stone-700 shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-emerald-900 text-emerald-200 font-bold text-sm flex items-center justify-center shrink-0">
                        {otherName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-stone-900 dark:text-white truncate">{otherName}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 uppercase">
                          {c.call_type}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-stone-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          {statusIcon}
                          <span>{statusText}</span>
                        </span>
                        <span>•</span>
                        <span>{new Date(c.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        {c.duration ? (
                          <>
                            <span>•</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{formatDuration(c.duration)}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Actions (Call Back & Delete) */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCallback(otherUserId, 'voice')}
                      className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 transition-colors cursor-pointer"
                      title="Voice Call Back"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCallback(otherUserId, 'video')}
                      className="p-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 transition-colors cursor-pointer"
                      title="Video Call Back"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(c.id)}
                      className="p-2 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
                      title="Delete from log"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      <CommunicationSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
};
