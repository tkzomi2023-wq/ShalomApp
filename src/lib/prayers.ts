import { supabase } from './supabase';
import { Member, PrayerRequest, isOBUser, DEFAULT_ADMIN_EMAIL } from '../types';

const LOCAL_STORAGE_KEY = 'sy_local_prayer_requests';

// Initial mock data if empty (for seamless offline preview)
const MOCK_PRAYER_REQUESTS: PrayerRequest[] = [
  {
    id: 'pr-mock-001',
    user_id: 'mock-user-123',
    user_name: 'Anonymous Member',
    user_email: 'member1@shalomyouth.org',
    title: 'Prayer for Healing and Recovery',
    category: 'Health & Healing',
    details: 'Please pray for my mother who is undergoing surgery this coming Thursday. Pray for successful procedure and fast recovery.',
    is_anonymous: true,
    status: 'pending',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'pr-mock-002',
    user_id: 'mock-user-456',
    user_name: 'Anonymous Member',
    user_email: 'member2@shalomyouth.org',
    title: 'Guidance for Youth Career & Exams',
    category: 'Youth & Studies',
    details: 'Seeking prayer support for our youth preparing for competitive examinations next month. Pray for clarity of mind and peace.',
    is_anonymous: true,
    status: 'prayed',
    prayed_by_id: 'admin-uuid-001',
    prayed_by_name: 'T.K. Paite (Founder)',
    prayed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    ob_note: 'The OB Committee has prayed over your exams and career path during our youth intercession service. Be strong and courageous!',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export class PrayerService {
  /**
   * Fetch prayer requests.
   * - Authorized OB Committee members can view ALL requests.
   * - Standard members can ONLY view their OWN submitted requests.
   */
  async getPrayerRequests(currentUser: Member | null): Promise<PrayerRequest[]> {
    if (!currentUser) return [];

    const isOB = currentUser.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || isOBUser(currentUser.role);

    try {
      let query = supabase.from('prayer_requests').select('*').order('created_at', { ascending: false });
      
      // If NOT an OB, restrict query to only requests created by this user
      if (!isOB) {
        const filters: string[] = [];
        if (currentUser.id) filters.push(`user_id.eq.${currentUser.id}`);
        if (currentUser.email) filters.push(`user_email.ilike.${currentUser.email}`);
        if (filters.length > 0) {
          query = query.or(filters.join(','));
        }
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Supabase fetch prayer_requests error, utilizing local cache:', error.message);
      }

      const remoteData = (data || []) as PrayerRequest[];
      const existingLocal = this.getLocalRequests();
      const merged = this.mergeRequests(remoteData, existingLocal);

      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
      } catch (_) {}

      if (!isOB) {
        return merged.filter(r => 
          r.user_id === currentUser.id || 
          (r.user_email && currentUser.email && r.user_email.toLowerCase() === currentUser.email.toLowerCase())
        );
      }

      return merged;
    } catch (err) {
      console.warn('Prayer requests fallback to local cache:', err);
      const local = this.getLocalRequests();
      if (!isOB) {
        return local.filter(r => 
          r.user_id === currentUser.id || 
          (r.user_email && currentUser.email && r.user_email.toLowerCase() === currentUser.email.toLowerCase())
        );
      }
      return local;
    }
  }

  /**
   * Create a new prayer request.
   * Enforces user linkage (`user_id = auth.uid() / currentUser.id`).
   */
  async createPrayerRequest(
    request: {
      title: string;
      category: string;
      details: string;
      is_anonymous: boolean;
    },
    currentUser: Member
  ): Promise<PrayerRequest> {
    if (!currentUser) throw new Error('You must be logged in to post a prayer request.');

    const newRequest: PrayerRequest = {
      id: `pr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      user_id: currentUser.id,
      user_name: request.is_anonymous ? 'Anonymous Member' : (currentUser.display_name || currentUser.name),
      user_email: currentUser.email,
      title: request.title.trim(),
      category: request.category || 'General',
      details: request.details.trim(),
      is_anonymous: Boolean(request.is_anonymous),
      status: 'pending',
      created_at: new Date().toISOString()
    };

    // 1. Always save to local cache first to guarantee instant UI availability
    this.saveToLocalCache(newRequest);

    // 2. Save to Supabase (with the same ID)
    try {
      const { data, error } = await supabase
        .from('prayer_requests')
        .insert({
          id: newRequest.id,
          user_id: newRequest.user_id,
          user_name: newRequest.user_name,
          user_email: newRequest.user_email,
          title: newRequest.title,
          category: newRequest.category,
          details: newRequest.details,
          is_anonymous: newRequest.is_anonymous,
          status: newRequest.status,
          created_at: newRequest.created_at
        })
        .select()
        .single();

      if (error) {
        console.warn('Supabase insert prayer request notice:', error.message);
      } else if (data) {
        this.saveToLocalCache(data as PrayerRequest);
        return data as PrayerRequest;
      }
    } catch (err) {
      console.warn('Failed to insert prayer request into Supabase, utilizing cached version:', err);
    }

    return newRequest;
  }

  /**
   * Update an existing prayer request
   */
  async updatePrayerRequest(
    requestId: string,
    updates: {
      title?: string;
      category?: string;
      details?: string;
      is_anonymous?: boolean;
    },
    currentUser: Member
  ): Promise<boolean> {
    if (!currentUser) throw new Error('Unauthorized');
    const isOB = currentUser.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || isOBUser(currentUser.role);

    const payload: any = {
      updated_at: new Date().toISOString()
    };
    if (updates.title !== undefined) payload.title = updates.title.trim();
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.details !== undefined) payload.details = updates.details.trim();
    if (updates.is_anonymous !== undefined) {
      payload.is_anonymous = updates.is_anonymous;
      payload.user_name = updates.is_anonymous ? 'Anonymous Member' : (currentUser.display_name || currentUser.name);
    }

    // Update local cache immediately
    this.updateLocalRequest(requestId, payload);

    try {
      let query = supabase.from('prayer_requests').update(payload).eq('id', requestId);
      if (!isOB) {
        const filters: string[] = [];
        if (currentUser.id) filters.push(`user_id.eq.${currentUser.id}`);
        if (currentUser.email) filters.push(`user_email.ilike.${currentUser.email}`);
        if (filters.length > 0) {
          query = query.or(filters.join(','));
        }
      }
      const { error } = await query;
      if (error) console.warn('Supabase update prayer request warning:', error.message);
    } catch (err) {
      console.warn('Failed to update prayer request in Supabase:', err);
    }

    return true;
  }

  /**
   * Mark a prayer request as "Prayed for" by an authorized OB committee member.
   */
  async markAsPrayed(
    requestId: string,
    obUser: Member,
    obNote?: string
  ): Promise<boolean> {
    const isOB = obUser.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || isOBUser(obUser.role);
    if (!isOB) {
      throw new Error('Permission Denied: Only authorized OB Committee members can mark prayer requests as prayed.');
    }

    const prayedByName = obUser.display_name || obUser.name;
    const prayedAt = new Date().toISOString();

    const updates = {
      status: 'prayed' as const,
      prayed_by_id: obUser.id,
      prayed_by_name: prayedByName,
      prayed_at: prayedAt,
      ob_note: obNote ? obNote.trim() : null,
      updated_at: prayedAt
    };

    // Update local cache immediately
    this.updateLocalRequest(requestId, updates);

    // Try Supabase update
    try {
      const { error } = await supabase
        .from('prayer_requests')
        .update(updates)
        .eq('id', requestId);

      if (error) console.warn('Supabase markAsPrayed error:', error.message);
    } catch (err) {
      console.warn('Failed to update prayer status on Supabase:', err);
    }

    return true;
  }

  /**
   * Revert status back to "Pending" (In Prayer)
   */
  async markAsPending(requestId: string, obUser: Member): Promise<boolean> {
    const isOB = obUser.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || isOBUser(obUser.role);
    if (!isOB) {
      throw new Error('Permission Denied: Only authorized OB Committee members can manage prayer request status.');
    }

    const updates = {
      status: 'pending' as const,
      prayed_by_id: null,
      prayed_by_name: null,
      prayed_at: null,
      ob_note: null,
      updated_at: new Date().toISOString()
    };

    // Update local cache immediately
    this.updateLocalRequest(requestId, updates);

    try {
      const { error } = await supabase
        .from('prayer_requests')
        .update(updates)
        .eq('id', requestId);
      if (error) console.warn('Supabase markAsPending notice:', error.message);
    } catch (_) {}

    return true;
  }

  /**
   * Delete a prayer request (by the creator or an OB)
   */
  async deletePrayerRequest(requestId: string, currentUser: Member): Promise<boolean> {
    if (!currentUser) throw new Error('Unauthorized');

    // Delete locally immediately
    try {
      const local = this.getLocalRequests();
      const filtered = local.filter(r => r.id !== requestId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    } catch (_) {}

    try {
      const { error } = await supabase
        .from('prayer_requests')
        .delete()
        .eq('id', requestId);

      if (error) console.warn('Supabase delete prayer request warning:', error.message);
    } catch (err) {
      console.warn('Failed to delete prayer request from Supabase:', err);
    }

    return true;
  }

  // --- Local Storage Helpers ---
  private getLocalRequests(): PrayerRequest[] {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return MOCK_PRAYER_REQUESTS;
  }

  private saveToLocalCache(req: PrayerRequest) {
    try {
      const current = this.getLocalRequests();
      const idx = current.findIndex(r => r.id === req.id);
      if (idx > -1) {
        current[idx] = { ...current[idx], ...req };
      } else {
        current.unshift(req);
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
    } catch (_) {}
  }

  private updateLocalRequest(id: string, updates: Partial<PrayerRequest>) {
    try {
      const current = this.getLocalRequests();
      const updated = current.map(r => r.id === id ? { ...r, ...updates } : r);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (_) {}
  }

  private mergeRequests(remote: PrayerRequest[], local: PrayerRequest[]): PrayerRequest[] {
    const map = new Map<string, PrayerRequest>();
    remote.forEach(r => map.set(r.id, r));
    local.forEach(l => {
      if (!map.has(l.id)) map.set(l.id, l);
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}

export const prayerService = new PrayerService();
