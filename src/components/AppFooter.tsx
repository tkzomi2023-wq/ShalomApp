import React, { useState } from 'react';
import { Smartphone, Download, Sparkles, ShieldCheck, ChevronRight } from 'lucide-react';
import { DatabaseHealthCheck } from './DatabaseHealthCheck';
import { DownloadAppModal } from './DownloadAppModal';

export const AppFooter: React.FC = () => {
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  const handleDirectApkDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = '/api/download-apk';
    link.download = 'Shalom_Youth_App_v2.4.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <footer className="mt-12 border-t border-stone-200 dark:border-stone-850 bg-stone-100/50 dark:bg-stone-950/80 transition-colors">
      
      {/* Prominent Footer Banner for APK / Mobile App Download */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-950 to-teal-950 text-white p-6 sm:p-8 shadow-xl border border-emerald-800/60">
          
          {/* Subtle background glow decorative elements */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Text & Icon Header */}
            <div className="flex items-start sm:items-center gap-4 text-center sm:text-left flex-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-emerald-300 shrink-0 shadow-lg mx-auto sm:mx-0">
                <Smartphone className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-emerald-300" /> Mobile Release v2.4
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-400/15 text-teal-200 text-[10px] font-bold">
                    <ShieldCheck className="w-3 h-3 text-teal-300" /> Android 7.0+ & iOS
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight leading-snug">
                  Download Shalom Youth Mobile App
                </h3>

                <p className="text-xs text-emerald-200/85 leading-relaxed max-w-xl">
                  Get the official Android APK or install the Web App directly on your mobile device for fast offline access, member directory, and instant community notifications.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={handleDirectApkDownload}
                className="w-full sm:w-auto px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-emerald-950 font-black text-xs rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer group"
                title="Directly download Android APK file"
              >
                <Download className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
                <span>Download Android APK</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDownloadModalOpen(true)}
                className="w-full sm:w-auto px-5 py-3.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-extrabold text-xs rounded-2xl border border-white/15 backdrop-blur-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                title="View installation guide & iOS options"
              >
                <span>Install Options & Guide</span>
                <ChevronRight className="w-4 h-4 text-emerald-300" />
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Copyright & Health Check Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500 dark:text-stone-400 border-t border-stone-200/60 dark:border-stone-800/80">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1">
          <p>© {new Date().getFullYear()} Shalom Youth Community Organization. All rights reserved.</p>
          <span className="hidden sm:inline text-stone-300 dark:text-stone-700">•</span>
          <button
            onClick={() => setIsDownloadModalOpen(true)}
            className="hover:text-emerald-600 dark:hover:text-emerald-400 font-semibold transition-colors cursor-pointer flex items-center gap-1"
          >
            <Smartphone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Download Mobile App (.APK)</span>
          </button>
        </div>

        <DatabaseHealthCheck />
      </div>

      {/* Download Modal */}
      <DownloadAppModal 
        isOpen={isDownloadModalOpen} 
        onClose={() => setIsDownloadModalOpen(false)} 
      />
    </footer>
  );
};
