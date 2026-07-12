/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from './lib/auth';
import { db, supabase } from './lib/supabase';
import { Member, UserRole, isOBUser, DEFAULT_ADMIN_EMAIL, ALL_ROLES, formatMemberName, BirthdayWish, ChatMessage } from './types';
import { getActivityLogs, addActivityLog, clearActivityLogs } from './lib/activity';
import { RoleBadge } from './components/RoleBadge';
import { SQLSetupModal } from './components/SQLSetupModal';
import { NotificationBell } from './components/NotificationBell';
import { LoginForm } from './components/LoginForm';
import { RegistrationForm } from './components/RegistrationForm';
import { MemberTable } from './components/MemberTable';
import { UserProfileModal } from './components/UserProfileModal';
import { FinancialRecordsPage } from './components/FinancialRecordsPage';
import { SchedulePage } from './components/SchedulePage';
import BirthdayEmailSettingsPage from './components/BirthdayEmailSettingsPage';
import { financialsDb } from './lib/financials';
import { Confetti } from './components/Confetti';
import { OnboardingTour } from './components/OnboardingTour';

// Recharts for analytics representation
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

// Lucide Icons
import { 
  Users, 
  UserPlus, 
  LogOut, 
  Database, 
  Sparkles, 
  ShieldCheck, 
  Info, 
  AlertTriangle, 
  FileText, 
  Plus, 
  TrendingUp, 
  Activity, 
  BookOpen, 
  PhoneCall, 
  CheckCircle,
  HelpCircle,
  User,
  UserCog,
  Calendar,
  SlidersHorizontal,
  Mail,
  MessageSquare,
  Send,
  Smile,
  MoreVertical,
  Trash2,
  Pencil,
  Trash,
  Check,
  CheckCheck,
  X,
  Clock,
  Sun,
  Moon
} from 'lucide-react';

const isBirthdayToday = (dobString?: string, todayDate: Date = new Date()): boolean => {
  if (!dobString) return false;
  const dobDate = new Date(dobString);
  if (isNaN(dobDate.getTime())) return false;
  
  return todayDate.getMonth() === dobDate.getMonth() && todayDate.getDate() === dobDate.getDate();
};

