import React from 'react';
import { X, Keyboard, Search, UserPlus, Users, Calendar, Heart, FileText, Trophy, PhoneCall, ShieldCheck, Moon, Sun, ArrowRight, CornerDownLeft } from 'lucide-react';

export interface KeyboardShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCommandPalette: () => void;
  onOpenNewMember?: () => void;
  isAdmin: boolean;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'Global & Search' | 'Navigation' | 'Admin Controls';
}

export const KeyboardShortcutsHelpModal: React.FC<KeyboardShortcutsHelpModalProps> = ({
  isOpen,
  onClose,
  onOpenCommandPalette,
  onOpenNewMember,
  isAdmin
}) => {
  if (!isOpen) return null;

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts: ShortcutItem[] = [
    {
      keys: [modKey, 'K'],
      description: 'Open Command Palette & Global Search',
      category: 'Global & Search'
    },
    {
      keys: ['/'],
      description: 'Focus Search Bar (or open Command Palette)',
      category: 'Global & Search'
    },
    {
      keys: [modKey, '/'],
      description: 'Open Keyboard Shortcuts Cheat Sheet',
      category: 'Global & Search'
    },
    {
      keys: ['Esc'],
      description: 'Close active modal or clear search input',
      category: 'Global & Search'
    },
    {
      keys: [modKey, 'Shift', 'D'],
      description: 'Navigate to Members Directory',
      category: 'Navigation'
    },
    {
      keys: [modKey, 'Shift', 'S'],
      description: 'Navigate to Service Schedules',
      category: 'Navigation'
    },
    {
      keys: [modKey, 'Shift', 'R'],
      description: 'Navigate to Prayer Requests',
      category: 'Navigation'
    },
    {
      keys: [modKey, 'Shift', 'C'],
      description: 'Navigate to Voice & Video Calls',
      category: 'Navigation'
    },
    {
      keys: [modKey, 'Shift', 'P'],
      description: 'Navigate to Football Predictions',
      category: 'Navigation'
    }
  ];

  if (isAdmin) {
    shortcuts.push(
      {
        keys: [modKey, 'N'],
        description: 'Provision New Member (Admin Direct Registration)',
        category: 'Admin Controls'
      },
      {
        keys: [modKey, 'Shift', 'F'],
        description: 'Navigate to Financial Records',
        category: 'Navigation'
      },
      {
        keys: [modKey, 'Shift', 'A'],
        description: 'Navigate to Admin Control Center',
        category: 'Navigation'
      },
      {
        keys: [modKey, 'Shift', 'O'],
        description: 'Inspect Open Graph (OG) Image & Meta Health',
        category: 'Admin Controls'
      }
    );
  }

  const categories: Array<'Global & Search' | 'Navigation' | 'Admin Controls'> = [
    'Global & Search',
    'Navigation',
    'Admin Controls'
  ];

  return (
    <div
      className="fixed inset-0 bg-stone-950/65 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-[99995] animate-fade-in text-left"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-stone-900 w-full max-w-xl rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[85vh] my-auto transition-all animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
              <Keyboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                Keyboard Shortcuts Guide
              </h3>
              <p className="text-xs text-emerald-100 font-medium">
                Supercharge your workflow with instant hotkeys
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-emerald-100 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts Categories Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {categories.map((cat) => {
            const catShortcuts = shortcuts.filter((s) => s.category === cat);
            if (catShortcuts.length === 0) return null;

            return (
              <div key={cat} className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{cat}</span>
                </h4>

                <div className="grid grid-cols-1 gap-2.5">
                  {catShortcuts.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200/80 dark:border-stone-800/80 text-xs transition-all hover:border-emerald-300 dark:hover:border-emerald-800"
                    >
                      <span className="font-semibold text-stone-800 dark:text-stone-200">
                        {s.description}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 ml-3">
                        {s.keys.map((k, keyIdx) => (
                          <React.Fragment key={keyIdx}>
                            <kbd className="px-2 py-1 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono font-bold text-[11px] rounded-lg shadow-2xs border border-stone-200 dark:border-stone-700 min-w-[24px] text-center">
                              {k}
                            </kbd>
                            {keyIdx < s.keys.length - 1 && (
                              <span className="text-stone-400 font-bold">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-100/80 dark:bg-stone-950/80 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={() => {
              onClose();
              onOpenCommandPalette();
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <Search className="w-4 h-4" />
            <span>Try Command Palette ({modKey}+K)</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
