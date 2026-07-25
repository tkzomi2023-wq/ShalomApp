/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modern glassmorphic incoming call overlay with sound controls and call accept/decline buttons.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCalling } from '../../context/CallingContext';
import { RoleBadge } from '../RoleBadge';
import { formatMemberName, getCleanAvatar } from '../../types';
import { callAudio } from '../../lib/callAudio';
import { 
  Phone, 
  PhoneOff, 
  Video, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  ShieldCheck,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export const IncomingCallModal: React.FC = () => {
  const { 
    callState, 
    targetMember, 
    callType, 
    acceptCall, 
    declineCall 
  } = useCalling();

  const [isRingtoneMuted, setIsRingtoneMuted] = useState(false);
  const [actionState, setActionState] = useState<'idle' | 'accepting' | 'declining'>('idle');

  if (callState !== 'ringing_incoming' || !targetMember) {
    return null;
  }

  const toggleMuteRingtone = () => {
    const nextMuted = !isRingtoneMuted;
    setIsRingtoneMuted(nextMuted);
    callAudio.setMuted(nextMuted);
  };

  const handleAccept = () => {
    if (actionState !== 'idle') return;
    setActionState('accepting');
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([40, 60, 80]); } catch (e) {}
    }
    setTimeout(() => {
      acceptCall();
    }, 250);
  };

  const handleDecline = () => {
    if (actionState !== 'idle') return;
    setActionState('declining');
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(100); } catch (e) {}
    }
    setTimeout(() => {
      declineCall();
    }, 250);
  };

  const displayName = formatMemberName(
    targetMember.display_name || targetMember.name, 
    targetMember.gender, 
    targetMember.marital_status
  );

  const cleanAvatar = getCleanAvatar(targetMember.avatar);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/85 backdrop-blur-2xl transition-all duration-300">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md bg-stone-900/90 border border-stone-800/80 rounded-3xl p-8 shadow-2xl text-center text-white flex flex-col items-center overflow-hidden"
      >
        
        {/* Glowing Background Radial Accents */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Label */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-6 shadow-inner">
          <Sparkles className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
          <span>INCOMING {callType.toUpperCase()} CALL</span>
        </div>

        {/* Pulsing Avatar Container */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping duration-1000" />
          <div className="absolute -inset-4 rounded-full border border-emerald-500/30 animate-pulse duration-700" />

          {cleanAvatar ? (
            <img 
              src={cleanAvatar} 
              alt={displayName} 
              className="relative w-28 h-28 rounded-full object-cover ring-4 ring-emerald-500/50 shadow-xl" 
            />
          ) : (
            <div className="relative w-28 h-28 rounded-full bg-emerald-950 text-emerald-300 font-bold text-3xl flex items-center justify-center ring-4 ring-emerald-500/50 shadow-xl">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="absolute bottom-0 right-0 p-2.5 bg-emerald-600 text-white rounded-full ring-2 ring-stone-900 shadow-md">
            {callType === 'video' ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
          </div>
        </div>

        {/* User Details */}
        <h2 className="text-2xl font-black text-stone-100 tracking-tight mt-4">
          {displayName}
        </h2>
        <div className="mt-2 flex items-center justify-center gap-2">
          <RoleBadge role={targetMember.role} />
          {targetMember.church_titles && (
            <span className="text-xs text-stone-400 font-medium truncate max-w-[150px]">
              {targetMember.church_titles}
            </span>
          )}
        </div>

        <p className="text-stone-400 text-xs mt-3 flex items-center gap-1.5 animate-pulse">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Secure WebRTC Direct Call
        </p>

        {/* Ringtone Mute Control */}
        <button
          onClick={toggleMuteRingtone}
          className="mt-6 inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors bg-stone-800/60 px-3.5 py-1.5 rounded-full border border-stone-700/50 active:scale-95 cursor-pointer"
        >
          {isRingtoneMuted ? (
            <>
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              <span>Unmute Ringtone</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mute Ringtone</span>
            </>
          )}
        </button>

        {/* Accept & Decline Action Controls with Tactile Animations */}
        <div className="mt-8 grid grid-cols-2 gap-6 w-full max-w-xs relative">
          
          {/* Decline Button */}
          <motion.button
            onClick={handleDecline}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.85, rotate: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            disabled={actionState !== 'idle'}
            className="flex flex-col items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
          >
            <div className={`relative w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 ${
              actionState === 'declining' 
                ? 'bg-rose-700 scale-110 ring-4 ring-rose-400 shadow-rose-600/80 animate-pulse' 
                : 'bg-rose-600 group-hover:bg-rose-500 shadow-rose-900/50 ring-2 ring-rose-500/30'
            }`}>
              {actionState === 'declining' ? (
                <XCircle className="w-8 h-8 animate-spin" />
              ) : (
                <PhoneOff className="w-7 h-7 group-hover:rotate-12 transition-transform" />
              )}
            </div>
            <span className="text-xs font-semibold text-stone-300 group-hover:text-rose-400 transition-colors">
              {actionState === 'declining' ? 'Declining...' : 'Decline'}
            </span>
          </motion.button>

          {/* Accept Button */}
          <motion.button
            onClick={handleAccept}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.85, rotate: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            disabled={actionState !== 'idle'}
            className="flex flex-col items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
          >
            <div className={`relative w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 ${
              actionState === 'accepting' 
                ? 'bg-emerald-500 scale-110 ring-4 ring-emerald-300 shadow-emerald-500/80' 
                : 'bg-emerald-600 group-hover:bg-emerald-500 shadow-emerald-900/50 ring-2 ring-emerald-500/30 animate-bounce'
            }`}>
              {actionState === 'accepting' ? (
                <CheckCircle2 className="w-8 h-8 animate-spin" />
              ) : (
                callType === 'video' ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />
              )}
            </div>
            <span className="text-xs font-semibold text-stone-300 group-hover:text-emerald-400 transition-colors">
              {actionState === 'accepting' ? 'Connecting...' : 'Accept'}
            </span>
          </motion.button>

        </div>

      </motion.div>
    </div>
  );
};