const formatTimeAgo = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    }
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}hr ago`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}day ago`;
    }
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInDays < 30) {
      return `${diffInWeeks}w ago`;
    }
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInDays < 365) {
      return `${diffInMonths}m ago`;
    }
    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears}y ago`;
  } catch (err) {
    return 'just now';
  }
};

const formatFullTimestamp = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && 
                    date.getMonth() === now.getMonth() && 
                    date.getFullYear() === now.getFullYear();
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) {
      return timeStr;
    } else {
      const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return `${dateStr}, ${timeStr}`;
    }
  } catch (err) {
    return '';
  }
};

const getChatDateHeader = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffTime = todayMidnight.getTime() - dateMidnight.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  } catch (err) {
    return '';
  }
};

function AppContent() {
  const { user, loading, signOut, refreshProfile } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return localStorage.getItem('sy_theme') === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('sy_theme', theme);
  }, [theme]);

  const [members, setMembers] = useState<Member[]>([]);
  const [logs, setLogs] = useState(() => getActivityLogs());
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState<boolean | null>(null);
  const [currentTab, setCurrentTab] = useState<'directory' | 'financials' | 'schedule' | 'birthday-tasks'>('directory');
  
  // Keep track of the current date to auto-dismiss birthday banners and effects when the day rolls over.
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    // Check if the calendar day has changed compared to currentDate
    const checkDateTransition = () => {
      const now = new Date();
      setCurrentDate((prevDate) => {
        if (
          now.getDate() !== prevDate.getDate() ||
          now.getMonth() !== prevDate.getMonth() ||
          now.getFullYear() !== prevDate.getFullYear()
        ) {
          return now;
        }
        return prevDate;
      });
    };

    // Calculate initial delay to midnight
    const getMsUntilMidnight = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      return midnight.getTime() - now.getTime();
    };

    let timeoutId: NodeJS.Timeout;
    const scheduleMidnightRefresh = () => {
      const ms = getMsUntilMidnight();
      timeoutId = setTimeout(() => {
        checkDateTransition();
        scheduleMidnightRefresh();
      }, ms);
    };

    scheduleMidnightRefresh();

    // Also run a 30-second interval poll as a robust fallback (e.g. system wake from sleep)
    const intervalId = setInterval(checkDateTransition, 30000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, []);
  
  // Dashboard Widget Toggles
  const [showBirthdayAlerts, setShowBirthdayAlerts] = useState<boolean>(() => {
    const saved = localStorage.getItem('sy_pref_show_birthday_alerts');
    return saved !== null ? saved === 'true' : true;
  });
  const [showRoleDistribution, setShowRoleDistribution] = useState<boolean>(() => {
    const saved = localStorage.getItem('sy_pref_show_role_distribution');
    return saved !== null ? saved === 'true' : true;
  });
  const [showQuickMetrics, setShowQuickMetrics] = useState<boolean>(() => {
    const saved = localStorage.getItem('sy_pref_show_quick_metrics');
    return saved !== null ? saved === 'true' : true;
  });
  
  // Modals / Portal selectors
  const [isSQLModalOpen, setIsSQLModalOpen] = useState(false);
  
  // Birthday Wishes & Gift Box states
  const [birthdayWishes, setBirthdayWishes] = useState<BirthdayWish[]>([]);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [wishedIds, setWishedIds] = useState<string[]>([]);
  const [isWishingMap, setIsWishingMap] = useState<Record<string, boolean>>({});
  const [selectedProfileMember, setSelectedProfileMember] = useState<Member | null>(null);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [isAuthView, setIsAuthView] = useState<'login' | 'register'>('login');
  const [addNewMemberOpen, setAddNewMemberOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showOnboardingTour, setShowOnboardingTour] = useState(false);

  // Global Realtime Chat states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newChatMessageText, setNewChatMessageText] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const chatEndRef = React.useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = React.useRef<HTMLDivElement>(null);
  const chatChannelRef = React.useRef<any>(null);
  const userTypingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isCurrentlyTypingRef = React.useRef<boolean>(false);

  // Mentions & Emoji Picker States
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(-1);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = React.useRef<HTMLDivElement>(null);
  const mentionDropdownRef = React.useRef<HTMLDivElement>(null);

  // Clear Chat & Reactions States
  const [isChatHeaderMenuOpen, setIsChatHeaderMenuOpen] = useState(false);
  const [showFullTimestamps, setShowFullTimestamps] = useState(() => localStorage.getItem('sy_show_full_timestamps') === 'true');
  const [showReadReceipts, setShowReadReceipts] = useState(() => localStorage.getItem('sy_show_read_receipts') !== 'false');
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [popoverDirection, setPopoverDirection] = useState<'up' | 'down'>('up');
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [showGuidelines, setShowGuidelines] = useState(() => !localStorage.getItem('sy_dismiss_guidelines'));
  const chatHeaderMenuRef = React.useRef<HTMLDivElement>(null);
  const activeReactionContainerRef = React.useRef<HTMLDivElement>(null);
  const pressTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const startPress = (msgId: string) => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      setActiveReactionMsgId(msgId);
    }, 500);
  };

  const endPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  // Determine if the reaction popover should open facing upwards or downwards
  useEffect(() => {
    if (!activeReactionMsgId) return;
    const timer = setTimeout(() => {
      const msgElement = document.querySelector(`[data-message-id="${activeReactionMsgId}"]`);
      if (msgElement && chatScrollContainerRef.current) {
        const msgRect = msgElement.getBoundingClientRect();
        const containerRect = chatScrollContainerRef.current.getBoundingClientRect();
        const spaceAbove = msgRect.top - containerRect.top;
        if (spaceAbove < 65) {
          setPopoverDirection('down');
        } else {
          setPopoverDirection('up');
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [activeReactionMsgId]);

  // Click outside listener for emoji picker, mentions, chat menu, and reaction popup
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (mentionDropdownRef.current && !mentionDropdownRef.current.contains(event.target as Node)) {
        setMentionQuery(null);
        setMentionIndex(-1);
      }
      if (chatHeaderMenuRef.current && !chatHeaderMenuRef.current.contains(event.target as Node)) {
        setIsChatHeaderMenuOpen(false);
      }
      if (activeReactionContainerRef.current && !activeReactionContainerRef.current.contains(event.target as Node)) {
        setActiveReactionMsgId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format mentions helper for chat message bubbles
  const renderFormattedMessage = (text: string) => {
    if (!text.includes('@')) return <span>{text}</span>;
    
    const approvedNames = members
      .filter(m => m.status === 'approved')
      .map(m => m.name);
    
    const sortedNames = [...approvedNames].sort((a, b) => b.length - a.length);
    const escapedNames = sortedNames.map(name => name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    
    if (escapedNames.length === 0) return <span>{text}</span>;
    
    const regex = new RegExp(`@(${escapedNames.join('|')})\\b`, 'gi');
    
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      const matchText = match[0];
      const nameOnly = match[1];
      
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }
      
      parts.push(
        <span 
          key={matchIndex} 
          className="bg-violet-100/80 dark:bg-violet-900/45 text-violet-700 dark:text-violet-300 font-extrabold px-1.5 py-0.5 rounded-md mx-0.5 border border-violet-200/50 dark:border-violet-800/40 inline-block align-baseline select-all"
        >
          @{nameOnly}
        </span>
      );
      
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return <span className="whitespace-pre-wrap">{parts}</span>;
  };

  // Mark messages as read when chat window is open
  useEffect(() => {
    if (isChatOpen && user && chatMessages.length > 0 && showReadReceipts) {
      const unreadMessageIds = chatMessages
        .filter(m => m.user_id !== user.id && (!m.read_by || !m.read_by.includes(user.id)))
        .map(m => m.id);
      
      if (unreadMessageIds.length > 0) {
        db.markMessagesAsRead(unreadMessageIds, user.id);
      }
    }
  }, [isChatOpen, chatMessages, user?.id, showReadReceipts]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }
  }, [chatMessages, isChatOpen]);

  // Manual Member creation (Admin action)
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('shalomyouth');
  const [newMemberRole, setNewMemberRole] = useState<UserRole>('standard');
  const [newMemberStatus, setNewMemberStatus] = useState<'approved' | 'pending'>('approved');
  const [newMemberGender, setNewMemberGender] = useState<'Male' | 'Female' | ''>('');
  const [adminFormError, setAdminFormError] = useState<string | null>(null);

  // Refresh and load members directory
  const loadDatabase = async () => {
    setIsTestingConnection(true);
    setConnectionError(null);
    setConnectionSuccess(null);
    try {
      const isOnline = await db.testConnection();
      setDbConnected(isOnline);
      if (isOnline) {
        setConnectionSuccess(true);
        await db.syncLocalDataToSupabase();
        await financialsDb.syncLocalFinancialsToSupabase();
      } else {
        setConnectionError(db.lastError || "Could not reach database. Check if tables are created.");
        setConnectionSuccess(false);
      }
      const data = await db.getMembers();
      setMembers(data);
      // Synchronize current logged-in session profile state
      if (user) {
        await refreshProfile();
      }
    } catch (e: any) {
      console.error('Failed to load database content:', e);
      setConnectionError(e?.message || String(e));
      setConnectionSuccess(false);
    } finally {
      setIsTestingConnection(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadDatabase();
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setWishedIds([]);
      return;
    }
    const loadSentWishes = async () => {
      try {
        const sent = await db.getSentBirthdayWishes(user.id);
        setWishedIds(sent);
      } catch (err) {
        console.error("Failed to load sent wishes:", err);
      }
    };
    loadSentWishes();
  }, [user?.id]);

  useEffect(() => {
    if (user && user.role === 'standard') {
      const tourCompleted = localStorage.getItem('sy_onboarding_tour_v1');
      if (tourCompleted !== 'completed') {
        const timer = setTimeout(() => {
          setShowOnboardingTour(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    } else {
      setShowOnboardingTour(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (user && user.dob && isBirthdayToday(user.dob, currentDate)) {
      const loadWishes = async () => {
        try {
          const wishes = await db.getBirthdayWishes(user.id);
          setBirthdayWishes(wishes);
        } catch (e) {
          console.error("Error loading birthday wishes:", e);
        }
      };
      loadWishes();
      // Poll every 15 seconds for hot updates on their special day!
      const interval = setInterval(loadWishes, 15000);
      return () => clearInterval(interval);
    } else {
      setBirthdayWishes([]);
    }
  }, [user?.id, user?.dob, currentDate]);

  // Ref to track if chat is open to avoid stale closures in realtime events
  const isChatOpenRef = React.useRef(isChatOpen);
  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) {
      setUnreadChatCount(0);
    }
  }, [isChatOpen]);

  // Load and Subscribe to Global Realtime Chat
  useEffect(() => {
    if (!user) {
      setChatMessages([]);
      setUnreadChatCount(0);
      setTypingUsers([]);
      return;
    }

    const loadInitialChats = async () => {
      try {
        const msgs = await db.getChatMessages();
        setChatMessages(msgs);
        if (!isChatOpenRef.current) {
          const unreadCount = msgs.filter(m => m.user_id !== user.id && (!m.read_by || !m.read_by.includes(user.id))).length;
          setUnreadChatCount(unreadCount);
        }
      } catch (err) {
        console.error('Failed to load initial chats:', err);
      }
    };

    loadInitialChats();

    // Subscribe to Postgres Changes and Presence for realtime updates
    const chatChannel = supabase
      .channel('public_global_chat_messages_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'global_chat_messages'
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setChatMessages((prev) => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          if (!isChatOpenRef.current && newMsg.user_id !== user.id) {
            setUnreadChatCount((c) => c + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'global_chat_messages'
        },
        (payload) => {
          const updatedMsg = payload.new as ChatMessage;
          setChatMessages((prev) => {
            return prev.map(m => m.id === updatedMsg.id ? updatedMsg : m);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'global_chat_messages'
        },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setChatMessages((prev) => prev.filter(m => m.id !== deletedId));
          } else {
            // Bulk delete fallback
            setChatMessages([]);
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = chatChannel.presenceState();
        const typing: string[] = [];
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          presences.forEach((p) => {
            if (p.is_typing && p.user_id !== user.id) {
              typing.push(p.user_name || 'Someone');
            }
          });
        });
        setTypingUsers(Array.from(new Set(typing)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await chatChannel.track({
            user_id: user.id,
            user_name: user.name,
            is_typing: false,
            online_at: new Date().toISOString()
          });
        }
      });

    chatChannelRef.current = chatChannel;

    // Fast polling fallback to guarantee syncing even on offline or unconfigured environments
    const fallbackPoll = setInterval(async () => {
      try {
        const msgs = await db.getChatMessages();
        setChatMessages((prev) => {
          const prevIds = new Set(prev.map(m => m.id));
          const newMsgs = msgs.filter(m => !prevIds.has(m.id));
          if (newMsgs.length > 0 && !isChatOpenRef.current) {
            setUnreadChatCount((c) => c + newMsgs.length);
          }
          return msgs;
        });
      } catch (e) {
        console.warn('Fallback poll warning:', e);
      }
    }, 4000);

    return () => {
      supabase.removeChannel(chatChannel);
      clearInterval(fallbackPoll);
      if (userTypingTimeoutRef.current) {
        clearTimeout(userTypingTimeoutRef.current);
      }
    };
  }, [user?.id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewChatMessageText(val);

    // Mention autocomplete detection
    const selectionStart = e.target.selectionStart || 0;
    const lastAtIdx = val.lastIndexOf('@', selectionStart - 1);
    
    if (lastAtIdx !== -1) {
      const chunk = val.substring(lastAtIdx + 1, selectionStart);
      if (!chunk.includes(' ') && chunk.length < 20) {
        setMentionQuery(chunk.toLowerCase());
        setMentionIndex(lastAtIdx);
      } else {
        setMentionQuery(null);
        setMentionIndex(-1);
      }
    } else {
      setMentionQuery(null);
      setMentionIndex(-1);
    }

    if (!user || !chatChannelRef.current) return;

    if (!isCurrentlyTypingRef.current) {
      isCurrentlyTypingRef.current = true;
      chatChannelRef.current.track({
        user_id: user.id,
        user_name: user.name,
        is_typing: true,
        online_at: new Date().toISOString()
      }).catch((err: any) => console.warn('Presence track typing error:', err));
    }

    if (userTypingTimeoutRef.current) {
      clearTimeout(userTypingTimeoutRef.current);
    }

    userTypingTimeoutRef.current = setTimeout(() => {
      isCurrentlyTypingRef.current = false;
      if (chatChannelRef.current) {
        chatChannelRef.current.track({
          user_id: user.id,
          user_name: user.name,
          is_typing: false,
          online_at: new Date().toISOString()
        }).catch((err: any) => console.warn('Presence untrack typing error:', err));
      }
    }, 1500);
  };

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !newChatMessageText.trim() || isSendingChat) return;

    const text = newChatMessageText.trim();
    setNewChatMessageText("");
    setMentionQuery(null);
    setMentionIndex(-1);
    setShowEmojiPicker(false);
    setIsSendingChat(true);

    if (userTypingTimeoutRef.current) {
      clearTimeout(userTypingTimeoutRef.current);
    }
    isCurrentlyTypingRef.current = false;
    if (chatChannelRef.current) {
      chatChannelRef.current.track({
        user_id: user.id,
        user_name: user.name,
        is_typing: false,
        online_at: new Date().toISOString()
      }).catch((err: any) => console.warn('Presence track clean error:', err));
    }

    try {
      const sentMsg = await db.sendChatMessage(
        text,
        user.id,
        user.name,
        user.avatar
      );
      
      setChatMessages((prev) => {
        if (prev.some(m => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });
    } catch (err) {
      console.error("Failed to send chat message:", err);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleSelectMention = (memberName: string) => {
    if (mentionIndex === -1) return;
    const text = newChatMessageText;
    const before = text.substring(0, mentionIndex);
    const after = text.substring(text.indexOf(' ', mentionIndex) !== -1 ? text.indexOf(' ', mentionIndex) : text.length);
    const newText = `${before}@${memberName} ${after}`;
    setNewChatMessageText(newText);
    setMentionQuery(null);
    setMentionIndex(-1);
    
    setTimeout(() => {
      const inputEl = document.getElementById('chat-message-input') as HTMLInputElement;
      if (inputEl) {
        inputEl.focus();
        const newPos = before.length + memberName.length + 2; // +1 for '@', +1 for space
        inputEl.setSelectionRange(newPos, newPos);
      }
    }, 50);
  };

  const handleSelectEmoji = (emoji: string) => {
    const text = newChatMessageText;
    const inputElement = document.getElementById('chat-message-input') as HTMLInputElement;
    const cursorPosition = inputElement?.selectionStart || text.length;
    
    const before = text.substring(0, cursorPosition);
    const after = text.substring(cursorPosition);
    const newText = `${before}${emoji}${after}`;
    
    setNewChatMessageText(newText);
    
    setTimeout(() => {
      if (inputElement) {
        inputElement.focus();
        const newCursorPos = cursorPosition + emoji.length;
        inputElement.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 50);
  };

  const handleClearChatHistory = async () => {
    if (!user || !isCurrentUserAdmin) return;
    if (!window.confirm('Are you sure you want to clear the entire chat history for everyone? This action is permanent.')) {
      return;
    }
    try {
      await db.clearAllChatMessages();
      setChatMessages([]);
      setIsChatHeaderMenuOpen(false);
    } catch (err) {
      console.error('Failed to clear chat history:', err);
    }
  };

  const handleToggleMessageReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    try {
      const updated = await db.toggleMessageReaction(messageId, emoji, user.id);
      if (updated) {
        setChatMessages(prev => prev.map(m => m.id === messageId ? updated : m));
      }
      setActiveReactionMsgId(null);
    } catch (err) {
      console.error('Failed to toggle message reaction:', err);
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    if (!user || !newText.trim()) return;
    try {
      const updated = await db.editChatMessage(messageId, newText.trim());
      if (updated) {
        setChatMessages(prev => prev.map(m => m.id === messageId ? updated : m));
      }
      setEditingMsgId(null);
      setEditingText('');
    } catch (err) {
      console.error('Failed to edit chat message:', err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    try {
      const updated = await db.deleteChatMessage(messageId);
      if (updated) {
        setChatMessages(prev => prev.map(m => m.id === messageId ? updated : m));
      }
      setActiveReactionMsgId(null);
    } catch (err) {
      console.error('Failed to delete chat message:', err);
    }
  };

  // Handle active user mutations
  const handleUpdateRoleAndStatus = async (id: string, role: UserRole, status: 'approved' | 'pending' | 'rejected') => {
    if (!user) return;
    try {
      const memberToUpdate = members.find(m => m.id === id);
      if (!memberToUpdate) return;

      const act = await db.updateMemberRoleAndStatus(id, role, status);
      if (act) {
        // Track log
        addActivityLog(
          user.id,
          user.email,
          user.name,
          'Member Updated',
          `Modified "${memberToUpdate.name}" role to "${role}" and status to "${status}".`,
          id,
          memberToUpdate.name
        );
        setLogs(getActivityLogs());
        await loadDatabase();
      }
    } catch (e: any) {
      alert(`Database rejected role modification: ${e.message || e}`);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!user) return;
    try {
      const memberToDelete = members.find(m => m.id === id);
      if (!memberToDelete) return;

      const act = await db.deleteMember(id);
      if (act) {
        addActivityLog(
          user.id,
          user.email,
          user.name,
          'Member Removed',
          `Deleted registration record for "${memberToDelete.name}" (${memberToDelete.email}).`,
          id,
          memberToDelete.name
        );
        setLogs(getActivityLogs());
        await loadDatabase();
      } else {
        alert('Cannot remove the default system administrator profile.');
      }
    } catch (e: any) {
      alert(`Delete operation failed: ${e.message || e}`);
    }
  };

  const handleBatchApproveMembers = async (ids: string[]) => {
    if (!user) return;
    try {
      let approvedCount = 0;
      for (const id of ids) {
        const memberToUpdate = members.find(m => m.id === id);
        if (!memberToUpdate) continue;
        
        // Don't update if already approved or default admin
        if (memberToUpdate.status === 'approved') continue;
        if (memberToUpdate.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) continue;

        const act = await db.updateMemberRoleAndStatus(id, memberToUpdate.role, 'approved');
        if (act) {
          addActivityLog(
            user.id,
            user.email,
            user.name,
            'Member Approved (Batch)',
            `Approved registration record for "${memberToUpdate.name}" (${memberToUpdate.email}).`,
            id,
            memberToUpdate.name
          );
          approvedCount++;
        }
      }
      if (approvedCount > 0) {
        setLogs(getActivityLogs());
        await loadDatabase();
      }
    } catch (e: any) {
      alert(`Database rejected batch approval: ${e.message || e}`);
    }
  };

  const handleBatchDeleteMembers = async (ids: string[]) => {
    if (!user) return;
    try {
      let deletedCount = 0;
      for (const id of ids) {
        const memberToDelete = members.find(m => m.id === id);
        if (!memberToDelete) continue;
        if (memberToDelete.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) continue;

        const act = await db.deleteMember(id);
        if (act) {
          addActivityLog(
            user.id,
            user.email,
            user.name,
            'Member Removed (Batch)',
            `Deleted registration record for "${memberToDelete.name}" (${memberToDelete.email}).`,
            id,
            memberToDelete.name
          );
          deletedCount++;
        }
      }
      if (deletedCount > 0) {
        setLogs(getActivityLogs());
        await loadDatabase();
      }
    } catch (e: any) {
      alert(`Database rejected batch deletion: ${e.message || e}`);
    }
  };

  const handleSendWish = async (receiverId: string, receiverName: string) => {
    if (!user) {
      alert("Please log in to send a wish!");
      return;
    }
    setIsWishingMap(prev => ({ ...prev, [receiverId]: true }));
    try {
      await db.sendBirthdayWish(receiverId, user.id, user.name);
      setWishedIds(prev => [...prev, receiverId]);
      alert(`🎉 Your birthday wish is inside ${receiverName}'s animated gift box! It will be visible to them for 24 hours. 🎁✨`);
    } catch (err: any) {
      console.error("Error sending birthday wish:", err);
      alert("Failed to send birthday wish. Please try again.");
    } finally {
      setIsWishingMap(prev => ({ ...prev, [receiverId]: false }));
    }
  };

  const handleUpdateProfileDetails = async (updated: Member) => {
    if (!user) return;
    
    // Security check: user must be editing their own profile or must be an admin
    const isSelf = user.id === updated.id || (user.email && updated.email && user.email.toLowerCase() === updated.email.toLowerCase());
    if (!isSelf && !isCurrentUserAdmin) {
      alert("You can only update your own profile.");
      return;
    }

    // Ensure linkage/ownership: If they are updating their own profile, we should use their active user.id
    const finalUpdated = { ...updated };
    if (isSelf && !isCurrentUserAdmin && user.id !== updated.id) {
      console.log(`[handleUpdateProfileDetails] Syncing profile ID for standard user: changing profile ID from ${updated.id} to ${user.id}`);
      finalUpdated.id = user.id;
    }

    try {
      const original = members.find(m => m.id === finalUpdated.id) || members.find(m => m.email.toLowerCase() === finalUpdated.email.toLowerCase());
      let details = `Updated details for "${finalUpdated.name}".`;
      let changes: string[] = [];
      if (original) {
        if (original.role !== finalUpdated.role) {
          changes.push(`role changed from "${original.role}" to "${finalUpdated.role}"`);
        }
        if (original.status !== finalUpdated.status) {
          changes.push(`status changed from "${original.status}" to "${finalUpdated.status}"`);
        }
        if (original.phone !== finalUpdated.phone) {
          changes.push(`phone changed from "${original.phone || 'None'}" to "${finalUpdated.phone || 'None'}"`);
        }
        if (original.address !== finalUpdated.address) {
          changes.push(`address changed`);
        }
        if (original.dob !== finalUpdated.dob) {
          changes.push(`DOB changed`);
        }
        if (original.blood_group !== finalUpdated.blood_group) {
          changes.push(`blood group changed from "${original.blood_group || 'None'}" to "${finalUpdated.blood_group || 'None'}"`);
        }
        if (original.gender !== finalUpdated.gender) {
          changes.push(`gender changed from "${original.gender || 'None'}" to "${finalUpdated.gender || 'None'}"`);
        }
        if (original.name !== finalUpdated.name) {
          changes.push(`name changed from "${original.name}" to "${finalUpdated.name}"`);
        }
        if (changes.length > 0) {
          details = `Updated details for "${finalUpdated.name}": ${changes.join(', ')}.`;
        }
      }

      await db.createOrUpdateMember(finalUpdated);
      
      const isModifiedByAdmin = user.id !== finalUpdated.id;
      const logAction = isModifiedByAdmin ? 'Admin Action' : 'Profile Modified';

      addActivityLog(
        user.id,
        user.email,
        user.name,
        logAction,
        details,
        finalUpdated.id,
        finalUpdated.name
      );
      setLogs(getActivityLogs());
      await loadDatabase();
      if (user.id === finalUpdated.id) {
        await refreshProfile();
      }
      setSelectedProfileMember(null);
    } catch (e: any) {
      alert(`Failed to save profile changes: ${e.message || e}`);
      throw e;
    }
  };

  // Add Member manually from admin panel
  const handleAdminAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminFormError(null);

    if (!newMemberEmail.trim()) {
      setAdminFormError('Email is required.');
      return;
    }
    if (!newMemberName.trim()) {
      setAdminFormError('Full Name is required.');
      return;
    }

    try {
      const result = await db.provisionMemberWithAuth(
        newMemberEmail.trim().toLowerCase(),
        newMemberPassword.trim() || 'shalomyouth',
        newMemberName.trim(),
        newMemberPhone.trim(),
        newMemberRole,
        newMemberStatus,
        newMemberGender || undefined
      );

      if (user) {
        addActivityLog(
          user.id,
          user.email,
          user.name,
          'Member Manual Provision',
          `Manually created account "${result.name}" with role "${result.role}".`,
          result.id,
          result.name
        );
        setLogs(getActivityLogs());
      }

      setNewMemberEmail('');
      setNewMemberName('');
      setNewMemberPhone('');
      setNewMemberPassword('shalomyouth');
      setNewMemberRole('standard');
      setNewMemberStatus('approved');
      setNewMemberGender('');
      setAddNewMemberOpen(false);
      await loadDatabase();
    } catch (err: any) {
      setAdminFormError(err.message || 'Operation failed');
    }
  };

  const handleClearLogs = () => {
    clearActivityLogs();
    setLogs([]);
  };

  // Check if current user is default admin or is an OB role
  const isCurrentUserAdmin = user ? (user.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || isOBUser(user.role)) : false;

  // Compute Statistics for Dashboard widgets
  const totalCount = members.length;
  const approvedCount = members.filter(m => m.status === 'approved').length;
  const pendingCount = members.filter(m => m.status === 'pending').length;
  const rejectedCount = members.filter(m => m.status === 'rejected').length;
  const obCount = members.filter(m => isOBUser(m.role)).length;
  const ecmCount = members.filter(m => m.role === 'ECM').length;
  const standardCount = members.filter(m => m.role === 'standard').length;

  // Data representation for Recharts Bar Chart: Role Distributions
  const roleDistributionData = [
    { name: 'Standard Member', count: standardCount, fill: '#10b981' },
    { name: 'ECM Committee', count: ecmCount, fill: '#3b82f6' },
    { name: 'Officer Bearer (OB)', count: obCount, fill: '#f59e0b' }
  ];

  // Data representation for Recharts Pie Chart: Approval States
  const statusDistributionData = [
    { name: 'Approved Members', value: approvedCount, color: '#10b981' },
    { name: 'Pending Approvals', value: pendingCount, color: '#f59e0b' },
    { name: 'Rejected Requests', value: rejectedCount, color: '#ef4444' }
  ].filter(item => item.value > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-stone-500">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-250 border-t-emerald-600 animate-spin mb-4"></div>
        <p className="text-xs font-bold uppercase tracking-wider">Accessing Shalom Youth Database...</p>
      </div>
    );
  }

  // --- UNAUTHENTICATED SCREEN (Welcome Portal) ---
  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-b from-stone-50 to-stone-100 dark:from-stone-900 dark:to-stone-950 flex flex-col justify-between relative transition-colors duration-200" id="app_root">
        {/* Floating Global Theme Toggle */}
        <div className="absolute top-4 right-4 z-50">
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-200 rounded-full border border-stone-200 dark:border-stone-700 shadow-md cursor-pointer transition-all active:scale-95 flex items-center justify-center hover:shadow-lg"
            title={theme === 'dark' ? 'Switch to Light Mode ☀️' : 'Switch to Dark Mode 🌙'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-violet-600" />
            )}
          </button>
        </div>

        {/* Decorative Top Accent */}
        <div className="h-2 bg-emerald-700 w-full"></div>

        <div className="max-w-4xl mx-auto w-full px-4 py-12 flex-1 flex flex-col justify-center items-center">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center w-full">
            
            {/* Branding Column */}
            <div className="md:col-span-5 space-y-6 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-extrabold tracking-wide uppercase border border-emerald-100 dark:border-emerald-900/50">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-450 animate-pulse" /> Official Club Space
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-stone-900 dark:text-white leading-none">
                  Shalom <span className="text-emerald-700 dark:text-emerald-450">Youth</span>
                </h1>
                <p className="text-sm text-stone-600 dark:text-stone-400 font-medium leading-relaxed">
                  The centralized member management administrative core. Designed for secure registration, dynamic roles, and seamless records tracking.
                </p>
              </div>

              {/* Status / Feature highlights */}
              <div className="space-y-3 hidden md:block">
                <div className="flex items-center gap-2.5 text-xs text-stone-600 dark:text-stone-400">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-450 shrink-0" />
                  <span>Real-time Supabase Database Sync</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-stone-600 dark:text-stone-400">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-450 shrink-0" />
                  <span>Interactive Role Management</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-stone-600 dark:text-stone-400">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-450 shrink-0" />
                  <span>Officer Bearer (OB) Control Panel</span>
                </div>
              </div>

              {/* Db Synchronizer status */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    if (user?.email?.toLowerCase() === 'tkpaite2016@gmail.com') {
                      setIsSQLModalOpen(true);
                    } else {
                      alert("Access Denied: Only tkpaite2016@gmail.com can configure Supabase Setup.");
                    }
                  }}
                  disabled={user?.email?.toLowerCase() !== 'tkpaite2016@gmail.com'}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-350 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 px-3.5 py-2 rounded-xl border border-emerald-100 dark:border-emerald-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  title={user?.email?.toLowerCase() === 'tkpaite2016@gmail.com' ? "Configure database" : "Supabase configurations are restricted to tkpaite2016@gmail.com"}
                >
                  <Database className="w-4 h-4" />
                  Supabase Setup Configurations
                </button>
              </div>
            </div>

            {/* Auth card Form Column */}
            <div className="md:col-span-7">
              <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 md:p-8 shadow-xl border border-stone-200/80 dark:border-stone-800 transition-all max-w-md mx-auto w-full">
                {isAuthView === 'login' ? (
                  <LoginForm 
                    onToggleRegister={() => setIsAuthView('register')} 
                    onSuccess={() => loadDatabase()} 
                  />
                ) : (
                  <RegistrationForm 
                    onToggleLogin={() => setIsAuthView('login')} 
                    onSuccess={() => loadDatabase()} 
                  />
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Universal Footer */}
        <footer className="py-6 border-t border-stone-200 dark:border-stone-850 bg-white dark:bg-stone-900 text-center text-xs text-stone-400 dark:text-stone-500">
          <p>© {new Date().getFullYear()} Shalom Youth Community Organization. Designed by TK Paite.</p>
        </footer>

        <SQLSetupModal isOpen={isSQLModalOpen} onClose={() => setIsSQLModalOpen(false)} />
      </div>
    );
  }

  // --- AUTHENTICATED SCREEN (Main Dashboard Workspace) ---
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col justify-between transition-colors duration-200" id="dashboard_root">
      
      {/* Universal Sticky Header Grid */}
      <header className="bg-emerald-900 text-white px-4 py-4 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-bold text-lg text-emerald-300">
              SY
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight leading-none">Shalom Youth</h1>
              <span className="text-[10px] text-emerald-250 font-bold uppercase tracking-wider">Members Console</span>
            </div>
          </div>

          {/* Quick connection / diagnostics indicator */}
          <div className="hidden lg:flex items-center gap-2 text-xs bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
            <span className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}></span>
            <span className="text-white/80">
              Database: {dbConnected ? 'Supabase Synchronized' : 'High-Fidelity Offline Sync'}
            </span>
          </div>

          {/* Right Section / Profile avatar / Logout */}
          <div className="flex items-center gap-3">
            <NotificationBell 
              currentUser={user} 
              logs={logs} 
              currentTab={currentTab}
              setCurrentTab={setCurrentTab}
              members={members}
              chatMessages={chatMessages}
              onOpenChat={() => setIsChatOpen(true)}
            />

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 bg-emerald-950/40 hover:bg-emerald-800/80 rounded-xl text-emerald-250 hover:text-white transition-all cursor-pointer shrink-0 border border-emerald-800/60 flex items-center justify-center"
              title={theme === 'dark' ? 'Switch to Light Mode ☀️' : 'Switch to Dark Mode 🌙'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-emerald-300" />
              )}
            </button>

            <div className="text-right hidden sm:block">
              <span className="block text-xs font-bold text-white leading-none">{formatMemberName(user.name, user.gender)}</span>
              <span className="inline-flex items-center mt-1">
                <RoleBadge role={user.role} className="scale-85 origin-right py-0 px-1.5" />
              </span>
            </div>
            
            <button
              id="tour-avatar-btn"
              onClick={() => {
                setProfileEditMode(false);
                setSelectedProfileMember(user);
              }}
              className="w-9 h-9 rounded-full overflow-hidden bg-emerald-80 text-emerald-200 hover:text-white font-black flex items-center justify-center text-xs border-2 border-emerald-700/50 cursor-pointer shrink-0"
              title="My Account Details"
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </button>

            <button
              id="tour-edit-profile-btn"
              onClick={() => {
                setProfileEditMode(true);
                setSelectedProfileMember(user);
              }}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 bg-emerald-950/40 hover:bg-emerald-800/80 text-emerald-100 hover:text-white rounded-xl text-xs font-bold border border-emerald-800/60 cursor-pointer transition-all shadow-xs"
              title="Edit My Profile Details"
            >
              <UserCog className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Edit Profile</span>
            </button>

            {user.role === 'standard' && (
              <button
                onClick={() => setShowOnboardingTour(true)}
                className="p-2 bg-emerald-950 hover:bg-emerald-999 rounded-xl text-emerald-250 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Take Onboarding Tour 🌟"
              >
                <HelpCircle className="w-4 h-4 text-emerald-250" />
              </button>
            )}

            <button
              onClick={() => signOut()}
              className="p-2 bg-emerald-950 hover:bg-emerald-999 rounded-xl text-emerald-250 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Logout Profile"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Primary Workspace Stage */}
      <main className="max-w-7xl mx-auto w-full px-4 py-6 flex-grow space-y-6">

        {/* Floating Festive Balloon Background Theme Effect */}
        {user.dob && isBirthdayToday(user.dob, currentDate) && (
          <>
            <style>{`
              @keyframes floatUp {
                0% {
                  transform: translateY(0) rotate(0deg);
                  opacity: 0;
                }
                10% {
                  opacity: 0.6;
                }
                90% {
                  opacity: 0.6;
                }
                100% {
                  transform: translateY(-120vh) rotate(15deg);
                  opacity: 0;
                }
              }
              @keyframes wiggle {
                0%, 100% { transform: rotate(-3deg); }
                50% { transform: rotate(3deg); }
              }
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes scaleUp {
                from { transform: scale(0.95); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
              }
              .animate-wiggle {
                animation: wiggle 1s ease-in-out infinite;
              }
              .animate-fade-in {
                animation: fadeIn 0.2s ease-out forwards;
              }
              .animate-scale-up {
                animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
              }
            `}</style>
            <div className="fixed inset-0 pointer-events-none z-10 overflow-hidden select-none">
              {[...Array(15)].map((_, i) => {
                const delay = i * 1.2;
                const left = (i * 7) % 95;
                const size = 20 + ((i * 12) % 30);
                const colors = ['bg-pink-400', 'bg-rose-400', 'bg-purple-400', 'bg-indigo-400', 'bg-sky-400', 'bg-amber-400', 'bg-emerald-400'];
                const colorClass = colors[i % colors.length];
                return (
                  <div
                    key={i}
                    className={`absolute bottom-[-100px] ${colorClass} opacity-40 rounded-full flex items-center justify-center`}
                    style={{
                      left: `${left}%`,
                      width: `${size}px`,
                      height: `${size * 1.2}px`,
                      animation: `floatUp 12s linear infinite`,
                      animationDelay: `${delay}s`,
                      boxShadow: 'inset -5px -5px 10px rgba(0,0,0,0.15), 0 5px 10px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div className="absolute bottom-[-15px] left-1/2 -translate-x-1/2 w-0.5 h-4 bg-stone-300"></div>
                    <div className="absolute top-[10%] left-[20%] w-[20%] h-[20%] bg-white/40 rounded-full"></div>
                    {i % 3 === 0 && <span className="text-[10px] animate-pulse">✨</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* TODAY IS YOUR BIRTHDAY FESTIVE THEME BANNER */}
        {user.dob && isBirthdayToday(user.dob, currentDate) && (
          <div className="p-3.5 sm:p-4 md:p-5 bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-600 rounded-2xl border border-pink-450/20 shadow-xl text-white flex flex-col md:flex-row items-center gap-3 sm:gap-4 relative overflow-hidden z-20 animate-scale-up">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl -mr-6 -mt-6 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-28 h-28 bg-pink-400/20 rounded-full blur-2xl -ml-10 -mb-10 animate-pulse"></div>
            
            <div className="p-2 sm:p-2.5 bg-white/15 backdrop-blur-xl rounded-xl shrink-0 text-2xl sm:text-3xl shadow-md border border-white/20 flex items-center justify-center animate-wiggle">
              🎂🎉
            </div>
            
            <div className="space-y-0.5 flex-grow text-center md:text-left relative z-10">
              <h3 className="text-sm sm:text-base md:text-lg font-black tracking-tight leading-tight text-white flex items-center justify-center md:justify-start gap-1.5 flex-wrap">
                <span>Happy Birthday, {formatMemberName(user.name, user.gender)}!</span>
                <span className="animate-bounce text-sm sm:text-base">🎁</span>
              </h3>
              <p className="text-[10px] sm:text-[11px] md:text-xs text-pink-50 font-medium max-w-2xl leading-normal opacity-95">
                Shalom Youth Community wishes you a beautiful and blessed birthday! May this new year bring endless joy, success, and divine guidance. The app is dressed in a special Birthday Theme in your honor today! ✨💖
              </p>
            </div>
            
            <div className="w-full md:w-auto shrink-0 relative z-10 flex justify-center md:justify-end">
              <button
                onClick={() => {
                  setShowConfetti(true);
                  alert("🎉 Thank you for being a wonderful part of Shalom Youth! Have an amazing birthday celebration!");
                }}
                className="w-full md:w-auto bg-white hover:bg-pink-50 active:bg-pink-100 text-indigo-950 font-black text-[10px] sm:text-xs px-4 py-2 sm:py-2.5 rounded-xl shadow-md transition-all transform hover:scale-102 active:scale-98 cursor-pointer border border-pink-100/10 text-center"
              >
                Receive Blessings 🙏
              </button>
            </div>
          </div>
        )}

        {/* COMPULSORY DATE OF BIRTH BANNER */}
        {user.status === 'approved' && !user.dob && (
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-xs flex flex-col md:flex-row items-start justify-between gap-4 animate-pulse">
            <div className="flex gap-4 items-start">
              <div className="p-3 bg-rose-100 text-rose-800 rounded-xl shrink-0">
                <Sparkles className="w-5.5 h-5.5 text-rose-600 animate-spin" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-rose-900 text-sm flex items-center gap-1.5">
                  🎂 Date of Birth is Now Compulsory!
                </h4>
                <p className="text-xs text-rose-700 leading-relaxed">
                  To celebrate birthdays across Shalom Youth with custom festive themes and community alerts, it is now mandatory for every member to add their Date of Birth. Please set yours today!
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setProfileEditMode(true);
                setSelectedProfileMember(user);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs shrink-0 self-start md:self-center cursor-pointer"
            >
              Add Date of Birth Now 🎂
            </button>
          </div>
        )}

        {/* MEMBERS BIRTHDAY ALERTS TICKER */}
        {showBirthdayAlerts && members.filter(m => m.status === 'approved' && m.id !== user.id && m.dob && isBirthdayToday(m.dob, currentDate)).length > 0 && (() => {
          const birthdayCelebrants = members.filter(m => m.status === 'approved' && m.id !== user.id && m.dob && isBirthdayToday(m.dob, currentDate));
          return (
            <div className="p-3.5 bg-linear-to-r from-amber-500/10 to-rose-500/10 rounded-2xl border border-amber-500/20 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-base shrink-0 animate-bounce">🎉</span>
                <div className="font-bold text-stone-800 dark:text-stone-100">
                  <span className="text-rose-600 dark:text-rose-400 font-extrabold uppercase tracking-wide text-[10px] mr-1.5 px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 rounded-md border border-rose-100 dark:border-rose-900/30">Birthday Alert</span>
                  Today we are celebrating the birthday of:{' '}
                  <span className="text-stone-900 dark:text-white font-black underline decoration-wavy decoration-rose-400">
                    {birthdayCelebrants.map(m => m.name).join(', ')}
                  </span>
                  ! 🎂✨ Let's make their day special!
                </div>
              </div>
              
              <div className="flex flex-wrap gap-1.5 items-center">
                {birthdayCelebrants.map(m => {
                  const hasWished = wishedIds.includes(m.id);
                  const isWishing = isWishingMap[m.id];
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleSendWish(m.id, m.name)}
                      disabled={hasWished || isWishing}
                      className={`inline-flex items-center gap-1 font-black text-[10px] px-3 py-1.5 rounded-xl transition-all shadow-xs duration-150 cursor-pointer ${
                        hasWished
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30 cursor-default'
                          : 'bg-rose-600 hover:bg-rose-700 text-white hover:scale-103 active:scale-97'
                      }`}
                      title={hasWished ? `You've already wished ${m.name} today!` : `Send birthday wish to ${m.name}`}
                    >
                      <span>{isWishing ? 'Sending... ⏳' : hasWished ? `Wished ${m.name} 💖` : `Wish ${m.name} 🎁`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Offline Fallback/Diagnostic Warning Banner */}
        {dbConnected === false && (
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-300 shadow-sm flex flex-col md:flex-row items-start gap-4">
            <div className="p-3 bg-amber-100 text-amber-800 rounded-xl shrink-0">
              <AlertTriangle className="w-5.5 h-5.5 text-amber-600 animate-pulse" />
            </div>
            <div className="space-y-2 flex-grow">
              <h4 className="font-extrabold text-amber-900 text-sm flex items-center gap-1.5">
                Supabase Sync: High-Fidelity Local Emulation Active
              </h4>
              <p className="text-xs text-amber-700 leading-relaxed">
                The application is running in local emulation (using browser local storage) because the required database tables do not exist in your live Supabase database yet. Any members or schedules you create right now are saved safely inside your local browser, but they won't store to Supabase until you run the database SQL script setup!
              </p>
              {(connectionError || db.lastError) && (
                <div className="p-3 bg-red-50 text-red-800 rounded-xl border border-red-100 text-xs font-mono break-all space-y-1">
                  <div className="font-bold text-[10px] uppercase tracking-wider text-red-600">
                    Live Connection Error Diagnostic:
                  </div>
                  <div>{connectionError || db.lastError}</div>
                  <div className="text-[10px] text-stone-500 mt-1">
                    Suggestion: Verify you copied/pasted your credentials correctly in the Secrets panel, and run the SQL schema script in your Supabase SQL Editor.
                  </div>
                </div>
              )}
              {connectionSuccess === false && !isTestingConnection && (
                <div className="text-xs text-red-600 font-semibold">
                  ⚠️ Connection failed. Please check the diagnostic log above.
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => {
                    if (user?.email?.toLowerCase() === 'tkpaite2016@gmail.com') {
                      setIsSQLModalOpen(true);
                    } else {
                      alert("Access Denied: Only tkpaite2016@gmail.com can configure Supabase Setup.");
                    }
                  }}
                  disabled={isTestingConnection || user?.email?.toLowerCase() !== 'tkpaite2016@gmail.com'}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors disabled:cursor-not-allowed cursor-pointer"
                  title={user?.email?.toLowerCase() === 'tkpaite2016@gmail.com' ? "Configure database" : "Supabase configurations are restricted to tkpaite2016@gmail.com"}
                >
                  Open SQL Setup Guide
                </button>
                <button
                  onClick={async () => {
                    await loadDatabase();
                  }}
                  disabled={isTestingConnection}
                  className="bg-white hover:bg-amber-100 disabled:bg-stone-50 text-amber-900 font-bold text-xs px-3.5 py-1.5 rounded-lg border border-amber-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  {isTestingConnection ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-amber-900 border-t-transparent rounded-full animate-spin"></span>
                      Testing connection...
                    </>
                  ) : (
                    'Test Connection & Re-Sync'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Verification Check Banner for standard pending members */}
        {user.status === 'pending' && (
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 flex flex-col sm:flex-row items-start gap-4">
            <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-amber-900 text-sm">Account Membership Awaiting Admin Verification</h4>
              <p className="text-xs text-amber-700 leading-relaxed">
                Thank you for registering at Shalom Youth! Your profile registration as a <strong>{user.role}</strong> user has been submitted successfully. An Officer Bearer (OB) committee administrator will verify and approve your status shortly.
              </p>
              <p className="text-[11px] text-amber-600">
                Contact our support team if your registration requires immediate clearance. Registered email: <span className="font-semibold">{user.email}</span>
              </p>
            </div>
          </div>
        )}

        {/* Rejected block */}
        {user.status === 'rejected' && (
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 flex flex-col sm:flex-row items-start gap-4">
            <div className="p-2.5 bg-rose-100 text-rose-800 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-rose-905 text-sm">Membership Registration Declined</h4>
              <p className="text-xs text-rose-700 leading-relaxed">
                We regret to inform you that your registration requesting membership Access was declined by our committee. You may contact our Secretary to request appeals.
              </p>
            </div>
          </div>
        )}

        {/* RESTRICTED CONTENT STATEMENT - Only Approved members see the dashboard */}
        {user.status === 'approved' ? (
          <>
            {/* View Swapper & Preferences Toggles */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex border-b border-stone-200 bg-white p-1 rounded-2xl shadow-2xs border max-w-full sm:max-w-lg overflow-x-auto w-full md:w-auto">
                <button
                  onClick={() => setCurrentTab('directory')}
                  className={`flex-1 py-1.5 sm:py-2 px-2.5 sm:px-4 rounded-xl font-bold text-[10px] sm:text-xs transition-all cursor-pointer text-center whitespace-nowrap ${currentTab === 'directory' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-500 hover:text-stone-800'}`}
                >
                  Members Directory
                </button>
                <button
                  id="tab-btn-schedule"
                  onClick={() => setCurrentTab('schedule')}
                  className={`flex-1 py-1.5 sm:py-2 px-2.5 sm:px-4 rounded-xl font-bold text-[10px] sm:text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${currentTab === 'schedule' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-500 hover:text-stone-800'}`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>Service Schedules</span>
                </button>
                {(isOBUser(user.role) || user.role === 'ECM') && (
                  <button
                    onClick={() => setCurrentTab('financials')}
                    className={`flex-1 py-1.5 sm:py-2 px-2.5 sm:px-4 rounded-xl font-bold text-[10px] sm:text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${currentTab === 'financials' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-500 hover:text-stone-800'}`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span>Financial Records</span>
                  </button>
                )}
                {isCurrentUserAdmin && (
                  <button
                    onClick={() => setCurrentTab('birthday-tasks')}
                    className={`flex-1 py-1.5 sm:py-2 px-2.5 sm:px-4 rounded-xl font-bold text-[10px] sm:text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${currentTab === 'birthday-tasks' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-500 hover:text-stone-800'}`}
                  >
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>Birthday Emails</span>
                  </button>
                )}
              </div>

              {/* Preferences Toggle / Layout Customize Menu */}
              {currentTab === 'directory' && (
                <div className="flex flex-wrap items-center gap-2.5 bg-white p-2 px-3.5 rounded-2xl border border-stone-150 shadow-2xs text-[11px] font-bold text-stone-600 w-full md:w-auto">
                  <span className="flex items-center gap-1.5 text-stone-450 mr-1">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Layout preferences:</span>
                  </span>
                  
                  <label className="flex items-center gap-1.5 hover:bg-stone-50/80 p-1.5 px-2 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-stone-100">
                    <input
                      type="checkbox"
                      checked={showBirthdayAlerts}
                      onChange={(e) => {
                        setShowBirthdayAlerts(e.target.checked);
                        localStorage.setItem('sy_pref_show_birthday_alerts', String(e.target.checked));
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Birthday Alerts</span>
                  </label>

                  <label className="flex items-center gap-1.5 hover:bg-stone-50/80 p-1.5 px-2 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-stone-100">
                    <input
                      type="checkbox"
                      checked={showQuickMetrics}
                      onChange={(e) => {
                        setShowQuickMetrics(e.target.checked);
                        localStorage.setItem('sy_pref_show_quick_metrics', String(e.target.checked));
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Metrics Stats</span>
                  </label>

                  <label className="flex items-center gap-1.5 hover:bg-stone-50/80 p-1.5 px-2 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-stone-100">
                    <input
                      type="checkbox"
                      checked={showRoleDistribution}
                      onChange={(e) => {
                        setShowRoleDistribution(e.target.checked);
                        localStorage.setItem('sy_pref_show_role_distribution', String(e.target.checked));
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Role Charts</span>
                  </label>
                </div>
              )}
            </div>

            {currentTab === 'financials' && (isOBUser(user.role) || user.role === 'ECM') ? (
              <FinancialRecordsPage 
                currentUser={user} 
                onAddLog={(action, details) => {
                  addActivityLog(user.id, user.email, user.name, action, details);
                  setLogs(getActivityLogs());
                }} 
              />
            ) : currentTab === 'schedule' ? (
              <SchedulePage
                currentUser={user}
                onAddLog={(action, details) => {
                  addActivityLog(user.id, user.email, user.name, action, details);
                  setLogs(getActivityLogs());
                }}
              />
            ) : currentTab === 'birthday-tasks' && isCurrentUserAdmin ? (
              <BirthdayEmailSettingsPage currentUser={user} members={members} />
            ) : (
              <>
                {/* Quick overview metrics Grid */}
            {showQuickMetrics && (
              <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                <div className="bg-white p-4.5 rounded-2xl border border-stone-150 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-stone-400">
                    <span className="text-[10px] uppercase font-bold tracking-wider">Total Members</span>
                    <Users className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-2xl font-black text-stone-900">{totalCount}</div>
                    <p className="text-[10px] text-emerald-65 font-medium">Registered in database</p>
                  </div>
                </div>

                <div className="bg-white p-4.5 rounded-2xl border border-stone-150 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-stone-400">
                    <span className="text-[10px] uppercase font-bold tracking-wider">Approved Active</span>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-2xl font-black text-stone-900">{approvedCount}</div>
                    <p className="text-[10px] text-stone-400 font-medium">{Math.round((approvedCount/totalCount)*100 || 0)}% of total users cleared</p>
                  </div>
                </div>

                <div className="bg-white p-4.5 rounded-2xl border border-stone-150 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-stone-450">
                    <span className="text-[10px] uppercase font-bold tracking-wider">Review Pending</span>
                    <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping"></div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-2xl font-black text-stone-900">{pendingCount}</div>
                    <p className="text-[10px] text-stone-400 font-medium">Require admin approvals</p>
                  </div>
                </div>

                <div className="bg-white p-4.5 rounded-2xl border border-stone-150 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-stone-400">
                    <span className="text-[10px] uppercase font-bold tracking-wider">Leader Officers / OB</span>
                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-2xl font-black text-stone-900">{obCount}</div>
                    <p className="text-[10px] text-stone-400 font-medium">Active administrative users</p>
                  </div>
                </div>

              </section>
            )}

            {/* Admin Analytics and SQL utilities representation - Only OB (Chairman, Vice Chairman, etc) can see this panel */}
            {/* Admin Analytics / Role distributions representation - Visible to OB, or standard users with preferences enabled */}
            {(isCurrentUserAdmin || showRoleDistribution) && (
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left side: Role distributions (Recharts) */}
                {showRoleDistribution && (
                  <div className={`${isCurrentUserAdmin ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white p-5 rounded-2xl border border-stone-150 shadow-xs flex flex-col justify-between space-y-4`}>
                    <div className="flex items-center justify-between border-b pb-3 border-stone-100">
                      <div>
                        <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider">Role & Status Distributions</h4>
                        <p className="text-[10px] text-stone-400">Visual representations of the database</p>
                      </div>
                      <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[10px] font-bold rounded-lg border border-emerald-100">
                        {isCurrentUserAdmin ? 'Officer Bearer Control' : 'Youth Core Database'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Role distributions chart */}
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-stone-400 text-center uppercase tracking-wide">Role breakdown (Standard vs Committee)</p>
                        <div className="h-44 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={roleDistributionData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#888888" />
                              <YAxis tick={{ fontSize: 9 }} stroke="#888888" />
                              <ChartTooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                {roleDistributionData.map((entry, idx) => (
                                  <Cell key={`cell-${idx}`} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Status pie chart */}
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-stone-400 text-center uppercase tracking-wide">Application states</p>
                        <div className="h-44 w-full relative flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={statusDistributionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={55}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {statusDistributionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <ChartTooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                              <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '9px' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Right side: Developer Tools & Custom Action box */}
                {isCurrentUserAdmin && (
                  <div className={`${showRoleDistribution ? 'lg:col-span-4' : 'lg:col-span-12'} bg-white p-5 rounded-2xl border border-stone-150 shadow-xs flex flex-col justify-between space-y-4`}>
                    <div className="border-b pb-3 border-stone-100">
                      <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider">Administrative Quick Panel</h4>
                      <p className="text-[10px] text-stone-400">Database links & manual provisioning</p>
                    </div>

                    <div className="space-y-3.5">
                      <button
                        onClick={() => setAddNewMemberOpen(true)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Manually Add Member
                      </button>

                      <button
                        onClick={() => {
                          if (user?.email?.toLowerCase() === 'tkpaite2016@gmail.com') {
                            setIsSQLModalOpen(true);
                          } else {
                            alert("Access Denied: Only tkpaite2016@gmail.com can configure Supabase Setup.");
                          }
                        }}
                        disabled={user?.email?.toLowerCase() !== 'tkpaite2016@gmail.com'}
                        className="w-full bg-white text-stone-700 hover:bg-stone-50 border border-stone-200 font-semibold text-xs py-2 px-4 rounded-xl shadow-xxs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
                        title={user?.email?.toLowerCase() === 'tkpaite2016@gmail.com' ? "Configure database" : "Supabase configurations are restricted to tkpaite2016@gmail.com"}
                      >
                        <Database className="w-3.5 h-3.5 text-emerald-600" />
                        Database SQL Script Guide
                      </button>
                    </div>

                    <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/30 text-[11px] leading-normal text-emerald-900 space-y-1">
                      <div className="flex items-center gap-1 font-bold">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>Security Authority: OB</span>
                      </div>
                      <p className="text-emerald-800">
                        As an Officer Bearer (Chairman/Secretary/etc.), you have absolute control over member clearances and roles. Promote users to ECM or OB anytime.
                      </p>
                    </div>
                  </div>
                )}

              </section>
            )}

            {/* Administrative / Manual register slider form */}
            {isCurrentUserAdmin && addNewMemberOpen && (
              <section className="bg-white p-5 rounded-2xl border border-stone-150 shadow-xl space-y-4 max-w-xl mx-auto w-full transition-all">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-extrabold text-stone-900 text-sm">Manually Provision New Youth Member</h4>
                  <button onClick={() => setAddNewMemberOpen(false)} className="text-stone-400 hover:text-stone-700 text-xs font-semibold cursor-pointer">
                    Cancel
                  </button>
                </div>

                {adminFormError && (
                  <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-100">
                    {adminFormError}
                  </div>
                )}

                <form onSubmit={handleAdminAddMember} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-600">
                  <div>
                    <label className="block font-bold text-[10px] text-stone-450 uppercase mb-1">Full Member Name</label>
                    <input
                      type="text"
                      required
                      value={newMemberName}
                      onChange={e => setNewMemberName(e.target.value)}
                      placeholder="e.g. Samuel Kipgen"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-hidden focus:ring-1"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[10px] text-stone-450 uppercase mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={newMemberEmail}
                      onChange={e => setNewMemberEmail(e.target.value)}
                      placeholder="email@shalomyouth.org"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-hidden focus:ring-1"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[10px] text-stone-450 uppercase mb-1 flex items-center justify-between">
                      <span>Phone Number</span>
                      <span className="text-[9px] text-emerald-600 lowercase tracking-normal font-medium">Required for phone login</span>
                    </label>
                    <input
                      type="tel"
                      value={newMemberPhone}
                      onChange={e => setNewMemberPhone(e.target.value)}
                      placeholder="+919876543210"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-hidden focus:ring-1"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[10px] text-stone-450 uppercase mb-1 flex items-center justify-between">
                      <span>Login Password</span>
                      <span className="text-[9px] text-stone-450 lowercase tracking-normal font-medium">Temporary password</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newMemberPassword}
                      onChange={e => setNewMemberPassword(e.target.value)}
                      placeholder="e.g. shalomyouth"
                      className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-hidden focus:ring-1 bg-emerald-50/25 text-emerald-950 font-mono font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[10px] text-stone-450 uppercase mb-1">Assigned Role</label>
                    <select
                      value={newMemberRole}
                      onChange={e => setNewMemberRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      {ALL_ROLES.map(r => (
                        <option key={r} value={r}>
                          {r === 'standard' ? 'standard (Member)' : r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[10px] text-stone-450 uppercase mb-1">Direct Status</label>
                    <select
                      value={newMemberStatus}
                      onChange={e => setNewMemberStatus(e.target.value as any)}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      <option value="approved">Approved Immediately</option>
                      <option value="pending">Awaiting Review</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-[10px] text-stone-450 uppercase mb-1">Gender</label>
                    <select
                      value={newMemberGender}
                      onChange={e => setNewMemberGender(e.target.value as 'Male' | 'Female' | '')}
                      className="w-full px-3 py-2 border rounded-lg bg-white cursor-pointer"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male (Tg.)</option>
                      <option value="Female">Female (Lia)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 pt-2">
                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl cursor-pointer shadow-xs text-xs"
                    >
                      Verify & Add Member Record
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* Core Member Lookup Spreadsheet table */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-stone-900 dark:text-white">Shalom Youth Registration Directory</h3>
                  <p className="text-xs text-stone-400">Search, filter, and manage organizational members</p>
                </div>
                <button
                  onClick={() => loadDatabase()}
                  className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-450 hover:text-stone-800 transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1 bg-white border border-stone-200"
                  title="Force DB synchronization"
                >
                  Sync Database
                </button>
              </div>

              <MemberTable
                members={members}
                onUpdateRoleAndStatus={handleUpdateRoleAndStatus}
                onDeleteMember={handleDeleteMember}
                onBatchApproveMembers={handleBatchApproveMembers}
                onBatchDeleteMembers={handleBatchDeleteMembers}
                onOpenProfile={(member) => setSelectedProfileMember(member)}
                isCurrentUserAdmin={isCurrentUserAdmin}
              />
            </section>
              </>
            )}
          </>
        ) : null}

        {/* Dynamic informational support block */}
        <section className="bg-emerald-950 text-emerald-200 p-6 rounded-2xl border border-emerald-900 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1.5 flex-1 p-1">
            <h4 className="font-extrabold text-white text-base"> Shalom Youth Org Guidelines</h4>
            <p className="text-xs leading-relaxed text-emerald-300">
              Shalom Youth acts with deep spiritual commitment and active community service. Under Officer Bearer (OB) management directions, we verify every member's role (standard, Executive Committee (ECM), or Leader OB roles) to foster clean collaboration and trust.
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0 bg-white/5 p-4 rounded-xl border border-white/5 w-full md:w-auto">
            <PhoneCall className="w-5 h-5 text-emerald-300" />
            <div className="text-xs">
              <p className="font-extrabold text-white">Need Assisting Help?</p>
              <p className="text-[11px] text-emerald-35 gap-1 inline-flex items-center">
                Contact Admin: tkpaite2016@gmail.com
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="py-6 bg-white border-t border-stone-200 text-center text-xs text-stone-400 mt-8">
        <p>© {new Date().getFullYear()} Shalom Youth Center. All system rights reserved.</p>
      </footer>

      {/* SQL script Copy tool */}
      <SQLSetupModal isOpen={isSQLModalOpen} onClose={() => setIsSQLModalOpen(false)} />

      {/* Render detailed profile card modal */}
      {selectedProfileMember && (
        <UserProfileModal
          member={selectedProfileMember}
          isOpen={!!selectedProfileMember}
          onClose={() => {
            setSelectedProfileMember(null);
            setProfileEditMode(false);
          }}
          onUpdate={handleUpdateProfileDetails}
          isCurrentUserAdmin={isCurrentUserAdmin}
          initialEditMode={profileEditMode && (selectedProfileMember.id === user?.id || (user?.email && selectedProfileMember.email && user.email.toLowerCase() === selectedProfileMember.email.toLowerCase()) || isCurrentUserAdmin)}
        />
      )}

      {/* Floating Animated Gift Box for the Birthday Boy/Girl */}
      {user && user.dob && isBirthdayToday(user.dob, currentDate) && (
        <div className="fixed bottom-6 left-6 z-40">
          <button
            id="tour-gift-box-btn"
            onClick={() => {
              setShowGiftModal(true);
            }}
            className="group flex items-center gap-2.5 bg-linear-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-[0_10px_25px_rgba(219,39,119,0.4)] hover:shadow-[0_15px_30px_rgba(219,39,119,0.6)] border border-pink-400/40 transition-all transform hover:scale-110 active:scale-95 animate-bounce duration-1000 cursor-pointer"
            title="Open your Birthday Gift Box! 🎁"
            style={{ animationDuration: '2s' }}
          >
            <div className="relative">
              <span className="text-2xl sm:text-3xl block">🎁</span>
              {birthdayWishes.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                  {birthdayWishes.length}
                </span>
              )}
            </div>
            <span className="font-extrabold text-xs hidden sm:inline tracking-tight">Your Gift Box! ✨</span>
          </button>
        </div>
      )}

      {/* Birthday Gift Box Wishes Modal */}
      {showGiftModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-stone-900 w-[92%] sm:w-full max-w-[340px] sm:max-w-md rounded-3xl shadow-2xl border border-pink-100 dark:border-pink-900/30 overflow-hidden relative animate-scale-up">
            {/* Cute ribbon top header decoration */}
            <div className="h-2 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500"></div>
            
            <button
              onClick={() => setShowGiftModal(false)}
              className="absolute top-3.5 right-3.5 text-stone-450 hover:text-stone-700 dark:hover:text-stone-200 transition-colors text-sm font-bold p-1 cursor-pointer bg-stone-50 dark:bg-stone-800 rounded-full w-6 h-6 flex items-center justify-center border border-stone-100 dark:border-stone-700"
              title="Close Gift Box"
            >
              ✕
            </button>
            
            <div className="p-5 sm:p-6 text-center space-y-4 sm:space-y-5">
              <div className="w-14 h-14 sm:w-20 sm:h-20 bg-pink-50 dark:bg-pink-950/30 rounded-2xl flex items-center justify-center mx-auto text-3xl sm:text-4xl shadow-md border border-pink-150/50 dark:border-pink-900/30 animate-wiggle">
                💝
              </div>
              
              <div className="space-y-1">
                <h3 className="text-base sm:text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-indigo-600">
                  Your Birthday Gift Box! 🎁
                </h3>
                <p className="text-[10px] sm:text-xs text-stone-500 dark:text-stone-400 font-medium leading-relaxed">
                  This box gathers all wishes sent to you within the last 24 hours.
                </p>
              </div>

              {/* Wishes List */}
              <div className="bg-stone-50 dark:bg-stone-950/20 rounded-2xl border border-stone-100 dark:border-stone-800/80 p-3 sm:p-4 max-h-48 sm:max-h-60 overflow-y-auto space-y-2">
                {birthdayWishes.length === 0 ? (
                  <div className="py-6 sm:py-8 text-center space-y-2">
                    <span className="text-2xl sm:text-3xl block animate-pulse">✨</span>
                    <p className="text-[10px] sm:text-xs text-stone-400 dark:text-stone-500 font-bold leading-normal">
                      Your box is empty but waiting!<br/>Friends will place their wishes here soon.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[9px] sm:text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider text-left pl-1">
                      Wishes Received ({birthdayWishes.length}):
                    </p>
                    {birthdayWishes.map((wish, index) => (
                      <div
                        key={wish.id}
                        className="p-2.5 sm:p-3 bg-white dark:bg-stone-900 rounded-xl border border-pink-100/40 dark:border-pink-950/25 flex items-center justify-between text-left transition-all hover:scale-101 shadow-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base shrink-0">💖</span>
                          <div className="min-w-0">
                            <span className="block text-[11px] sm:text-xs font-black text-stone-800 dark:text-stone-100 truncate">
                              {wish.wisher_name}
                            </span>
                            <span className="block text-[8px] sm:text-[9px] text-stone-450 dark:text-stone-500 font-mono">
                              Placed {new Date(wish.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs shrink-0 animate-pulse">🌟</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-1.5">
                <button
                  onClick={() => {
                    setShowGiftModal(false);
                  }}
                  className="w-full bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 active:from-pink-700 active:to-indigo-800 text-white font-black text-xs py-2.5 sm:py-3 rounded-xl shadow-lg transition-all transform active:scale-98 cursor-pointer"
                >
                  Close & Celebrate! 🎂
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Realtime Global Chat Overlay */}
      {user && (
        <>
          {/* Floating Chat Icon Toggle Button */}
          <div className="fixed bottom-6 right-6 z-40 transition-all duration-300">
            <button
              id="tour-global-chat-btn"
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="group flex items-center justify-center bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white p-4 rounded-full shadow-2xl hover:shadow-[0_15px_30px_rgba(99,102,241,0.5)] border border-indigo-400/30 transition-all transform hover:scale-110 active:scale-95 cursor-pointer relative animate-fade-in"
              title="Open Global Fellowship Chat 💬"
            >
              <MessageSquare className="w-6 h-6 animate-pulse" />
              {unreadChatCount > 0 && !isChatOpen && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                  {unreadChatCount}
                </span>
              )}
            </button>
          </div>

          {/* Chat Window Panel */}
          {isChatOpen && (
            <div className="fixed inset-0 sm:inset-auto sm:right-6 sm:bottom-24 z-50 w-full sm:w-[380px] h-full sm:h-[550px] sm:max-h-[75vh] flex flex-col bg-white dark:bg-stone-900 rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-stone-200 dark:border-stone-800 overflow-hidden animate-scale-up">
              {/* Chat Header */}
              <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-4 py-3 text-white flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping absolute"></div>
                  <div className="w-2 h-2 bg-emerald-400 rounded-full relative"></div>
                  <div>
                    <h3 className="font-extrabold text-xs sm:text-sm tracking-tight">Global Fellowship Chat</h3>
                    {typingUsers.length > 0 ? (
                      <p className="text-[9px] text-emerald-300 font-extrabold animate-pulse flex items-center gap-1">
                        <span className="inline-flex gap-0.5">
                          <span className="w-1 h-1 bg-emerald-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-1 h-1 bg-emerald-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-1 h-1 bg-emerald-300 rounded-full animate-bounce"></span>
                        </span>
                        <span>{typingUsers.slice(0, 2).join(' & ')}{typingUsers.length > 2 ? ` & ${typingUsers.length - 2} more` : ''} typing...</span>
                      </p>
                    ) : (
                      <p className="text-[9px] text-indigo-100 font-medium">Shalom Youth Community • Real-time</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 relative">
                  {user && (
                    <div ref={chatHeaderMenuRef} className="relative">
                      <button
                        onClick={() => setIsChatHeaderMenuOpen(!isChatHeaderMenuOpen)}
                        className={`text-white/80 hover:text-white transition-colors text-xs font-bold p-1 bg-white/10 hover:bg-white/20 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer border border-white/10 ${isChatHeaderMenuOpen ? 'bg-white/25 text-white border-white/40' : ''}`}
                        title="Chat Settings"
                      >
                        <MoreVertical className="w-3.5 h-3.5 shrink-0" />
                      </button>

                      {isChatHeaderMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-stone-850 rounded-xl shadow-2xl border border-stone-200 dark:border-stone-800 py-1.5 z-50 animate-scale-up text-left">
                          <button
                            onClick={() => {
                              setShowGuidelines(true);
                              setIsChatHeaderMenuOpen(false);
                            }}
                            className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:text-stone-900 transition-colors flex items-center gap-2 cursor-pointer border-b border-stone-100 dark:border-stone-800"
                          >
                            <Info className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                            <span>Fellowship Guidelines</span>
                          </button>

                          <div className="px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300 border-b border-stone-100 dark:border-stone-800 select-none">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span>Full Timestamps</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newVal = !showFullTimestamps;
                                setShowFullTimestamps(newVal);
                                localStorage.setItem('sy_show_full_timestamps', String(newVal));
                              }}
                              className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer outline-none shrink-0 ${
                                showFullTimestamps ? 'bg-violet-600' : 'bg-stone-300 dark:bg-stone-700'
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform shadow-xs ${
                                  showFullTimestamps ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>

                          <div className="px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300 border-b border-stone-100 dark:border-stone-800 select-none">
                            <div className="flex items-center gap-2">
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>Read Receipts</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newVal = !showReadReceipts;
                                setShowReadReceipts(newVal);
                                localStorage.setItem('sy_show_read_receipts', String(newVal));
                              }}
                              className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer outline-none shrink-0 ${
                                showReadReceipts ? 'bg-violet-600' : 'bg-stone-300 dark:bg-stone-700'
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform shadow-xs ${
                                  showReadReceipts ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>

                          {isCurrentUserAdmin && (
                            <button
                              onClick={handleClearChatHistory}
                              className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-700 transition-colors flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Clear Chat History</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => setIsChatOpen(false)}
                    className="text-white/80 hover:text-white transition-colors text-xs font-bold p-1 bg-white/10 hover:bg-white/20 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer border border-white/10"
                    title="Close Chat"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Fellowship Guidelines Welcoming Card */}
              {showGuidelines && (
                <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-stone-900 dark:to-stone-850 border-b border-stone-150 dark:border-stone-800 p-3.5 space-y-2 animate-slide-down relative z-10 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400 animate-pulse shrink-0" />
                      <div>
                        <h4 className="text-xs font-black text-violet-950 dark:text-violet-200">
                          Welcome, {user?.name ? user.name.split(' ')[0] : 'Fellow'}! 👋
                        </h4>
                        <p className="text-[9px] text-stone-400 dark:text-stone-500 font-bold">Fellowship Guidelines</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowGuidelines(false);
                        localStorage.setItem('sy_dismiss_guidelines', 'true');
                      }}
                      className="text-stone-400 hover:text-rose-600 dark:text-stone-500 dark:hover:text-rose-400 text-xs font-extrabold leading-none p-1 rounded-full hover:bg-stone-200/50 dark:hover:bg-stone-800/50 transition-all cursor-pointer"
                      title="Dismiss guidelines"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <ul className="text-[10.5px] text-stone-600 dark:text-stone-400 space-y-1.5 list-none font-medium leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-violet-500 text-xs shrink-0 select-none">🕊️</span>
                      <span>Speak with grace, respect, and encouragement for all members.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-violet-500 text-xs shrink-0 select-none">🛡️</span>
                      <span>Keep conversations clean, uplifting, and fellowship-centered.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-violet-500 text-xs shrink-0 select-none">❤️</span>
                      <span>Use emoji reactions to support and bless others' messages!</span>
                    </li>
                  </ul>
                </div>
              )}

              {/* Message List */}
              <div ref={chatScrollContainerRef} className="flex-1 overflow-y-auto p-2.5 space-y-2 bg-stone-50/50 dark:bg-stone-950/20 animate-fade-in">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <span className="text-2xl animate-bounce">💬</span>
                    <div className="space-y-1">
                      <p className="text-xs font-black text-stone-700 dark:text-stone-300">Welcome to the Global Chat!</p>
                      <p className="text-[10px] text-stone-400 dark:text-stone-500 max-w-[180px] leading-relaxed mx-auto">
                        Be the first to leave a friendly greeting, announcement, or verse.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {(() => {
                      let lastDateHeader = '';
                      return chatMessages.map((msg) => {
                        const dateHeader = getChatDateHeader(msg.created_at);
                        const displayHeader = dateHeader && dateHeader !== lastDateHeader;
                        if (displayHeader) {
                          lastDateHeader = dateHeader;
                        }

                        if (msg.user_id === 'system') {
                          return (
                            <div key={msg.id} className="space-y-1.5 w-full">
                              {displayHeader && (
                                <div className="flex items-center justify-center gap-3 my-4 select-none animate-fade-in w-full">
                                  <div className="h-px bg-stone-200 dark:bg-stone-800/80 flex-1"></div>
                                  <span className="bg-stone-200/80 dark:bg-stone-850 text-stone-600 dark:text-stone-300 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider border border-stone-300/30 dark:border-stone-800/80 shadow-xxs">
                                    {dateHeader}
                                  </span>
                                  <div className="h-px bg-stone-200 dark:bg-stone-800/80 flex-1"></div>
                                </div>
                              )}
                              <div className="flex justify-center my-1 animate-fade-in w-full select-none">
                                <span className="bg-stone-200/65 dark:bg-stone-800/80 text-stone-500 dark:text-stone-400 text-[10px] px-2.5 py-1 rounded-full font-bold shadow-xs">
                                  {msg.message}
                                </span>
                              </div>
                            </div>
                          );
                        }

                        const isOwnMessage = msg.user_id === user.id;
                        const senderMember = members.find((m) => m.id === msg.user_id);
                        const avatarUrl = senderMember?.avatar || msg.user_avatar;
                        const isDeleted = msg.message === "This message was deleted";
                        const isEditing = editingMsgId === msg.id;

                        return (
                          <div key={msg.id} className="space-y-1.5 w-full">
                            {displayHeader && (
                              <div className="flex items-center justify-center gap-3 my-4 select-none animate-fade-in w-full">
                                <div className="h-px bg-stone-200 dark:bg-stone-800/80 flex-1"></div>
                                <span className="bg-stone-200/80 dark:bg-stone-850 text-stone-600 dark:text-stone-300 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider border border-stone-300/30 dark:border-stone-800/80 shadow-xxs">
                                  {dateHeader}
                                </span>
                                <div className="h-px bg-stone-200 dark:bg-stone-800/80 flex-1"></div>
                              </div>
                            )}

                            <div
                              data-message-id={msg.id}
                              className={`flex items-start gap-2 ${
                                isOwnMessage ? 'justify-start' : 'justify-end flex-row-reverse'
                              }`}
                            >
                          {/* Avatar */}
                          <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 shadow-xs border border-stone-200 dark:border-stone-800 flex items-center justify-center">
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={msg.user_name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className={`w-full h-full text-[9px] font-black font-sans flex items-center justify-center text-white ${
                                isOwnMessage 
                                  ? 'bg-violet-600' 
                                  : 'bg-emerald-600'
                              }`}>
                                {msg.user_name ? msg.user_name.charAt(0).toUpperCase() : '?'}
                              </div>
                            )}
                          </div>

                          {/* Message Bubble Column */}
                          <div className={`flex flex-col max-w-[75%] relative ${isOwnMessage ? 'items-start' : 'items-end'}`}>
                            {/* Sender Name */}
                            {!isOwnMessage && (
                              <span className="text-[9px] text-stone-400 dark:text-stone-500 font-bold mb-0.5 px-1 truncate max-w-[120px]">
                                {msg.user_name}
                              </span>
                            )}
                            {isOwnMessage && (
                              <span className="text-[9px] text-stone-400 dark:text-stone-500 font-bold mb-0.5 px-1 truncate max-w-[120px]">
                                You
                              </span>
                            )}
                            
                            {/* Text bubble or Editing Block */}
                            {isEditing ? (
                              <div className="bg-white dark:bg-stone-850 p-1.5 rounded-2xl border border-violet-500 dark:border-violet-400 shadow-md flex flex-col gap-1 w-[200px] sm:w-[240px]">
                                <textarea
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className="w-full text-xs p-1.5 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 rounded focus:outline-none focus:ring-1 focus:ring-violet-500 border border-stone-200 dark:border-stone-850 resize-none font-medium leading-normal animate-scale-up"
                                  rows={2}
                                  maxLength={500}
                                  autoFocus
                                />
                                <div className="flex justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMsgId(null);
                                      setEditingText('');
                                    }}
                                    className="p-1 rounded text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5 shrink-0" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleEditMessage(msg.id, editingText)}
                                    className="p-1 rounded bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                                    title="Save"
                                  >
                                    <Check className="w-3.5 h-3.5 shrink-0" />
                                  </button>
                                </div>
                              </div>
                            ) : isDeleted ? (
                              <div className={`px-3 py-1.5 text-xs shadow-xs transition-all select-none bg-stone-100/80 dark:bg-stone-900/40 text-stone-400 dark:text-stone-500 rounded-2xl border border-stone-150/45 dark:border-stone-850/30 italic ${
                                isOwnMessage ? 'rounded-tl-none' : 'rounded-tr-none'
                              }`}>
                                <p className="break-words font-normal text-left">This message was deleted</p>
                              </div>
                            ) : (
                              <div 
                                onTouchStart={() => startPress(msg.id)}
                                onTouchEnd={endPress}
                                onMouseDown={() => startPress(msg.id)}
                                onMouseUp={endPress}
                                onMouseLeave={endPress}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setActiveReactionMsgId(msg.id);
                                }}
                                className={`px-3 py-1.5 text-xs shadow-xs leading-snug transition-all cursor-pointer select-none active:scale-98 ${
                                  isOwnMessage
                                    ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-2xl rounded-tl-none'
                                    : 'bg-white dark:bg-stone-850 text-stone-850 dark:text-stone-150 rounded-2xl rounded-tr-none border border-stone-100 dark:border-stone-800'
                                }`}
                                title="Hold or right-click to react"
                              >
                                <p className="break-words font-medium text-left">{renderFormattedMessage(msg.message)}</p>
                              </div>
                            )}

                             {/* Emoji Reaction Popover */}
                             {activeReactionMsgId === msg.id && !isDeleted && !isEditing && (
                               <div 
                                 ref={activeReactionContainerRef}
                                 className={`absolute z-30 ${
                                   popoverDirection === 'up' ? '-top-11' : 'top-full mt-1.5'
                                 } flex items-center gap-1 bg-white dark:bg-stone-850 rounded-full shadow-2xl border border-stone-200 dark:border-stone-750 px-2 py-1.5 animate-scale-up ${
                                   isOwnMessage ? 'left-0' : 'right-0'
                                 }`}
                               >
                                 {['👍', '❤️', '😂', '🙏', '🎉', '😮'].map(emoji => {
                                   const list = (msg.reactions?.[emoji] || []) as string[];
                                   const hasMyReaction = list.includes(user.id);
                                   return (
                                     <button
                                       key={emoji}
                                       type="button"
                                       onClick={() => handleToggleMessageReaction(msg.id, emoji)}
                                       className={`h-7 w-7 text-sm rounded-full flex items-center justify-center transition-all hover:scale-125 hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-90 cursor-pointer select-none ${
                                         hasMyReaction ? 'bg-violet-100 dark:bg-violet-900/40' : ''
                                       }`}
                                     >
                                       {emoji}
                                     </button>
                                   );
                                 })}

                                 {isOwnMessage && (
                                   <>
                                     <div className="w-px h-4 bg-stone-200 dark:bg-stone-700 mx-1 shrink-0" />
                                     <button
                                       type="button"
                                       onClick={() => {
                                         setEditingMsgId(msg.id);
                                         setEditingText(msg.message);
                                         setActiveReactionMsgId(null);
                                       }}
                                       className="h-7 w-7 rounded-full flex items-center justify-center text-stone-500 hover:text-violet-600 dark:text-stone-400 dark:hover:text-violet-400 hover:bg-stone-100 dark:hover:bg-stone-850 transition-colors cursor-pointer"
                                       title="Edit Message"
                                     >
                                       <Pencil className="w-3.5 h-3.5" />
                                     </button>
                                     <button
                                       type="button"
                                       onClick={() => {
                                         handleDeleteMessage(msg.id);
                                         setActiveReactionMsgId(null);
                                       }}
                                       className="h-7 w-7 rounded-full flex items-center justify-center text-stone-500 hover:text-rose-600 dark:text-stone-400 dark:hover:text-rose-400 hover:bg-stone-100 dark:hover:bg-stone-850 transition-colors cursor-pointer"
                                       title="Delete Message"
                                     >
                                       <Trash className="w-3.5 h-3.5" />
                                     </button>
                                   </>
                                 )}
                               </div>
                             )}

                             {/* Reactions Count List */}
                             {msg.reactions && Object.keys(msg.reactions).length > 0 && !isDeleted && (
                               <div className={`flex flex-wrap items-center gap-1 mt-1 ${isOwnMessage ? 'justify-start' : 'justify-end'}`}>
                                 {Object.entries(msg.reactions as Record<string, string[]>).map(([emoji, userIds]) => {
                                   if (!userIds || userIds.length === 0) return null;
                                   const hasMyReaction = userIds.includes(user.id);
                                   return (
                                     <button
                                       key={emoji}
                                       type="button"
                                       onClick={() => handleToggleMessageReaction(msg.id, emoji)}
                                       className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border transition-all active:scale-90 cursor-pointer select-none ${
                                         hasMyReaction
                                           ? 'bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-950/30 dark:border-violet-850 dark:text-violet-300 font-extrabold'
                                           : 'bg-stone-50 border-stone-150 text-stone-500 dark:bg-stone-900 dark:border-stone-800 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                                       }`}
                                       title={`Reacted: ${userIds.map(id => members.find(m => m.id === id)?.name || 'Someone').join(', ')}`}
                                     >
                                       <span>{emoji}</span>
                                       <span>{userIds.length}</span>
                                     </button>
                                   );
                                 })}
                               </div>
                             )}

                             {/* Timing & Read Receipts */}
                             <div className={`flex items-center gap-1 mt-0.5 px-1 select-none ${isOwnMessage ? 'justify-start' : 'justify-end'}`}>
                               <span className="text-[8px] text-stone-400 dark:text-stone-500 font-mono">
                                 {showFullTimestamps ? formatFullTimestamp(msg.created_at) : formatTimeAgo(msg.created_at)}
                               </span>
                               {isOwnMessage && (
                                 <span 
                                   className={`text-[9px] font-bold cursor-help ${
                                     showReadReceipts && msg.read_by && msg.read_by.filter(id => id !== user.id).length > 0
                                       ? 'text-emerald-500 dark:text-emerald-400 font-black'
                                       : 'text-stone-400 dark:text-stone-500'
                                   }`}
                                  title={
                                    showReadReceipts && msg.read_by && msg.read_by.filter(id => id !== user.id).length > 0
                                      ? `Seen by: ${msg.read_by
                                          .filter(id => id !== user.id)
                                          .map(id => members.find(m => m.id === id)?.name || 'Someone')
                                          .join(', ')}`
                                      : 'Sent'
                                  }
                                >
                                  {showReadReceipts && msg.read_by && msg.read_by.filter(id => id !== user.id).length > 0 ? '✓✓' : '✓'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Mentions Suggestion Dropdown */}
              {mentionQuery !== null && members.filter(m => m.status === 'approved' && m.name.toLowerCase().includes(mentionQuery)).length > 0 && (
                <div 
                  ref={mentionDropdownRef}
                  className="mx-3 mb-2 bg-white dark:bg-stone-850 rounded-xl shadow-xl border border-stone-200 dark:border-stone-700/80 overflow-hidden z-50 max-h-36 overflow-y-auto animate-scale-up divide-y divide-stone-100 dark:divide-stone-800"
                >
                  <div className="bg-stone-50 dark:bg-stone-900/40 px-3 py-1.5 text-[9px] text-stone-400 dark:text-stone-500 font-extrabold uppercase tracking-wider">
                    Mention Member
                  </div>
                  {members
                    .filter(m => m.status === 'approved' && m.name.toLowerCase().includes(mentionQuery))
                    .map(member => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleSelectMention(member.name)}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-violet-50 dark:hover:bg-violet-950/20 hover:text-violet-700 dark:hover:text-violet-400 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <div className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-[9px] font-black text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0 border border-violet-200/35">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{member.name}</span>
                        <span className="ml-auto text-[8px] text-stone-400 dark:text-stone-500 font-bold italic">{member.role}</span>
                      </button>
                    ))}
                </div>
              )}

              {/* Emoji Picker Popup Panel */}
              {showEmojiPicker && (
                <div 
                  ref={emojiPickerRef}
                  className="absolute bottom-16 right-3 bg-white dark:bg-stone-850 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-700/85 p-2.5 z-50 w-64 animate-scale-up"
                >
                  <div className="text-[9px] font-extrabold text-stone-450 dark:text-stone-500 uppercase tracking-wider mb-2 px-1 text-left">
                    Fellowship Emojis
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[
                      '😊', '🙏', '❤️', '🎉', '✨', '🔥', '👏', '🙌', '⭐', '🎂', '🎈', '🎁',
                      '😂', '😮', '😍', '👍', '💪', '🕊️', '🤝', '😇', '💡', '🌟', '✝️', '📖',
                      '🌅', '🌈', '🏡', '🌸', '🍕', '🍰', '☕', '🥤', '🎒', '💬', '📢', '⏰'
                    ].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleSelectEmoji(emoji)}
                        className="h-8 w-8 text-lg rounded-lg hover:bg-stone-105 dark:hover:bg-stone-800 active:scale-90 transition-all flex items-center justify-center cursor-pointer select-none"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Input form */}
              <form
                onSubmit={handleSendChatMessage}
                className="p-3 bg-white dark:bg-stone-900 border-t border-stone-150 dark:border-stone-800 flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer text-stone-450 dark:text-stone-500 hover:text-violet-600 dark:hover:text-violet-400 ${showEmojiPicker ? 'text-violet-600 bg-violet-50 dark:bg-violet-950/20' : ''}`}
                  title="Add emoji"
                >
                  <Smile className="w-4 h-4 shrink-0" />
                </button>

                <input
                  id="chat-message-input"
                  type="text"
                  value={newChatMessageText}
                  onChange={handleInputChange}
                  placeholder="Type your fellowship message..."
                  className="flex-1 bg-stone-50 dark:bg-stone-950/55 border border-stone-200 dark:border-stone-800 rounded-full px-4 py-2 text-xs text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-stone-400"
                  maxLength={500}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!newChatMessageText.trim() || isSendingChat}
                  className="bg-violet-600 hover:bg-violet-700 active:scale-95 text-white p-2 rounded-full cursor-pointer transition-all flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-md hover:shadow-indigo-500/20"
                  title="Send message"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {showConfetti && (
        <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      )}

      {showOnboardingTour && user && (
        <OnboardingTour user={user} onComplete={() => setShowOnboardingTour(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
