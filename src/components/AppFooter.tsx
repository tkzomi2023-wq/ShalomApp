import React from 'react';
import { DatabaseHealthCheck } from './DatabaseHealthCheck';

interface AppFooterProps {
  onOpenDownloadModal?: () => void;
}

export const AppFooter: React.FC<AppFooterProps> = () => {
  return (
    <footer className="mt-12 border-t border-stone-200 dark:border-stone-850 bg-stone-100/50 dark:bg-stone-950/80 transition-colors">
      {/* Copyright & Health Check Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500 dark:text-stone-400">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1">
          <p>© {new Date().getFullYear()} Shalom Youth Community Organization. All rights reserved.</p>
        </div>

        <DatabaseHealthCheck />
      </div>
    </footer>
  );
};
