/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Reusable Voice & Video calling buttons with member online presence indicators.
 */

import React from 'react';
import { Member } from '../../types';
import { useCalling } from '../../context/CallingContext';
import { Phone, Video, Circle } from 'lucide-react';

interface CallButtonsProps {
  member: Member;
  size?: 'sm' | 'md' | 'lg';
  showPresenceDot?: boolean;
  className?: string;
}

export const CallButtons: React.FC<CallButtonsProps> = ({ 
  member, 
  size = 'md', 
  showPresenceDot = true,
  className = ''
}) => {
  const { startCall, presenceMap, callState, currentUser } = useCalling();

  const isCallingEnabled = typeof window !== 'undefined' ? localStorage.getItem('sy_enable_calling_services') !== 'false' : true;
  const isAdmin = currentUser?.email?.toLowerCase() === 'tkpaite2016@gmail.com';

  if (!isCallingEnabled && !isAdmin) {
    return null;
  }

  const presence = presenceMap.get(member.id);
  const status = presence?.status || 'offline';

  const getStatusColor = () => {
    switch (status) {
      case 'online': return 'bg-emerald-500';
      case 'in_call':
      case 'busy': return 'bg-amber-500';
      case 'away': return 'bg-yellow-500';
      case 'dnd': return 'bg-rose-500';
      default: return 'bg-stone-300 dark:bg-stone-600';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'online': return 'Online';
      case 'in_call': return 'In Call';
      case 'busy': return 'Busy';
      case 'away': return 'Away';
      case 'dnd': return 'Do Not Disturb';
      default: return 'Offline';
    }
  };

  const isBtnDisabled = callState !== 'idle';

  const sizeClasses = {
    sm: 'p-1.5 rounded-lg text-xs',
    md: 'p-2 rounded-xl text-xs',
    lg: 'px-3 py-2 rounded-xl text-xs font-semibold'
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-4 h-4'
  }[size];

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {showPresenceDot && (
        <span 
          className={`inline-block w-2.5 h-2.5 rounded-full ${getStatusColor()} ring-2 ring-white dark:ring-stone-900 shrink-0`} 
          title={`Status: ${getStatusLabel()}`}
        />
      )}

      {/* Voice Call Button */}
      <button
        onClick={() => startCall(member, 'voice')}
        disabled={isBtnDisabled}
        className={`${sizeClasses} bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 transition-all shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
        title={`Voice Call ${member.name}`}
      >
        <Phone className={iconSizes} />
        {size === 'lg' && <span>Voice</span>}
      </button>

      {/* Video Call Button */}
      <button
        onClick={() => startCall(member, 'video')}
        disabled={isBtnDisabled}
        className={`${sizeClasses} bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 dark:text-sky-400 border border-sky-200 dark:border-sky-800/60 transition-all shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
        title={`Video Call ${member.name}`}
      >
        <Video className={iconSizes} />
        {size === 'lg' && <span>Video</span>}
      </button>
    </div>
  );
};
