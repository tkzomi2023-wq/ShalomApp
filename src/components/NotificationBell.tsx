/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  BellOff, 
  Check, 
  CheckSquare, 
  Trash2, 
  Clock, 
  Calendar, 
  User, 
  BookOpen, 
  Sparkles, 
  ArrowRight, 
  ShieldAlert,
  Info,
  DollarSign,
  UserCheck
} from 'lucide-react';
import { Member, ActivityLog, isOBUser, DEFAULT_ADMIN_EMAIL, formatMemberName, ChatMessage } from '../types';
import { schedulesDb, ServiceSchedule } from '../lib/schedule';

interface NotificationBellProps {
  currentUser: Member;
  logs: ActivityLog[];
  currentTab: 'directory' | 'financials' | 'schedule';
  setCurrentTab: (tab: 'directory' | 'financials' | 'schedule') => void;
  members?: Member[];
  chatMessages?: ChatMessage[];
  onOpenChat?: () => void;
}

interface NotificationItem {
  id: string;
  type: 'assignment' | 'schedule_update' | 'personal_log' | 'general_log';
  title: string;
  message: string;
  timestamp: string; // ISO or date string
  isRead: boolean;
  meta?: {
    scheduleId?: string;
    logId?: string;
    role?: string;
    targetTab?: 'directory' | 'financials' | 'schedule';
  };
}

