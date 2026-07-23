/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * WebRTC & Supabase Realtime calling context. Provides peer-to-peer audio and video calling,
 * presence tracking, signaling, audio tones, and media device controls.
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Member } from '../types';
import { 
  CallType, 
  CallState,
  CallStatus, 
  CallRecord, 
  CallSettings, 
  UserPresence, 
  UserPresenceStatus,
  SignalingPayload,
  CallNotification
} from '../types/calling';
import { callingService } from '../lib/callingService';
import { callAudio } from '../lib/callAudio';

interface CallingContextType {
  // Call State
  callState: CallState;
  isCalleeRinging: boolean;
  currentCall: CallRecord | null;
  targetMember: Member | null;
  callType: CallType;
  callDuration: number; // in seconds
  signalBars: number; // 1 to 4
  
  // Media States
  isMicMuted: boolean;
  isCameraOff: boolean;
  isSpeakerMuted: boolean;
  isScreenSharing: boolean;
  isFullscreen: boolean;
  isPiP: boolean;

  // Streams
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;

  // Settings & Notifications
  settings: CallSettings;
  presenceMap: Map<string, UserPresence>;
  notifications: CallNotification[];
  unreadNotifCount: number;

  // Actions
  startCall: (target: Member, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: (reason?: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleMicrophone: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
  toggleScreenShare: () => Promise<void>;
  toggleFullscreen: () => void;
  togglePiP: () => void;
  switchCamera: (deviceId: string) => Promise<void>;
  updateSettings: (newSettings: Partial<CallSettings>) => Promise<void>;
  markNotificationsAsRead: () => Promise<void>;
  refreshHistory: () => Promise<void>;
}

const CallingContext = createContext<CallingContextType | null>(null);

const DEFAULT_STUN_SERVER: RTCIceServer = {
  urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']
};

export const CallingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: currentUser } = useAuth();

  // Primary Call States
  const [callState, setCallState] = useState<'idle' | 'ringing_incoming' | 'ringing_outgoing' | 'active' | 'ended'>('idle');
  const [isCalleeRinging, setIsCalleeRinging] = useState<boolean>(false);
  const [currentCall, setCurrentCall] = useState<CallRecord | null>(null);

