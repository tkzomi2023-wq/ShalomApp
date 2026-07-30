import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  User,
  Users,
  Calendar,
  Heart,
  FileText,
  Trophy,
  PhoneCall,
  ShieldCheck,
  UserPlus,
  Moon,
  Sun,
  Database,
  Keyboard,
  ArrowRight,
  X,
  Sparkles,
  SlidersHorizontal,
  RefreshCw,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';
import { Member, UserRole, isOBUser, DEFAULT_ADMIN_EMAIL, formatMemberName, getCleanAvatar, getDefaultAvatar } from '../types';
import { RoleBadge } from './RoleBadge';

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  currentUser: Member | null;
  onNavigateTab: (tab: 'directory' | 'financials' | 'schedule' | 'birthday-tasks' | 'meta-settings' | 'football' | 'prayer-requests' | 'calling' | 'admin-control') => void;
  onSelectMember: (member: Member) => void;
  onOpenNewMember: () => void;
  onOpenShortcutsHelp: () => void;
  onToggleTheme: () => void;
  theme: 'light' | 'dark';
  onOpenSQLModal?: () => void;
  onOpenBialModal?: () => void;
  onRefreshDatabase?: () => void;
}

interface PaletteItem {
  id: string;
  category: 'Members' | 'Navigation' | 'Actions';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  badge?: string;
  memberObj?: Member;
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  members,
  currentUser,
  onNavigateTab,
  onSelectMember,
  onOpenNewMember,
  onOpenShortcutsHelp,
  onToggleTheme,
  theme,
  onOpenSQLModal,
  onOpenBialModal,
  onRefreshDatabase
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const isMainAdmin = currentUser?.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || currentUser?.email?.toLowerCase() === 'tkpaite2016@gmail.com';
  const isAdminOrOB = currentUser && (isOBUser(currentUser.role) || isMainAdmin);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Build the list of available commands / search results
  const items: PaletteItem[] = [];

  const lowerQuery = query.trim().toLowerCase();

  // 1. Filter Members if query exists or top members if empty query
  if (lowerQuery) {
    const matchingMembers = members.filter((m) => {
      const name = (m.name || '').toLowerCase();
      const displayName = (m.display_name || '').toLowerCase();
      const username = (m.username || '').toLowerCase();
      const email = (m.email || '').toLowerCase();
      const phone = (m.phone || '').toLowerCase();
      const bial = (m.bial || '').toLowerCase();
      const blood = (m.blood_group || '').toLowerCase();

      return (
        name.includes(lowerQuery) ||
        displayName.includes(lowerQuery) ||
        username.includes(lowerQuery) ||
        email.includes(lowerQuery) ||
        phone.includes(lowerQuery) ||
        bial.includes(lowerQuery) ||
        blood.includes(lowerQuery)
      );
    }).slice(0, 6);

    matchingMembers.forEach((m) => {
      items.push({
        id: `member-${m.id}`,
        category: 'Members',
        title: formatMemberName(m.display_name || m.name, m.gender, m.marital_status),
        subtitle: `${m.email}${m.phone ? ` • ${m.phone}` : ''}${m.bial ? ` • Bial ${m.bial}` : ''}`,
        icon: (
          <div className="w-6 h-6 rounded-full overflow-hidden bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-[10px] flex items-center justify-center shrink-0 border border-emerald-300/50">
            {getCleanAvatar(m.avatar) || getDefaultAvatar(m.gender) ? (
              <img src={getCleanAvatar(m.avatar) || getDefaultAvatar(m.gender)} alt={m.name} className="w-full h-full object-cover" />
            ) : (
              m.name.charAt(0).toUpperCase()
            )}
          </div>
        ),
        badge: m.role,
        memberObj: m,
        action: () => {
          onSelectMember(m);
          onClose();
        }
      });
    });
  }

