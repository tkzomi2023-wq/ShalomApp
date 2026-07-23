/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Active and Outgoing WebRTC Call View with video rendering, media controls, audio wave feedback,
 * and PiP float mode.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useCalling } from '../../context/CallingContext';
import { RoleBadge } from '../RoleBadge';
import { formatMemberName, getCleanAvatar } from '../../types';
import { CommunicationSettingsModal } from './CommunicationSettingsModal';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Volume2, 
  VolumeX, 
  Monitor, 
  Maximize2, 
  Minimize2, 
  PictureInPicture2,
  Expand,
  ChevronDown,
  Settings, 
  Signal, 
  ShieldCheck, 
  Sparkles,
  PhoneCall
} from 'lucide-react';

export const ActiveCallModal: React.FC = () => {
  const { 
    callState, 
    isCalleeRinging,
    targetMember, 
    callType, 
    callDuration, 
    signalBars, 
    isMicMuted, 
    isCameraOff, 
    isSpeakerMuted, 
    isScreenSharing, 
    isFullscreen, 
    isPiP, 
    localStream, 
    remoteStream, 
    endCall, 
    toggleMicrophone, 
    toggleCamera, 
    toggleSpeaker, 
    toggleScreenShare, 
    toggleFullscreen, 
    togglePiP 
  } = useCalling();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement | null>(null);

  // Click outside listener for view mode menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
        setIsViewMenuOpen(false);
      }
    };
    if (isViewMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isViewMenuOpen]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Callback ref handler to attach localStream as soon as video element enters DOM
  const setLocalVideoRef = (el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el && localStream) {
      if (el.srcObject !== localStream) {
        el.srcObject = localStream;
      }
      el.play().catch(() => {});
    }
  };

  // Callback ref handler to attach remoteStream as soon as video element enters DOM
  const setRemoteVideoRef = (el: HTMLVideoElement | null) => {
    remoteVideoRef.current = el;
    if (el && remoteStream) {
      if (el.srcObject !== remoteStream) {
        el.srcObject = remoteStream;
      }
      el.play().catch(() => {});
    }
  };

  // Attach local stream to video element on state/stream updates
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, callState, callType, isCameraOff]);

  // Attach remote stream to video element on state/stream updates
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, callState, callType]);

  if (callState !== 'ringing_outgoing' && callState !== 'active' && callState !== 'ended') {
    return null;
  }

  if (!targetMember) return null;

  const displayName = formatMemberName(
    targetMember.display_name || targetMember.name, 
    targetMember.gender, 
    targetMember.marital_status
  );

  const cleanAvatar = getCleanAvatar(targetMember.avatar);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Picture-in-Picture Mini Floating Overlay Mode
  if (isPiP) {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-72 bg-stone-900/95 border border-stone-800 rounded-2xl shadow-2xl p-3 text-white flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-xs text-stone-200 truncate">{displayName}</span>
          </div>
          <button 
            onClick={togglePiP} 
            className="p-1 text-stone-400 hover:text-white rounded-md hover:bg-stone-800 cursor-pointer"
            title="Expand / Restore Call Window"
          >
            <Expand className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        </div>

        {callType === 'video' && remoteStream ? (
          <div className="relative w-full h-36 bg-black rounded-xl overflow-hidden">
            <video 
              ref={setRemoteVideoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover" 
            />
          </div>
        ) : (
          <div className="py-2 flex items-center justify-center gap-2 bg-stone-850 rounded-xl">
            <PhoneCall className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-mono text-xs text-emerald-400">{formatTimer(callDuration)}</span>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            onClick={toggleMicrophone}
            className={`p-2 rounded-full ${isMicMuted ? 'bg-rose-600 text-white' : 'bg-stone-800 text-stone-300'}`}
          >
            {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={endCall}
            className="p-2.5 rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-500"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/90 backdrop-blur-2xl transition-all duration-300`}>
      <div className={`relative w-full ${isFullscreen ? 'h-full max-w-none' : 'max-w-4xl h-[88vh]'} bg-stone-900 border border-stone-800/90 rounded-3xl overflow-hidden shadow-2xl flex flex-col`}>
        
        {/* Top Floating Control Bar */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-stone-950/80 to-transparent flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-stone-800/80 px-3 py-1.5 rounded-full border border-stone-700/50 backdrop-blur-md">
              <span className={`w-2.5 h-2.5 rounded-full ${callState === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-ping'}`} />
              <span className="text-xs font-bold text-stone-200">
                {callState === 'ringing_outgoing' ? (isCalleeRinging ? 'Ringing...' : 'Calling...') : callState === 'active' ? formatTimer(callDuration) : 'Call Ended'}
              </span>
            </div>

            {/* Signal Strength */}
            <div className="hidden sm:flex items-center gap-1 bg-stone-800/80 px-2.5 py-1.5 rounded-full border border-stone-700/50 text-xs text-stone-300">
              <Signal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-mono text-stone-400">{signalBars}/4</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer"
              title="Communication Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Single Unified View Mode Toggle Button */}
            <div className="relative" ref={viewMenuRef}>
              <button
                type="button"
                onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
                className="px-2.5 py-1.5 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors border border-stone-700/50 flex items-center gap-1 cursor-pointer"
                title="View Mode Options (Picture-in-Picture & Fullscreen)"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4 text-amber-400" />
                ) : (
                  <PictureInPicture2 className="w-4 h-4 text-emerald-400" />
                )}
                <ChevronDown className={`w-3 h-3 text-stone-400 transition-transform duration-200 ${isViewMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isViewMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-stone-900 border border-stone-750 rounded-2xl shadow-2xl py-1.5 z-30 text-xs text-white">
                  <button
                    type="button"
                    onClick={() => {
                      togglePiP();
                      setIsViewMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-stone-800 flex items-center gap-2.5 text-stone-200 transition-colors cursor-pointer"
                  >
                    <PictureInPicture2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-bold">Picture-in-Picture</span>
                      <span className="text-[10px] text-stone-400">Minimize call to floating window</span>
                    </div>
                  </button>

                  <div className="my-1 border-t border-stone-800" />

                  <button
                    type="button"
                    onClick={() => {
                      toggleFullscreen();
                      setIsViewMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-stone-800 flex items-center gap-2.5 text-stone-200 transition-colors cursor-pointer"
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-bold">Exit Fullscreen</span>
                          <span className="text-[10px] text-stone-400">Return to windowed modal</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <Expand className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-bold">Fullscreen Mode</span>
                          <span className="text-[10px] text-stone-400">Expand to full screen</span>
                        </div>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Stage View (Video or Audio Visualizer) */}
        <div className="relative flex-1 bg-stone-950 flex items-center justify-center overflow-hidden">
          {callType === 'video' && remoteStream ? (
            /* Remote Video Stream */
            <video 
              ref={setRemoteVideoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover" 
            />
          ) : (
            /* Voice Call Stage / Large Avatar View */
            <div className="flex flex-col items-center justify-center p-6 text-center z-10">
              <div className="relative my-6">
                <div className="absolute -inset-6 rounded-full bg-emerald-500/10 animate-pulse duration-1000" />
                <div className="absolute -inset-12 rounded-full border border-emerald-500/20 animate-ping duration-1000" />

                {cleanAvatar ? (
                  <img 
                    src={cleanAvatar} 
                    alt={displayName} 
                    className="relative w-36 h-36 rounded-full object-cover ring-4 ring-emerald-500/40 shadow-2xl" 
                  />
                ) : (
                  <div className="relative w-36 h-36 rounded-full bg-emerald-950 text-emerald-300 font-bold text-4xl flex items-center justify-center ring-4 ring-emerald-500/40 shadow-2xl">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <h3 className="text-2xl font-black text-white">{displayName}</h3>
              <div className="mt-2 flex items-center gap-2">
                <RoleBadge role={targetMember.role} />
              </div>

              <p className="mt-3 text-xs text-stone-400 font-medium">
                {callState === 'ringing_outgoing' ? (isCalleeRinging ? 'Ringing...' : 'Calling...') : 'Voice Connected'}
              </p>
            </div>
          )}

          {/* Self Local Video PIP Preview (Corner) */}
          {callType === 'video' && localStream && (
            <div className="absolute bottom-24 right-4 z-20 w-36 h-48 sm:w-44 sm:h-56 bg-stone-900 rounded-2xl overflow-hidden border-2 border-stone-700/80 shadow-2xl">
              <video 
                ref={setLocalVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : ''}`} 
              />
              {isCameraOff && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-stone-900 text-stone-500 text-xs">
                  <VideoOff className="w-6 h-6 mb-1 text-stone-600" />
                  <span>Camera Off</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Control Dock Toolbar */}
        <div className="p-4 sm:p-6 bg-stone-950/90 border-t border-stone-800/80 flex items-center justify-center gap-3 sm:gap-6 text-white">
          
          {/* Mute Mic */}
          <button
            onClick={toggleMicrophone}
            className={`p-3.5 sm:p-4 rounded-2xl transition-all duration-200 cursor-pointer ${
              isMicMuted 
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/30 ring-2 ring-rose-500' 
                : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
            }`}
            title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Camera Toggle */}
          {callType === 'video' && (
            <button
              onClick={toggleCamera}
              className={`p-3.5 sm:p-4 rounded-2xl transition-all duration-200 cursor-pointer ${
                isCameraOff 
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/30 ring-2 ring-rose-500' 
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
              }`}
              title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          )}

          {/* Speaker Toggle */}
          <button
            onClick={toggleSpeaker}
            className={`p-3.5 sm:p-4 rounded-2xl transition-all duration-200 cursor-pointer ${
              isSpeakerMuted 
                ? 'bg-amber-600 text-white' 
                : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
            }`}
            title={isSpeakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}
          >
            {isSpeakerMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>

          {/* Screen Share */}
          {callType === 'video' && (
            <button
              onClick={toggleScreenShare}
              className={`p-3.5 sm:p-4 rounded-2xl transition-all duration-200 cursor-pointer ${
                isScreenSharing 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' 
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
              }`}
              title="Share Screen"
            >
              <Monitor className="w-6 h-6" />
            </button>
          )}

          {/* End Call Button */}
          <button
            onClick={endCall}
            className="px-6 py-3.5 sm:px-8 sm:py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2.5 shadow-xl shadow-rose-900/40 transition-all duration-200 hover:scale-105 cursor-pointer"
          >
            <PhoneOff className="w-6 h-6" />
            <span className="hidden sm:inline text-sm">End Call</span>
          </button>
        </div>

      </div>

      {/* Embedded Communication Settings Modal */}
      <CommunicationSettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
};
