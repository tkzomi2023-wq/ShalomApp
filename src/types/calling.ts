/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CallType = 'voice' | 'video';

export type CallState = 'idle' | 'ringing_incoming' | 'ringing_outgoing' | 'active' | 'ended';

export type CallStatus = 
  | 'ringing' 
  | 'accepted' 
  | 'declined' 
  | 'busy' 
  | 'ended' 
  | 'missed' 
  | 'cancelled';

export interface CallRecord {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: CallType;
  status: CallStatus;
  started_at: string;
  answered_at?: string;
  ended_at?: string;
  duration?: number; // Duration in seconds
  room_id: string;
  created_at: string;
  updated_at?: string;

  // Populated metadata for UI display
  caller_name?: string;
  caller_avatar?: string;
  caller_role?: string;
  receiver_name?: string;
  receiver_avatar?: string;
  receiver_role?: string;
}

export interface CallParticipant {
  id: string;
  call_id: string;
  user_id: string;
  joined_at: string;
  left_at?: string;
  device?: string;
  network?: string;
}

export interface CallNotification {
  id: string;
  receiver_id: string;
  caller_id: string;
  status: 'missed' | 'rejected' | 'ended';
  is_read: boolean;
  created_at: string;
  caller_name?: string;
  caller_avatar?: string;
  call_type?: CallType;
}

export interface CallSettings {
  user_id: string;
  microphone_enabled: boolean;
  camera_enabled: boolean;
  speaker_enabled: boolean;
  video_quality: '480p' | '720p' | '1080p';
  preferred_camera?: string;
  preferred_microphone?: string;
  preferred_speaker?: string;
  ringtone_volume?: number;
  auto_answer?: boolean;
  turn_server_url?: string;
  turn_username?: string;
  turn_credential?: string;
  turn_enabled?: boolean;
  updated_at?: string;
}

export type UserPresenceStatus = 'online' | 'offline' | 'busy' | 'in_call' | 'away' | 'dnd';

export interface UserPresence {
  userId: string;
  status: UserPresenceStatus;
  lastSeen: string;
  name?: string;
  avatar?: string;
  role?: string;
}

export type SignalingEventType = 
  | 'call:invite'
  | 'call:ringing'
  | 'call:accept'
  | 'call:decline'
  | 'call:busy'
  | 'call:cancel'
  | 'call:end'
  | 'webrtc:offer'
  | 'webrtc:answer'
  | 'webrtc:ice_candidate'
  | 'presence:heartbeat';

export interface SignalingPayload {
  callId: string;
  roomId: string;
  callerId: string;
  callerName?: string;
  callerAvatar?: string;
  callerRole?: string;
  receiverId: string;
  receiverName?: string;
  callType: CallType;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  reason?: string;
  timestamp: string;
}

export interface CommunicationStats {
  totalCalls: number;
  voiceCallsCount: number;
  videoCallsCount: number;
  totalDurationSeconds: number;
  missedCallsCount: number;
  callSuccessRate: number; // percentage 0-100
  dailyCalls: { date: string; voice: number; video: number }[];
}
