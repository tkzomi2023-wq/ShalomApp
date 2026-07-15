/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Member } from '../types';
import { financialsDb } from '../lib/financials';
import { db } from '../lib/supabase';
import { 
  X, 
  AlertTriangle, 
  Check, 
  RefreshCw, 
  Database, 
  Sparkles, 
  ShieldAlert, 
  HelpCircle,
  TrendingUp,
  UserCheck
} from 'lucide-react';

interface BialDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onRefresh: () => Promise<void>;
}

interface DiscrepancyItem {
  id: string; // unique item id
  memberId: string;
  memberName: string;
  memberEmail: string;
  financialRecordName: string;
  financialBial: string;
  profileBial: string;
  resolved: boolean;
}

export function BialDiagnosticModal({ isOpen, onClose, members, onRefresh }: BialDiagnosticModalProps) {
  const [loading, setLoading] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyItem[]>([]);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [autoSyncingAll, setAutoSyncingAll] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const stripPrefix = (s: string) => {
    return s
      .toLowerCase()
      .replace(/^(tg\.|tg\s+|lia\s+|lia\.|pa\s+|pa\.|sia\s+|sia\.)/gi, '')
      .trim();
  };

  const runDiagnostic = async () => {
    setLoading(true);
    setSuccessMsg(null);
    try {
      const records = await financialsDb.getFinancialRecords();
      const items: DiscrepancyItem[] = [];

      // We only inspect financial records that actually specify a Bial area
      const recordsWithBial = records.filter(r => r.area && r.area.trim() !== '' && r.area !== 'TBD');

      // Keep track of processed member IDs to avoid listing duplicates if a member has multiple financial records
      const processedMemberIds = new Set<string>();

      recordsWithBial.forEach(record => {
        const normalizedRecName = record.name.trim().toLowerCase();
        const strippedRecName = stripPrefix(normalizedRecName);

        // Try to locate the registered member profile
        const matchedMember = members.find(m => {
          const normalizedMemName = m.name.trim().toLowerCase();
          const strippedMemName = stripPrefix(normalizedMemName);
          return (
            normalizedMemName === normalizedRecName ||
            strippedMemName === strippedRecName
          );
        });

        if (matchedMember) {
          if (processedMemberIds.has(matchedMember.id)) {
            return; // Already processed this member
          }

          const mBial = matchedMember.bial || '';
          const fBial = record.area.trim();

          // If profile Bial doesn't exist or is different from financial Bial, we have a discrepancy!
          if (mBial !== fBial) {
            items.push({
              id: `${matchedMember.id}_${record.id}`,
              memberId: matchedMember.id,
              memberName: matchedMember.name,
              memberEmail: matchedMember.email,
              financialRecordName: record.name,
              financialBial: fBial,
              profileBial: mBial || 'Not Assigned',
              resolved: false
            });
            processedMemberIds.add(matchedMember.id);
          }
        }
      });

      setDiscrepancies(items);
    } catch (err) {
      console.error('Failed to run Bial diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runDiagnostic();
    }
  }, [isOpen, members]);

  const handleFixItem = async (item: DiscrepancyItem) => {
    setFixingId(item.id);
    try {
      // Update profile in Supabase
      await db.updateMemberBial(item.memberId, item.financialBial);
      
      // Mark as resolved locally
      setDiscrepancies(prev => prev.map(d => d.id === item.id ? { ...d, resolved: true } : d));
      
      // Refresh parent dataset
      await onRefresh();
    } catch (err: any) {
      alert(`Failed to sync Bial: ${err.message || err}`);
    } finally {
      setFixingId(null);
    }
  };

  const handleAutoSyncAll = async () => {
    const unresolved = discrepancies.filter(d => !d.resolved);
    if (unresolved.length === 0) return;

    if (!confirm(`Are you sure you want to automatically resolve and sync all ${unresolved.length} discrepancies? This will overwrite profile settings with their financial records' Bial values.`)) {
      return;
    }

    setAutoSyncingAll(true);
    let count = 0;
    try {
      for (const item of unresolved) {
        await db.updateMemberBial(item.memberId, item.financialBial);
        count++;
      }
      setSuccessMsg(`Successfully resolved and synchronized ${count} discrepancies!`);
      await onRefresh();
      await runDiagnostic();
    } catch (err: any) {
      alert(`Auto-sync error: ${err.message || err}`);
    } finally {
      setAutoSyncingAll(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-stone-900 border border-stone-150 dark:border-stone-800 rounded-3xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-stone-100 dark:border-stone-850 flex items-center justify-between bg-stone-50/50 dark:bg-stone-950/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-stone-900 dark:text-white uppercase tracking-wider">
                Bial Assignment Diagnostics
              </h3>
              <p className="text-[11px] text-stone-400">
                Compares financial database records against user registration profiles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-xl cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Ribbon */}
        <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/10 border-b border-emerald-100/50 dark:border-emerald-900/10 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-emerald-800 dark:text-emerald-350 leading-relaxed">
            <strong>Automatic Real-Time Sync Finder:</strong> Whenever a member is placed in a Bial inside the financial transactions sheet but their profile remains blank or mismatched, this diagnostic engine lists them below. You can sync individual records or execute an automatic batch patch.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider animate-pulse">Running Diagnostics Check...</p>
            </div>
          ) : discrepancies.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl bg-stone-50/20 space-y-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-700 dark:text-stone-300">Perfectly Synchronized!</p>
                <p className="text-[10px] text-stone-400 mt-0.5">All Bial assignments in the financials database match their respective user profiles.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              
              {/* Stats & Actions */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-500 flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/10 px-2.5 py-1 rounded-lg">
                  <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
                  {discrepancies.filter(d => !d.resolved).length} Unresolved Discrepancies
                </span>
                
                <button
                  onClick={handleAutoSyncAll}
                  disabled={autoSyncingAll || discrepancies.every(d => d.resolved)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-[10px] rounded-xl cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1 shadow-xs"
                >
                  {autoSyncingAll ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5" />
                  )}
                  <span>Auto-Sync All ({discrepancies.filter(d => !d.resolved).length})</span>
                </button>
              </div>

              {successMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-xl text-[10px] font-bold">
                  {successMsg}
                </div>
              )}

              {/* Items List */}
              <div className="border border-stone-150 dark:border-stone-850 rounded-2xl divide-y divide-stone-100 dark:divide-stone-850 overflow-hidden bg-stone-50/20">
                {discrepancies.map((item) => (
                  <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-stone-900/50 hover:bg-stone-50/40 transition-all">
                    
                    {/* User info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-stone-800 dark:text-stone-200 text-xs">
                          {item.memberName}
                        </span>
                        <span className="text-[9px] text-stone-400">
                          ({item.memberEmail})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-semibold text-stone-500">
                        <span className="flex items-center gap-1">
                          Financials: <strong className="text-amber-600 dark:text-amber-400">{item.financialBial}</strong>
                        </span>
                        <span className="text-stone-350">•</span>
                        <span className="flex items-center gap-1">
                          Profile: <strong className="text-rose-600 dark:text-rose-400">{item.profileBial}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Quick Resolve Button */}
                    <div className="shrink-0">
                      {item.resolved ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-xl">
                          <Check className="w-3.5 h-3.5" /> Resolved & Synced
                        </span>
                      ) : (
                        <button
                          onClick={() => handleFixItem(item)}
                          disabled={fixingId === item.id}
                          className="px-3 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 text-stone-700 dark:text-stone-300 font-extrabold text-[9px] rounded-xl transition-all cursor-pointer uppercase tracking-wider flex items-center gap-1"
                        >
                          {fixingId === item.id ? (
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-2.5 h-2.5" />
                          )}
                          <span>Fix & Copy Bial</span>
                        </button>
                      )}
                    </div>

                  </div>
                ))}
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 dark:border-stone-850 flex justify-end bg-stone-50/50 dark:bg-stone-950/10">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-150 dark:bg-stone-850 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-[11px] rounded-xl cursor-pointer transition-colors uppercase tracking-wide"
          >
            Close Diagnostics
          </button>
        </div>

      </div>
    </div>
  );
}
