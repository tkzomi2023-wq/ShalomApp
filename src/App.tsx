/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from './lib/auth';
import { db, supabase } from './lib/supabase';
import { Member, UserRole, isOBUser, DEFAULT_ADMIN_EMAIL, ALL_ROLES, formatMemberName, BirthdayWish, ChatMessage, getDefaultAvatar, getCleanAvatar } from './types';
import { cleanTitle, TAB_PAGE_TITLES, BRAND_DEFAULT } from './lib/title';
import { updateClientHeadMeta } from './lib/seo';
import { getActivityLogs, addActivityLog, clearActivityLogs } from './lib/activity';
import { RoleBadge } from './components/RoleBadge';
import { SQLSetupModal } from './components/SQLSetupModal';
import { NotificationBell } from './components/NotificationBell';
import { LoginForm } from './components/LoginForm';
import { RegistrationForm } from './components/RegistrationForm';
import { MemberTable } from './components/MemberTable';
import { UserProfileModal } from './components/UserProfileModal';
import { BialDiagnosticModal } from './components/BialDiagnosticModal';
import { FinancialRecordsPage } from './components/FinancialRecordsPage';
import { SchedulePage } from './components/SchedulePage';
import BirthdayEmailSettingsPage from './components/BirthdayEmailSettingsPage';
import { WebsiteMetaSettingsPage } from './components/WebsiteMetaSettingsPage';
import { DatabaseHealthCheck } from './components/DatabaseHealthCheck';
import { AppFooter } from './components/AppFooter';
import { DownloadAppModal } from './components/DownloadAppModal';
import { FootballModule } from './components/FootballModule';
import { PrayerRequestsPage } from './components/PrayerRequestsPage';
import { MemberDemographicsSection } from './components/MemberDemographicsSection';
import { AdminControlPage } from './components/AdminControlPage';
import { financialsDb } from './lib/financials';
import { Confetti } from './components/Confetti';
import { OnboardingTour } from './components/OnboardingTour';
import { getApiUrl, apiFetch, safeJsonParse } from './lib/api';
import { CallingProvider } from './context/CallingContext';
import { CustomDialogProvider, customConfirm, customAlert } from './context/CustomDialogContext';
import { IncomingCallModal } from './components/calling/IncomingCallModal';
import { ActiveCallModal } from './components/calling/ActiveCallModal';
import { CallHistoryPage } from './components/calling/CallHistoryPage';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { KeyboardShortcutsHelpModal } from './components/KeyboardShortcutsHelpModal';
import { ManualProvisionModal } from './components/ManualProvisionModal';
import { OgPreviewModal } from './components/OgPreviewModal';

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
  UserCheck,
  ArrowRight,
  LogOut, 
  Database, 
  Sparkles, 
  ShieldCheck, 
  ShieldAlert,
  Info, 
  AlertTriangle, 
  AlertCircle,
  FileText, 
  Plus, 
  TrendingUp, 
  Activity, 
  BookOpen, 
  PhoneCall, 
  Smartphone,
  Download,
  ChevronRight,
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
  Moon,
  Globe,
  ArrowLeft,
  Pin,
  PinOff,
  ChevronsDown,
  Trophy,
  Heart,
  RefreshCw,
  ExternalLink,
  Keyboard,
  Search,
  Bookmark,
  BookmarkCheck,
  BookmarkX
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
  const { user, loading, loadingStatus, retryInit, signOut, refreshProfile } = useAuth();
  const isCurrentUserAdmin = user ? (user.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || isOBUser(user.role)) : false;
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('sy_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('sy_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as any).startViewTransition(() => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
      });
    } else {
      setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    }
  };

  const cleanMetaString = (str?: string): string => {
    if (!str) return '';
    return str
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFD]/g, '')
      .trim();
  };

  const applyMetaToDom = (data: {
    title?: string;
    description?: string;
    keywords?: string;
    favicon?: string;
    ogImage?: string;
    siteUrl?: string;
  }) => {
    if (!data) return;

    const cleanedTitle = cleanMetaString(data.title);
    const cleanedDescription = cleanMetaString(data.description);
    const cleanedKeywords = cleanMetaString(data.keywords);

    let sUrl = (data.siteUrl || '').trim();
    if (sUrl.includes('jsagyouth.netlify.app') || sUrl.includes('shalomyouth.netlify.app')) {
      sUrl = '';
    }
    if (sUrl && !sUrl.startsWith('http://') && !sUrl.startsWith('https://')) {
      sUrl = `https://${sUrl}`;
    }
    if (!sUrl && typeof window !== 'undefined') {
      sUrl = window.location.origin;
    }
    sUrl = sUrl.replace(/\/+$/, '');

    const toFullUrl = (url?: string): string => {
      if (!url) return '';
      const trimmed = url.trim();
      if (trimmed.includes('jsagyouth.netlify.app') || trimmed.includes('shalomyouth.netlify.app')) {
        const cleanPath = trimmed.replace(/^https?:\/\/[^\/]+/, '');
        return sUrl ? `${sUrl}${cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath}` : (typeof window !== 'undefined' ? `${window.location.origin}${cleanPath}` : cleanPath);
      }
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
        return trimmed;
      }
      const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
      return sUrl ? `${sUrl}${cleanPath}` : (typeof window !== 'undefined' ? `${window.location.origin}${cleanPath}` : cleanPath);
    };

    const fullOgImage = toFullUrl(data.ogImage);
    const fullFavicon = toFullUrl(data.favicon);

    if (cleanedTitle) {
      setBrandTitle(cleanedTitle);
    }

    const setMetaTag = (selector: string, attrName: string, attrVal: string, contentVal?: string) => {
      if (!contentVal) return;
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', contentVal);
    };

    setMetaTag('meta[name="description"]', 'name', 'description', cleanedDescription);
    setMetaTag('meta[name="keywords"]', 'name', 'keywords', cleanedKeywords);

    setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', cleanedTitle || 'Shalom Youth Fellowship - JSAG');
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', cleanedTitle);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', cleanedDescription);
    setMetaTag('meta[property="og:image"]', 'property', 'og:image', fullOgImage);
    setMetaTag('meta[property="og:image:secure_url"]', 'property', 'og:image:secure_url', fullOgImage.replace(/^http:/, 'https:'));
    setMetaTag('meta[property="og:image:width"]', 'property', 'og:image:width', '1200');
    setMetaTag('meta[property="og:image:height"]', 'property', 'og:image:height', '631');
    setMetaTag('meta[property="og:image:type"]', 'property', 'og:image:type', 'image/png');
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', sUrl);

    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', cleanedTitle);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', cleanedDescription);
    setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', fullOgImage);
    setMetaTag('meta[name="twitter:url"]', 'name', 'twitter:url', sUrl);

    if (sUrl) {
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', sUrl);
    }

    if (fullFavicon) {
      let faviconLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
      if (faviconLinks.length === 0) {
        const newFav = document.createElement('link');
        newFav.setAttribute('rel', 'icon');
        document.head.appendChild(newFav);
        faviconLinks = document.querySelectorAll('link[rel="icon"]');
      }
      faviconLinks.forEach(link => {
        link.setAttribute('href', fullFavicon);
      });
    }
  };

  useEffect(() => {
    // Dynamic website meta, SEO configurations & module visibility loader
    const loadWebsiteMeta = async () => {
      let data: any = null;

      // 1. Try fetching from Supabase directly
      try {
        let dbMeta: any = null;
        const { data: d1 } = await supabase.from('meta_configs').select('*').eq('id', 'singleton').maybeSingle();
        dbMeta = d1;

        if (!dbMeta) {
          const { data: d2 } = await supabase.from('meta_settings').select('*').eq('id', 'singleton').maybeSingle();
          dbMeta = d2;
        }

        if (dbMeta) {
          const storedLocalConfig = localStorage.getItem('sy_local_meta_config');
          const parsedLocal = storedLocalConfig ? JSON.parse(storedLocalConfig) : null;

          const footballVal = typeof dbMeta.is_football_enabled === 'boolean'
            ? dbMeta.is_football_enabled
            : (localStorage.getItem('sy_enable_football_predictions') === 'false' ? false : (parsedLocal?.isFootballEnabled ?? true));

          const prayerVal = typeof dbMeta.is_prayer_requests_enabled === 'boolean'
            ? dbMeta.is_prayer_requests_enabled
            : (localStorage.getItem('sy_enable_prayer_requests') === 'false' ? false : (parsedLocal?.isPrayerRequestsEnabled ?? true));

          const callingVal = typeof dbMeta.is_calling_enabled === 'boolean'
            ? dbMeta.is_calling_enabled
            : (localStorage.getItem('sy_enable_calling_services') === 'false' ? false : (parsedLocal?.isCallingEnabled ?? true));

          data = {
            title: dbMeta.title || parsedLocal?.title,
            description: dbMeta.description || parsedLocal?.description,
            keywords: dbMeta.keywords || parsedLocal?.keywords,
            ogImage: dbMeta.og_image || parsedLocal?.ogImage,
            favicon: dbMeta.favicon || parsedLocal?.favicon,
            siteUrl: dbMeta.site_url || parsedLocal?.siteUrl,
            isFootballEnabled: footballVal,
            isPrayerRequestsEnabled: prayerVal,
            isCallingEnabled: callingVal
          };

          setIsFootballEnabled(footballVal);
          setIsPrayerRequestsEnabled(prayerVal);
          setIsCallingEnabled(callingVal);

          localStorage.setItem('sy_enable_football_predictions', footballVal ? 'true' : 'false');
          localStorage.setItem('sy_enable_prayer_requests', prayerVal ? 'true' : 'false');
          localStorage.setItem('sy_enable_calling_services', callingVal ? 'true' : 'false');

          localStorage.setItem('sy_local_meta_config', JSON.stringify(data));
        }
      } catch (e) {
        console.warn('Direct Supabase fetch for meta tables yielded:', e);
      }

      // 2. Fallback to API endpoint if not loaded yet
      if (!data) {
        try {
          let response = await apiFetch('/api/meta-config');
          
          if (!response.ok && response.status === 401) {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                response = await apiFetch('/api/meta-config');
              }
            } catch (authErr) {
              console.error('Silent re-authentication attempt failed:', authErr);
            }
          }

          if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('text/html')) {
              data = await response.json();
              if (data) {
                if (data.isFootballEnabled !== undefined) {
                  setIsFootballEnabled(data.isFootballEnabled);
                  localStorage.setItem('sy_enable_football_predictions', data.isFootballEnabled ? 'true' : 'false');
                }
                if (data.isPrayerRequestsEnabled !== undefined) {
                  setIsPrayerRequestsEnabled(data.isPrayerRequestsEnabled);
                  localStorage.setItem('sy_enable_prayer_requests', data.isPrayerRequestsEnabled ? 'true' : 'false');
                }
                if (data.isCallingEnabled !== undefined) {
                  setIsCallingEnabled(data.isCallingEnabled);
                  localStorage.setItem('sy_enable_calling_services', data.isCallingEnabled ? 'true' : 'false');
                }
                localStorage.setItem('sy_local_meta_config', JSON.stringify(data));
              }
            }
          }
        } catch (err) {
          console.warn('Failed to fetch website metadata via API:', err);
        }
      }

      // 3. Fallback to local storage
      if (!data) {
        try {
          const cached = localStorage.getItem('sy_local_meta_config');
          if (cached) {
            data = JSON.parse(cached);
          }
        } catch (e) {
          console.error('Failed to read local cached meta config:', e);
        }
      }

      if (data) {
        applyMetaToDom(data);
      }
    };

    loadWebsiteMeta();

    // Setup Supabase Realtime subscription for meta_configs table
    const metaChannel = supabase
      .channel('meta_configs_realtime_app')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_configs' }, (payload: any) => {
        if (payload.new) {
          if (typeof payload.new.is_football_enabled === 'boolean') {
            setIsFootballEnabled(payload.new.is_football_enabled);
            localStorage.setItem('sy_enable_football_predictions', payload.new.is_football_enabled ? 'true' : 'false');
          }
          if (typeof payload.new.is_prayer_requests_enabled === 'boolean') {
            setIsPrayerRequestsEnabled(payload.new.is_prayer_requests_enabled);
            localStorage.setItem('sy_enable_prayer_requests', payload.new.is_prayer_requests_enabled ? 'true' : 'false');
          }
          if (typeof payload.new.is_calling_enabled === 'boolean') {
            setIsCallingEnabled(payload.new.is_calling_enabled);
            localStorage.setItem('sy_enable_calling_services', payload.new.is_calling_enabled ? 'true' : 'false');
          }

          const newMeta = {
            title: payload.new.title,
            description: payload.new.description,
            keywords: payload.new.keywords,
            ogImage: payload.new.og_image,
            favicon: payload.new.favicon,
            siteUrl: payload.new.site_url,
          };
          applyMetaToDom(newMeta);
          localStorage.setItem('sy_local_meta_config', JSON.stringify(newMeta));
        }
      })
      .subscribe();

    const handleCustomEvent = (e: any) => {
      if (e.detail) {
        applyMetaToDom(e.detail);
      }
    };
    window.addEventListener('meta_config_updated', handleCustomEvent);

    const handleVisibilityEvent = (e: any) => {
      if (e.detail) {
        if (typeof e.detail.is_football_enabled === 'boolean') setIsFootballEnabled(e.detail.is_football_enabled);
        if (typeof e.detail.is_prayer_requests_enabled === 'boolean') setIsPrayerRequestsEnabled(e.detail.is_prayer_requests_enabled);
        if (typeof e.detail.is_calling_enabled === 'boolean') setIsCallingEnabled(e.detail.is_calling_enabled);
      }
    };
    window.addEventListener('module_visibility_updated', handleVisibilityEvent);

    return () => {
      supabase.removeChannel(metaChannel);
      window.removeEventListener('meta_config_updated', handleCustomEvent);
      window.removeEventListener('module_visibility_updated', handleVisibilityEvent);
    };
  }, []);

  const [members, setMembers] = useState<Member[]>([]);
  const [logs, setLogs] = useState(() => getActivityLogs());
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isRetryingFromUI, setIsRetryingFromUI] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState<boolean | null>(null);
  const [connectionRetryCount, setConnectionRetryCount] = useState(0);

  const handleManualRetry = async () => {
    setIsRetryingFromUI(true);
    try {
      if (retryInit) {
        await retryInit();
      }
      await loadDatabase();
    } catch (e) {
      console.error("Manual connection retry error:", e);
    } finally {
      setIsRetryingFromUI(false);
    }
  };
  const [currentTab, setCurrentTab] = useState<'directory' | 'financials' | 'schedule' | 'birthday-tasks' | 'meta-settings' | 'football' | 'prayer-requests' | 'calling' | 'admin-control'>(() => {
    const VALID_TABS = ['directory', 'financials', 'schedule', 'birthday-tasks', 'meta-settings', 'football', 'prayer-requests', 'calling', 'admin-control'];
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && VALID_TABS.includes(tab)) {
      return tab as any;
    }
    // Deep-linking fallback: automatically switch to 'schedule' tab if schedule parameters exist in URL query or hash
    if (params.get('scheduleId') || params.get('schedule') || params.get('id')) {
      return 'schedule';
    }
    const hash = window.location.hash.replace('#', '');
    if (hash && VALID_TABS.includes(hash)) {
      return hash as any;
    }
    if (hash.includes('schedule') || hash.includes('scheduleId')) {
      return 'schedule';
    }
    try {
      const savedTab = localStorage.getItem('sy_current_tab');
      if (savedTab && VALID_TABS.includes(savedTab)) {
        return savedTab as any;
      }
    } catch (e) {
      // ignore
    }
    return 'directory';
  });

  const [brandTitle, setBrandTitle] = useState<string>(BRAND_DEFAULT);
  const [customOverrideTitle, setCustomOverrideTitle] = useState<string | null>(null);

  const [directoryStatusFilter, setDirectoryStatusFilter] = useState<'All' | 'pending' | 'approved' | 'rejected'>('All');

  const [isFootballEnabled, setIsFootballEnabled] = useState<boolean>(() => {
    return localStorage.getItem('sy_enable_football_predictions') !== 'false';
  });

  const [isPrayerRequestsEnabled, setIsPrayerRequestsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('sy_enable_prayer_requests') !== 'false';
  });

  const [isCallingEnabled, setIsCallingEnabled] = useState<boolean>(() => {
    return localStorage.getItem('sy_enable_calling_services') !== 'false';
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', currentTab);
    window.history.replaceState({ tab: currentTab }, '', url.toString());
    try {
      localStorage.setItem('sy_current_tab', currentTab);
    } catch (e) {
      // ignore
    }
  }, [currentTab]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['directory', 'financials', 'schedule', 'birthday-tasks', 'meta-settings', 'football', 'prayer-requests', 'calling', 'admin-control'].includes(tab)) {
        setCurrentTab(tab as any);
      } else if (params.get('scheduleId') || params.get('schedule') || params.get('id')) {
        setCurrentTab('schedule');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Listen for custom title overrides from dynamic sub-components (modals, schedule details, etc.)
  useEffect(() => {
    const handleTitleChange = (e: any) => {
      if (e.detail) {
        setCustomOverrideTitle(e.detail.title ? cleanTitle(e.detail.title) : null);
      }
    };
    window.addEventListener('sy_page_title_change', handleTitleChange);
    return () => window.removeEventListener('sy_page_title_change', handleTitleChange);
  }, []);

  // Reset custom title whenever currentTab changes
  useEffect(() => {
    setCustomOverrideTitle(null);
  }, [currentTab]);

  // Centralized SEO Document Title Sync & Open Graph Meta Updates
  useEffect(() => {
    const brand = cleanTitle(brandTitle) || BRAND_DEFAULT;
    let pageTitle = customOverrideTitle;

    if (!pageTitle) {
      pageTitle = TAB_PAGE_TITLES[currentTab] || BRAND_DEFAULT;
    }

    const cleanedPage = cleanTitle(pageTitle);
    let fullTitle = brand;

    if (cleanedPage && cleanedPage !== brand && !cleanedPage.includes(brand)) {
      fullTitle = `${cleanedPage} | ${brand}`;
    } else if (cleanedPage) {
      fullTitle = cleanedPage;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
    const ogImageUrl = origin ? `${origin}/api/og${currentPath === '/' ? '' : currentPath}` : '/api/og';

    updateClientHeadMeta({
      title: fullTitle,
      canonicalUrl: typeof window !== 'undefined' ? window.location.href : '',
      ogImage: ogImageUrl
    });
  }, [currentTab, customOverrideTitle, brandTitle]);
  
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
  const [showMemberDemographics, setShowMemberDemographics] = useState<boolean>(() => {
    const saved = localStorage.getItem('sy_pref_show_member_demographics');
    return saved !== null ? saved === 'true' : true;
  });
  
  // Modals / Portal selectors
  const [isSQLModalOpen, setIsSQLModalOpen] = useState(false);
  const [isBialDiagnosticOpen, setIsBialDiagnosticOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  
  // Birthday Wishes & Gift Box states
  const [birthdayWishes, setBirthdayWishes] = useState<BirthdayWish[]>([]);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [wishedIds, setWishedIds] = useState<string[]>([]);
  const [isWishingMap, setIsWishingMap] = useState<Record<string, boolean>>({});
  const [selectedProfileMember, setSelectedProfileMember] = useState<Member | null>(null);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [isAuthView, setIsAuthView] = useState<'login' | 'register'>('login');
  const [addNewMemberOpen, setAddNewMemberOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isOgPreviewOpen, setIsOgPreviewOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showBalloons, setShowBalloons] = useState(true);
  const [blessingsReceived, setBlessingsReceived] = useState(false);
  const [customDialog, setCustomDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'confirm' | 'alert';
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);
  const [showOnboardingTour, setShowOnboardingTour] = useState(false);

  // Global Realtime Chat states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newChatMessageText, setNewChatMessageText] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
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
  const [autoScrollChat, setAutoScrollChat] = useState(() => localStorage.getItem('sy_chat_auto_scroll') !== 'false');
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [popoverDirection, setPopoverDirection] = useState<'up' | 'down'>('up');
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [showGuidelines, setShowGuidelines] = useState(() => !localStorage.getItem('sy_dismiss_guidelines'));
  const chatHeaderMenuRef = React.useRef<HTMLDivElement>(null);
  const activeReactionContainerRef = React.useRef<HTMLDivElement>(null);
  const pressTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Thread Discussion States
  const [activeThreadParent, setActiveThreadParent] = useState<ChatMessage | null>(null);
  const [newReplyText, setNewReplyText] = useState("");

  // Personal Saved / Bookmarked Messages States
  const [showSavedMessagesView, setShowSavedMessagesView] = useState(false);
  const [savedMessageIds, setSavedMessageIds] = useState<string[]>([]);

  useEffect(() => {
    if (user?.id) {
      try {
        const stored = localStorage.getItem(`sy_saved_messages_${user.id}`);
        if (stored) {
          setSavedMessageIds(JSON.parse(stored));
        } else {
          setSavedMessageIds([]);
        }
      } catch (e) {
        setSavedMessageIds([]);
      }
    } else {
      setSavedMessageIds([]);
    }
  }, [user?.id]);

  const handleToggleSaveMessage = (messageId: string) => {
    if (!user?.id) return;
    setSavedMessageIds(prev => {
      const exists = prev.includes(messageId);
      const updated = exists ? prev.filter(id => id !== messageId) : [...prev, messageId];
      try {
        localStorage.setItem(`sy_saved_messages_${user.id}`, JSON.stringify(updated));
      } catch (e) {
        // ignore
      }
      return updated;
    });
  };

  // Message retention policy states
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState(false);
  const [retentionDays, setRetentionDays] = useState<number>(0);
  const [lastCleanupRun, setLastCleanupRun] = useState<string | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupFeedback, setCleanupFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active user presence/last_seen heartbeat
  useEffect(() => {
    if (!user?.id) return;
    const updateHeartbeat = () => {
      const nowIso = new Date().toISOString();
      db.updateMemberLastSeen(user.id, user.email, nowIso);
    };
    updateHeartbeat();
    const interval = setInterval(updateHeartbeat, 20000);
    return () => clearInterval(interval);
  }, [user?.id, user?.email]);

  // Global Keyboard Shortcuts (Ctrl+K search, Ctrl+N new member, Ctrl+/ shortcuts help, Ctrl+Shift+<Tab>)
  useEffect(() => {
    if (!user) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElem = document.activeElement;
      const isEditingText = activeElem && (
        activeElem.tagName === 'INPUT' ||
        activeElem.tagName === 'TEXTAREA' ||
        activeElem.tagName === 'SELECT' ||
        (activeElem as HTMLElement).isContentEditable
      );

      const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const hasCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl+K / Cmd+K -> Open Command Palette
      if (hasCmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Ctrl+/ or Cmd+/ -> Open Keyboard Shortcuts Guide
      if (hasCmdOrCtrl && e.key === '/') {
        e.preventDefault();
        setIsShortcutsHelpOpen((prev) => !prev);
        return;
      }

      // Ctrl+N / Cmd+N -> Provision New Member (if authorized)
      if (hasCmdOrCtrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        const isAdminOrOB = isOBUser(user.role) || user.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || user.email?.toLowerCase() === 'tkpaite2016@gmail.com';
        if (isAdminOrOB) {
          setAddNewMemberOpen(true);
        } else {
          customAlert({
            title: 'Permission Denied',
            message: 'Only administrators and office bearers can provision new youth members.',
            type: 'warning'
          });
        }
        return;
      }

      // Navigation Shortcuts (Ctrl+Shift+<Key> or Cmd+Shift+<Key>)
      if (hasCmdOrCtrl && e.shiftKey) {
        const key = e.key.toLowerCase();
        if (key === 'd') {
          e.preventDefault();
          setCurrentTab('directory');
          return;
        }
        if (key === 's') {
          e.preventDefault();
          setCurrentTab('schedule');
          return;
        }
        if (key === 'r' && isPrayerRequestsEnabled) {
          e.preventDefault();
          setCurrentTab('prayer-requests');
          return;
        }
        if (key === 'c' && isCallingEnabled) {
          e.preventDefault();
          setCurrentTab('calling');
          return;
        }
        if (key === 'p' && isFootballEnabled) {
          e.preventDefault();
          setCurrentTab('football');
          return;
        }
        if (key === 'f' && (isOBUser(user.role) || user.role === 'ECM')) {
          e.preventDefault();
          setCurrentTab('financials');
          return;
        }
        if (key === 'a' && (isOBUser(user.role) || user.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || user.email?.toLowerCase() === 'tkpaite2016@gmail.com')) {
          e.preventDefault();
          setCurrentTab('admin-control');
          return;
        }
        if (key === 'o') {
          e.preventDefault();
          setIsOgPreviewOpen(prev => !prev);
          return;
        }
      }

      // Single '/' key when not editing text -> Focus directory search input or open Command Palette
      if (e.key === '/' && !hasCmdOrCtrl && !e.shiftKey && !isEditingText) {
        e.preventDefault();
        const searchInput = document.getElementById('member-directory-search-input') as HTMLInputElement;
        if (searchInput && currentTab === 'directory') {
          searchInput.focus();
        } else {
          setIsCommandPaletteOpen(true);
        }
        return;
      }

      // Escape key -> Close any open shortcut modals
      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) setIsCommandPaletteOpen(false);
        if (isShortcutsHelpOpen) setIsShortcutsHelpOpen(false);
        if (addNewMemberOpen) setAddNewMemberOpen(false);
        if (isOgPreviewOpen) setIsOgPreviewOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const handleOpenOgInspector = () => setIsOgPreviewOpen(true);
    window.addEventListener('sy_open_og_inspector', handleOpenOgInspector);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('sy_open_og_inspector', handleOpenOgInspector);
    };
  }, [user, currentTab, isCommandPaletteOpen, isShortcutsHelpOpen, addNewMemberOpen, isOgPreviewOpen, isPrayerRequestsEnabled, isCallingEnabled, isFootballEnabled]);

  // Load retention settings when modal is opened
  useEffect(() => {
    if (isRetentionModalOpen) {
      db.getMessageRetentionPolicy().then(days => {
        setRetentionDays(days);
      });
      setLastCleanupRun(localStorage.getItem('sy_last_cleanup_run'));
      setCleanupFeedback(null);
    }
  }, [isRetentionModalOpen]);

  // Trigger background cleanup for admins once on load/mount or every 12 hours
  useEffect(() => {
    if (isCurrentUserAdmin) {
      const lastRun = localStorage.getItem('sy_last_cleanup_run');
      const now = new Date();
      let shouldRun = false;
      if (!lastRun) {
        shouldRun = true;
      } else {
        const lastRunDate = new Date(lastRun);
        const diffHours = (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60);
        if (diffHours >= 12) {
          shouldRun = true;
        }
      }

      if (shouldRun) {
        const timer = setTimeout(async () => {
          try {
            const res = await db.runAutomatedCleanup();
            if (res.success && res.deletedCount > 0) {
              console.log(`[Automated Cleanup] Deleted ${res.deletedCount} messages older than ${res.policyDays} days.`);
            }
          } catch (e) {
            console.warn('[Automated Cleanup] Failed background cleanup:', e);
          }
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [isCurrentUserAdmin]);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const threadEndRef = React.useRef<HTMLDivElement>(null);
  const threadScrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Thread alert states for tracking new replies to threads the user participates in
  const [threadAlerts, setThreadAlerts] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sy_chat_thread_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Keep track of the message log to identify when genuinely new messages are received
  const prevMessagesRef = React.useRef<ChatMessage[]>([]);

  // Dynamically calculate which thread parent IDs the current user is participating in
  const participatingThreadIds = React.useMemo(() => {
    if (!user || !chatMessages) return new Set<string>();
    const threadIds = new Set<string>();
    chatMessages.forEach(m => {
      if (m.user_id === user.id) {
        if (m.parent_id) {
          threadIds.add(m.parent_id);
        } else {
          threadIds.add(m.id);
        }
      }
    });
    return threadIds;
  }, [chatMessages, user?.id]);

  // React to incoming messages to identify if any represent new replies to threads the user is participating in
  useEffect(() => {
    if (!user || chatMessages.length === 0) {
      prevMessagesRef.current = chatMessages;
      return;
    }

    const prevIds = new Set(prevMessagesRef.current.map(m => m.id));
    const newArrivals = chatMessages.filter(m => !prevIds.has(m.id) && m.user_id !== user.id);

    if (newArrivals.length > 0 && prevMessagesRef.current.length > 0) {
      let updatedAlerts = [...threadAlerts];
      let addedAlert = false;

      newArrivals.forEach(msg => {
        if (msg.parent_id) {
          // If the reply belongs to a thread the user is in, and they are not looking at it right now
          if (participatingThreadIds.has(msg.parent_id)) {
            const isViewingThisThread = isChatOpen && activeThreadParent?.id === msg.parent_id;
            if (!isViewingThisThread && !updatedAlerts.includes(msg.parent_id)) {
              updatedAlerts.push(msg.parent_id);
              addedAlert = true;
            }
          }
        }
      });

      if (addedAlert) {
        setThreadAlerts(updatedAlerts);
        localStorage.setItem('sy_chat_thread_alerts', JSON.stringify(updatedAlerts));
      }
    }

    prevMessagesRef.current = chatMessages;
  }, [chatMessages, user, participatingThreadIds, isChatOpen, activeThreadParent, threadAlerts]);

  // Automatically dismiss alerts when the user opens/views the corresponding thread
  useEffect(() => {
    if (activeThreadParent && threadAlerts.includes(activeThreadParent.id)) {
      const updated = threadAlerts.filter(id => id !== activeThreadParent.id);
      setThreadAlerts(updated);
      localStorage.setItem('sy_chat_thread_alerts', JSON.stringify(updated));
    }
  }, [activeThreadParent, threadAlerts]);

  // Thread auto-scroll to bottom on replies or open
  useEffect(() => {
    if (activeThreadParent) {
      setTimeout(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [chatMessages, activeThreadParent]);

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

  // Format mentions and URLs helper for chat message bubbles
  const renderFormattedMessage = (text: string, isOwn: boolean = false) => {
    if (!text) return null;

    // Helper to format URLs and mentions within a substring
    const processSegment = (segment: string) => {
      // Regex to capture http/https/www URLs and file path URLs (like ctnk0szi54/Shalom_Youth_App_v2.4.apk/file)
      const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9_-]+\/[a-zA-Z0-9_\-.]+\.[a-zA-Z0-9]{2,}\/[^\s]*|[a-zA-Z0-9_-]+\.[a-zA-Z0-9_\-.]+\/[^\s]+)/gi;

      const subParts = [];
      let lastSubIndex = 0;
      let match;

      while ((match = urlRegex.exec(segment)) !== null) {
        const matchIdx = match.index;
        const matchedUrl = match[0];

        if (matchIdx > lastSubIndex) {
          subParts.push(
            <span key={`txt-${lastSubIndex}`} className="break-words [overflow-wrap:anywhere] [word-break:break-word]">
              {segment.substring(lastSubIndex, matchIdx)}
            </span>
          );
        }

        let href = matchedUrl;
        if (!href.startsWith('http://') && !href.startsWith('https://')) {
          href = `https://${href}`;
        }

        subParts.push(
          <a
            key={`url-${matchIdx}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 my-0.5 rounded-md text-[11px] font-bold border transition-all break-all [overflow-wrap:anywhere] max-w-full ${
              isOwn
                ? 'bg-white/20 hover:bg-white/30 text-white border-white/30 underline underline-offset-2'
                : 'bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 text-violet-700 dark:text-violet-300 border-violet-200/60 dark:border-violet-800/50 underline underline-offset-2'
            }`}
            title={`Open link: ${matchedUrl}`}
          >
            <ExternalLink className="w-3 h-3 shrink-0 opacity-85" />
            <span className="break-all [overflow-wrap:anywhere] line-clamp-1 max-w-[180px] sm:max-w-[220px] inline-block align-bottom">{matchedUrl}</span>
          </a>
        );

        lastSubIndex = urlRegex.lastIndex;
      }

      if (lastSubIndex < segment.length) {
        subParts.push(
          <span key={`txt-${lastSubIndex}`} className="break-words [overflow-wrap:anywhere] [word-break:break-word]">
            {segment.substring(lastSubIndex)}
          </span>
        );
      }

      return subParts;
    };

    const approvedNames = members
      .filter(m => m.status === 'approved')
      .map(m => m.name);
    
    const sortedNames = [...approvedNames].sort((a, b) => b.length - a.length);
    const escapedNames = sortedNames.map(name => name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));

    if (escapedNames.length === 0 || !text.includes('@')) {
      return <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] min-w-0 max-w-full">{processSegment(text)}</span>;
    }

    const mentionRegex = new RegExp(`@(${escapedNames.join('|')})\\b`, 'gi');
    const mainParts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      const nameOnly = match[1];

      if (matchIndex > lastIndex) {
        mainParts.push(...processSegment(text.substring(lastIndex, matchIndex)));
      }

      mainParts.push(
        <span 
          key={`mention-${matchIndex}`} 
          className={`font-extrabold px-1.5 py-0.5 rounded-md mx-0.5 border inline-flex items-center gap-0.5 text-[11px] align-baseline shadow-xxs ${
            isOwn
              ? 'bg-white/25 text-white border-white/40'
              : 'bg-violet-100/90 dark:bg-violet-900/60 text-violet-800 dark:text-violet-200 border-violet-200/80 dark:border-violet-700/60'
          }`}
        >
          @{nameOnly}
        </span>
      );

      lastIndex = mentionRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      mainParts.push(...processSegment(text.substring(lastIndex)));
    }

    return <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] min-w-0 max-w-full">{mainParts}</span>;
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

  // Track previous chat open state to detect when it transitions from closed to open
  const prevIsChatOpenRef = React.useRef(isChatOpen);

  // Auto-scroll chat to bottom
  useEffect(() => {
    const wasClosed = !prevIsChatOpenRef.current;
    prevIsChatOpenRef.current = isChatOpen;

    if (isChatOpen) {
      const lastMessage = chatMessages[chatMessages.length - 1];
      const isOwnMessage = lastMessage && lastMessage.user_id === user?.id;

      if (wasClosed || autoScrollChat || isOwnMessage) {
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ 
            behavior: wasClosed ? 'auto' : 'smooth' 
          });
        }, wasClosed ? 50 : 80);
      }
    }
  }, [chatMessages, isChatOpen, autoScrollChat, user?.id]);

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
      const isOnline = await db.testConnection(2, 400);
      setDbConnected(isOnline);
      if (isOnline) {
        setConnectionSuccess(true);
        setConnectionRetryCount(0); // Reset retry counter upon successful connection
        await db.syncLocalDataToSupabase().catch(e => console.warn("Local sync warning:", e));
        await financialsDb.syncLocalFinancialsToSupabase().catch(e => console.warn("Financials sync warning:", e));
      } else {
        setConnectionError(db.lastError || "Could not reach database. Check if tables are created.");
        setConnectionSuccess(false);
        setConnectionRetryCount(prev => prev + 1); // Increment retry counter on failure
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
      setConnectionRetryCount(prev => prev + 1);
    } finally {
      setIsTestingConnection(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadDatabase();

    // Auto sync background interval (every 45 seconds)
    const autoSyncInterval = setInterval(() => {
      loadDatabase();
    }, 45000);

    // Auto sync when tab regains focus
    const handleFocusSync = () => {
      loadDatabase();
    };

    window.addEventListener('focus', handleFocusSync);

    return () => {
      clearInterval(autoSyncInterval);
      window.removeEventListener('focus', handleFocusSync);
    };
  }, [user?.id]);

  // Online status listener and auto-reconnect background retry sequence
  useEffect(() => {
    if (!user) return;

    const handleOnline = () => {
      console.log('Network online status changed. Attempting automatic database reconnection...');
      setConnectionRetryCount(0);
      loadDatabase();
    };

    window.addEventListener('online', handleOnline);

    // If connection failed (dbConnected === false) and we haven't exceeded maximum retries
    let retryTimer: NodeJS.Timeout | null = null;
    if (dbConnected === false && connectionRetryCount < 5) {
      // Calculate backoff delay up to 12 seconds max
      const delay = Math.min(4000 + (connectionRetryCount * 2000), 12000);
      console.log(`Scheduling automatic background reconnection retry #${connectionRetryCount + 1} in ${delay}ms...`);
      retryTimer = setTimeout(() => {
        loadDatabase();
      }, delay);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [user?.id, dbConnected, connectionRetryCount]);

  // Deep-link routing: automatically open a member's profile if '?profile=...' is present in the URL
  useEffect(() => {
    if (members.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const profileId = params.get('profile');
      if (profileId) {
        const found = members.find(m => m.id === profileId);
        if (found) {
          setSelectedProfileMember(found);
          // Cleanly remove the ?profile param from the browser address bar without hard reloading
          const cleanSearch = window.location.search
            .replace(new RegExp(`[\\?&]profile=${profileId}`), '')
            .replace(/^&/, '?')
            .replace(/\?$/, '');
          const newUrl = window.location.pathname + cleanSearch;
          window.history.replaceState({}, '', newUrl);
        }
      }
    }
  }, [members]);

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
    if (user) {
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
  }, [user?.id]);

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
        const onlineIds: string[] = [];
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          presences.forEach((p) => {
            if (p.user_id) {
              onlineIds.push(p.user_id);
              const nowIso = new Date().toISOString();
              db.updateMemberLastSeen(p.user_id, undefined, nowIso);
            }
            if (p.is_typing && p.user_id !== user.id) {
              typing.push(p.user_name || 'Someone');
            }
          });
        });
        setTypingUsers(Array.from(new Set(typing)));
        setOnlineUserIds(Array.from(new Set(onlineIds)));
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

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !activeThreadParent || !newReplyText.trim() || isSendingReply) return;

    const text = newReplyText.trim();
    setNewReplyText("");
    setIsSendingReply(true);

    try {
      const sentMsg = await db.sendChatMessage(
        text,
        user.id,
        user.name,
        user.avatar,
        activeThreadParent.id
      );
      
      setChatMessages((prev) => {
        if (prev.some(m => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });
    } catch (err) {
      console.error("Failed to send thread reply:", err);
    } finally {
      setIsSendingReply(false);
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
    if (!user) return;
    const confirmMsg = isCurrentUserAdmin
      ? 'Are you sure you want to clear the entire chat history for everyone? This action is permanent.'
      : 'Are you sure you want to clear your chat history view?';

    const confirmed = await customConfirm({
      title: 'Clear Chat History',
      message: confirmMsg,
      type: 'danger',
      confirmText: 'Clear Chat',
      cancelText: 'Cancel'
    });

    if (!confirmed) {
      return;
    }
    try {
      const nowIso = new Date().toISOString();
      localStorage.setItem('sy_chat_cleared_at', nowIso);
      localStorage.removeItem('sy_global_chat_messages');

      if (isCurrentUserAdmin) {
        await db.clearAllChatMessages();
      }

      const freshMsgs = await db.getChatMessages();
      setChatMessages(freshMsgs);
      setIsChatHeaderMenuOpen(false);
    } catch (err) {
      console.error('Failed to clear chat history:', err);
      setChatMessages([]);
      setIsChatHeaderMenuOpen(false);
    }
  };

  const handleSaveRetentionPolicy = async () => {
    if (!isCurrentUserAdmin) return;
    setIsCleaningUp(true);
    setCleanupFeedback(null);
    try {
      await db.setMessageRetentionPolicy(retentionDays);
      setCleanupFeedback({ type: 'success', message: `Retention policy successfully saved! Messages older than ${retentionDays || 'infinite'} days will be cleaned up.` });
    } catch (err: any) {
      setCleanupFeedback({ type: 'error', message: err.message || 'Failed to save retention policy.' });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleRunCleanupNow = async () => {
    if (!isCurrentUserAdmin) return;
    setIsCleaningUp(true);
    setCleanupFeedback(null);
    try {
      const res = await db.runAutomatedCleanup(retentionDays);
      if (res.success) {
        setCleanupFeedback({ 
          type: 'success', 
          message: `Cleanup completed successfully! Deleted ${res.deletedCount} unpinned messages older than ${retentionDays} days.` 
        });
        setLastCleanupRun(new Date().toISOString());
        // Refresh chat messages
        const msgs = await db.getChatMessages();
        setChatMessages(msgs);
      } else {
        setCleanupFeedback({ type: 'error', message: 'Cleanup failed or found no messages to delete.' });
      }
    } catch (err: any) {
      setCleanupFeedback({ type: 'error', message: err.message || 'Failed to trigger cleanup.' });
    } finally {
      setIsCleaningUp(false);
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
    const confirmed = await customConfirm({
      title: 'Delete Message',
      message: 'Are you sure you want to delete this message? This action cannot be undone.',
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    if (!confirmed) return;
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

  const handleTogglePinMessage = async (messageId: string, currentPinStatus: boolean) => {
    if (!user || !isCurrentUserAdmin) return;
    try {
      const updated = await db.togglePinChatMessage(messageId, !currentPinStatus);
      if (updated) {
        setChatMessages(prev => prev.map(m => m.id === messageId ? updated : m));
        addActivityLog(
          user.id,
          user.email,
          user.name,
          currentPinStatus ? 'Announcement Unpinned' : 'Announcement Pinned',
          `${currentPinStatus ? 'Unpinned' : 'Pinned'} important announcement message: "${updated.message.substring(0, 40)}${updated.message.length > 40 ? '...' : ''}"`,
          messageId,
          updated.user_name
        );
        setLogs(getActivityLogs());
      }
      setActiveReactionMsgId(null);
    } catch (err) {
      console.error('Failed to toggle pin message:', err);
    }
  };

  // Handle active user mutations
  const handleUpdateRoleAndStatus = async (id: string, role: UserRole, status: 'approved' | 'pending' | 'rejected') => {
    if (!user) return;
    try {
      const memberToUpdate = members.find(m => m.id === id);
      if (!memberToUpdate) return;

      if (role !== memberToUpdate.role && user.email.toLowerCase() !== DEFAULT_ADMIN_EMAIL.toLowerCase()) {
        alert('You do not have permission to assign or change user roles. This function is restricted to the administrator.');
        return;
      }

      if (memberToUpdate.role !== 'standard' && user.email.toLowerCase() !== DEFAULT_ADMIN_EMAIL.toLowerCase()) {
        alert('Permission Denied: Office Bearers can only verify or update Standard (Member) records. Access to other leadership or administrative roles is restricted to the administrator.');
        return;
      }

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

  const handleBulkAssignBial = async (ids: string[], bial: string) => {
    if (!user) return;
    try {
      let updatedCount = 0;
      for (const id of ids) {
        const memberToUpdate = members.find(m => m.id === id);
        if (!memberToUpdate) continue;
        
        await db.updateMemberBial(id, bial);
        
        addActivityLog(
          user.id,
          user.email,
          user.name,
          'Member Bial Updated',
          `Assigned "${memberToUpdate.name}" to Bial "${bial}" in profile.`,
          id,
          memberToUpdate.name
        );
        updatedCount++;
      }
      
      setLogs(getActivityLogs());
      await loadDatabase();
      alert(`Successfully assigned ${updatedCount} members to "${bial}"!`);
    } catch (e: any) {
      alert(`Database rejected bulk Bial assignment: ${e.message || e}`);
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

  const triggerCustomAlert = (title: string, message: string) => {
    setCustomDialog({
      isOpen: true,
      title,
      message,
      type: 'alert',
      onConfirm: () => setCustomDialog(null)
    });
  };

  const handleSendWish = async (receiverId: string, receiverName: string) => {
    if (!user) {
      triggerCustomAlert("Fellowship Login Required", "Please log in to your account first before sending birthday wishes!");
      return;
    }
    setIsWishingMap(prev => ({ ...prev, [receiverId]: true }));
    try {
      await db.sendBirthdayWish(receiverId, user.id, user.name);
      setWishedIds(prev => [...prev, receiverId]);
      triggerCustomAlert("Birthday Wish Placed! 🎉", `Your birthday wish is successfully inside ${receiverName}'s animated gift box! It will be visible to them for the next 24 hours. 🎁✨`);
    } catch (err: any) {
      console.error("Error sending birthday wish:", err);
      triggerCustomAlert("Sending Failed", "Failed to send birthday wish. Please verify your internet connection and try again.");
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
      
      if (original) {
        if (original.role !== finalUpdated.role && user.email.toLowerCase() !== DEFAULT_ADMIN_EMAIL.toLowerCase()) {
          alert('You do not have permission to change user roles. This function is restricted to the administrator.');
          return;
        }
        if (original.role !== 'standard' && !isSelf && user.email.toLowerCase() !== DEFAULT_ADMIN_EMAIL.toLowerCase()) {
          alert('Permission Denied: Office Bearers can only edit or verify Standard (Member) profiles. Modifying details of other leadership or administrative roles is restricted to the main administrator.');
          return;
        }
      }

      if (finalUpdated.role !== 'standard' && !isSelf && user.email.toLowerCase() !== DEFAULT_ADMIN_EMAIL.toLowerCase()) {
        alert('Permission Denied: You cannot set a user role other than Standard (Member). Only the main administrator can assign other roles.');
        return;
      }

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
        if (original.marital_status !== finalUpdated.marital_status) {
          changes.push(`marital status changed from "${original.marital_status || 'Single'}" to "${finalUpdated.marital_status || 'Single'}"`);
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
      setAdminFormError('Username (Legal Name) is required.');
      return;
    }

    if (newMemberRole !== 'standard' && user?.email?.toLowerCase() !== DEFAULT_ADMIN_EMAIL.toLowerCase()) {
      setAdminFormError('Permission Denied: Only the main administrator (tkpaite2016@gmail.com) can manually provision members with a role other than Standard (Member).');
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

  // Demographics computations
  const membersWithDob = members.filter(m => m.dob && !isNaN(new Date(m.dob).getTime()));
  const totalWithDob = membersWithDob.length;

  const getAge = (dobStr: string): number => {
    const dobDate = new Date(dobStr);
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
      age--;
    }
    return age;
  };

  const memberAges = membersWithDob.map(m => getAge(m.dob!));
  
  const averageAge = totalWithDob > 0 
    ? parseFloat((memberAges.reduce((sum, age) => sum + age, 0) / totalWithDob).toFixed(1))
    : 0;

  // Average age by gender
  const maleMembersWithDob = membersWithDob.filter(m => m.gender?.toLowerCase() === 'male');
  const femaleMembersWithDob = membersWithDob.filter(m => m.gender?.toLowerCase() === 'female');
  
  // Overall Male & Female counters (across all registered members)
  const allMaleMembers = members.filter(m => m.gender?.toLowerCase() === 'male');
  const allFemaleMembers = members.filter(m => m.gender?.toLowerCase() === 'female');
  const totalMaleCount = allMaleMembers.length;
  const totalFemaleCount = allFemaleMembers.length;
  const totalUnspecifiedGenderCount = members.filter(m => !m.gender || (m.gender.toLowerCase() !== 'male' && m.gender.toLowerCase() !== 'female')).length;
  const marriedMaleCount = allMaleMembers.filter(m => m.marital_status?.toLowerCase() === 'married').length;
  const singleMaleCount = totalMaleCount - marriedMaleCount;
  
  const maleAvgAge = maleMembersWithDob.length > 0
    ? parseFloat((maleMembersWithDob.map(m => getAge(m.dob!)).reduce((sum, age) => sum + age, 0) / maleMembersWithDob.length).toFixed(1))
    : 0;

  const femaleAvgAge = femaleMembersWithDob.length > 0
    ? parseFloat((femaleMembersWithDob.map(m => getAge(m.dob!)).reduce((sum, age) => sum + age, 0) / femaleMembersWithDob.length).toFixed(1))
    : 0;

  // Youngest and Oldest members
  let youngestMemberName = '';
  let youngestAge = 999;
  let oldestMemberName = '';
  let oldestAge = -1;

  membersWithDob.forEach(m => {
    const age = getAge(m.dob!);
    if (age < youngestAge) {
      youngestAge = age;
      youngestMemberName = m.display_name || m.name;
    }
    if (age > oldestAge) {
      oldestAge = age;
      oldestMemberName = m.display_name || m.name;
    }
  });

  // Age group ranges count
  const ageGroups = {
    under18: 0,
    range18_22: 0,
    range23_27: 0,
    range28_35: 0,
    over35: 0
  };

  memberAges.forEach(age => {
    if (age < 18) ageGroups.under18++;
    else if (age <= 22) ageGroups.range18_22++;
    else if (age <= 27) ageGroups.range23_27++;
    else if (age <= 35) ageGroups.range28_35++;
    else ageGroups.over35++;
  });

  const ageGroupDistributionData = [
    { name: 'Under 18', count: ageGroups.under18, fill: '#ec4899' },
    { name: '18 - 22', count: ageGroups.range18_22, fill: '#10b981' },
    { name: '23 - 27', count: ageGroups.range23_27, fill: '#3b82f6' },
    { name: '28 - 35', count: ageGroups.range28_35, fill: '#f59e0b' },
    { name: '36 & Over', count: ageGroups.over35, fill: '#8b5cf6' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-stone-50 via-emerald-950/5 to-stone-100 dark:from-stone-950 dark:via-emerald-950/20 dark:to-stone-900 flex flex-col items-center justify-center p-6 transition-colors duration-250">
        <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/90 dark:border-stone-800 shadow-2xl p-8 text-center space-y-6 relative overflow-hidden backdrop-blur-xl">
          {/* Top Gradient Shimmer Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-pulse"></div>

          {loadingStatus === 'error' ? (
            <div className="space-y-5 py-2">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 flex items-center justify-center text-red-500 shadow-inner">
                <AlertCircle className="w-8 h-8 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-black text-stone-950 dark:text-white">Database Connection Timeout</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed font-medium">
                  We had trouble connecting to the Shalom Youth Database. Please verify your internet connection and try reconnecting.
                </p>
              </div>
              <button
                onClick={handleManualRetry}
                disabled={isRetryingFromUI}
                className="w-full py-3 px-5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-70 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isRetryingFromUI ? 'animate-spin' : ''}`} />
                {isRetryingFromUI ? 'Reconnecting to Database...' : 'Retry Database Connection'}
              </button>
            </div>
          ) : (
            <div className="space-y-6 py-3">
              {/* Animated Connection Shield & Spinner Badge */}
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                {/* Outer Glow Ring */}
                <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 animate-ping opacity-75"></div>
                
                {/* Outer Spinning Border */}
                <div className="absolute -inset-1 rounded-2xl border-2 border-emerald-500/20 dark:border-emerald-500/30"></div>
                <div className="absolute -inset-1 rounded-2xl border-2 border-transparent border-t-emerald-500 dark:border-t-emerald-400 animate-spin"></div>
                
                {/* Core Badge */}
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/25 relative z-10">
                  <Database className="w-8 h-8 text-white animate-pulse" />
                </div>
              </div>

              {/* Status Header & Live Indicator Badge */}
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 rounded-full text-[11px] font-black tracking-wider uppercase text-emerald-700 dark:text-emerald-300">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Initiating Database Connection</span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-black text-stone-900 dark:text-stone-100 tracking-tight">
                    Shalom Youth Database Sync
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 font-medium leading-relaxed">
                    {loadingStatus === 'connecting' && "Verifying security credentials and establishing live database link..."}
                    {loadingStatus === 'slow' && "Preparing your workspace. Synchronizing member profiles & logs..."}
                    {loadingStatus === 'retrying' && "Re-establishing database handshake. Please hold on..."}
                  </p>
                </div>
              </div>

              {/* Shimmer Progress Track */}
              <div className="w-full bg-stone-150 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden relative">
                <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 rounded-full w-3/4 animate-pulse"></div>
              </div>

              {(loadingStatus === 'slow' || loadingStatus === 'retrying') && (
                <button
                  onClick={handleManualRetry}
                  disabled={isRetryingFromUI}
                  className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 disabled:opacity-70 text-stone-800 dark:text-stone-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-stone-200 dark:border-stone-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRetryingFromUI ? 'animate-spin' : ''}`} />
                  {isRetryingFromUI ? 'Reconnecting...' : 'Force Reconnect'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- UNAUTHENTICATED SCREEN (Welcome Portal) ---
  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-b from-stone-50 to-stone-100 flex flex-col justify-between relative transition-colors duration-200" id="app_root">
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
              {user?.email?.toLowerCase() === 'tkpaite2016@gmail.com' && (
                <div className="pt-2">
                  <button
                    onClick={() => setIsSQLModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-350 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 px-3.5 py-2 rounded-xl border border-emerald-100 dark:border-emerald-900/50 transition-colors cursor-pointer"
                    title="Configure database"
                  >
                    <Database className="w-4 h-4" />
                    Supabase Setup Configurations
                  </button>
                </div>
              )}
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
        <AppFooter />

        <SQLSetupModal isOpen={isSQLModalOpen} onClose={() => setIsSQLModalOpen(false)} />
      </div>
    );
  }

  // --- AUTHENTICATED SCREEN (Main Dashboard Workspace) ---
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col justify-between transition-colors duration-200 overflow-x-hidden w-full max-w-full min-w-0" id="dashboard_root">
      
      {/* Universal Sticky Header Grid */}
      <header className="bg-emerald-900 text-white px-2.5 py-2 sm:px-4 sm:py-3 sticky top-0 z-40 shadow-md w-full max-w-full overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-3 w-full min-w-0">
          
          {/* Logo */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-white/10 flex items-center justify-center font-bold text-xs sm:text-lg text-emerald-300 shrink-0">
              SY
            </div>
            <div className="shrink-0 hidden sm:block">
              <h1 className="text-xs sm:text-sm md:text-base font-extrabold tracking-tight leading-none whitespace-nowrap">Shalom Youth</h1>
              <span className="text-[8px] sm:text-[9px] md:text-[10px] text-emerald-250 font-bold uppercase tracking-wider block leading-tight">Members Console</span>
            </div>
          </div>

          {/* Quick connection / diagnostics indicator */}
          <button
            id="sy-db-connection-badge"
            onClick={() => {
              if (!dbConnected && !isTestingConnection) {
                setConnectionRetryCount(0); // Reset retry count for manual retry
                loadDatabase();
              }
            }}
            disabled={isTestingConnection}
            className={`hidden lg:flex items-center gap-2 text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 shrink-0 transition-all ${!dbConnected ? 'cursor-pointer hover:border-amber-400/50' : 'cursor-default'}`}
            title={dbConnected ? 'Database connection is healthy and active' : 'Database connection is offline. Click to manually reconnect.'}
          >
            <span className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-emerald-400' : isTestingConnection ? 'bg-indigo-400 animate-ping' : 'bg-amber-400 animate-pulse'}`}></span>
            <span className="text-white/80 font-medium">
              Database: {isTestingConnection ? 'Connecting...' : dbConnected ? 'Supabase Synchronized' : 'High-Fidelity Offline Sync'}
            </span>
            {!dbConnected && !isTestingConnection && (
              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-md animate-pulse font-bold border border-amber-500/30">Retry</span>
            )}
          </button>

          {/* Right Section / Profile avatar / Logout */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0">
            {/* Command Palette Trigger */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/15 text-xs font-semibold cursor-pointer transition-all shadow-2xs shrink-0 select-none"
              title="Search Members, Navigation & Commands (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden xl:inline">Search</span>
              <kbd className="hidden xl:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono font-bold bg-white/15 text-white/90 rounded border border-white/20">
                {typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl+K'}
              </kbd>
            </button>

            {/* Quick Add Member Button for Admins */}
            {user && (isOBUser(user.role) || user.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || user.email?.toLowerCase() === 'tkpaite2016@gmail.com') && (
              <button
                onClick={() => setAddNewMemberOpen(true)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white border border-emerald-400/40 text-xs font-extrabold cursor-pointer transition-all shadow-2xs shrink-0 select-none"
                title="Provision New Youth Member (Ctrl+N)"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">New Member</span>
                <kbd className="hidden 2xl:inline-flex items-center text-[9px] font-mono font-bold bg-black/20 text-white px-1 py-0.5 rounded">
                  {typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? '⌘N' : 'Ctrl+N'}
                </kbd>
              </button>
            )}

            {/* Shortcuts Guide Button */}
            <button
              onClick={() => setIsShortcutsHelpOpen(true)}
              className="p-1.5 sm:p-2 bg-emerald-950/50 hover:bg-emerald-800/80 text-emerald-200 hover:text-white rounded-xl transition-all cursor-pointer border border-emerald-800/60 shadow-2xs shrink-0 flex items-center justify-center"
              title="Keyboard Shortcuts Guide (Ctrl+/)"
              aria-label="Keyboard Shortcuts"
            >
              <Keyboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {user && !user.hide_notifications_ui && (
              <NotificationBell 
                currentUser={user} 
                logs={logs} 
                currentTab={currentTab}
                setCurrentTab={setCurrentTab}
                members={members}
                chatMessages={chatMessages}
                onOpenChat={() => setIsChatOpen(true)}
              />
            )}

            <div className="text-right hidden xl:block shrink-0">
              <span className="block text-xs font-bold text-white leading-none">{formatMemberName(user.display_name || user.name, user.gender, user.marital_status)}</span>
              <div className="flex items-center justify-end gap-1 mt-1">
                <RoleBadge role={user.role} className="scale-85 origin-right py-0 px-1.5" />
                {user.custom_title && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.25 rounded-md text-[9px] font-extrabold bg-amber-400 text-amber-950 shadow-2xs">
                    <Sparkles className="w-2.5 h-2.5 text-amber-900 shrink-0 animate-pulse" />
                    <span>{user.custom_title}</span>
                  </span>
                )}
              </div>
            </div>
            
            <button
              id="tour-avatar-btn"
              onClick={() => {
                setProfileEditMode(false);
                setSelectedProfileMember(user);
              }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-emerald-80 text-emerald-200 hover:text-white font-black flex items-center justify-center text-xs border-2 border-emerald-700/50 cursor-pointer shrink-0"
              title="My Account Details"
            >
              {getCleanAvatar(user.avatar) || getDefaultAvatar(user.gender) ? (
                <img src={getCleanAvatar(user.avatar) || getDefaultAvatar(user.gender)} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </button>

            {/* Dark/Light Theme Toggle Button */}
            <button
              id="sy-theme-toggle-btn"
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 bg-emerald-950/50 hover:bg-emerald-800/80 text-emerald-100 hover:text-white rounded-xl transition-all cursor-pointer border border-emerald-800/60 shadow-xs shrink-0 flex items-center justify-center gap-1.5"
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 animate-pulse" />
                  <span className="hidden xl:inline text-[10px] font-extrabold text-amber-200">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-200" />
                  <span className="hidden xl:inline text-[10px] font-extrabold text-emerald-100">Dark</span>
                </>
              )}
            </button>

            <button
              id="tour-edit-profile-btn"
              onClick={() => {
                setProfileEditMode(true);
                setSelectedProfileMember(user);
              }}
              className="p-1.5 sm:p-2 lg:px-2.5 lg:py-1.5 bg-emerald-950/40 hover:bg-emerald-800/80 text-emerald-100 hover:text-white rounded-xl text-[10px] sm:text-xs font-bold border border-emerald-800/60 cursor-pointer transition-all shadow-xs shrink-0 flex items-center gap-1"
              title="Edit My Profile Details"
            >
              <UserCog className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Edit Profile</span>
            </button>

            {user.role === 'standard' && (
              <button
                onClick={() => setShowOnboardingTour(true)}
                className="p-1.5 sm:p-2 bg-emerald-950 hover:bg-emerald-999 rounded-xl text-emerald-250 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Take Onboarding Tour 🌟"
              >
                <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-250" />
              </button>
            )}

            <button
              onClick={() => signOut()}
              className="p-1.5 sm:p-2 bg-emerald-950 hover:bg-emerald-999 rounded-xl text-emerald-250 hover:text-white transition-colors cursor-pointer shrink-0 flex items-center justify-center"
              title="Logout Profile"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Primary Workspace Stage */}
      <main className="max-w-7xl mx-auto w-full px-2.5 sm:px-4 py-4 sm:py-6 flex-grow space-y-4 sm:space-y-6 min-w-0 max-w-full overflow-hidden">

        {/* Floating Festive Balloon Background Theme Effect */}
        {user.dob && isBirthdayToday(user.dob, currentDate) && showBalloons && (
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
                <span>Happy Birthday, {formatMemberName(user.display_name || user.name, user.gender, user.marital_status)}!</span>
                <span className="animate-bounce text-sm sm:text-base">🎁</span>
              </h3>
              <p className="text-[10px] sm:text-[11px] md:text-xs text-pink-50 font-medium max-w-2xl leading-normal opacity-95">
                Shalom Youth Community wishes you a beautiful and blessed birthday! May this new year bring endless joy, success, and divine guidance. The app is dressed in a special Birthday Theme in your honor today! ✨💖
              </p>
            </div>
            
            <div className="w-full md:w-auto shrink-0 relative z-10 flex justify-center md:justify-end">
              <button
                onClick={() => {
                  if (blessingsReceived) {
                    setCustomDialog({
                      isOpen: true,
                      title: "Stop Birthday Celebrations? 🛑",
                      message: "Do you want to stop the floating balloons and festive animations on your screen?",
                      type: 'confirm',
                      confirmText: "Yes, Stop Them",
                      cancelText: "Keep Celebrating",
                      onConfirm: () => {
                        setShowConfetti(false);
                        setShowBalloons(false);
                        setBlessingsReceived(false);
                        setCustomDialog(null);
                      },
                      onCancel: () => setCustomDialog(null)
                    });
                  } else {
                    setCustomDialog({
                      isOpen: true,
                      title: "Receive Birthday Blessings! 🎁✨",
                      message: "Do you wish to activate your official birthday blessings and play the festive animations?",
                      type: 'confirm',
                      confirmText: "Bless Me! 💖",
                      cancelText: "Not Now",
                      onConfirm: () => {
                        setShowConfetti(true);
                        setShowBalloons(true);
                        setBlessingsReceived(true);
                        
                        setTimeout(() => {
                          setCustomDialog({
                            isOpen: true,
                            title: "Happy Birthday! 🎉🎂",
                            message: "Thank you for being a wonderful part of Shalom Youth! Have an amazing birthday celebration!",
                            type: 'alert',
                            confirmText: "Ameen 🙏",
                            onConfirm: () => setCustomDialog(null)
                          });
                        }, 300);
                      },
                      onCancel: () => setCustomDialog(null)
                    });
                  }
                }}
                onDoubleClick={() => {
                  if (blessingsReceived) {
                    setShowConfetti(false);
                    setShowBalloons(false);
                    setBlessingsReceived(false);
                    setCustomDialog({
                      isOpen: true,
                      title: "Animations Stopped 🎈",
                      message: "Festive celebrations and floating balloons have been turned off. You can click again to restart!",
                      type: 'alert',
                      confirmText: "OK",
                      onConfirm: () => setCustomDialog(null)
                    });
                  }
                }}
                className={`w-full md:w-auto font-black text-[10px] sm:text-xs px-5 py-2.5 sm:py-3 rounded-xl shadow-md transition-all transform hover:scale-102 active:scale-98 cursor-pointer border text-center ${
                  blessingsReceived 
                    ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500' 
                    : 'bg-white hover:bg-pink-50 active:bg-pink-100 text-indigo-950 border-pink-100/10'
                }`}
                title={blessingsReceived ? "Double click or click again to stop the celebrations" : "Click to receive your blessings"}
              >
                {blessingsReceived ? "Stop Blessings 🛑" : "Receive Blessings 🙏"}
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
                    {birthdayCelebrants.map(m => formatMemberName(m.display_name || m.name, m.gender, m.marital_status)).join(', ')}
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
                {user?.email?.toLowerCase() === 'tkpaite2016@gmail.com' && (
                  <button
                    onClick={() => setIsSQLModalOpen(true)}
                    disabled={isTestingConnection}
                    className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors disabled:cursor-not-allowed cursor-pointer"
                    title="Configure database"
                  >
                    Open SQL Setup Guide
                  </button>
                )}
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
            {/* OB Action Alert Banner for Pending Registrations */}
            {isCurrentUserAdmin && pendingCount > 0 && (
              <div className="mb-6 p-4.5 bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 dark:from-amber-950/40 dark:to-amber-950/20 rounded-2xl border border-amber-300/80 dark:border-amber-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
                    <UserCheck className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-amber-950 dark:text-amber-200 text-sm">
                        {pendingCount} New Pending Registration{pendingCount > 1 ? 's' : ''} Awaiting Review
                      </span>
                      <span className="bg-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Action Needed
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                      Automated system alerts have been issued to OB committee members. Click below to review and approve new members.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCurrentTab('directory');
                    setDirectoryStatusFilter('pending');
                  }}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-center"
                >
                  <span>Review Pending Applications ({pendingCount})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* View Swapper & Preferences Toggles */}
            <div className="flex flex-col gap-3 mb-6 min-w-0 max-w-full overflow-hidden">
              {/* Navigation Tabs bar */}
              <div className="flex bg-white dark:bg-stone-900 p-1 rounded-xl sm:rounded-2xl shadow-2xs border border-stone-200 dark:border-stone-800 max-w-full overflow-x-auto no-scrollbar w-full scroll-smooth min-w-0">
                <button
                  onClick={() => setCurrentTab('directory')}
                  className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs transition-all cursor-pointer text-center whitespace-nowrap shrink-0 ${currentTab === 'directory' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'}`}
                >
                  Members Directory
                </button>
                <button
                  id="tab-btn-schedule"
                  onClick={() => setCurrentTab('schedule')}
                  className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${currentTab === 'schedule' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'}`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>Service Schedules</span>
                </button>

                {isPrayerRequestsEnabled && (
                  <button
                    id="tab-btn-prayers"
                    onClick={() => setCurrentTab('prayer-requests')}
                    className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${currentTab === 'prayer-requests' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'}`}
                  >
                    <Heart className="w-3.5 h-3.5 shrink-0 text-rose-400 fill-rose-400" />
                    <span>Prayer Requests</span>
                  </button>
                )}
                {(isOBUser(user.role) || user.role === 'ECM') && (
                  <button
                    onClick={() => setCurrentTab('financials')}
                    className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${currentTab === 'financials' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'}`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span>Financial Records</span>
                  </button>
                )}
                {isFootballEnabled && (
                  <button
                    onClick={() => setCurrentTab('football')}
                    className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${currentTab === 'football' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'}`}
                  >
                    <Trophy className="w-3.5 h-3.5 shrink-0" />
                    <span>Football Predictions</span>
                  </button>
                )}
                {isCallingEnabled && (
                  <button
                    id="tab-btn-calling"
                    onClick={() => setCurrentTab('calling')}
                    className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${currentTab === 'calling' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'}`}
                  >
                    <PhoneCall className="w-3.5 h-3.5 shrink-0" />
                    <span>Calls & History</span>
                  </button>
                )}
                {(isOBUser(user.role) || user?.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || user?.email?.toLowerCase() === 'tkpaite2016@gmail.com') && (
                  <button
                    id="tab-btn-admin-control"
                    onClick={() => setCurrentTab('admin-control')}
                    className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${currentTab === 'admin-control' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'}`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Admin Control</span>
                  </button>
                )}
              </div>

              {/* Preferences Toggle / Layout Customize Menu - Rendered strictly BELOW tabs */}
              {currentTab === 'directory' && (
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 py-2 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-stone-100/90 dark:bg-stone-900/90 border border-stone-200/80 dark:border-stone-800 text-[11px] font-bold text-stone-600 dark:text-stone-300 w-full max-w-full overflow-x-auto min-w-0 shadow-2xs no-scrollbar">
                  <span className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 shrink-0 mr-1">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Layout Preferences:</span>
                  </span>
                  
                  <label className="flex items-center gap-1.5 bg-white dark:bg-stone-800 hover:bg-stone-50 p-1.5 px-2.5 rounded-lg cursor-pointer transition-colors border border-stone-200/60 dark:border-stone-700/60 shrink-0 select-none shadow-2xs">
                    <input
                      type="checkbox"
                      checked={showBirthdayAlerts}
                      onChange={(e) => {
                        setShowBirthdayAlerts(e.target.checked);
                        localStorage.setItem('sy_pref_show_birthday_alerts', String(e.target.checked));
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="whitespace-nowrap">Birthday Alerts</span>
                  </label>

                  <label className="flex items-center gap-1.5 bg-white dark:bg-stone-800 hover:bg-stone-50 p-1.5 px-2.5 rounded-lg cursor-pointer transition-colors border border-stone-200/60 dark:border-stone-700/60 shrink-0 select-none shadow-2xs">
                    <input
                      type="checkbox"
                      checked={showQuickMetrics}
                      onChange={(e) => {
                        setShowQuickMetrics(e.target.checked);
                        localStorage.setItem('sy_pref_show_quick_metrics', String(e.target.checked));
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="whitespace-nowrap">Metrics Stats</span>
                  </label>

                  <label className="flex items-center gap-1.5 bg-white dark:bg-stone-800 hover:bg-stone-50 p-1.5 px-2.5 rounded-lg cursor-pointer transition-colors border border-stone-200/60 dark:border-stone-700/60 shrink-0 select-none shadow-2xs">
                    <input
                      type="checkbox"
                      checked={showRoleDistribution}
                      onChange={(e) => {
                        setShowRoleDistribution(e.target.checked);
                        localStorage.setItem('sy_pref_show_role_distribution', String(e.target.checked));
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="whitespace-nowrap">Role Charts</span>
                  </label>

                  <label className="flex items-center gap-1.5 bg-white dark:bg-stone-800 hover:bg-stone-50 p-1.5 px-2.5 rounded-lg cursor-pointer transition-colors border border-stone-200/60 dark:border-stone-700/60 shrink-0 select-none shadow-2xs">
                    <input
                      type="checkbox"
                      checked={showMemberDemographics}
                      onChange={(e) => {
                        setShowMemberDemographics(e.target.checked);
                        localStorage.setItem('sy_pref_show_member_demographics', String(e.target.checked));
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className="whitespace-nowrap">Demographics</span>
                  </label>
                </div>
              )}
            </div>

            {currentTab === 'football' ? (
              !isFootballEnabled ? (
                <div className="bg-white dark:bg-stone-900 border border-stone-150 dark:border-stone-800 rounded-3xl p-8 md:p-12 text-center max-w-lg mx-auto shadow-sm my-8">
                  <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-200/50">
                    <Trophy className="w-8 h-8 text-amber-600 dark:text-amber-500" />
                  </div>
                  <h3 className="text-xl font-extrabold text-stone-900 dark:text-white mb-3">
                    Predictions Module Inactive
                  </h3>
                  <p className="text-stone-500 dark:text-stone-400 text-sm mb-6 leading-relaxed">
                    The Football Predictions module is currently disabled by administrators. Please check back later or contact your system administrator.
                  </p>
                  <button
                    onClick={() => setCurrentTab('directory')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    Go Back to Directory
                  </button>
                </div>
              ) : (
                <FootballModule 
                  currentUser={user} 
                  isFootballEnabled={isFootballEnabled}
                  onToggleFootballEnabled={setIsFootballEnabled}
                />
              )
            ) : currentTab === 'financials' && (isOBUser(user.role) || user.role === 'ECM') ? (
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
            ) : currentTab === 'prayer-requests' ? (
              !isPrayerRequestsEnabled ? (
                <div className="bg-white dark:bg-stone-900 border border-stone-150 dark:border-stone-800 rounded-3xl p-8 md:p-12 text-center max-w-lg mx-auto shadow-sm my-8">
                  <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-200/50">
                    <Heart className="w-8 h-8 text-rose-600 dark:text-rose-500 fill-rose-600 dark:fill-rose-500" />
                  </div>
                  <h3 className="text-xl font-extrabold text-stone-900 dark:text-white mb-3">
                    Prayer Requests Module Inactive
                  </h3>
                  <p className="text-stone-500 dark:text-stone-400 text-sm mb-6 leading-relaxed">
                    The Prayer Requests module is currently disabled by administrators. Please check back later or contact your system administrator.
                  </p>
                  <button
                    onClick={() => setCurrentTab('directory')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    Go Back to Directory
                  </button>
                </div>
              ) : (
                <PrayerRequestsPage currentUser={user} />
              )
            ) : currentTab === 'calling' ? (
              !isCallingEnabled ? (
                <div className="bg-white dark:bg-stone-900 border border-stone-150 dark:border-stone-800 rounded-3xl p-8 md:p-12 text-center max-w-lg mx-auto shadow-sm my-8">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-200/50">
                    <PhoneCall className="w-8 h-8 text-blue-600 dark:text-blue-500" />
                  </div>
                  <h3 className="text-xl font-extrabold text-stone-900 dark:text-white mb-3">
                    Calling Services Module Inactive
                  </h3>
                  <p className="text-stone-500 dark:text-stone-400 text-sm mb-6 leading-relaxed">
                    Voice & Video Calling services and call history features are currently disabled by administrators. Please check back later or contact your system administrator.
                  </p>
                  <button
                    onClick={() => setCurrentTab('directory')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    Go Back to Directory
                  </button>
                </div>
              ) : (
                <CallHistoryPage />
              )
            ) : (currentTab === 'admin-control' || currentTab === 'birthday-tasks' || currentTab === 'meta-settings') && (isOBUser(user.role) || user?.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || user?.email?.toLowerCase() === 'tkpaite2016@gmail.com') ? (
              <AdminControlPage
                currentUser={user}
                members={members}
                onOpenProvisionModal={() => setAddNewMemberOpen(true)}
                onOpenSQLModal={() => setIsSQLModalOpen(true)}
                onOpenBialModal={() => setIsBialDiagnosticOpen(true)}
                onOpenRetentionModal={() => setIsRetentionModalOpen(true)}
                onRefresh={loadDatabase}
                setLogs={setLogs}
                isFootballEnabled={isFootballEnabled}
                setIsFootballEnabled={setIsFootballEnabled}
                isPrayerRequestsEnabled={isPrayerRequestsEnabled}
                setIsPrayerRequestsEnabled={setIsPrayerRequestsEnabled}
                isCallingEnabled={isCallingEnabled}
                setIsCallingEnabled={setIsCallingEnabled}
                membersCount={totalCount}
                pendingCount={pendingCount}
              />
            ) : (
              <>
                {/* Quick overview metrics Grid */}
            {showQuickMetrics && (
              <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5 lg:gap-4">
                
                <div className="bg-white dark:bg-stone-900 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-1.5 transition-all">
                  <div className="flex items-center justify-between text-stone-400 dark:text-stone-500">
                    <span className="text-[9px] sm:text-[10px] uppercase font-extrabold tracking-wider truncate">Total Members</span>
                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">{totalCount}</div>
                    <p className="text-[9px] sm:text-[10px] text-emerald-600 font-medium truncate">Registered in database</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-stone-900 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-1.5 transition-all">
                  <div className="flex items-center justify-between text-stone-400 dark:text-stone-500">
                    <span className="text-[9px] sm:text-[10px] uppercase font-extrabold tracking-wider truncate">Approved Active</span>
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 shrink-0"></div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">{approvedCount}</div>
                    <p className="text-[9px] sm:text-[10px] text-stone-400 font-medium truncate">{Math.round((approvedCount/totalCount)*100 || 0)}% cleared</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-stone-900 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-1.5 transition-all">
                  <div className="flex items-center justify-between text-stone-400 dark:text-stone-500">
                    <span className="text-[9px] sm:text-[10px] uppercase font-extrabold tracking-wider truncate">Review Pending</span>
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-amber-400 rounded-full animate-ping shrink-0"></div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">{pendingCount}</div>
                    <p className="text-[9px] sm:text-[10px] text-stone-400 font-medium truncate">Require approvals</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-stone-900 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-1.5 transition-all">
                  <div className="flex items-center justify-between text-stone-400 dark:text-stone-500">
                    <span className="text-[9px] sm:text-[10px] uppercase font-extrabold tracking-wider truncate">Leader / OB</span>
                    <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">{obCount}</div>
                    <p className="text-[9px] sm:text-[10px] text-stone-400 font-medium truncate">Admin & Leaders</p>
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1 bg-white dark:bg-stone-900 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-2xs space-y-1.5 relative group overflow-visible transition-all">
                  <div className="flex items-center justify-between text-stone-400 dark:text-stone-500">
                    <span className="text-[9px] sm:text-[10px] uppercase font-extrabold tracking-wider truncate">Online Now</span>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-green-500"></span>
                      </span>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white flex items-baseline gap-1.5">
                      {onlineUserIds.length}
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-stone-400 font-medium truncate">
                      {onlineUserIds.length === 1 ? '1 active user' : `${onlineUserIds.length} active users`}
                    </p>
                  </div>

                  {onlineUserIds.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 hidden group-hover:block bg-stone-900 text-white text-[10px] p-2.5 rounded-xl shadow-xl border border-stone-800 z-30 max-h-48 overflow-y-auto w-52 font-medium">
                      <p className="font-extrabold border-b border-stone-800 pb-1.5 mb-1.5 text-stone-400">Active Members:</p>
                      <div className="space-y-1">
                        {onlineUserIds.map(id => {
                          const mb = members.find(m => m.id === id);
                          return (
                            <div key={id} className="flex items-center gap-1.5 text-stone-200">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0 animate-pulse" />
                              <span className="truncate">{mb ? mb.name : (id === user?.id ? 'You' : 'Anonymous')}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

              </section>
            )}

            {/* Member Demographics & Analytics Charts Section */}
            <MemberDemographicsSection
              members={members}
              currentUser={user}
              isCurrentUserAdmin={isCurrentUserAdmin}
              showRoleDistribution={showRoleDistribution}
              showMemberDemographics={showMemberDemographics}
              roleDistributionData={roleDistributionData}
              statusDistributionData={statusDistributionData}
              setAddNewMemberOpen={setAddNewMemberOpen}
              setIsSQLModalOpen={setIsSQLModalOpen}
              setIsBialDiagnosticOpen={setIsBialDiagnosticOpen}
              isFootballEnabled={isFootballEnabled}
              setIsFootballEnabled={setIsFootballEnabled}
              isPrayerRequestsEnabled={isPrayerRequestsEnabled}
              setIsPrayerRequestsEnabled={setIsPrayerRequestsEnabled}
              isCallingEnabled={isCallingEnabled}
              setIsCallingEnabled={setIsCallingEnabled}
            />

            {/* Core Member Lookup Spreadsheet table */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-stone-900 dark:text-white">Shalom Youth Registration Directory</h3>
                  <p className="text-xs text-stone-400">Search, filter, and manage organizational members</p>
                </div>
                <button
                  onClick={() => loadDatabase()}
                  disabled={isTestingConnection}
                  className="p-1.5 px-3 bg-white dark:bg-stone-850 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white border border-stone-200 dark:border-stone-750 rounded-xl transition-all cursor-pointer text-xs font-semibold flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
                  title="Automatic database background synchronization"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin text-emerald-600 dark:text-emerald-400' : ''}`} />
                  <span>{isTestingConnection ? 'Syncing...' : 'Sync Database'}</span>
                </button>
              </div>

              <MemberTable
                members={members}
                onUpdateRoleAndStatus={handleUpdateRoleAndStatus}
                onDeleteMember={handleDeleteMember}
                onBatchApproveMembers={handleBatchApproveMembers}
                onBatchDeleteMembers={handleBatchDeleteMembers}
                onBulkAssignBial={handleBulkAssignBial}
                onOpenProfile={(member, editMode) => {
                  setSelectedProfileMember(member);
                  setProfileEditMode(!!editMode);
                }}
                isCurrentUserAdmin={isCurrentUserAdmin}
                onlineUserIds={onlineUserIds}
                initialStatusFilter={directoryStatusFilter}
              />
            </section>
              </>
            )}
          </>
        ) : null}

        {/* Dynamic informational support block */}
        <section className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-emerald-200 p-6 sm:p-7 rounded-3xl border border-emerald-800/80 shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            
            {/* Guidelines Text */}
            <div className="space-y-2 flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase tracking-wider">
                  Community Standards
                </span>
                <span className="text-[10px] text-emerald-300/80 font-bold">
                  v2.4 Mobile Release
                </span>
              </div>
              <h4 className="font-extrabold text-white text-base sm:text-lg tracking-tight">
                Shalom Youth Org Guidelines
              </h4>
              <p className="text-xs leading-relaxed text-emerald-200/90 max-w-3xl">
                Shalom Youth acts with deep spiritual commitment and active community service. Under Officer Bearer (OB) management directions, we verify every member's role (standard, Executive Committee (ECM), or Leader OB roles) to foster clean collaboration and trust.
              </p>
            </div>

            {/* Need Assisting Help Card */}
            <div className="flex items-center gap-3.5 bg-white/10 dark:bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/10 shrink-0 w-full lg:w-auto">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div className="text-xs text-left">
                <p className="font-extrabold text-white">Need Assisting Help?</p>
                <p className="text-[11px] text-emerald-300 font-medium">
                  Contact Admin: tkpaite2016@gmail.com
                </p>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* Footer */}
      <AppFooter onOpenDownloadModal={() => setIsDownloadModalOpen(true)} />

      {/* Download Mobile App Modal */}
      <DownloadAppModal 
        isOpen={isDownloadModalOpen} 
        onClose={() => setIsDownloadModalOpen(false)} 
      />

      {/* SQL script Copy tool */}
      <SQLSetupModal isOpen={isSQLModalOpen} onClose={() => setIsSQLModalOpen(false)} />

      {/* Bial Assignment Diagnostic Tool Modal */}
      <BialDiagnosticModal 
        isOpen={isBialDiagnosticOpen} 
        onClose={() => setIsBialDiagnosticOpen(false)} 
        members={members} 
        onRefresh={loadDatabase} 
      />

      {/* Message Retention Policy Modal */}
      {isRetentionModalOpen && (
        <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in text-left">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5" />
                <h3 className="font-extrabold text-base tracking-tight">Message Retention Policy</h3>
              </div>
              <button
                onClick={() => setIsRetentionModalOpen(false)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 text-left">
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                As an Admin, you can configure an automated cleanup schedule to automatically prune older messages from the Fellowship Chat. This helps optimize database size and keeps loading speeds snappy.
              </p>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                  Delete Messages Older Than:
                </label>
                <select
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-250 dark:border-stone-800 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 dark:text-stone-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 cursor-pointer"
                >
                  <option value={0}>Disabled (Keep All Messages Forever)</option>
                  <option value={3}>3 Days</option>
                  <option value={7}>7 Days (1 Week)</option>
                  <option value={14}>14 Days (2 Weeks)</option>
                  <option value={30}>30 Days (1 Month)</option>
                  <option value={90}>90 Days (3 Months)</option>
                </select>
              </div>

              {/* Notice Banner */}
              <div className="bg-indigo-50/50 dark:bg-indigo-950/25 border border-indigo-100/40 dark:border-indigo-900/30 rounded-xl p-3 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-left">
                  <h4 className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300">Pinned Messages are Safe!</h4>
                  <p className="text-[10px] text-indigo-700/80 dark:text-indigo-400/80 leading-normal">
                    Important announcements that are marked as <strong>Pinned</strong> will never be deleted, even if they exceed the selected retention period.
                  </p>
                </div>
              </div>

              {/* Status Section */}
              <div className="bg-stone-50 dark:bg-stone-950 rounded-xl p-3.5 border border-stone-150 dark:border-stone-800 space-y-1.5 text-[11px] select-none">
                <div className="flex justify-between">
                  <span className="text-stone-400">Current Policy:</span>
                  <span className="font-extrabold text-stone-700 dark:text-stone-300">
                    {retentionDays > 0 ? `Delete messages older than ${retentionDays} days` : 'Disabled (No retention policy)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Last Background Run:</span>
                  <span className="font-semibold text-stone-700 dark:text-stone-300">
                    {lastCleanupRun ? new Date(lastCleanupRun).toLocaleString() : 'Never'}
                  </span>
                </div>
              </div>

              {/* Feedback Alert */}
              {cleanupFeedback && (
                <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs font-bold leading-normal animate-fade-in ${
                  cleanupFeedback.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400' 
                    : 'bg-rose-50 border-rose-250 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400'
                }`}>
                  <div className="shrink-0 mt-0.5">
                    {cleanupFeedback.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                    )}
                  </div>
                  <span>{cleanupFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="bg-stone-50 dark:bg-stone-950 px-5 py-4 border-t border-stone-150 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 text-left">
              <button
                type="button"
                onClick={handleRunCleanupNow}
                disabled={isCleaningUp || retentionDays <= 0}
                className="px-4 py-2 text-xs font-extrabold text-violet-700 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-250 hover:bg-violet-50 dark:hover:bg-violet-950/30 border border-violet-100 dark:border-violet-900/30 rounded-xl transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center gap-1.5"
              >
                {isCleaningUp ? 'Running...' : 'Run Cleanup Now'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRetentionModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRetentionPolicy}
                  disabled={isCleaningUp}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {isCleaningUp ? 'Saving...' : 'Save Policy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              className={`group flex items-center justify-center bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white p-4 rounded-full shadow-2xl hover:shadow-[0_15px_30px_rgba(99,102,241,0.5)] border border-indigo-400/30 transition-all transform hover:scale-110 active:scale-95 cursor-pointer relative animate-fade-in ${
                threadAlerts.length > 0 && !isChatOpen
                  ? 'ring-4 ring-indigo-500 dark:ring-indigo-400 animate-pulse shadow-[0_0_25px_rgba(99,102,241,0.7)]'
                  : ''
              }`}
              title="Open Global Fellowship Chat 💬"
            >
              <MessageSquare className="w-6 h-6 animate-pulse" />
              {unreadChatCount > 0 && !isChatOpen && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                  {unreadChatCount}
                </span>
              )}
              {threadAlerts.length > 0 && !isChatOpen && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-stone-900 font-extrabold text-[8px] px-1.5 py-0.5 rounded-full border border-white animate-bounce shadow-md">
                  New Reply
                </span>
              )}
            </button>
          </div>

          {/* Chat Window Panel */}
          {isChatOpen && !activeThreadParent && (
            <div className={`fixed inset-0 sm:inset-auto sm:right-6 sm:bottom-24 z-50 w-full sm:w-[380px] h-full sm:h-[550px] sm:max-h-[75vh] flex flex-col bg-white dark:bg-stone-900 rounded-none sm:rounded-2xl overflow-hidden animate-scale-up ${
              threadAlerts.length > 0
                ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.45)] border border-indigo-400/50'
                : 'shadow-2xl border-0 sm:border border-stone-200 dark:border-stone-800'
            }`}>
              {showSavedMessagesView ? (
                <>
                  {/* Saved Messages Header */}
                  <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 px-4 py-3 text-white flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        onClick={() => setShowSavedMessagesView(false)}
                        className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white flex items-center justify-center shrink-0"
                        title="Back to Global Chat"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-xs sm:text-sm tracking-tight flex items-center gap-1.5 truncate">
                          <Bookmark className="w-4 h-4 fill-amber-200 text-amber-100 shrink-0" />
                          <span>Saved Messages</span>
                        </h3>
                        <p className="text-[9px] text-amber-100 font-medium truncate">Personal bookmarks ({savedMessageIds.length})</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowSavedMessagesView(false);
                        setIsChatOpen(false);
                      }}
                      className="text-white/80 hover:text-white transition-colors text-xs font-bold p-1 bg-white/10 hover:bg-white/20 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer border border-white/10 shrink-0"
                      title="Close Chat"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Saved Messages List Body */}
                  <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-stone-50/50 dark:bg-stone-950/20 animate-fade-in">
                    {(() => {
                      const savedList = chatMessages.filter(m => savedMessageIds.includes(m.id));
                      if (savedList.length === 0) {
                        return (
                          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 my-auto">
                            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl shadow-xs">
                              <Bookmark className="w-6 h-6 fill-amber-500/20" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-black text-stone-700 dark:text-stone-300">No Saved Messages Yet</p>
                              <p className="text-[10px] text-stone-400 dark:text-stone-500 max-w-[220px] leading-relaxed mx-auto">
                                Click <span className="font-bold text-amber-600 dark:text-amber-400">Save</span> on any chat message to bookmark important announcements, verses, or notes for yourself.
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                              <span>🔖 Your Saved Items ({savedList.length})</span>
                            </span>
                            <button
                              onClick={() => {
                                if (window.confirm("Are you sure you want to clear all your saved messages?")) {
                                  setSavedMessageIds([]);
                                  if (user?.id) localStorage.removeItem(`sy_saved_messages_${user.id}`);
                                }
                              }}
                              className="text-[9px] font-bold text-stone-400 hover:text-rose-600 dark:text-stone-500 dark:hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Clear All</span>
                            </button>
                          </div>

                          {savedList.map((msg) => {
                            const senderMember = members.find((m) => m.id === msg.user_id);
                            const avatarUrl = getCleanAvatar(senderMember?.avatar) || msg.user_avatar || (senderMember ? getDefaultAvatar(senderMember.gender) : '');
                            const isOwn = msg.user_id === user.id;

                            return (
                              <div
                                key={`saved-${msg.id}`}
                                className="bg-white dark:bg-stone-850 p-3 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs hover:border-amber-300 dark:hover:border-amber-800 transition-all space-y-2 group text-left"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-stone-200 dark:border-stone-700 flex items-center justify-center bg-violet-600 text-white text-[9px] font-black">
                                      {avatarUrl ? (
                                        <img src={avatarUrl} alt={msg.user_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      ) : (
                                        msg.user_name ? msg.user_name.charAt(0).toUpperCase() : '?'
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-black text-stone-800 dark:text-stone-200 truncate leading-tight">
                                        {isOwn ? 'You' : msg.user_name}
                                      </p>
                                      <p className="text-[8.5px] text-stone-400 dark:text-stone-500 font-mono">
                                        {formatTimeAgo(msg.created_at)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => {
                                        setShowSavedMessagesView(false);
                                        if (msg.parent_id) {
                                          const parentMsg = chatMessages.find(m => m.id === msg.parent_id);
                                          if (parentMsg) {
                                            setActiveThreadParent(parentMsg);
                                          }
                                        }
                                        setTimeout(() => {
                                          const el = document.querySelector(`[data-message-id="${msg.id}"]`);
                                          if (el) {
                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            el.classList.add('ring-2', 'ring-amber-400', 'scale-102');
                                            setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400', 'scale-102'), 2000);
                                          }
                                        }, 150);
                                      }}
                                      className="px-2 py-1 rounded-md bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 text-amber-800 dark:text-amber-300 text-[9.5px] font-black transition-all flex items-center gap-1 cursor-pointer"
                                      title="Jump to message in chat"
                                    >
                                      <span>Jump</span>
                                    </button>

                                    <button
                                      onClick={() => handleToggleSaveMessage(msg.id)}
                                      className="p-1 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:text-stone-500 dark:hover:text-rose-400 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                      title="Remove from saved messages"
                                    >
                                      <BookmarkX className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="text-xs text-stone-700 dark:text-stone-300 font-medium break-words leading-relaxed pl-2 border-l-2 border-amber-400/60 dark:border-amber-500/50 my-1">
                                  {renderFormattedMessage(msg.message)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <>
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
                              setShowSavedMessagesView(true);
                              setIsChatHeaderMenuOpen(false);
                            }}
                            className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:text-stone-900 transition-colors flex items-center justify-between cursor-pointer border-b border-stone-100 dark:border-stone-800"
                          >
                            <div className="flex items-center gap-2">
                              <Bookmark className="w-3.5 h-3.5 text-amber-500 shrink-0 fill-amber-500/20" />
                              <span>Saved Messages</span>
                            </div>
                            {savedMessageIds.length > 0 && (
                              <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-amber-200/50">
                                {savedMessageIds.length}
                              </span>
                            )}
                          </button>

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

                          <div className="px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300 border-b border-stone-100 dark:border-stone-800 select-none">
                            <div className="flex items-center gap-2">
                              <ChevronsDown className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span>Auto-Scroll Chat</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newVal = !autoScrollChat;
                                setAutoScrollChat(newVal);
                                localStorage.setItem('sy_chat_auto_scroll', String(newVal));
                              }}
                              className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer outline-none shrink-0 ${
                                autoScrollChat ? 'bg-violet-600' : 'bg-stone-300 dark:bg-stone-700'
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform shadow-xs ${
                                  autoScrollChat ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>

                          {isCurrentUserAdmin && (
                            <button
                              onClick={() => {
                                setIsRetentionModalOpen(true);
                                setIsChatHeaderMenuOpen(false);
                              }}
                              className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:text-stone-900 transition-colors flex items-center gap-2 cursor-pointer border-b border-stone-100 dark:border-stone-800"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                              <span>Message Retention Policy</span>
                            </button>
                          )}

                          <button
                            onClick={handleClearChatHistory}
                            className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-700 transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Clear Chat History</span>
                          </button>
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
                          Welcome, {user ? (user.display_name || user.name).split(' ')[0] : 'Fellow'}! 👋
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

              {/* Pinned Announcements Panel */}
              {(() => {
                const pinnedMessages = chatMessages.filter(m => m.is_pinned && !m.parent_id);
                if (pinnedMessages.length === 0) return null;
                return (
                  <div className="bg-amber-50/90 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/30 p-2.5 space-y-2 z-10 shadow-xs max-h-[160px] overflow-y-auto">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider select-none">
                      <Pin className="w-3.5 h-3.5 fill-amber-500 stroke-amber-700 animate-pulse" />
                      <span>Pinned Announcements ({pinnedMessages.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {pinnedMessages.map((pMsg) => (
                        <div key={`pinned-${pMsg.id}`} className="bg-white/80 dark:bg-stone-850/60 p-2 rounded-xl border border-amber-100/50 dark:border-amber-950/40 shadow-xxs flex items-start justify-between gap-2 transition-all hover:bg-white dark:hover:bg-stone-850">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 select-none">
                              <span className="text-[9px] font-extrabold text-stone-700 dark:text-stone-300">
                                {pMsg.user_name}
                              </span>
                              <span className="text-[8px] text-stone-400 dark:text-stone-500 font-medium">
                                • {formatTimeAgo(pMsg.created_at)}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-stone-850 dark:text-stone-150 font-medium break-words leading-relaxed line-clamp-3">
                              {renderFormattedMessage(pMsg.message)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                const msgElement = document.querySelector(`[data-message-id="${pMsg.id}"]`);
                                if (msgElement) {
                                  msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  msgElement.classList.add('ring-2', 'ring-amber-400', 'scale-102');
                                  setTimeout(() => {
                                    msgElement.classList.remove('ring-2', 'ring-amber-400', 'scale-102');
                                  }, 2000);
                                }
                              }}
                              className="px-1.5 py-0.5 rounded bg-amber-100/50 hover:bg-amber-150 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-400 transition-all text-[9px] font-black cursor-pointer uppercase select-none"
                              title="Jump to message in chat"
                            >
                              Jump
                            </button>
                            {isCurrentUserAdmin && (
                              <button
                                onClick={() => handleTogglePinMessage(pMsg.id, true)}
                                className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:text-stone-500 dark:hover:text-rose-400 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                                title="Unpin Announcement"
                              >
                                <PinOff className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Message List */}
              <div ref={chatScrollContainerRef} className="flex-1 overflow-y-auto p-2.5 space-y-2 bg-stone-50/50 dark:bg-stone-950/20 animate-fade-in">
                {chatMessages.filter(m => !m.parent_id).length === 0 ? (
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
                      const mainChatMessages = chatMessages.filter(m => !m.parent_id);
                      return mainChatMessages.map((msg) => {
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
                        const avatarUrl = getCleanAvatar(senderMember?.avatar) || msg.user_avatar || (senderMember ? getDefaultAvatar(senderMember.gender) : '');
                        const isDeleted = msg.message === "This message was deleted";
                        const repliesCount = chatMessages.filter(m => m.parent_id === msg.id).length;
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
                              className={`flex items-start gap-2 max-w-full min-w-0 ${
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
                          <div className={`flex flex-col max-w-[80%] min-w-0 relative ${isOwnMessage ? 'items-start' : 'items-end'}`}>
                            {/* Sender Name */}
                            {!isOwnMessage && (
                              <span className="text-[9px] text-stone-400 dark:text-stone-500 font-bold mb-0.5 px-1 flex items-center gap-1.5 max-w-[150px] truncate">
                                <span className="truncate">{msg.user_name}</span>
                                <span 
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    onlineUserIds.includes(msg.user_id) 
                                      ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' 
                                      : 'bg-stone-300 dark:bg-stone-700'
                                  }`}
                                  title={onlineUserIds.includes(msg.user_id) ? "Online" : "Offline"}
                                />
                              </span>
                            )}
                            {isOwnMessage && (
                              <span className="text-[9px] text-stone-400 dark:text-stone-500 font-bold mb-0.5 px-1 flex items-center gap-1.5 max-w-[150px] truncate">
                                <span className="truncate">You</span>
                                <span 
                                  className="w-1.5 h-1.5 rounded-full shrink-0 bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
                                  title="Online"
                                />
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
                                className={`px-3 py-1.5 text-xs shadow-xs leading-snug transition-all cursor-pointer select-none active:scale-98 max-w-full min-w-0 overflow-hidden break-words [overflow-wrap:anywhere] [word-break:break-word] ${
                                  isOwnMessage
                                    ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-2xl rounded-tl-none'
                                    : 'bg-white dark:bg-stone-850 text-stone-850 dark:text-stone-150 rounded-2xl rounded-tr-none border border-stone-100 dark:border-stone-800'
                                }`}
                                title="Hold or right-click to react"
                              >
                                <div className="break-words [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap font-medium text-left min-w-0 max-w-full">
                                  {renderFormattedMessage(msg.message, isOwnMessage)}
                                </div>
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

                                 <div className="w-px h-4 bg-stone-200 dark:bg-stone-700 mx-1 shrink-0" />
                                 <button
                                   type="button"
                                   onClick={() => {
                                     handleToggleSaveMessage(msg.id);
                                     setActiveReactionMsgId(null);
                                   }}
                                   className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                                     savedMessageIds.includes(msg.id)
                                       ? 'text-amber-500 hover:text-stone-500 dark:text-amber-400 dark:hover:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-850 bg-amber-50 dark:bg-amber-950/20'
                                       : 'text-stone-500 hover:text-amber-500 dark:text-stone-400 dark:hover:text-amber-400 hover:bg-stone-100 dark:hover:bg-stone-850'
                                   }`}
                                   title={savedMessageIds.includes(msg.id) ? "Remove from Saved Messages" : "Save / Bookmark Message"}
                                 >
                                   <Bookmark className={`w-3.5 h-3.5 ${savedMessageIds.includes(msg.id) ? 'fill-amber-500 text-amber-500' : ''}`} />
                                 </button>

                                 {(isOwnMessage || isCurrentUserAdmin) && (
                                   <>
                                     <div className="w-px h-4 bg-stone-200 dark:bg-stone-700 mx-1 shrink-0" />
                                     
                                     {isOwnMessage && (
                                       <>
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

                                     {isCurrentUserAdmin && (
                                       <button
                                         type="button"
                                         onClick={() => handleTogglePinMessage(msg.id, !!msg.is_pinned)}
                                         className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                                           msg.is_pinned 
                                             ? 'text-amber-500 hover:text-stone-500 dark:text-amber-400 dark:hover:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-850 bg-amber-50 dark:bg-amber-950/20'
                                             : 'text-stone-500 hover:text-amber-500 dark:text-stone-400 dark:hover:text-amber-400 hover:bg-stone-100 dark:hover:bg-stone-850'
                                         }`}
                                         title={msg.is_pinned ? "Unpin Announcement" : "Pin Announcement"}
                                       >
                                         {msg.is_pinned ? (
                                           <PinOff className="w-3.5 h-3.5" />
                                         ) : (
                                           <Pin className="w-3.5 h-3.5" />
                                         )}
                                       </button>
                                     )}
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
                               {!isDeleted && (
                                 <>
                                   <button type="button" onClick={() => setActiveThreadParent(msg)} className={`text-[9px] font-extrabold flex items-center gap-0.5 transition-colors cursor-pointer ml-1.5 ${threadAlerts.includes(msg.id) ? 'text-amber-500 hover:text-amber-600 dark:text-amber-400 font-black animate-pulse' : 'text-stone-400 hover:text-violet-600 dark:text-stone-500 dark:hover:text-violet-400'}`} title="Reply to message"><MessageSquare className={`w-2.5 h-2.5 shrink-0 ${threadAlerts.includes(msg.id) ? 'text-amber-500 fill-amber-500' : ''}`} /><span>Reply {threadAlerts.includes(msg.id) && '• New'}</span></button>

                                   <button
                                     type="button"
                                     onClick={() => handleToggleSaveMessage(msg.id)}
                                     className={`text-[9px] font-extrabold flex items-center gap-0.5 transition-colors cursor-pointer ml-1.5 ${
                                       savedMessageIds.includes(msg.id)
                                         ? 'text-amber-600 hover:text-amber-700 dark:text-amber-400 font-black'
                                         : 'text-stone-400 hover:text-amber-500 dark:text-stone-500 dark:hover:text-amber-400'
                                     }`}
                                     title={savedMessageIds.includes(msg.id) ? "Remove from Saved Messages" : "Save / Bookmark Message"}
                                   >
                                     <Bookmark className={`w-2.5 h-2.5 shrink-0 ${savedMessageIds.includes(msg.id) ? 'fill-amber-500 text-amber-500' : ''}`} />
                                     <span>{savedMessageIds.includes(msg.id) ? 'Saved' : 'Save'}</span>
                                   </button>
                                 </>
                               )}
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
                             {repliesCount > 0 && (
                               <button
                                 onClick={() => setActiveThreadParent(msg)}
                                 className={`mt-1 flex items-center gap-1.5 px-2 py-1 text-[10px] font-black rounded-lg border transition-all active:scale-95 cursor-pointer shadow-xxs ${
                                   threadAlerts.includes(msg.id)
                                     ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 dark:border-amber-900/30 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                     : 'bg-violet-50 hover:bg-violet-100 border-violet-100/40 dark:border-violet-900/30 dark:hover:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                                 }`}
                               >
                                 <MessageSquare className={`w-3 h-3 shrink-0 animate-pulse ${threadAlerts.includes(msg.id) ? 'text-amber-500 fill-amber-500' : 'text-violet-500'}`} />
                                 <span>{repliesCount} {repliesCount === 1 ? 'reply' : 'replies'}</span>
                                 {threadAlerts.includes(msg.id) && (
                                   <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></span>
                                 )}
                               </button>
                             )}
                             <div className="hidden">
                               {isOwnMessage && (
                                 <span className="hidden">
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
            </>
          )}
        </div>
      )}

          {/* Thread Panel View */}
          {isChatOpen && activeThreadParent && (
            <div className={`fixed inset-0 sm:inset-auto sm:right-6 sm:bottom-24 z-50 w-full sm:w-[380px] h-full sm:h-[550px] sm:max-h-[75vh] flex flex-col bg-white dark:bg-stone-900 rounded-none sm:rounded-2xl overflow-hidden animate-scale-up ${
              threadAlerts.length > 0
                ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.45)] border border-indigo-400/50'
                : 'shadow-2xl border-0 sm:border border-stone-200 dark:border-stone-800'
            }`}>
              {/* Thread Header */}
              <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-4 py-3 text-white flex items-center gap-3 shadow-md">
                <button
                  onClick={() => setActiveThreadParent(null)}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white flex items-center justify-center shrink-0"
                  title="Back to Global Chat"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-xs sm:text-sm tracking-tight truncate">Thread Discussion</h3>
                  <p className="text-[9px] text-indigo-100 font-medium truncate">Replying to {activeThreadParent.user_name}</p>
                </div>
                <button
                  onClick={() => {
                    setActiveThreadParent(null);
                    setIsChatOpen(false);
                  }}
                  className="text-white/80 hover:text-white transition-colors text-xs font-bold p-1 bg-white/10 hover:bg-white/20 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer border border-white/10"
                  title="Close Chat"
                >
                  ✕
                </button>
              </div>

              {/* Thread Messages List Container */}
              <div ref={threadScrollContainerRef} className="flex-1 overflow-y-auto p-3.5 space-y-4 bg-stone-50/50 dark:bg-stone-950/20 animate-fade-in">
                {/* Parent Message Card */}
                <div className="p-3 bg-violet-50/30 dark:bg-violet-950/10 rounded-xl border border-violet-100/40 dark:border-violet-900/10 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 border border-violet-200 shadow-xxs">
                      {(() => {
                        const parentSenderMember = members.find(m => m.id === activeThreadParent.user_id);
                        const parentAvatarUrl = getCleanAvatar(parentSenderMember?.avatar || activeThreadParent.user_avatar) || (parentSenderMember ? getDefaultAvatar(parentSenderMember.gender) : '');
                        return parentAvatarUrl ? (
                          <img
                            src={parentAvatarUrl}
                            alt={activeThreadParent.user_name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full text-[8px] font-black flex items-center justify-center bg-violet-600 text-white">
                            {activeThreadParent.user_name.charAt(0).toUpperCase()}
                          </div>
                        );
                      })()}
                    </div>
                    <span className="text-[10px] font-black text-violet-950 dark:text-violet-200">{activeThreadParent.user_name}</span>
                    <span className="text-[8px] text-stone-400 font-mono ml-auto">
                      {formatFullTimestamp(activeThreadParent.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-800 dark:text-stone-200 font-medium break-words leading-relaxed pl-1">
                    {renderFormattedMessage(activeThreadParent.message)}
                  </p>
                </div>

                <div className="flex items-center justify-between select-none px-1">
                  <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                    Replies
                  </span>
                  <div className="h-px bg-stone-200 dark:bg-stone-800 flex-1 ml-3"></div>
                </div>

                {/* List of Reply Messages */}
                {chatMessages.filter(m => m.parent_id === activeThreadParent.id).length === 0 ? (
                  <div className="py-8 text-center space-y-1.5 select-none">
                    <span className="text-xl block">💬</span>
                    <p className="text-[10px] text-stone-400 dark:text-stone-500 font-bold leading-normal">
                      No replies yet.<br/>Be the first to start the discussion!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chatMessages
                      .filter(m => m.parent_id === activeThreadParent.id)
                      .map((msg) => {
                        const isOwnReply = msg.user_id === user.id;
                        const senderMember = members.find((m) => m.id === msg.user_id);
                        const avatarUrl = getCleanAvatar(senderMember?.avatar) || msg.user_avatar || (senderMember ? getDefaultAvatar(senderMember.gender) : '');
                        const isDeleted = msg.message === "This message was deleted";
                        const isEditingReply = editingMsgId === msg.id;

                        return (
                          <div
                            key={msg.id}
                            data-message-id={msg.id}
                            className={`flex items-start gap-2 max-w-full min-w-0 ${
                              isOwnReply ? 'justify-start' : 'justify-end flex-row-reverse'
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
                                  isOwnReply ? 'bg-violet-600' : 'bg-emerald-600'
                                }`}>
                                  {msg.user_name ? msg.user_name.charAt(0).toUpperCase() : '?'}
                                </div>
                              )}
                            </div>

                            {/* Message Bubble Column */}
                            <div className={`flex flex-col max-w-[80%] min-w-0 relative ${isOwnReply ? 'items-start' : 'items-end'}`}>
                              {/* Sender Name */}
                              {!isOwnReply && (
                                <span className="text-[9px] text-stone-400 dark:text-stone-500 font-bold mb-0.5 px-1 flex items-center gap-1.5 max-w-[150px] truncate">
                                  <span className="truncate">{msg.user_name}</span>
                                  <span 
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      onlineUserIds.includes(msg.user_id) 
                                        ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' 
                                        : 'bg-stone-300 dark:bg-stone-700'
                                    }`}
                                    title={onlineUserIds.includes(msg.user_id) ? "Online" : "Offline"}
                                  />
                                </span>
                              )}
                              {isOwnReply && (
                                <span className="text-[9px] text-stone-400 dark:text-stone-500 font-bold mb-0.5 px-1 flex items-center gap-1.5 max-w-[150px] truncate">
                                  <span className="truncate">You</span>
                                  <span 
                                    className="w-1.5 h-1.5 rounded-full shrink-0 bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
                                    title="Online"
                                  />
                                </span>
                              )}

                              {/* Text bubble or Editing Block */}
                              {isEditingReply ? (
                                <div className="bg-white dark:bg-stone-850 p-1.5 rounded-2xl border border-violet-500 dark:border-violet-400 shadow-md flex flex-col gap-1 w-[200px] sm:w-[240px]">
                                  <textarea
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    className="w-full text-xs p-1.5 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 rounded focus:outline-none focus:ring-1 focus:ring-violet-500 border border-stone-200 dark:border-stone-850 resize-none font-medium leading-normal"
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
                                <div className={`px-3 py-1.5 text-xs bg-stone-100/80 dark:bg-stone-900/40 text-stone-400 dark:text-stone-500 rounded-2xl border border-stone-150/45 dark:border-stone-850/30 italic ${
                                  isOwnReply ? 'rounded-tl-none' : 'rounded-tr-none'
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
                                  className={`px-3 py-1.5 text-xs shadow-xs leading-snug transition-all cursor-pointer select-none active:scale-98 max-w-full min-w-0 overflow-hidden break-words [overflow-wrap:anywhere] [word-break:break-word] ${
                                    isOwnReply
                                      ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-2xl rounded-tl-none'
                                      : 'bg-white dark:bg-stone-850 text-stone-850 dark:text-stone-150 rounded-2xl rounded-tr-none border border-stone-100 dark:border-stone-800'
                                  }`}
                                  title="Hold or right-click to react"
                                >
                                  <div className="break-words [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap font-medium text-left min-w-0 max-w-full">
                                    {renderFormattedMessage(msg.message, isOwnReply)}
                                  </div>
                                </div>
                              )}

                              {/* Emoji Reaction Popover */}
                              {activeReactionMsgId === msg.id && !isDeleted && !isEditingReply && (
                                <div
                                  ref={activeReactionContainerRef}
                                  className={`absolute z-30 ${
                                    popoverDirection === 'up' ? '-top-11' : 'top-full mt-1.5'
                                  } flex items-center gap-1 bg-white dark:bg-stone-850 rounded-full shadow-2xl border border-stone-200 dark:border-stone-750 px-2 py-1.5 animate-scale-up ${
                                    isOwnReply ? 'left-0' : 'right-0'
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

                                  {isOwnReply && (
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

                              {/* Timing & Read Receipts */}
                              <div className={`flex items-center gap-1 mt-0.5 px-1 select-none ${isOwnReply ? 'justify-start' : 'justify-end'}`}>
                                <span className="text-[8px] text-stone-400 dark:text-stone-500 font-mono">
                                  {formatTimeAgo(msg.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
                <div ref={threadEndRef} />
              </div>

              {/* Thread Input Form */}
              <form
                onSubmit={handleSendReply}
                className="p-3 bg-white dark:bg-stone-900 border-t border-stone-150 dark:border-stone-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newReplyText}
                  onChange={(e) => setNewReplyText(e.target.value)}
                  placeholder="Reply to this thread..."
                  className="flex-1 bg-stone-50 dark:bg-stone-950/55 border border-stone-200 dark:border-stone-800 rounded-full px-4 py-2 text-xs text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-stone-400"
                  maxLength={500}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!newReplyText.trim() || isSendingReply}
                  className="bg-violet-600 hover:bg-violet-700 active:scale-95 text-white p-2 rounded-full cursor-pointer transition-all flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-md hover:shadow-indigo-500/20"
                  title="Send reply"
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

      {/* Custom Alert & Confirmation Dialog Modal */}
      {customDialog && customDialog.isOpen && (
        <div className="fixed inset-0 bg-stone-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] animate-fade-in">
          <div className="bg-white dark:bg-stone-900 border border-stone-150 dark:border-stone-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-scale-up space-y-4 text-center">
            <div className="w-14 h-14 bg-pink-50 dark:bg-pink-950/30 text-pink-500 dark:text-pink-400 rounded-2xl flex items-center justify-center mx-auto border border-pink-100/30 dark:border-pink-900/30">
              <Sparkles className="w-7 h-7 animate-pulse" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100 leading-tight">
                {customDialog.title}
              </h3>
              <p className="text-xs sm:text-sm text-stone-550 dark:text-stone-400 leading-relaxed font-medium">
                {customDialog.message}
              </p>
            </div>
            
            <div className="flex gap-3 pt-2">
              {customDialog.type === 'confirm' && (
                <button
                  type="button"
                  onClick={() => {
                    if (customDialog.onCancel) {
                      customDialog.onCancel();
                    } else {
                      setCustomDialog(null);
                    }
                  }}
                  className="flex-1 py-2.5 px-4 bg-stone-100 hover:bg-stone-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                >
                  {customDialog.cancelText || 'Cancel'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  customDialog.onConfirm();
                }}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 active:scale-98 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                {customDialog.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Global Command Palette & Search Modal */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        members={members}
        currentUser={user}
        onNavigateTab={(tab) => setCurrentTab(tab)}
        onSelectMember={(member) => {
          setCurrentTab('directory');
          setSelectedProfileMember(member);
        }}
        onOpenNewMember={() => setAddNewMemberOpen(true)}
        onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
        onToggleTheme={toggleTheme}
        theme={theme}
        onOpenSQLModal={() => setIsSQLModalOpen(true)}
        onOpenBialModal={() => setIsBialDiagnosticOpen(true)}
        onRefreshDatabase={loadDatabase}
      />

      {/* Keyboard Shortcuts Cheat Sheet Guide Modal */}
      <KeyboardShortcutsHelpModal
        isOpen={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenNewMember={() => setAddNewMemberOpen(true)}
        isAdmin={!!(user && (isOBUser(user.role) || user.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || user.email?.toLowerCase() === 'tkpaite2016@gmail.com'))}
      />

      {/* Manual Provisioning Modal (Direct Admin Member Registration) */}
      <ManualProvisionModal
        isOpen={addNewMemberOpen}
        onClose={() => setAddNewMemberOpen(false)}
        currentUser={user}
        onRefresh={loadDatabase}
        setLogs={setLogs}
      />

      {/* Dynamic Open Graph (OG) Inspector Modal */}
      <OgPreviewModal
        isOpen={isOgPreviewOpen}
        onClose={() => setIsOgPreviewOpen(false)}
        currentTab={currentTab}
      />

      {/* Real-time Voice & Video Call Overlays */}
      <IncomingCallModal />
      <ActiveCallModal />
    </div>
  );
}

export default function App() {
  return (
    <CustomDialogProvider>
      <AuthProvider>
        <CallingProvider>
          <AppContent />
        </CallingProvider>
      </AuthProvider>
    </CustomDialogProvider>
  );
}
