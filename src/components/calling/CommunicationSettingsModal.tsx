/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Settings Modal for media devices, STUN/TURN server setup, ringtone testing, and video quality.
 */

import React, { useState, useEffect } from 'react';
import { useCalling } from '../../context/CallingContext';
import { callAudio } from '../../lib/callAudio';
import { 
  Settings, 
  Mic, 
  Video, 
  Volume2, 
  Server, 
  X, 
  Check, 
  Play, 
  Sparkles, 
  ShieldCheck, 
  SlidersHorizontal 
} from 'lucide-react';

interface CommunicationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommunicationSettingsModal: React.FC<CommunicationSettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings } = useCalling();

  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);

  const [selectedMic, setSelectedMic] = useState(settings.preferred_microphone || '');
  const [selectedCam, setSelectedCam] = useState(settings.preferred_camera || '');
  const [selectedSpeaker, setSelectedSpeaker] = useState(settings.preferred_speaker || '');
  const [videoQuality, setVideoQuality] = useState(settings.video_quality || '720p');

  // TURN Configuration
  const [turnUrl, setTurnUrl] = useState(settings.turn_server_url || '');
  const [turnUsername, setTurnUsername] = useState(settings.turn_username || '');
  const [turnCredential, setTurnCredential] = useState(settings.turn_credential || '');
  const [turnEnabled, setTurnEnabled] = useState(settings.turn_enabled || false);

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Load available media devices
    navigator.mediaDevices?.enumerateDevices().then(devices => {
      setMicrophones(devices.filter(d => d.kind === 'audioinput'));
      setCameras(devices.filter(d => d.kind === 'videoinput'));
      setSpeakers(devices.filter(d => d.kind === 'audiooutput'));
    }).catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    await updateSettings({
      preferred_microphone: selectedMic,
      preferred_camera: selectedCam,
      preferred_speaker: selectedSpeaker,
      video_quality: videoQuality as any,
      turn_server_url: turnUrl,
      turn_username: turnUsername,
      turn_credential: turnCredential,
      turn_enabled: turnEnabled,
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const testRingtoneSound = () => {
    callAudio.playRingtone();
    setTimeout(() => {
      callAudio.stopAll();
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl text-stone-800 dark:text-stone-100 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-xl">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-stone-900 dark:text-white">Communication Settings</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">Audio, Video & TURN Server configuration</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          
          {/* Audio Devices */}
          <div className="space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Audio Devices
            </h4>

            <div>
              <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">Microphone Input</label>
              <select
                value={selectedMic}
                onChange={e => setSelectedMic(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-xs text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Default Microphone</option>
                {microphones.map(m => (
                  <option key={m.deviceId} value={m.deviceId}>{m.label || `Microphone ${m.deviceId.slice(0, 5)}`}</option>
                ))}
              </select>
            </div>

            {speakers.length > 0 && (
              <div>
                <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">Speaker Output</label>
                <select
                  value={selectedSpeaker}
                  onChange={e => setSelectedSpeaker(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-xs text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Default Speaker</option>
                  {speakers.map(s => (
                    <option key={s.deviceId} value={s.deviceId}>{s.label || `Speaker ${s.deviceId.slice(0, 5)}`}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={testRingtoneSound}
              className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900/40 hover:bg-emerald-100/50 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Test Ringtone Sound
            </button>
          </div>

          <hr className="border-stone-100 dark:border-stone-800" />

          {/* Video Devices & Quality */}
          <div className="space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
              <Video className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Video Settings
            </h4>

            <div>
              <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">Camera Device</label>
              <select
                value={selectedCam}
                onChange={e => setSelectedCam(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-xs text-stone-800 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Default Camera</option>
                {cameras.map(c => (
                  <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.slice(0, 5)}`}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-stone-700 dark:text-stone-300">Video Resolution</label>
              <div className="grid grid-cols-3 gap-3">
                {(['480p', '720p', '1080p'] as const).map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setVideoQuality(q)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      videoQuality === q 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                        : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    {q} {q === '720p' && '(Recommended)'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <hr className="border-stone-100 dark:border-stone-800" />

          {/* TURN / STUN Server Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Custom TURN Server Setup
              </h4>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={turnEnabled}
                  onChange={e => setTurnEnabled(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-xs font-semibold">Enable Custom TURN</span>
              </label>
            </div>

            {turnEnabled && (
              <div className="space-y-3 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-200 dark:border-stone-700/60 text-xs">
                <div>
                  <label className="block font-semibold mb-1">TURN Server URL</label>
                  <input
                    type="text"
                    placeholder="turn:turn.example.com:3478"
                    value={turnUrl}
                    onChange={e => setTurnUrl(e.target.value)}
                    className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Username</label>
                    <input
                      type="text"
                      placeholder="Username"
                      value={turnUsername}
                      onChange={e => setTurnUsername(e.target.value)}
                      className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Credential / Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={turnCredential}
                      onChange={e => setTurnCredential(e.target.value)}
                      className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <span className="text-xs text-stone-400 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Default STUN: Google STUN active
          </span>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                Saved!
              </>
            ) : (
              'Save Preferences'
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
