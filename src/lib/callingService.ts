/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Database service layer for calls, notifications, participants, and settings.
 * Supports Supabase tables with resilient local fallback.
 */

import { supabase } from './supabase';
import { 
  CallRecord, 
  CallParticipant, 
  CallNotification, 
  CallSettings, 
  CommunicationStats,
  CallType,
  CallStatus 
} from '../types/calling';

const CALL_SETTINGS_LOCAL_KEY = 'sy_call_settings_v1';
const CALL_HISTORY_LOCAL_KEY = 'sy_call_history_v1';
const CALL_NOTIFICATIONS_LOCAL_KEY = 'sy_call_notifications_v1';

export const callingService = {
  /**
   * Get user call settings
   */
  async getCallSettings(userId: string): Promise<CallSettings> {
    const defaultSettings: CallSettings = {
      user_id: userId,
      microphone_enabled: true,
      camera_enabled: true,
      speaker_enabled: true,
      video_quality: '720p',
      ringtone_volume: 0.8,
      auto_answer: false,
      turn_enabled: false,
    };

    try {
      const { data, error } = await supabase
        .from('call_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (data && !error) {
        return { ...defaultSettings, ...data };
      }
    } catch (e) {
      console.warn('Unable to query call_settings table, checking local storage:', e);
    }

    // Fallback to local storage
    try {
      const cached = localStorage.getItem(`${CALL_SETTINGS_LOCAL_KEY}_${userId}`);
      if (cached) {
        return { ...defaultSettings, ...JSON.parse(cached) };
      }
    } catch (e) {}

    return defaultSettings;
  },

  /**
   * Save user call settings
   */
  async saveCallSettings(settings: CallSettings): Promise<CallSettings> {
    try {
      localStorage.setItem(`${CALL_SETTINGS_LOCAL_KEY}_${settings.user_id}`, JSON.stringify(settings));
    } catch (e) {}

    try {
      const { data, error } = await supabase
        .from('call_settings')
        .upsert({
          user_id: settings.user_id,
          microphone_enabled: settings.microphone_enabled,
          camera_enabled: settings.camera_enabled,
          speaker_enabled: settings.speaker_enabled,
          video_quality: settings.video_quality,
          preferred_camera: settings.preferred_camera,
          preferred_microphone: settings.preferred_microphone,
          preferred_speaker: settings.preferred_speaker,
          ringtone_volume: settings.ringtone_volume,
          auto_answer: settings.auto_answer,
          turn_server_url: settings.turn_server_url,
          turn_username: settings.turn_username,
          turn_credential: settings.turn_credential,
          turn_enabled: settings.turn_enabled,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (data && !error) {
        return data as CallSettings;
      }
    } catch (e) {
      console.warn('Call settings DB save deferred/fallback active:', e);
    }

    return settings;
  },

  /**
   * Create or update a call record
   */
  async recordCall(call: Partial<CallRecord>): Promise<CallRecord> {
    const callRecord: CallRecord = {
      id: call.id || crypto.randomUUID(),
      caller_id: call.caller_id || '',
      receiver_id: call.receiver_id || '',
      call_type: call.call_type || 'voice',
      status: call.status || 'ringing',
      started_at: call.started_at || new Date().toISOString(),
      answered_at: call.answered_at,
      ended_at: call.ended_at,
      duration: call.duration || 0,
      room_id: call.room_id || `room_${Date.now()}`,
      created_at: call.created_at || new Date().toISOString(),
      caller_name: call.caller_name,
      caller_avatar: call.caller_avatar,
      caller_role: call.caller_role,
      receiver_name: call.receiver_name,
      receiver_avatar: call.receiver_avatar,
      receiver_role: call.receiver_role,
    };

    // Store in local history cache
    try {
      const history = this.getLocalCallHistory();
      const existingIdx = history.findIndex(c => c.id === callRecord.id);
      if (existingIdx >= 0) {
        history[existingIdx] = { ...history[existingIdx], ...callRecord };
      } else {
        history.unshift(callRecord);
      }
      localStorage.setItem(CALL_HISTORY_LOCAL_KEY, JSON.stringify(history.slice(0, 100)));
    } catch (e) {}

    // Persist to Supabase if table exists
    try {
      const { data, error } = await supabase
        .from('calls')
        .upsert({
          id: callRecord.id,
          caller_id: callRecord.caller_id,
          receiver_id: callRecord.receiver_id,
          call_type: callRecord.call_type,
          status: callRecord.status,
          started_at: callRecord.started_at,
          answered_at: callRecord.answered_at,
          ended_at: callRecord.ended_at,
          duration: callRecord.duration,
          room_id: callRecord.room_id,
          created_at: callRecord.created_at,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (data && !error) {
        return { ...callRecord, ...data };
      }
    } catch (e) {
      console.warn('Call record DB sync warning (table missing or RLS):', e);
    }

    return callRecord;
  },

  /**
   * Get call history for a user
   */
  async getCallHistory(userId: string): Promise<CallRecord[]> {
    let callList: CallRecord[] = [];

    try {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (data && !error && data.length > 0) {
        callList = data as CallRecord[];
      }
    } catch (e) {
      console.warn('Could not load calls from DB, using local store:', e);
    }

    if (callList.length === 0) {
      callList = this.getLocalCallHistory().filter(c => c.caller_id === userId || c.receiver_id === userId);
    }

    // Populate user profile metadata for caller/receiver
    try {
      const { data: profiles } = await supabase.from('profiles').select('id, name, display_name, avatar, role');
      if (profiles && profiles.length > 0) {
        const profileMap = new Map(profiles.map(p => [p.id, p]));
        callList = callList.map(c => {
          const caller = profileMap.get(c.caller_id);
          const receiver = profileMap.get(c.receiver_id);
          return {
            ...c,
            caller_name: c.caller_name || caller?.display_name || caller?.name || 'Unknown User',
            caller_avatar: c.caller_avatar || caller?.avatar,
            caller_role: c.caller_role || caller?.role,
            receiver_name: c.receiver_name || receiver?.display_name || receiver?.name || 'Unknown User',
            receiver_avatar: c.receiver_avatar || receiver?.avatar,
            receiver_role: c.receiver_role || receiver?.role,
          };
        });
      }
    } catch (e) {}

    return callList;
  },

  /**
   * Add a call participant log
   */
  async recordParticipant(participant: Partial<CallParticipant>): Promise<void> {
    try {
      await supabase.from('call_participants').insert({
        id: crypto.randomUUID(),
        call_id: participant.call_id,
        user_id: participant.user_id,
        joined_at: participant.joined_at || new Date().toISOString(),
        left_at: participant.left_at,
        device: participant.device || navigator.userAgent,
        network: participant.network || 'WebRTC',
      });
    } catch (e) {}
  },

  /**
   * Add a call notification (missed/rejected call)
   */
  async addCallNotification(notif: Partial<CallNotification>): Promise<CallNotification> {
    const notification: CallNotification = {
      id: notif.id || crypto.randomUUID(),
      receiver_id: notif.receiver_id || '',
      caller_id: notif.caller_id || '',
      status: notif.status || 'missed',
      is_read: false,
      created_at: new Date().toISOString(),
      caller_name: notif.caller_name,
      caller_avatar: notif.caller_avatar,
      call_type: notif.call_type || 'voice',
    };

    // Store in local storage
    try {
      const list = this.getLocalNotifications();
      list.unshift(notification);
      localStorage.setItem(CALL_NOTIFICATIONS_LOCAL_KEY, JSON.stringify(list.slice(0, 50)));
    } catch (e) {}

    try {
      await supabase.from('call_notifications').insert({
        id: notification.id,
        receiver_id: notification.receiver_id,
        caller_id: notification.caller_id,
        status: notification.status,
        is_read: false,
        created_at: notification.created_at,
      });
    } catch (e) {}

    return notification;
  },

  /**
   * Get unread call notifications for user
   */
  async getNotifications(userId: string): Promise<CallNotification[]> {
    let list: CallNotification[] = [];

    try {
      const { data, error } = await supabase
        .from('call_notifications')
        .select('*')
        .eq('receiver_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (data && !error) {
        list = data as CallNotification[];
      }
    } catch (e) {}

    if (list.length === 0) {
      list = this.getLocalNotifications().filter(n => n.receiver_id === userId);
    }

    return list;
  },

  /**
   * Mark all call notifications as read
   */
  async markNotificationsRead(userId: string): Promise<void> {
    try {
      const list = this.getLocalNotifications();
      const updated = list.map(n => n.receiver_id === userId ? { ...n, is_read: true } : n);
      localStorage.setItem(CALL_NOTIFICATIONS_LOCAL_KEY, JSON.stringify(updated));
    } catch (e) {}

    try {
      await supabase
        .from('call_notifications')
        .update({ is_read: true })
        .eq('receiver_id', userId);
    } catch (e) {}
  },

  /**
   * Delete a call from history
   */
  async deleteCallHistoryItem(callId: string): Promise<void> {
    try {
      const list = this.getLocalCallHistory().filter(c => c.id !== callId);
      localStorage.setItem(CALL_HISTORY_LOCAL_KEY, JSON.stringify(list));
    } catch (e) {}

    try {
      await supabase.from('calls').delete().eq('id', callId);
    } catch (e) {}
  },

  /**
   * Calculate aggregated communication analytics
   */
  async getStats(userId?: string): Promise<CommunicationStats> {
    const history = await this.getCallHistory(userId || '');
    
    const voiceCalls = history.filter(c => c.call_type === 'voice');
    const videoCalls = history.filter(c => c.call_type === 'video');
    const totalDuration = history.reduce((acc, c) => acc + (c.duration || 0), 0);
    const missed = history.filter(c => c.status === 'missed' || c.status === 'declined');
    const accepted = history.filter(c => c.status === 'accepted' || c.status === 'ended');
    const successRate = history.length > 0 ? Math.round((accepted.length / history.length) * 100) : 100;

    // Last 7 days breakdown
    const dailyMap = new Map<string, { voice: number; video: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyMap.set(dateStr, { voice: 0, video: 0 });
    }

    history.forEach(c => {
      const dateStr = c.created_at.split('T')[0];
      if (dailyMap.has(dateStr)) {
        const item = dailyMap.get(dateStr)!;
        if (c.call_type === 'voice') item.voice++;
        else item.video++;
      }
    });

    const dailyCalls = Array.from(dailyMap.entries()).map(([date, counts]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      voice: counts.voice,
      video: counts.video,
    }));

    return {
      totalCalls: history.length,
      voiceCallsCount: voiceCalls.length,
      videoCallsCount: videoCalls.length,
      totalDurationSeconds: totalDuration,
      missedCallsCount: missed.length,
      callSuccessRate: successRate,
      dailyCalls,
    };
  },

  getLocalCallHistory(): CallRecord[] {
    try {
      const raw = localStorage.getItem(CALL_HISTORY_LOCAL_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  getLocalNotifications(): CallNotification[] {
    try {
      const raw = localStorage.getItem(CALL_NOTIFICATIONS_LOCAL_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
};
