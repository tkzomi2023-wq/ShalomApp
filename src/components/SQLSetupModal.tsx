/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SUPABASE_SETUP_SQL, SUPABASE_URL } from '../lib/supabase';
import { Copy, Check, Database, X, Terminal, ExternalLink } from 'lucide-react';

interface SQLSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SQLSetupModal: React.FC<SQLSetupModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800">
        {/* Header */}
        <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/35 dark:text-emerald-400 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 dark:text-white text-lg">Supabase Setup Guide</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">Database setup & synchronizations</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-xs flex flex-col gap-1 shadow-xs">
            <span className="font-bold flex items-center gap-1">💡 Standard User Contribution View Fix</span>
            <span>
              We have updated the SELECT policy for the <strong>financial_records</strong> table. If standard users see ₹0 or cannot view their contribution audits on their profile, please copy and re-run the updated SQL script below in your Supabase SQL Editor. This grants view permissions to standard users for their profiles.
            </span>
          </div>

          <div>
            <p className="mb-2">
              To activate real-time synchronization with your live Supabase database, copy the schema SQL script below and execute it in your <strong>Supabase SQL Editor</strong>.
            </p>
            <div className="flex flex-wrap gap-2 items-center text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 px-3.5 py-2.5 rounded-lg border border-amber-100 dark:border-amber-900/20">
              <span className="font-medium">Supabase Project Endpoint URL:</span>
              <code className="bg-white dark:bg-stone-850 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/40 select-all font-mono">
                {SUPABASE_URL}
              </code>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5" /> SCHEMAS & TRIGGERS SQL code
              </span>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-900/35 dark:text-emerald-400 px-3 py-1.5 rounded-md hover:bg-emerald-100/50 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied to Clipboard!' : 'Copy SQL Script'}
              </button>
            </div>
            <pre className="p-4 bg-stone-900 text-stone-100 rounded-xl overflow-x-auto font-mono text-xs max-h-60 leading-normal border border-stone-800">
              {SUPABASE_SETUP_SQL}
            </pre>
          </div>

          <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-100/40 space-y-2.5">
            <h4 className="font-bold text-stone-800 dark:text-emerald-400 text-xs uppercase tracking-wide">Steps to execute:</h4>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
              <li>
                Open the <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline font-semibold inline-flex items-center gap-0.5">
                  Supabase Dashboard <ExternalLink className="w-3 h-3" />
                </a> and go to your project.
              </li>
              <li>Click on the <strong>SQL Editor</strong> tab on the left navigation sidebar.</li>
              <li>Select <strong>New Query</strong>, paste this copied SQL script, and click <strong>Run</strong>.</li>
              <li>That's it! When users sign up, their profile record is created and syncs perfectly!</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-stone-100 dark:border-stone-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 text-white font-semibold text-xs rounded-lg shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            I Understand, Close Dialog
          </button>
        </div>
      </div>
    </div>
  );
};
