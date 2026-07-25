import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, Info, CheckCircle2, ShieldAlert, X } from 'lucide-react';

export interface DialogOptions {
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
}

interface InternalDialogState extends DialogOptions {
  isOpen: boolean;
  isConfirm: boolean;
  resolve: (value: any) => void;
}

interface CustomDialogContextType {
  showConfirm: (options: DialogOptions) => Promise<boolean>;
  showAlert: (options: DialogOptions) => Promise<void>;
}

const CustomDialogContext = createContext<CustomDialogContextType | undefined>(undefined);

export const useCustomDialog = () => {
  const context = useContext(CustomDialogContext);
  if (!context) {
    throw new Error('useCustomDialog must be used within a CustomDialogProvider');
  }
  return context;
};

// Global ref helper so non-React/outside-hook contexts can also trigger custom dialogs if needed
let globalShowConfirm: ((options: DialogOptions) => Promise<boolean>) | null = null;
let globalShowAlert: ((options: DialogOptions) => Promise<void>) | null = null;

export const customConfirm = (options: DialogOptions): Promise<boolean> => {
  if (globalShowConfirm) {
    return globalShowConfirm(options);
  }
  // Fallback to native window.confirm if context isn't mounted
  return Promise.resolve(window.confirm(`${options.title}\n\n${options.message}`));
};

export const customAlert = (options: DialogOptions): Promise<void> => {
  if (globalShowAlert) {
    return globalShowAlert(options);
  }
  window.alert(`${options.title}\n\n${options.message}`);
  return Promise.resolve();
};

export const CustomDialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialogState, setDialogState] = useState<InternalDialogState | null>(null);

  const showConfirm = useCallback((options: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        ...options,
        isOpen: true,
        isConfirm: true,
        resolve,
      });
    });
  }, []);

  const showAlert = useCallback((options: DialogOptions): Promise<void> => {
    return new Promise((resolve) => {
      setDialogState({
        ...options,
        isOpen: true,
        isConfirm: false,
        resolve: () => resolve(undefined),
      });
    });
  }, []);

  useEffect(() => {
    globalShowConfirm = showConfirm;
    globalShowAlert = showAlert;
    return () => {
      globalShowConfirm = null;
      globalShowAlert = null;
    };
  }, [showConfirm, showAlert]);

  const handleConfirm = () => {
    if (dialogState) {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(40); } catch (e) {}
      }
      dialogState.resolve(true);
      setDialogState(null);
    }
  };

  const handleCancel = () => {
    if (dialogState) {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(20); } catch (e) {}
      }
      dialogState.resolve(false);
      setDialogState(null);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!dialogState?.isOpen) return;
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter') {
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogState]);

  const type = dialogState?.type || 'info';

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <Trash2 className="w-6 h-6 text-rose-500 dark:text-rose-400" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-500 dark:text-amber-400" />;
      case 'success':
        return <CheckCircle2 className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />;
      default:
        return <Info className="w-6 h-6 text-sky-500 dark:text-sky-400" />;
    }
  };

  const getGlowColor = () => {
    switch (type) {
      case 'danger':
        return 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 border-rose-200 dark:border-rose-900/50';
      case 'warning':
        return 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 border-amber-200 dark:border-amber-900/50';
      case 'success':
        return 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 border-emerald-200 dark:border-emerald-900/50';
      default:
        return 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-500 border-sky-200 dark:border-sky-900/50';
    }
  };

  const getPrimaryButtonBg = () => {
    switch (type) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30';
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30';
      default:
        return 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30';
    }
  };

  return (
    <CustomDialogContext.Provider value={{ showConfirm, showAlert }}>
      {children}

      <AnimatePresence>
        {dialogState?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-md transition-all">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 450, damping: 25 }}
              className="relative w-full max-w-md bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden text-stone-900 dark:text-stone-100"
            >
              {/* Top ambient radial glow */}
              <div className={`absolute -top-16 -right-16 w-32 h-32 rounded-full blur-2xl pointer-events-none ${
                type === 'danger' ? 'bg-rose-500/20' : type === 'warning' ? 'bg-amber-500/20' : 'bg-emerald-500/20'
              }`} />

              <div className="flex items-start gap-4">
                <div className={`p-3.5 rounded-2xl border shrink-0 ${getGlowColor()}`}>
                  {getIcon()}
                </div>

                <div className="flex-1 min-w-0 pr-6">
                  <h3 className="text-lg font-bold tracking-tight text-stone-900 dark:text-white">
                    {dialogState.title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed font-normal">
                    {dialogState.message}
                  </p>
                </div>

                <button
                  onClick={handleCancel}
                  className="absolute top-5 right-5 p-1.5 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="mt-7 flex items-center justify-end gap-3">
                {dialogState.isConfirm && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleCancel}
                    className="px-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold transition-all cursor-pointer border border-stone-200 dark:border-stone-700/80"
                  >
                    {dialogState.cancelText || 'Cancel'}
                  </motion.button>
                )}

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleConfirm}
                  className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${getPrimaryButtonBg()}`}
                >
                  {dialogState.confirmText || (dialogState.isConfirm ? 'Confirm' : 'OK')}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </CustomDialogContext.Provider>
  );
};
