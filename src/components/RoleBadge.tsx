/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { UserRole } from '../types';
import { 
  User, 
  Crown, 
  Layers, 
  Award, 
  Star, 
  BookOpen, 
  PenTool, 
  Wallet, 
  Coins 
} from 'lucide-react';

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className = '' }) => {
  let badgeStyles = 'bg-stone-100 text-stone-700 border-stone-200';
  let label = role;
  let Icon = User;

  switch (role) {
    case 'standard':
      badgeStyles = 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
      label = 'Standard Youth';
      Icon = User;
      break;
    case 'Founder':
      badgeStyles = 'bg-indigo-100 text-indigo-800 border-indigo-300 font-extrabold shadow-xs dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/50';
      label = 'Founder';
      Icon = Crown;
      break;
    case 'ECM':
      badgeStyles = 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30';
      label = 'ECM (Executive Committee Member)';
      Icon = Layers;
      break;
    case 'Chairman':
      badgeStyles = 'bg-amber-100 text-amber-800 border-amber-300 font-bold shadow-xs dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50';
      label = 'OB: Chairman';
      Icon = Award;
      break;
    case 'Vice Chairman':
      badgeStyles = 'bg-amber-50 text-amber-700 border-amber-200 font-semibold dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30';
      label = 'OB: Vice Chairman';
      Icon = Star;
      break;
    case 'Secretary':
      badgeStyles = 'bg-teal-50 text-teal-700 border-teal-200 font-semibold dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/30';
      label = 'OB: Secretary';
      Icon = BookOpen;
      break;
    case 'Assistant Secretary':
      badgeStyles = 'bg-cyan-50 text-cyan-700 border-cyan-200 font-semibold dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/30';
      label = 'OB: Assistant Secretary';
      Icon = PenTool;
      break;
    case 'Treasurer':
      badgeStyles = 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 font-semibold dark:bg-fuchsia-950/20 dark:text-fuchsia-400 dark:border-fuchsia-900/30';
      label = 'OB: Treasurer';
      Icon = Wallet;
      break;
    case 'Financial Secretary':
      badgeStyles = 'bg-rose-50 text-rose-700 border-rose-200 font-semibold dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30';
      label = 'OB: Financial Secretary';
      Icon = Coins;
      break;
  }

  let shortLabel = label;
  switch (role) {
    case 'standard':
      shortLabel = 'Member';
      break;
    case 'ECM':
      shortLabel = 'ECM';
      break;
    case 'Chairman':
      shortLabel = 'Chairman';
      break;
    case 'Vice Chairman':
      shortLabel = 'Vice Chair';
      break;
    case 'Secretary':
      shortLabel = 'Secretary';
      break;
    case 'Assistant Secretary':
      shortLabel = 'Asst. Sec';
      break;
    case 'Treasurer':
      shortLabel = 'Treasurer';
      break;
    case 'Financial Secretary':
      shortLabel = 'Fin. Sec';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium border ${badgeStyles} ${className}`}
    >
      <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{shortLabel}</span>
    </span>
  );
};
