/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, db } from './supabase';

export interface ServiceSchedule {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "04:30 PM"
  speaker: string; // Speaker or Sermon leader
  leader: string;  // Chairman / Leader
  topic?: string;
  venue?: string;   // Optional venue
  solo?: string;   // Solo presentation
  sumpi_aapna?: string; // Dedicated Offering
  lst_simna_quiz?: string; // Scripture Reading & Quiz
  sumpi_khon_ding?: string; // Offering collector
  notes?: string;
  thumbnail?: string; // Built-in preset URL or base64 data string
  segment_order?: string[]; // Optional custom reordered list of segment keys
  created_at: string;
  created_by_email: string;
  created_by_name: string;
}

export const INITIAL_SCHEDULES: ServiceSchedule[] = [
  {
    id: 'sched-1',
    title: 'Youth Fellowship & Worship',
    date: '2026-06-28',
    time: '04:30 PM',
    speaker: 'Pastor Joseph Thang Mun Lian',
    leader: 'Tg. Do Lian Zau',
    topic: 'Standing Strong in Faith',
    venue: 'Shalom Sanctuary, Zemabawk',
    solo: 'Lia Ching Sian Muani',
    sumpi_aapna: 'Tg. Khup Sian Muan & Lia Mercy Cing',
    lst_simna_quiz: 'Sermon Chapter 3 scripture simna',
    sumpi_khon_ding: 'Lia Thang Cing & Lia Nuam San',
    notes: 'Bring your friends and family! Light refreshments to be served after service.',
    thumbnail: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=600&auto=format&fit=crop',
    created_at: new Date('2026-06-20T10:00:00Z').toISOString(),
    created_by_email: 'tkpaite2016@gmail.com',
    created_by_name: 'T.K. Paite (Founder)'
  },
  {
    id: 'sched-2',
    title: 'Youth Scripture Study & Discussion',
    date: '2026-07-05',
    time: '04:30 PM',
    speaker: 'Lia Nuam San Cing',
    leader: 'Lia Rebecca Cing Sian Hoih',
    topic: 'Exposing the Truth in Word',
    venue: 'Fellowship Hall, Zuangtui',
    solo: 'Tg. Kam Sian Lal',
    sumpi_aapna: 'Tg. Sian Lam Thang',
    lst_simna_quiz: 'James Epistle study and Biblical trivia speedrun quiz',
    sumpi_khon_ding: 'Lia Rebecca Sian & Tg. Do Sian',
    notes: 'Please read Epistle of James Chapters 1 & 2 before the session.',
    thumbnail: 'https://images.unsplash.com/photo-1504052434569-7c9602df539f?q=80&w=600&auto=format&fit=crop',
    created_at: new Date('2026-06-21T09:30:00Z').toISOString(),
    created_by_email: 'tkpaite2016@gmail.com',
    created_by_name: 'T.K. Paite (Founder)'
  }
];