export function NotificationBell({ 
  currentUser, 
  logs, 
  currentTab, 
  setCurrentTab, 
  members = [],
  chatMessages = [],
  onOpenChat
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'feed'>('alerts');
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load read notification IDs for this user
  useEffect(() => {
    const cached = localStorage.getItem(`sy_read_notifications_${currentUser.id}`);
    if (cached) {
      try {
        setReadIds(JSON.parse(cached));
      } catch (e) {
        console.error('Error loading read notifications:', e);
      }
    }
  }, [currentUser.id]);

  // Sync read notification IDs
  const saveReadIds = (ids: string[]) => {
    setReadIds(ids);
    localStorage.setItem(`sy_read_notifications_${currentUser.id}`, JSON.stringify(ids));
  };

  // Fetch schedules for checking assignments
  const fetchSchedules = async () => {
    try {
      const data = await schedulesDb.getSchedules();
      setSchedules(data);
    } catch (e) {
      console.error('Error loading schedules in notification component:', e);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [logs]); // Re-fetch schedules when logs change, since it might indicate a schedule creation/update

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper function to match user's name in schedule text fields
  const matchesUser = (fieldValue?: string) => {
    if (!fieldValue) return false;
    const normalizedUser = currentUser.name.toLowerCase().trim();
    const normalizedField = fieldValue.toLowerCase();

    if (normalizedField.includes(normalizedUser)) return true;

    // Split the user's name into significant words (min 3 chars) to allow partial matching
    const nameParts = normalizedUser.split(/\s+/).filter(part => part.length >= 3);
    if (nameParts.length > 0) {
      // Check if any significant word is a complete word or part of a word in the field
      return nameParts.some(part => normalizedField.includes(part));
    }
    return false;
  };

  // Check if schedule date is upcoming or today
  const isUpcomingOrToday = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    return date >= today;
  };

  // Generate All Notifications Dynamically
  const notifications: NotificationItem[] = [];

  const isCurrentUserAdmin = currentUser.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || isOBUser(currentUser.role);

  // 3. Process upcoming member birthdays (for admins only)
  if (isCurrentUserAdmin && members && members.length > 0) {
    const todayStr = new Date();
    todayStr.setHours(0, 0, 0, 0);

    members.forEach(m => {
      if (m.dob) {
        const dobDate = new Date(m.dob);
        if (!isNaN(dobDate.getTime())) {
          const birthMonth = dobDate.getMonth();
          const birthDate = dobDate.getDate();

          // Birthday in current calendar year
          const bdayThisYear = new Date(todayStr.getFullYear(), birthMonth, birthDate);
          bdayThisYear.setHours(0, 0, 0, 0);

          let targetBday = bdayThisYear;
          if (bdayThisYear < todayStr) {
            // Birthday already passed this year, check next year
            targetBday = new Date(todayStr.getFullYear() + 1, birthMonth, birthDate);
            targetBday.setHours(0, 0, 0, 0);
          }

          const diffTime = targetBday.getTime() - todayStr.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays >= 0 && diffDays <= 7) {
            let title = '';
            let msg = '';
            if (diffDays === 0) {
              title = `🎂 Happy Birthday Today!`;
              msg = `Today is ${formatMemberName(m.name, m.gender)}'s birthday! 🎉 Send your wishes and celebrate!`;
            } else if (diffDays === 1) {
              title = `🎂 Birthday Tomorrow!`;
              msg = `${formatMemberName(m.name, m.gender)}'s birthday is tomorrow (${targetBday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}). Get ready to celebrate!`;
            } else {
              title = `🎂 Upcoming Birthday`;
              msg = `${formatMemberName(m.name, m.gender)}'s birthday is in ${diffDays} days on ${targetBday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.`;
            }

            notifications.push({
              id: `bday-${m.id}-${targetBday.getFullYear()}`,
              type: 'personal_log', // Show in Personal Alerts for admins
              title,
              message: msg,
              timestamp: targetBday.toISOString().split('T')[0] + 'T00:00:00',
              isRead: readIds.includes(`bday-${m.id}-${targetBday.getFullYear()}`),
              meta: { targetTab: 'directory' }
            });
          }
        }
      }
    });
  }

  // 1. Process Schedules for Personal Assignment Alerts & New Updates
  const today = new Date();
  schedules.forEach(schedule => {
    const upcoming = isUpcomingOrToday(schedule.date);
    
    if (upcoming) {
      // Check roles
      if (matchesUser(schedule.speaker)) {
        notifications.push({
          id: `assign-${schedule.id}-speaker`,
          type: 'assignment',
          title: '🎤 Upcoming Sermon Speaker',
          message: `You are scheduled as the Speaker for "${schedule.title}" on ${schedule.date} (${schedule.time}).`,
          timestamp: schedule.date + 'T' + (schedule.time.includes('PM') ? '16:30:00' : '09:00:00'),
          isRead: readIds.includes(`assign-${schedule.id}-speaker`),
          meta: { scheduleId: schedule.id, role: 'Speaker', targetTab: 'schedule' }
        });
      }
      
      if (matchesUser(schedule.leader)) {
        notifications.push({
          id: `assign-${schedule.id}-leader`,
          type: 'assignment',
          title: '📋 Service Worship Leader',
          message: `You are the designated Worship Leader/Chairman for "${schedule.title}" on ${schedule.date} at ${schedule.time}.`,
          timestamp: schedule.date + 'T' + (schedule.time.includes('PM') ? '16:30:00' : '09:00:00'),
          isRead: readIds.includes(`assign-${schedule.id}-leader`),
          meta: { scheduleId: schedule.id, role: 'Worship Leader', targetTab: 'schedule' }
        });
      }

      if (matchesUser(schedule.solo)) {
        notifications.push({
          id: `assign-${schedule.id}-solo`,
          type: 'assignment',
          title: '🎵 Solo Presentation',
          message: `You have an upcoming Solo presentation scheduled for "${schedule.title}" on ${schedule.date}.`,
          timestamp: schedule.date + 'T12:00:00',
          isRead: readIds.includes(`assign-${schedule.id}-solo`),
          meta: { scheduleId: schedule.id, role: 'Soloist', targetTab: 'schedule' }
        });
      }

      if (matchesUser(schedule.sumpi_aapna)) {
        notifications.push({
          id: `assign-${schedule.id}-sumpi_aapna`,
          type: 'assignment',
          title: '🤝 Dedicated Offering (Sumpi Aapna)',
          message: `You are assigned for Dedication Prayer/Offering (Sumpi Aapna) at "${schedule.title}" on ${schedule.date}.`,
          timestamp: schedule.date + 'T12:00:00',
          isRead: readIds.includes(`assign-${schedule.id}-sumpi_aapna`),
          meta: { scheduleId: schedule.id, role: 'Dedication Prayer', targetTab: 'schedule' }
        });
      }

      if (matchesUser(schedule.sumpi_khon_ding)) {
        notifications.push({
          id: `assign-${schedule.id}-sumpi_khon_ding`,
          type: 'assignment',
          title: '💰 Offering Ushering',
          message: `You are assigned to collect offerings (Sumpi Khon Ding) during "${schedule.title}" on ${schedule.date}.`,
          timestamp: schedule.date + 'T12:00:00',
          isRead: readIds.includes(`assign-${schedule.id}-sumpi_khon_ding`),
          meta: { scheduleId: schedule.id, role: 'Offering Usher', targetTab: 'schedule' }
        });
      }

      if (matchesUser(schedule.lst_simna_quiz)) {
        notifications.push({
          id: `assign-${schedule.id}-lst_simna_quiz`,
          type: 'assignment',
          title: '📖 Scripture Reading & Trivia',
          message: `You are assigned for Scripture Reading/Quiz (LST Simna & Quiz) for "${schedule.title}" on ${schedule.date}.`,
          timestamp: schedule.date + 'T12:00:00',
          isRead: readIds.includes(`assign-${schedule.id}-lst_simna_quiz`),
          meta: { scheduleId: schedule.id, role: 'Scripture Reading', targetTab: 'schedule' }
        });
      }
    }

    // New schedule creation alerts within last 3 days
    const createdDate = new Date(schedule.created_at);
    const diffHours = (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
    if (diffHours <= 72 && schedule.created_by_email !== currentUser.email) {
      notifications.push({
        id: `sched-create-${schedule.id}`,
        type: 'schedule_update',
        title: '📅 New Service Schedule Added',
        message: `"${schedule.title}" has been scheduled for ${schedule.date} by ${schedule.created_by_name}.`,
        timestamp: schedule.created_at,
        isRead: readIds.includes(`sched-create-${schedule.id}`),
        meta: { scheduleId: schedule.id, targetTab: 'schedule' }
      });
    }
  });

  // 4. Process @mentions in Chat Messages
  if (chatMessages && chatMessages.length > 0) {
    chatMessages.forEach(msg => {
      const mentionPattern = `@${currentUser.name.toLowerCase().replace(/\s+/g, '')}`;
      const hasMention = msg.message.toLowerCase().includes(`@${currentUser.name.toLowerCase()}`) || 
                          msg.message.toLowerCase().replace(/\s+/g, '').includes(mentionPattern);

      if (hasMention && msg.user_id !== currentUser.id) {
        notifications.push({
          id: `chat-mention-${msg.id}`,
          type: 'personal_log',
          title: '💬 Tagged in Global Chat',
          message: `${msg.user_name}: "${msg.message}"`,
          timestamp: msg.created_at,
          isRead: readIds.includes(`chat-mention-${msg.id}`)
        });
      }
    });
  }

  // 2. Process Activity Logs for personal alerts or general feeds
  logs.forEach(log => {
    const isActorMe = log.userId === currentUser.id || log.userEmail === currentUser.email;
    const mentionsMyName = log.details.toLowerCase().includes(currentUser.name.toLowerCase()) || 
                          log.details.toLowerCase().includes(currentUser.email.toLowerCase());
    
    if (mentionsMyName && !isActorMe) {
      // Check if it's a membership status change
      const detailsLower = log.details.toLowerCase();
      const isStatusChange = detailsLower.includes('status to') || detailsLower.includes('status changed');
      
      if (isStatusChange) {
        let statusValue: 'approved' | 'pending' | 'rejected' | null = null;
        if (detailsLower.includes('status to "approved"') || detailsLower.includes('to "approved"')) {
          statusValue = 'approved';
        } else if (detailsLower.includes('status to "pending"') || detailsLower.includes('to "pending"')) {
          statusValue = 'pending';
        } else if (detailsLower.includes('status to "rejected"') || detailsLower.includes('status to "declined"') || detailsLower.includes('to "rejected"') || detailsLower.includes('to "declined"')) {
          statusValue = 'rejected';
        }

        if (statusValue) {
          let title = '⚙️ Membership Status Update';
          let message = `Your membership status has been updated.`;
          if (statusValue === 'approved') {
            title = '🎉 Membership Approved!';
            message = `Congratulations! Your Shalom Youth membership has been approved. You now have full access to the directory, schedules, and community features.`;
          } else if (statusValue === 'pending') {
            title = '⏳ Membership Awaiting Review';
            message = `Your membership status is now set to Pending. The administrative committee is reviewing your registration profile.`;
          } else if (statusValue === 'rejected') {
            title = '⚠️ Membership Registration Declined';
            message = `We regret to inform you that your request for membership access was declined. Please contact our Secretary or Officers for appeals.`;
          }

          notifications.push({
            id: `log-status-change-${log.id}`,
            type: 'personal_log', // Appears in personal alerts tab
            title,
            message,
            timestamp: log.created_at,
            isRead: readIds.includes(`log-status-change-${log.id}`),
            meta: { logId: log.id, targetTab: 'directory' }
          });
          return; // Skip normal Profile Update Alert to avoid duplicate notifications
        }
      }

      // Something happened to me (e.g. approved, role changed)
      notifications.push({
        id: `log-personal-${log.id}`,
        type: 'personal_log',
        title: `⚙️ Profile Update Alert`,
        message: `${log.userName}: ${log.action} - ${log.details}`,
        timestamp: log.created_at,
        isRead: readIds.includes(`log-personal-${log.id}`),
        meta: { logId: log.id, targetTab: 'directory' }
      });
    } else {
      // General activity logs
      let prefix = '⚡';
      let targetTab: 'directory' | 'financials' | 'schedule' | undefined = undefined;

      if (log.action.includes('Financial') || log.details.toLowerCase().includes('rupee') || log.details.toLowerCase().includes('collection')) {
        prefix = '💰';
        targetTab = 'financials';
      } else if (log.action.includes('Member') || log.action.includes('Registration')) {
        prefix = '👤';
        targetTab = 'directory';
      } else if (log.action.includes('Schedule')) {
        prefix = '📅';
        targetTab = 'schedule';
      }

      notifications.push({
        id: `log-general-${log.id}`,
        type: 'general_log',
        title: `${prefix} ${log.action}`,
        message: `${log.userName} ${log.details.startsWith('Deleted') || log.details.startsWith('Modified') || log.details.startsWith('Created') ? log.details : 'performed: ' + log.details}`,
        timestamp: log.created_at,
        isRead: readIds.includes(`log-general-${log.id}`),
        meta: { logId: log.id, targetTab }
      });
    }
  });

  // Sort all notifications by date/time descending
  const sortedNotifications = notifications.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Separate Alerts (Assignments + Personal Updates) and Feed (All general events)
  const personalAlerts = sortedNotifications.filter(n => n.type === 'assignment' || n.type === 'personal_log');
  const feedEvents = sortedNotifications.filter(n => n.type === 'schedule_update' || n.type === 'general_log');

  const unreadCount = sortedNotifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Prevent trigger navigation
    }
    if (!readIds.includes(id)) {
      saveReadIds([...readIds, id]);
    }
  };

  const handleMarkAllAsRead = () => {
    const allIds = sortedNotifications.map(n => n.id);
    saveReadIds(Array.from(new Set([...readIds, ...allIds])));
  };

  const handleClearAll = () => {
    // Treat "clear" as marking everything as read and putting them into dismissed
    handleMarkAllAsRead();
    setIsOpen(false);
  };

  const handleNotificationClick = (item: NotificationItem) => {
    handleMarkAsRead(item.id);
    setIsOpen(false);
    
    // Check if it is a chat mention notification
    if (item.id.startsWith('chat-mention-') && onOpenChat) {
      onOpenChat();
      return;
    }
    
    // Switch main tabs if meta indicates a navigation route
    if (item.meta?.targetTab) {
      setCurrentTab(item.meta.targetTab);
      
      // If it's a schedule, scroll to schedule section or highlight
      if (item.meta.targetTab === 'schedule' && item.meta.scheduleId) {
        setTimeout(() => {
          const element = document.getElementById(`schedule-card-${item.meta?.scheduleId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('ring-4', 'ring-emerald-500/50', 'animate-pulse');
            setTimeout(() => {
              element.classList.remove('ring-4', 'ring-emerald-500/50', 'animate-pulse');
            }, 3000);
          }
        }, 300);
      }
    }
  };

  // Render relative time
  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const diffMs = Date.now() - date.getTime();
      const diffMin = Math.floor(diffMs / (1000 * 60));
      const diffHr = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  const visibleNotifications = activeTab === 'alerts' ? personalAlerts : feedEvents;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        onClick={() => {
          setIsOpen(!isOpen);
          // Auto-trigger load when opening
          fetchSchedules();
        }}
        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-200 hover:text-white transition-all cursor-pointer relative focus:outline-none focus:ring-2 focus:ring-emerald-400 border border-white/10 shrink-0"
        title="Organization Notifications"
      >
        <Bell className={`w-4.5 h-4.5 ${unreadCount > 0 ? 'animate-bounce' : ''}`} />
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white ring-2 ring-emerald-900 shadow-sm animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed sm:absolute left-1/2 sm:left-auto right-auto sm:right-0 top-[70px] sm:top-auto mt-3 w-[calc(100vw-2rem)] sm:w-100 max-w-sm sm:max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-150 dark:border-stone-800 z-50 overflow-hidden text-left -translate-x-1/2 sm:translate-x-0"
          >
            {/* Header */}
            <div className="p-4 bg-emerald-900 text-white flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-350" />
                  <span>Notification Center</span>
                </h3>
                <p className="text-[10px] text-emerald-200 font-medium">
                  {unreadCount} unread message{unreadCount !== 1 ? 's' : ''} for {formatMemberName(currentUser.name, currentUser.gender)}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-emerald-150 hover:text-white transition-all text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    title="Mark all as read"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mark read</span>
                  </button>
                )}
                <button
                  onClick={handleClearAll}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-emerald-150 hover:text-white transition-all text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  title="Clear feed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </div>
            </div>

            {/* View Swapper tabs */}
            <div className="flex bg-stone-50 dark:bg-stone-950 border-b border-stone-150 dark:border-stone-850 p-1">
              <button
                onClick={() => setActiveTab('alerts')}
                className={`flex-1 py-2 px-3 text-center rounded-xl text-[11px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'alerts'
                    ? 'bg-white dark:bg-stone-850 text-emerald-700 dark:text-emerald-400 shadow-xs'
                    : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                }`}
              >
                <span>My Personal Alerts</span>
                {personalAlerts.filter(n => !n.isRead).length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('feed')}
                className={`flex-1 py-2 px-3 text-center rounded-xl text-[11px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'feed'
                    ? 'bg-white dark:bg-stone-850 text-emerald-700 dark:text-emerald-400 shadow-xs'
                    : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                }`}
              >
                <span>General Club Feed</span>
                {feedEvents.filter(n => !n.isRead).length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                )}
              </button>
            </div>

            {/* Content List */}
            <div className="max-h-85 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-850 bg-white dark:bg-stone-900">
              {visibleNotifications.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <div className="mx-auto w-10 h-10 rounded-full bg-stone-50 dark:bg-stone-800 flex items-center justify-center text-stone-350 dark:text-stone-650">
                    <BellOff className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300">All Quiet Here</h4>
                    <p className="text-[10px] text-stone-400 dark:text-stone-500 max-w-[240px] mx-auto leading-relaxed">
                      {activeTab === 'alerts' 
                        ? "You don't have any personal upcoming service assignments or notifications."
                        : "No recent updates or activity logs recorded in the community."}
                    </p>
                  </div>
                </div>
              ) : (
                visibleNotifications.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3.5 hover:bg-stone-50/80 dark:hover:bg-stone-850/50 transition-all cursor-pointer flex items-start gap-3 relative border-l-2 ${
                      item.isRead 
                        ? 'border-transparent opacity-80' 
                        : item.type === 'assignment' 
                          ? 'border-emerald-600 bg-emerald-50/20 dark:bg-emerald-900/5' 
                          : 'border-amber-500 bg-amber-50/10 dark:bg-amber-950/5'
                    }`}
                  >
                    {/* Unread circle badge */}
                    {!item.isRead && (
                      <span className={`absolute top-4 right-4 w-1.5 h-1.5 rounded-full ${item.type === 'assignment' ? 'bg-emerald-600' : 'bg-amber-500'}`}></span>
                    )}

                    <div className="space-y-1.5 flex-1 pr-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-xs text-stone-800 dark:text-stone-200">
                          {item.title}
                        </span>
                        <span className="text-[9px] font-bold text-stone-400 flex items-center gap-1 shrink-0">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>

                      <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed font-medium">
                        {item.message}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        {item.meta?.targetTab ? (
                          <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5">
                            <span>Open {item.meta.targetTab === 'schedule' ? 'Schedule' : item.meta.targetTab === 'financials' ? 'Financials' : 'Directory'}</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </span>
                        ) : (
                          <span></span>
                        )}

                        {!item.isRead && (
                          <button
                            onClick={(e) => handleMarkAsRead(item.id, e)}
                            className="p-1 text-[9px] font-bold text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-0.5 cursor-pointer"
                            title="Dismiss"
                          >
                            <Check className="w-3 h-3" />
                            <span>Dismiss</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer summary */}
            <div className="p-3 bg-stone-50 dark:bg-stone-950 border-t border-stone-150 dark:border-stone-850 flex items-center justify-between text-[10px] text-stone-400 font-bold px-4">
              <span>Logged as {currentUser.role}</span>
              <span className="text-emerald-700 dark:text-emerald-400">Shalom Youth Core</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