  // 2. Navigation items
  const navItems: PaletteItem[] = [
    {
      id: 'nav-directory',
      category: 'Navigation',
      title: 'Members Directory',
      subtitle: 'View, search, filter and manage all youth members',
      icon: <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      shortcut: `${modKey}+Shift+D`,
      action: () => {
        onNavigateTab('directory');
        onClose();
      }
    },
    {
      id: 'nav-schedule',
      category: 'Navigation',
      title: 'Service Schedules & Rosters',
      subtitle: 'Sabbath services, assignments and duty rosters',
      icon: <Calendar className="w-4 h-4 text-indigo-500" />,
      shortcut: `${modKey}+Shift+S`,
      action: () => {
        onNavigateTab('schedule');
        onClose();
      }
    },
    {
      id: 'nav-prayers',
      category: 'Navigation',
      title: 'Prayer Requests',
      subtitle: 'Community intercessions, praise reports and requests',
      icon: <Heart className="w-4 h-4 text-rose-500" />,
      shortcut: `${modKey}+Shift+R`,
      action: () => {
        onNavigateTab('prayer-requests');
        onClose();
      }
    },
    {
      id: 'nav-calling',
      category: 'Navigation',
      title: 'Voice & Video Calls / Call History',
      subtitle: 'Peer-to-peer youth calling and activity logs',
      icon: <PhoneCall className="w-4 h-4 text-teal-500" />,
      shortcut: `${modKey}+Shift+C`,
      action: () => {
        onNavigateTab('calling');
        onClose();
      }
    },
    {
      id: 'nav-football',
      category: 'Navigation',
      title: 'Football Predictions',
      subtitle: 'Match outcome forecasts and leaderboard',
      icon: <Trophy className="w-4 h-4 text-amber-500" />,
      shortcut: `${modKey}+Shift+P`,
      action: () => {
        onNavigateTab('football');
        onClose();
      }
    }
  ];

  if (isAdminOrOB) {
    navItems.push({
      id: 'nav-financials',
      category: 'Navigation',
      title: 'Financial Records',
      subtitle: 'Bial receipts, monthly logs and PDF exports',
      icon: <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      shortcut: `${modKey}+Shift+F`,
      action: () => {
        onNavigateTab('financials');
        onClose();
      }
    });

    navItems.push({
      id: 'nav-admin',
      category: 'Navigation',
      title: 'Admin Control Center',
      subtitle: 'Provisioning, SQL diagnostics, logs & system settings',
      icon: <ShieldCheck className="w-4 h-4 text-purple-500" />,
      shortcut: `${modKey}+Shift+A`,
      action: () => {
        onNavigateTab('admin-control');
        onClose();
      }
    });
  }