function getLocalSegmentOrders(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem('sy_segment_orders');
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function saveLocalSegmentOrder(id: string, order: string[]) {
  try {
    const orders = getLocalSegmentOrders();
    orders[id] = order;
    localStorage.setItem('sy_segment_orders', JSON.stringify(orders));
  } catch (e) {
    console.warn('Failed to save segment order locally:', e);
  }
}

class SchedulesDataManager {
  constructor() {}

  async getSchedules(): Promise<ServiceSchedule[]> {
    const segmentOrders = getLocalSegmentOrders();
    const attachOrders = (list: ServiceSchedule[]) =>
      list.map(s => ({
        ...s,
        segment_order: segmentOrders[s.id] || s.segment_order
      }));

    try {
      const { data, error } = await supabase
        .from('youth_service_schedules')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        const enriched = attachOrders(data as ServiceSchedule[]);
        try {
          localStorage.setItem('sy_cached_schedules', JSON.stringify(enriched));
          localStorage.setItem('sy_has_database_schedules', 'true');
        } catch (e) {
          console.warn('Failed to write schedules cache:', e);
        }
        return enriched;
      }

      // If data is empty:
      // Check if we have previously loaded database schedules
      const hasDbSchedules = localStorage.getItem('sy_has_database_schedules') === 'true';
      if (hasDbSchedules) {
        try {
          const cached = localStorage.getItem('sy_cached_schedules');
          if (cached) {
            return attachOrders(JSON.parse(cached) as ServiceSchedule[]);
          }
        } catch (_) {}
        return []; // It was legitimately cleared or database is empty
      }

      // Try to seed the database in the background. Only secretary admins are allowed by RLS.
      let isSecAdmin = false;
      try {
        const cachedUserStr = localStorage.getItem('sy_current_user');
        if (cachedUserStr) {
          const u = JSON.parse(cachedUserStr);
          if (u && u.role && ['Founder', 'Admin', 'Secretary', 'Assistant Secretary'].includes(u.role)) {
            isSecAdmin = true;
          }
        }
      } catch (_) {}

      if (isSecAdmin) {
        this.syncAllSchedulesToSupabase().catch(e => {
          console.warn('Silently ignored schedules seeding warning:', e?.message || e);
        });
      }

      return attachOrders(INITIAL_SCHEDULES);
    } catch (err: any) {
      console.error('Supabase youth_service_schedules query failed, returning in-memory fallback:', err?.message || err);
      // Fallback to cache if available
      try {
        const cached = localStorage.getItem('sy_cached_schedules');
        if (cached) {
          return attachOrders(JSON.parse(cached) as ServiceSchedule[]);
        }
      } catch (_) {}
      return attachOrders(INITIAL_SCHEDULES);
    }
  }

  private async syncAllSchedulesToSupabase() {
    try {
      const { error } = await supabase
        .from('youth_service_schedules')
        .upsert(INITIAL_SCHEDULES.map(s => {
          const { segment_order, ...dbPayload } = s;
          return {
            ...dbPayload,
            created_at: s.created_at || new Date().toISOString()
          };
        }));
      if (error) throw error;
    } catch (e: any) {
      console.error('Failed to seed initial schedules to Supabase:', e?.message || e);
    }
  }

  async addSchedule(
    schedule: Omit<ServiceSchedule, 'id' | 'created_at' | 'created_by_email' | 'created_by_name'>,
    activeUserEmail: string,
    activeUserName: string
  ): Promise<ServiceSchedule> {
    const newSchedule: ServiceSchedule = {
      ...schedule,
      id: `sched-${crypto.randomUUID()}`,
      created_at: new Date().toISOString(),
      created_by_email: activeUserEmail,
      created_by_name: activeUserName
    };

    if (newSchedule.segment_order) {
      saveLocalSegmentOrder(newSchedule.id, newSchedule.segment_order);
    }

    const { segment_order, ...dbPayload } = newSchedule;

    try {
      const { error } = await supabase
        .from('youth_service_schedules')
        .insert(dbPayload);

      if (error) {
        console.warn('Supabase schedule insert warning:', error.message);
      }

      // Update local cache
      try {
        const cached = localStorage.getItem('sy_cached_schedules');
        const currentList: ServiceSchedule[] = cached ? JSON.parse(cached) : [];
        currentList.push(newSchedule);
        currentList.sort((a, b) => a.date.localeCompare(b.date));
        localStorage.setItem('sy_cached_schedules', JSON.stringify(currentList));
        localStorage.setItem('sy_has_database_schedules', 'true');
      } catch (e) {
        console.warn('Failed to cache new schedule:', e);
      }
    } catch (err: any) {
      console.error('Supabase schedule insert failed:', err?.message || err);
      throw err;
    }

    return newSchedule;
  }

  async updateSchedule(id: string, updated: Partial<ServiceSchedule>): Promise<ServiceSchedule> {
    if (updated.segment_order) {
      saveLocalSegmentOrder(id, updated.segment_order);
    }

    const { segment_order, ...dbPayload } = updated;

    if (Object.keys(dbPayload).length > 0) {
      try {
        const { error } = await supabase
          .from('youth_service_schedules')
          .update(dbPayload)
          .eq('id', id);

        if (error) {
          console.warn('Supabase schedule update warning:', error.message);
        }
      } catch (err: any) {
        console.warn('Supabase schedule update error:', err?.message || err);
      }
    }

    // Update local cache
    let updatedSchedule: ServiceSchedule | null = null;
    try {
      const cached = localStorage.getItem('sy_cached_schedules');
      let currentList: ServiceSchedule[] = cached ? JSON.parse(cached) : [];
      const targetIndex = currentList.findIndex(s => s.id === id);
      if (targetIndex !== -1) {
        currentList[targetIndex] = { ...currentList[targetIndex], ...updated };
        updatedSchedule = currentList[targetIndex];
      } else {
        updatedSchedule = { id, ...updated } as ServiceSchedule;
        currentList.push(updatedSchedule);
      }
      currentList.sort((a, b) => a.date.localeCompare(b.date));
      localStorage.setItem('sy_cached_schedules', JSON.stringify(currentList));
    } catch (e) {
      console.warn('Failed to update schedule cache:', e);
    }

    if (!updatedSchedule) {
      updatedSchedule = { id, ...updated } as ServiceSchedule;
    }

    return updatedSchedule;
  }

  async deleteSchedule(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('youth_service_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Update local cache
      try {
        const cached = localStorage.getItem('sy_cached_schedules');
        if (cached) {
          let currentList: ServiceSchedule[] = JSON.parse(cached);
          currentList = currentList.filter(s => s.id !== id);
          localStorage.setItem('sy_cached_schedules', JSON.stringify(currentList));
        }
      } catch (e) {
        console.warn('Failed to delete schedule from cache:', e);
      }

      return true;
    } catch (err: any) {
      console.error('Supabase schedule delete failed:', err?.message || err);
      throw err;
    }
  }
}

export const schedulesDb = new SchedulesDataManager();
