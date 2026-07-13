import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Database, 
  Activity, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Clock, 
  Check 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PingHistoryItem {
  timestamp: string;
  status: 'green' | 'yellow' | 'red';
  latency: number;
  message: string | null;
}

export function DatabaseHealthCheck() {
  const [status, setStatus] = useState<'green' | 'yellow' | 'red'>('green');
  const [latency, setLatency] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<PingHistoryItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Load initial history from localStorage if available
  useEffect(() => {
    try {
      const cached = localStorage.getItem('sy_supabase_ping_history');
      if (cached) {
        setHistory(JSON.parse(cached));
      }
    } catch (e) {
      console.warn('Failed to load ping history cache:', e);
    }
  }, []);

  const runHealthCheck = async (isManual = false) => {
    if (isChecking) return;
    setIsChecking(true);
    const startTime = performance.now();
    
    try {
      // Run a cheap, light metadata/profile query to check live connection
      const { error } = await supabase.from('profiles').select('id').limit(1);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      let finalStatus: 'green' | 'yellow' | 'red' = 'green';
      let msg: string | null = null;

      if (error) {
        // Determine if it is a real connection failure (DNS / offline) 
        // or a standard auth/permission restriction from Supabase (which still indicates active connectivity).
        const supaErr = error as any;
        const isNetworkFailure = 
          error.message?.toLowerCase().includes('failed to fetch') || 
          error.message?.toLowerCase().includes('network') ||
          supaErr.status === null || 
          supaErr.status === undefined ||
          supaErr.status === 0;

        if (isNetworkFailure) {
          finalStatus = 'red';
          msg = error.message || 'Offline: Failed to reach Supabase API.';
        } else {
          // Reached server successfully, but was blocked by RLS / Auth / custom codes
          finalStatus = duration > 800 ? 'yellow' : 'green';
          msg = `Connected (API Handshake: ${error.code || supaErr.status || 'Success'})`;
        }
      } else {
        // Successful query
        finalStatus = duration > 800 ? 'yellow' : 'green';
      }

      setStatus(finalStatus);
      setLatency(duration);
      setErrorMsg(msg);
      const now = new Date();
      setLastChecked(now);

      // Update history
      const newHistoryItem: PingHistoryItem = {
        timestamp: now.toLocaleTimeString(),
        status: finalStatus,
        latency: duration,
        message: msg
      };

      setHistory(prev => {
        const updated = [newHistoryItem, ...prev].slice(0, 5);
        try {
          localStorage.setItem('sy_supabase_ping_history', JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save ping history:', e);
        }
        return updated;
      });

    } catch (err: any) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      const now = new Date();

      setStatus('red');
      setLatency(duration);
      setErrorMsg(err?.message || 'Unknown network error');
      setLastChecked(now);

      const newHistoryItem: PingHistoryItem = {
        timestamp: now.toLocaleTimeString(),
        status: 'red',
        latency: duration,
        message: err?.message || 'Unknown connection error'
      };

      setHistory(prev => {
        const updated = [newHistoryItem, ...prev].slice(0, 5);
        try {
          localStorage.setItem('sy_supabase_ping_history', JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save ping history:', e);
        }
        return updated;
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Run on mount, then poll every 45 seconds
  useEffect(() => {
    runHealthCheck();
    const interval = setInterval(() => {
      runHealthCheck();
    }, 45000);

    return () => clearInterval(interval);
  }, []);

  // Handle click outside to close popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    }
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  // Color mapping utilities
  const getStatusColor = (s: 'green' | 'yellow' | 'red') => {
    switch (s) {
      case 'green': return 'bg-emerald-500';
      case 'yellow': return 'bg-amber-500';
      case 'red': return 'bg-rose-500';
    }
  };

  const getStatusText = (s: 'green' | 'yellow' | 'red') => {
    switch (s) {
      case 'green': return 'Connected';
      case 'yellow': return 'Slow Connection';
      case 'red': return 'Sync Offline';
    }
  };

  return (
    <div className="relative inline-block" ref={popoverRef} id="supabase_health_check_widget">
      {/* Footer Pill Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/60 hover:bg-stone-100 dark:hover:bg-stone-800 transition-all cursor-pointer select-none text-[11px] font-semibold text-stone-600 dark:text-stone-400 shadow-sm"
        title="Check Supabase Connection Status"
      >
        <span className="relative flex h-2 w-2">
          {status === 'green' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          )}
          {status === 'yellow' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          )}
          {status === 'red' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${getStatusColor(status)}`}></span>
        </span>
        <Database className="w-3.5 h-3.5 text-stone-500" />
        <span className="max-sm:hidden">Supabase:</span>
        <span className={
          status === 'green' ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 
          status === 'yellow' ? 'text-amber-600 dark:text-amber-400 font-extrabold' : 
          'text-rose-600 dark:text-rose-400 font-extrabold'
        }>
          {getStatusText(status)}
        </span>
        {latency !== null && (
          <span className="text-[10px] text-stone-400 font-mono">({latency}ms)</span>
        )}
      </button>

      {/* Floating Diagnostic Popover Card */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: -4, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute bottom-full right-0 mb-2 w-80 bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 p-4 z-40 text-left overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-violet-500" />
                <h4 className="text-xs font-black text-stone-800 dark:text-stone-100 uppercase tracking-wider">
                  Database Health Check
                </h4>
              </div>
              <button 
                onClick={() => setIsExpanded(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors p-0.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Summary Banner */}
            <div className="mt-3 bg-stone-50 dark:bg-stone-950 p-3 rounded-xl border border-stone-100 dark:border-stone-850 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Current State</p>
                <p className="text-sm font-black text-stone-800 dark:text-stone-100 mt-0.5 flex items-center gap-1.5">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${getStatusColor(status)}`}></span>
                  {status === 'green' && 'Excellent sync'}
                  {status === 'yellow' && 'Slow Connection'}
                  {status === 'red' && 'Database offline'}
                </p>
              </div>
              
              <div className="text-right">
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Latency</p>
                <p className="text-sm font-black text-stone-800 dark:text-stone-100 mt-0.5 font-mono">
                  {latency !== null ? `${latency} ms` : '--'}
                </p>
              </div>
            </div>

            {/* Error Message Warning */}
            {errorMsg && (
              <div className="mt-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 text-[11px] p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/30 flex gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Historical Sparkline/Pings */}
            <div className="mt-4">
              <h5 className="text-[10px] text-stone-400 dark:text-stone-500 font-black uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Recent Diagnostics</span>
                <Activity className="w-3.5 h-3.5 text-stone-400" />
              </h5>
              
              {history.length === 0 ? (
                <p className="text-center text-xs text-stone-400 py-3 italic">
                  No checks performed yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {history.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between text-[11px] py-1 px-1.5 hover:bg-stone-50 dark:hover:bg-stone-950 rounded-lg transition-all"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(item.status)}`}></span>
                        <span className="text-stone-500 dark:text-stone-400 font-mono text-[10px]">{item.timestamp}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {item.message ? (
                          <span className="text-[10px] text-stone-400 max-w-[120px] truncate" title={item.message}>
                            {item.message}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Successful</span>
                        )}
                        <span className="font-mono text-stone-700 dark:text-stone-300 text-[10px] font-bold">
                          {item.latency}ms
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer with Manual Check Button */}
            <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[10px]">
              <span className="text-stone-400 flex items-center gap-1 font-semibold">
                <Clock className="w-3 h-3 text-stone-400" />
                Checked: {lastChecked ? lastChecked.toLocaleTimeString() : 'never'}
              </span>

              <button
                disabled={isChecking}
                onClick={() => runHealthCheck(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-extrabold transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'Checking...' : 'Ping Now'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