  // Filter navigation items by query
  navItems.forEach((item) => {
    if (
      !lowerQuery ||
      item.title.toLowerCase().includes(lowerQuery) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(lowerQuery))
    ) {
      items.push(item);
    }
  });

  // 3. Action items
  const actionItems: PaletteItem[] = [];

  if (isAdminOrOB) {
    actionItems.push({
      id: 'action-new-member',
      category: 'Actions',
      title: 'Provision New Member',
      subtitle: 'Manually register a new youth account',
      icon: <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      shortcut: `${modKey}+N`,
      action: () => {
        onOpenNewMember();
        onClose();
      }
    });
  }

  actionItems.push({
    id: 'action-shortcuts-help',
    category: 'Actions',
    title: 'Keyboard Shortcuts Cheat Sheet',
    subtitle: 'View all keyboard navigation shortcuts',
    icon: <Keyboard className="w-4 h-4 text-cyan-500" />,
    shortcut: `${modKey}+/`,
    action: () => {
      onOpenShortcutsHelp();
      onClose();
    }
  });

  actionItems.push({
    id: 'action-toggle-theme',
    category: 'Actions',
    title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
    subtitle: `Current theme: ${theme}`,
    icon: theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />,
    action: () => {
      onToggleTheme();
      onClose();
    }
  });

  if (isAdminOrOB && onOpenSQLModal) {
    actionItems.push({
      id: 'action-sql-diag',
      category: 'Actions',
      title: 'Database & SQL Diagnostics',
      subtitle: 'Inspect Supabase tables, repair missing columns & schema',
      icon: <Database className="w-4 h-4 text-indigo-400" />,
      action: () => {
        onOpenSQLModal();
        onClose();
      }
    });
  }

  if (isAdminOrOB && onOpenBialModal) {
    actionItems.push({
      id: 'action-bial-diag',
      category: 'Actions',
      title: 'Bial Discrepancy Diagnostics',
      subtitle: 'Resolve discrepancies between profile and financial records',
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      action: () => {
        onOpenBialModal();
        onClose();
      }
    });
  }

  if (onRefreshDatabase) {
    actionItems.push({
      id: 'action-refresh-db',
      category: 'Actions',
      title: 'Force Database Refresh',
      subtitle: 'Sync members, logs, and metadata live from Supabase',
      icon: <RefreshCw className="w-4 h-4 text-emerald-500" />,
      action: () => {
        onRefreshDatabase();
        onClose();
      }
    });
  }

  actionItems.forEach((item) => {
    if (
      !lowerQuery ||
      item.title.toLowerCase().includes(lowerQuery) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(lowerQuery))
    ) {
      items.push(item);
    }
  });

  // Keep selected index bounded
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (selectedIndex >= items.length) {
      setSelectedIndex(Math.max(0, items.length - 1));
    }
  }, [items.length]);

  // Handle keydown inside command palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (items.length > 0 ? (prev - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        items[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  // Group items by category for rendering
  const categories: Array<'Members' | 'Navigation' | 'Actions'> = ['Members', 'Navigation', 'Actions'];

  return (
    <div
      className="fixed inset-0 bg-stone-950/65 backdrop-blur-md flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4 z-[99990] animate-fade-in text-left"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-stone-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[80vh] transition-all animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="p-4 bg-stone-50/80 dark:bg-stone-950/80 border-b border-stone-200 dark:border-stone-800 flex items-center gap-3 shrink-0">
          <Search className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search members, pages, actions..."
            className="flex-1 bg-transparent text-sm sm:text-base text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none font-medium"
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-md border border-stone-300 dark:border-stone-700">
            Esc to close
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-4 divide-y divide-stone-100 dark:divide-stone-800/50">
          {items.length === 0 ? (
            <div className="py-12 text-center text-stone-400 dark:text-stone-500 space-y-2">
              <HelpCircle className="w-8 h-8 mx-auto opacity-50 text-stone-400" />
              <p className="text-sm font-semibold">No results found for "{query}"</p>
              <p className="text-xs text-stone-400">Try searching for a member's name, email, or a tab like "Directory".</p>
            </div>
          ) : (
            categories.map((cat) => {
              const catItems = items.filter((item) => item.category === cat);
              if (catItems.length === 0) return null;

              return (
                <div key={cat} className="pt-2 first:pt-0 space-y-1">
                  <div className="px-3 py-1 text-[10px] uppercase font-black tracking-wider text-stone-400 dark:text-stone-500">
                    {cat}
                  </div>

                  <div className="space-y-1">
                    {catItems.map((item) => {
                      const globalIndex = items.findIndex((i) => i.id === item.id);
                      const isSelected = globalIndex === selectedIndex;

                      return (
                        <div
                          key={item.id}
                          onClick={item.action}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={`w-full text-left px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-3 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-md'
                              : 'hover:bg-stone-100 dark:hover:bg-stone-800/70 text-stone-800 dark:text-stone-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`}>
                              {item.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs sm:text-sm font-extrabold truncate ${isSelected ? 'text-white' : 'text-stone-900 dark:text-white'}`}>
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                    isSelected
                                      ? 'bg-white/20 text-white'
                                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                  }`}>
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              {item.subtitle && (
                                <p className={`text-[11px] truncate font-medium ${isSelected ? 'text-emerald-100' : 'text-stone-500 dark:text-stone-400'}`}>
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {item.shortcut && (
                              <kbd className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                                isSelected
                                  ? 'bg-white/20 text-white border-white/30'
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700'
                              }`}>
                                {item.shortcut}
                              </kbd>
                            )}
                            <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-white translate-x-0.5' : 'text-stone-400 opacity-0 group-hover:opacity-100'} transition-all`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer / Shortcuts Tips */}
        <div className="p-3 bg-stone-100/80 dark:bg-stone-950/80 border-t border-stone-200 dark:border-stone-800 text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700 font-mono text-[9px] font-bold">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700 font-mono text-[9px] font-bold">↓</kbd>
              <span className="ml-0.5">Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700 font-mono text-[9px] font-bold">↵</kbd>
              <span>Select</span>
            </span>
          </div>
          <button
            onClick={onOpenShortcutsHelp}
            className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>All Shortcuts ({modKey}+/)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