  const callStateRef = useRef<CallState>('idle');
  const currentCallRef = useRef<CallRecord | null>(null);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    currentCallRef.current = currentCall;
  }, [currentCall]);
  const [targetMember, setTargetMember] = useState<Member | null>(null);
  const [callType, setCallType] = useState<CallType>('voice');
  const [callDuration, setCallDuration] = useState<number>(0);
  const [signalBars, setSignalBars] = useState<number>(4);

  // Media Controls
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);

  // Stream References
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Call Settings & Notifications
  const [settings, setSettings] = useState<CallSettings>({
    user_id: currentUser?.id || '',
    microphone_enabled: true,
    camera_enabled: true,
    speaker_enabled: true,
    video_quality: '720p',
    ringtone_volume: 0.8,
    auto_answer: false,
    turn_enabled: false,
  });

  const [presenceMap, setPresenceMap] = useState<Map<string, UserPresence>>(new Map());
  const [notifications, setNotifications] = useState<CallNotification[]>([]);

  // WebRTC Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const durationTimerRef = useRef<any>(null);
  const statsTimerRef = useRef<any>(null);
  const ringTimeoutRef = useRef<any>(null);

  // Realtime Channels
  const signalingChannelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);

  // Request browser notification permissions on initial mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Load call settings & notifications when user logs in
  useEffect(() => {
    if (!currentUser?.id) return;

    callingService.getCallSettings(currentUser.id).then(s => setSettings(s));
    callingService.getNotifications(currentUser.id).then(n => setNotifications(n));
  }, [currentUser?.id]);

  // Handle call duration timer
  useEffect(() => {
    if (callState === 'active') {
      setCallDuration(0);
      durationTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [callState]);

  // Construct WebRTC RTCPeerConnection configuration
  const getPeerConfig = useCallback((): RTCConfiguration => {
    const iceServers: RTCIceServer[] = [DEFAULT_STUN_SERVER];

    if (settings.turn_enabled && settings.turn_server_url) {
      const turnServer: RTCIceServer = {
        urls: settings.turn_server_url,
      };
      if (settings.turn_username) turnServer.username = settings.turn_username;
      if (settings.turn_credential) turnServer.credential = settings.turn_credential;
      iceServers.push(turnServer);
    }

    return {
      iceServers,
      iceCandidatePoolSize: 10,
    };
  }, [settings]);

  // Clean up WebRTC peer connection and streams
  const cleanupMediaAndPeer = useCallback(() => {
    callAudio.stopAll();

    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }

    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(track => track.stop());
      remoteStreamRef.current = null;
      setRemoteStream(null);
    }

    iceCandidatesQueueRef.current = [];
    setIsCalleeRinging(false);
    setIsScreenSharing(false);
    setIsMicMuted(false);
    setIsCameraOff(false);
  }, []);

  // Initialize MediaStream (Mic / Camera)
  const getUserMediaStream = useCallback(async (type: CallType): Promise<MediaStream> => {
    const audioConstraints: boolean | MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    let videoConstraints: boolean | MediaTrackConstraints = false;
    if (type === 'video') {
      let width = 1280;
      let height = 720;
      if (settings.video_quality === '480p') { width = 854; height = 480; }
      if (settings.video_quality === '1080p') { width = 1920; height = 1080; }

      videoConstraints = {
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: 30 },
        facingMode: 'user',
      };
    if (settings.preferred_camera) {
      (videoConstraints as MediaTrackConstraints).deviceId = { ideal: settings.preferred_camera };
    }
  }

  if (settings.preferred_microphone) {
    (audioConstraints as MediaTrackConstraints).deviceId = { ideal: settings.preferred_microphone };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: videoConstraints,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  } catch (err: any) {
    console.warn('Full media capture failed, attempting audio-only capture:', err);
    try {
      // Fallback to basic audio
      const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = audioOnly;
      setLocalStream(audioOnly);
      return audioOnly;
    } catch (audioErr: any) {
      console.warn('Media device access failed or denied, creating fallback silent stream:', audioErr);
      // Fallback synthetic audio stream so call signaling and connection flow can succeed
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const dest = ctx.createMediaStreamDestination();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.0001;
          osc.connect(gain);
          gain.connect(dest);
          osc.start();

          const synthStream = dest.stream;
          localStreamRef.current = synthStream;
          setLocalStream(synthStream);
          return synthStream;
        }
      } catch (e) {
        console.error('Failed creating synthetic stream:', e);
      }
      // Re-throw if all fails
      throw audioErr;
    }
  }
  }, [settings]);

  // Create PeerConnection & attach local stream tracks
  const setupPeerConnection = useCallback((type: CallType, callId: string, roomId: string) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(getPeerConfig());
    peerConnectionRef.current = pc;

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && signalingChannelRef.current && currentUser?.id) {
        signalingChannelRef.current.send({
          type: 'broadcast',
          event: 'webrtc:ice_candidate',
          payload: {
            callId,
            roomId,
            callerId: currentUser.id,
            receiverId: targetMember?.id || '',
            candidate: event.candidate.toJSON(),
            timestamp: new Date().toISOString(),
          }
        });
      }
    };

    // Handle Remote Stream Track Arrival
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        setRemoteStream(event.streams[0]);
      } else {
        const stream = remoteStreamRef.current || new MediaStream();
        stream.addTrack(event.track);
        remoteStreamRef.current = stream;
        setRemoteStream(stream);
      }
    };

    // Monitor Connection Health / Stats
    statsTimerRef.current = setInterval(async () => {
      if (!peerConnectionRef.current || peerConnectionRef.current.connectionState !== 'connected') return;
      try {
        const stats = await peerConnectionRef.current.getStats();
        let rtt = 50;
        stats.forEach(report => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime) rtt = report.currentRoundTripTime * 1000;
          }
        });
        if (rtt < 100) setSignalBars(4);
        else if (rtt < 200) setSignalBars(3);
        else if (rtt < 400) setSignalBars(2);
        else setSignalBars(1);
      } catch (e) {}
    }, 3000);

    return pc;
  }, [getPeerConfig, currentUser?.id, targetMember?.id]);

  // Process queued ICE Candidates
  const processQueuedIceCandidates = useCallback(async () => {
    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) return;
    while (iceCandidatesQueueRef.current.length > 0) {
      const candidate = iceCandidatesQueueRef.current.shift();
      if (candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Error applying queued ICE candidate:', e);
        }
      }
    }
  }, []);

  // Send Signaling Message over Supabase Realtime
  const sendSignal = useCallback((event: string, payload: Partial<SignalingPayload>) => {
    if (signalingChannelRef.current) {
      signalingChannelRef.current.send({
        type: 'broadcast',
        event,
        payload
      });
    }
  }, []);

  // Set up Supabase Realtime Signaling & Presence Channels
  useEffect(() => {
    if (!currentUser?.id) return;

    // 1. Signaling Broadcast Channel
    const signalingChannel = supabase.channel('sy_call_signaling', {
      config: { broadcast: { self: false } }
    });

    signalingChannel
      .on('broadcast', { event: 'call:invite' }, async ({ payload }: { payload: SignalingPayload }) => {
        if (payload.receiverId !== currentUser.id) return;

        // Check if currently on a call
        if (callState !== 'idle') {
          sendSignal('call:busy', {
            callId: payload.callId,
            roomId: payload.roomId,
            receiverId: currentUser.id,
            callerId: payload.callerId,
            reason: 'User is on another call',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        const callerInfo: Member = {
          id: payload.callerId,
          email: '',
          name: payload.callerName || 'Fellow Member',
          display_name: payload.callerName || 'Fellow Member',
          avatar: payload.callerAvatar,
          role: (payload.callerRole as any) || 'standard',
          status: 'approved',
          created_at: new Date().toISOString(),
        };

        const incomingRecord: CallRecord = {
          id: payload.callId,
          caller_id: payload.callerId,
          receiver_id: currentUser.id,
          call_type: payload.callType,
          status: 'ringing',
          started_at: payload.timestamp,
          room_id: payload.roomId,
          created_at: payload.timestamp,
          caller_name: payload.callerName,
          caller_avatar: payload.callerAvatar,
          caller_role: payload.callerRole,
        };

        setTargetMember(callerInfo);
        setCurrentCall(incomingRecord);
        setCallType(payload.callType);
        setCallState('ringing_incoming');

        // Send 'call:ringing' acknowledgement back to caller so caller UI changes from "Calling..." to "Ringing..."
        sendSignal('call:ringing', {
          callId: payload.callId,
          roomId: payload.roomId,
          callerId: payload.callerId,
          receiverId: currentUser.id,
          timestamp: new Date().toISOString(),
        });

        // Play Ringtone
        callAudio.playRingtone(settings.ringtone_volume);

        // Show Browser Notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Incoming ${payload.callType.toUpperCase()} Call`, {
            body: `${payload.callerName || 'A member'} is calling you...`,
            icon: payload.callerAvatar || '/icon.png',
          });
        }

        // Set 30s Ringing Timeout
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = setTimeout(() => {
          if (callStateRef.current === 'ringing_incoming') {
            declineCall('No Answer (Timeout 30s)');
          }
        }, 30000);
      })
      .on('broadcast', { event: 'call:ringing' }, ({ payload }: { payload: SignalingPayload }) => {
        if (payload.callerId === currentUser.id) {
          setIsCalleeRinging(true);
        }
      })
      .on('broadcast', { event: 'call:accept' }, async ({ payload }: { payload: SignalingPayload }) => {
        if (payload.callerId !== currentUser.id) return;
        callAudio.stopAll();

        if (ringTimeoutRef.current) {
          clearTimeout(ringTimeoutRef.current);
          ringTimeoutRef.current = null;
        }

        setCallState('active');

        // Broadcast 'in_call' status to Supabase Presence
        if (presenceChannelRef.current) {
          presenceChannelRef.current.track({
            userId: currentUser.id,
            status: 'in_call',
            lastSeen: new Date().toISOString(),
            name: currentUser.display_name || currentUser.name,
            avatar: currentUser.avatar,
          }).catch(() => {});
        }

        if (currentCall) {
          const updated = { ...currentCall, status: 'accepted' as CallStatus, answered_at: new Date().toISOString() };
          setCurrentCall(updated);
          callingService.recordCall(updated);
        }

        // Create WebRTC Offer
        try {
          const pc = peerConnectionRef.current;
          if (pc) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            sendSignal('webrtc:offer', {
              callId: payload.callId,
              roomId: payload.roomId,
              callerId: currentUser.id,
              receiverId: payload.receiverId,
              callType,
              sdp: offer,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.error('Failed creating WebRTC offer:', e);
        }
      })
      .on('broadcast', { event: 'call:decline' }, async ({ payload }: { payload: SignalingPayload }) => {
        if (payload.callerId !== currentUser.id) return;

        if (ringTimeoutRef.current) {
          clearTimeout(ringTimeoutRef.current);
          ringTimeoutRef.current = null;
        }

        callAudio.playBusyTone();
        setCallState('ended');

        const activeCall = currentCallRef.current || currentCall;

        if (activeCall) {
          const isNoAnswer = payload.reason?.includes('No Answer') || payload.reason?.includes('Timeout');
          const finalStatus: CallStatus = isNoAnswer ? 'missed' : 'declined';
          const updated = { ...activeCall, status: finalStatus, ended_at: new Date().toISOString() };
          callingService.recordCall(updated);
          callingService.addCallNotification({
            receiver_id: currentUser.id,
            caller_id: payload.receiverId,
            status: isNoAnswer ? 'missed' : 'rejected',
            caller_name: targetMember?.display_name || targetMember?.name,
            caller_avatar: targetMember?.avatar,
            call_type: callType,
          });
        }

        setTimeout(() => {
          cleanupMediaAndPeer();
          setCallState('idle');
          setCurrentCall(null);
          setTargetMember(null);
        }, 2500);
      })
      .on('broadcast', { event: 'call:busy' }, async ({ payload }: { payload: SignalingPayload }) => {
        if (payload.callerId !== currentUser.id) return;

        callAudio.playBusyTone();
        setCallState('ended');

        setTimeout(() => {
          cleanupMediaAndPeer();
          setCallState('idle');
          setCurrentCall(null);
          setTargetMember(null);
        }, 2500);
      })
      .on('broadcast', { event: 'call:cancel' }, ({ payload }: { payload: SignalingPayload }) => {
        if (payload.receiverId !== currentUser.id) return;

        callAudio.stopAll();
        callingService.addCallNotification({
          receiver_id: currentUser.id,
          caller_id: payload.callerId,
          status: 'missed',
          caller_name: targetMember?.display_name || targetMember?.name,
          caller_avatar: targetMember?.avatar,
          call_type: callType,
        });

        cleanupMediaAndPeer();
        setCallState('idle');
        setCurrentCall(null);
        setTargetMember(null);
      })
      .on('broadcast', { event: 'call:end' }, ({ payload }: { payload: SignalingPayload }) => {
        if (payload.receiverId !== currentUser.id && payload.callerId !== currentUser.id) return;

        callAudio.playEndCallTone();
        setCallState('ended');

        if (currentCall) {
          const updated = {
            ...currentCall,
            status: 'ended' as CallStatus,
            ended_at: new Date().toISOString(),
            duration: callDuration
          };
          callingService.recordCall(updated);
        }

        setTimeout(() => {
          cleanupMediaAndPeer();
          setCallState('idle');
          setCurrentCall(null);
          setTargetMember(null);
        }, 1500);
      })
      .on('broadcast', { event: 'webrtc:offer' }, async ({ payload }: { payload: SignalingPayload }) => {
        if (payload.receiverId !== currentUser.id) return;

        const pc = peerConnectionRef.current;
        if (!pc || !payload.sdp) return;

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await processQueuedIceCandidates();

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          sendSignal('webrtc:answer', {
            callId: payload.callId,
            roomId: payload.roomId,
            callerId: payload.callerId,
            receiverId: currentUser.id,
            sdp: answer,
            timestamp: new Date().toISOString(),
          });
        } catch (e) {
          console.error('Error handling offer:', e);
        }
      })
      .on('broadcast', { event: 'webrtc:answer' }, async ({ payload }: { payload: SignalingPayload }) => {
        if (payload.callerId !== currentUser.id) return;

        const pc = peerConnectionRef.current;
        if (!pc || !payload.sdp) return;

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await processQueuedIceCandidates();
        } catch (e) {
          console.error('Error handling answer:', e);
        }
      })
      .on('broadcast', { event: 'webrtc:ice_candidate' }, async ({ payload }: { payload: SignalingPayload }) => {
        if (payload.receiverId !== currentUser.id && payload.callerId !== currentUser.id) return;

        const pc = peerConnectionRef.current;
        if (payload.candidate) {
          if (pc && pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
              console.warn('ICE candidate addition failed:', e);
            }
          } else {
            iceCandidatesQueueRef.current.push(payload.candidate);
          }
        }
      })
      .subscribe();

    signalingChannelRef.current = signalingChannel;

    // 2. Presence Tracking Channel
    const presenceChannel = supabase.channel('sy_presence_channel', {
      config: { presence: { key: currentUser.id } }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const map = new Map<string, UserPresence>();

        Object.keys(state).forEach(key => {
          const userArr = state[key] as any[];
          if (userArr && userArr.length > 0) {
            const p = userArr[0];
            map.set(key, {
              userId: key,
              status: p.status || 'online',
              lastSeen: p.lastSeen || new Date().toISOString(),
              name: p.name,
              avatar: p.avatar,
            });
          }
        });

        setPresenceMap(map);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          let currentPresenceStatus: UserPresenceStatus = 'online';
          if (callState === 'active' || callState === 'ringing_outgoing' || callState === 'ringing_incoming') {
            currentPresenceStatus = 'in_call';
          }
          await presenceChannel.track({
            userId: currentUser.id,
            status: currentPresenceStatus,
            lastSeen: new Date().toISOString(),
            name: currentUser.display_name || currentUser.name,
            avatar: currentUser.avatar,
          });
        }
      });

    presenceChannelRef.current = presenceChannel;

    return () => {
      supabase.removeChannel(signalingChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [currentUser, callState, currentCall, targetMember, callType, settings.ringtone_volume, sendSignal, cleanupMediaAndPeer, processQueuedIceCandidates]);

  // Update online presence when callState changes
  useEffect(() => {
    if (presenceChannelRef.current && currentUser?.id) {
      let status: UserPresenceStatus = 'online';
      if (callState === 'active' || callState === 'ringing_incoming' || callState === 'ringing_outgoing') {
        status = 'in_call';
      }
      presenceChannelRef.current.track({
        userId: currentUser.id,
        status,
        lastSeen: new Date().toISOString(),
        name: currentUser.display_name || currentUser.name,
        avatar: currentUser.avatar,
      }).catch(() => {});
    }
  }, [callState, currentUser]);

  // Start an Outgoing Call
  const startCall = async (target: Member, type: CallType) => {
    if (!currentUser?.id) {
      alert('Please log in to initiate calls.');
      return;
    }

    const isCallingEnabled = typeof window !== 'undefined' ? localStorage.getItem('sy_enable_calling_services') !== 'false' : true;
    const isAdmin = currentUser.email?.toLowerCase() === 'tkpaite2016@gmail.com';
    if (!isCallingEnabled && !isAdmin) {
      alert('Voice and video calling services are currently disabled by administrators.');
      return;
    }

    if (callState !== 'idle') {
      alert('You are already on an active call.');
      return;
    }

    const callId = crypto.randomUUID();
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    setTargetMember(target);
    setCallType(type);
    setIsCalleeRinging(false);
    setCallState('ringing_outgoing');

    const newCall: CallRecord = {
      id: callId,
      caller_id: currentUser.id,
      receiver_id: target.id,
      call_type: type,
      status: 'ringing',
      started_at: new Date().toISOString(),
      room_id: roomId,
      created_at: new Date().toISOString(),
      caller_name: currentUser.display_name || currentUser.name,
      caller_avatar: currentUser.avatar,
      caller_role: currentUser.role,
      receiver_name: target.display_name || target.name,
      receiver_avatar: target.avatar,
      receiver_role: target.role,
    };

    setCurrentCall(newCall);
    callingService.recordCall(newCall);

    // Play Outgoing Ringback Dial Tone
    callAudio.playDialTone(settings.ringtone_volume);

    try {
      // 1. Capture user media stream
      const stream = await getUserMediaStream(type);

      // 2. Setup RTCPeerConnection and attach tracks
      const pc = setupPeerConnection(type, callId, roomId);
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // 3. Send Signaling Call Invite
      sendSignal('call:invite', {
        callId,
        roomId,
        callerId: currentUser.id,
        callerName: currentUser.display_name || currentUser.name,
        callerAvatar: currentUser.avatar,
        callerRole: currentUser.role,
        receiverId: target.id,
        callType: type,
        timestamp: new Date().toISOString(),
      });

      // Ringing timeout (30s) if no response / unanswered
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'ringing_outgoing') {
          endCall();
        }
      }, 30000);

    } catch (err: any) {
      console.error('Failed to initiate call:', err);
      callAudio.stopAll();
      setCallState('idle');
      setCurrentCall(null);
      setTargetMember(null);
      alert(`Could not access audio/video device: ${err.message || 'Permission denied'}`);
    }
  };

  // Accept an Incoming Call
  const acceptCall = async () => {
    if (!currentCall || !targetMember || !currentUser?.id) return;

    callAudio.stopAll();
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }

    try {
      // 1. Capture Media
      const stream = await getUserMediaStream(callType);

      // 2. Setup Peer Connection
      const pc = setupPeerConnection(callType, currentCall.id, currentCall.room_id);
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      setCallState('active');

      // Automatically broadcast 'in-call' status via Supabase Presence
      if (presenceChannelRef.current) {
        presenceChannelRef.current.track({
          userId: currentUser.id,
          status: 'in_call',
          lastSeen: new Date().toISOString(),
          name: currentUser.display_name || currentUser.name,
          avatar: currentUser.avatar,
        }).catch(() => {});
      }

      const updated = {
        ...currentCall,
        status: 'accepted' as CallStatus,
        answered_at: new Date().toISOString()
      };
      setCurrentCall(updated);
      callingService.recordCall(updated);

      // 3. Send Signal Call Accept
      sendSignal('call:accept', {
        callId: currentCall.id,
        roomId: currentCall.room_id,
        callerId: currentCall.caller_id,
        receiverId: currentUser.id,
        timestamp: new Date().toISOString(),
      });

    } catch (err: any) {
      console.error('Error accepting call:', err);
      declineCall('Failed to access media');
    }
  };

  // Decline an Incoming Call
  const declineCall = async (reason = 'Declined by user') => {
    callAudio.stopAll();

    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }

    const activeCall = currentCallRef.current || currentCall;

    if (activeCall && currentUser?.id) {
      sendSignal('call:decline', {
        callId: activeCall.id,
        roomId: activeCall.room_id,
        callerId: activeCall.caller_id,
        receiverId: currentUser.id,
        reason,
        timestamp: new Date().toISOString(),
      });

      const isNoAnswer = reason.includes('No Answer') || reason.includes('Timeout');
      const finalStatus: CallStatus = isNoAnswer ? 'missed' : 'declined';

      const updated = {
        ...activeCall,
        status: finalStatus,
        ended_at: new Date().toISOString()
      };
      callingService.recordCall(updated);

      // Add Missed/Rejected notification for receiver
      callingService.addCallNotification({
        receiver_id: currentUser.id,
        caller_id: activeCall.caller_id,
        status: isNoAnswer ? 'missed' : 'rejected',
        caller_name: targetMember?.display_name || targetMember?.name,
        caller_avatar: targetMember?.avatar,
        call_type: callType,
      });
    }

    cleanupMediaAndPeer();
    setCallState('idle');
    setCurrentCall(null);
    setTargetMember(null);
  };

  // End an Active or Outgoing Call
  const endCall = async () => {
    callAudio.playEndCallTone();

    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }

    const activeCall = currentCallRef.current || currentCall;

    if (activeCall && currentUser?.id) {
      const isOutgoingRinging = callStateRef.current === 'ringing_outgoing' || activeCall.status === 'ringing';

      sendSignal(isOutgoingRinging ? 'call:cancel' : 'call:end', {
        callId: activeCall.id,
        roomId: activeCall.room_id,
        callerId: activeCall.caller_id,
        receiverId: activeCall.receiver_id,
        timestamp: new Date().toISOString(),
      });

      const finalStatus: CallStatus = isOutgoingRinging ? 'missed' : 'ended';
      const updated = {
        ...activeCall,
        status: finalStatus,
        ended_at: new Date().toISOString(),
        duration: callDuration,
      };
      callingService.recordCall(updated);

      if (isOutgoingRinging) {
        callingService.addCallNotification({
          receiver_id: activeCall.receiver_id,
          caller_id: activeCall.caller_id,
          status: 'missed',
          caller_name: currentUser.display_name || currentUser.name,
          caller_avatar: currentUser.avatar,
          call_type: callType,
        });
      }
    }

    setIsCalleeRinging(false);
    setCallState('ended');
    setTimeout(() => {
      cleanupMediaAndPeer();
      setCallState('idle');
      setCurrentCall(null);
      setTargetMember(null);
    }, 1000);
  };

  // Toggle Microphone Mute
  const toggleMicrophone = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicMuted(!isMicMuted);
    }
  };

  // Toggle Camera Mute/Disable
  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  // Toggle Remote Speaker
  const toggleSpeaker = () => {
    setIsSpeakerMuted(!isSpeakerMuted);
  };

  // Screen Sharing
  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current) return;

    if (!isScreenSharing) {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = displayStream.getVideoTracks()[0];

        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');

        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
      } catch (e) {
        console.warn('Screen share cancelled:', e);
      }
    } else {
      // Revert back to camera stream
      if (localStreamRef.current) {
        const cameraTrack = localStreamRef.current.getVideoTracks()[0];
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');

        if (videoSender && cameraTrack) {
          videoSender.replaceTrack(cameraTrack);
        }
      }
      setIsScreenSharing(false);
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Toggle Picture-in-Picture
  const togglePiP = () => {
    setIsPiP(!isPiP);
  };

  // Switch Video Device (Camera)
  const switchCamera = async (deviceId: string) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(newVideoTrack);
        }
      }

      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(t => t.stop());
        localStreamRef.current.removeTrack(localStreamRef.current.getVideoTracks()[0]);
        localStreamRef.current.addTrack(newVideoTrack);
        setLocalStream(newStream);
      }
    } catch (err) {
      console.error('Failed switching camera:', err);
    }
  };

  // Update Call Settings
  const updateSettings = async (newSettings: Partial<CallSettings>) => {
    if (!currentUser?.id) return;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await callingService.saveCallSettings(updated);
  };

  // Mark all call notifications read
  const markNotificationsAsRead = async () => {
    if (!currentUser?.id) return;
    await callingService.markNotificationsRead(currentUser.id);
    const updated = await callingService.getNotifications(currentUser.id);
    setNotifications(updated);
  };

  const refreshHistory = async () => {
    if (currentUser?.id) {
      const notifs = await callingService.getNotifications(currentUser.id);
      setNotifications(notifs);
    }
  };

  const unreadNotifCount = notifications.filter(n => !n.is_read).length;

  return (
    <CallingContext.Provider
      value={{
        callState,
        isCalleeRinging,
        currentCall,
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
        settings,
        presenceMap,
        notifications,
        unreadNotifCount,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMicrophone,
        toggleCamera,
        toggleSpeaker,
        toggleScreenShare,
        toggleFullscreen,
        togglePiP,
        switchCamera,
        updateSettings,
        markNotificationsAsRead,
        refreshHistory,
      }}
    >
      {children}
    </CallingContext.Provider>
  );
};

export const useCalling = () => {
  const context = useContext(CallingContext);
  if (!context) {
    throw new Error('useCalling must be used within a CallingProvider');
  }
  return context;
};
