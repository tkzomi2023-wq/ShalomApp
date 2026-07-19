/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, db } from './supabase';
import { DEFAULT_ADMIN_EMAIL } from '../types';

export interface FinancialRecord {
  id: string;
  user_id?: string;
  name: string;
  address: string;
  amount: number;
  area: string; // "Bial 1", "Bial 2", ... "Bial 12"
  payment_month: string; // January - December
  payment_date: string; // YYYY-MM-DD
  created_at: string;
  created_by_email: string;
  created_by_name: string;
}

export interface BialConfig {
  id: string; // "Bial 1", "Bial 2", etc.
  leaders: string;
  area: string;
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const BIAL_IDS = [
  'Bial 1', 'Bial 2', 'Bial 3', 'Bial 4', 'Bial 5', 'Bial 6',
  'Bial 7', 'Bial 8', 'Bial 9', 'Bial 10', 'Bial 11', 'Bial 12'
];

export const INITIAL_BIAL_CONFIGS: BialConfig[] = [
  {
    id: 'Bial 1',
    leaders: 'Pastor Jospeh Thang Mun Lian, Lia Cing Lian Nuam, Lia Elizabeth Cing Hau Man, Lia Ciin Biak Dik',
    area: 'Zemabawk - Zuangtui Tg. Kapa te Inn'
  },
  {
    id: 'Bial 2',
    leaders: 'Tg. Do Lian Zau, Lia Do Uap Kim, Lia Rebecca Cing Sian Hoih, Lia Dim Sian Huai Cing',
    area: 'Zuangtui'
  },
  {
    id: 'Bial 3',
    leaders: 'Lia Helen Zothankhumi, Tg. Dal Khan KHual, Tg. Lian Sian Nang, Lia Esther Cing Lian Sang',
    area: 'Zuangtui Peng - Upa Kamkap te inn'
  },
  {
    id: 'Bial 4',
    leaders: 'Lia Nuam San Cing, Tg. Kham Lam Lian, Lia Lun Khawm Kim, Lia Don Sian Zuun',
    area: 'Building san pan a nuai dong, bawngkawn'
  },
  {
    id: 'Bial 5',
    leaders: 'Tg. Thang Za Sing, Tg. Micheal Sian Muan Sang, Lia Man tawi Kim, Tg. Thang Khan Mang',
    area: 'Banwgkawn lamnuai - Ramhlun Tg. Mangpite inn'
  },
  {
    id: 'Bial 6',
    leaders: 'Tg. Jospeh Thangremruata, Lia Christy Dim Lawh Cing, Tg. Thang Lam Cin, Tg. Thang Lian Mang',
    area: 'banwgkawn Pa Neidai Inn, brigate, durtlang'
  },
  {
    id: 'Bial 7',
    leaders: 'Pa Hau Khan Langh, Pa Kham Deih Zam, Lia Cing Sian Zo, Tg. Nang Suan Muang',
    area: 'Chaltlang - Laipuitlang'
  },
  { id: 'Bial 8', leaders: 'TBD', area: 'TBD' },
  { id: 'Bial 9', leaders: 'TBD', area: 'TBD' },
  { id: 'Bial 10', leaders: 'TBD', area: 'TBD' },
  { id: 'Bial 11', leaders: 'TBD', area: 'TBD' },
  { id: 'Bial 12', leaders: 'TBD', area: 'TBD' },
];

export const INITIAL_FINANCIAL_RECORDS: FinancialRecord[] = [];

const safeStorage = {
  getItem(key: string): string | null {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  },
  setItem(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch (_) {}
  },
  removeItem(key: string): void {
    try { localStorage.removeItem(key); } catch (_) {}
  }
};

class FinancialsDataManager {
  constructor() {}

  // --- BIALS MODULE API ---

  async getBialConfigs(): Promise<BialConfig[]> {
    try {
      const { data, error } = await supabase
        .from('bial_configs')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        throw error;
      }
      if (data && data.length > 0) {
        return data as BialConfig[];
      }
      
      // Try to seed with initial configs in the background. Only OB admins are allowed by RLS.
      let isObAdmin = false;
      try {
        const cachedUserStr = localStorage.getItem('sy_current_user');
        if (cachedUserStr) {
          const u = JSON.parse(cachedUserStr);
          if (u && u.role && ['Founder', 'Admin', 'Chairman', 'Vice Chairman', 'Secretary', 'Assistant Secretary', 'Treasurer', 'Financial Secretary'].includes(u.role)) {
            isObAdmin = true;
          }
        }
      } catch (_) {}

      if (isObAdmin) {
        this.syncAllBialConfigsToSupabase().catch(e => {
          console.warn('Silently ignored bial configs seeding warning:', e?.message || e);
        });
      }
      
      return INITIAL_BIAL_CONFIGS;
    } catch (err: any) {
      console.error('Supabase bial_configs query error, returning in-memory fallback:', err?.message || err);
      return INITIAL_BIAL_CONFIGS;
    }
  }

  async saveBialConfig(config: BialConfig): Promise<BialConfig[]> {
    try {
      const { error } = await supabase
        .from('bial_configs')
        .upsert({
          id: config.id,
          leaders: config.leaders,
          area: config.area,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (err: any) {
      console.error('Supabase bial config upsert failed:', err?.message || err);
      throw err;
    }

    return this.getBialConfigs();
  }

  async deleteBialConfig(id: string): Promise<BialConfig[]> {
    try {
      const { error } = await supabase
        .from('bial_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Supabase bial config delete failed:', err?.message || err);
      throw err;
    }

    return this.getBialConfigs();
  }

  private async syncAllBialConfigsToSupabase() {
    try {
      const { error } = await supabase
        .from('bial_configs')
        .upsert(INITIAL_BIAL_CONFIGS.map(c => ({
          id: c.id,
          leaders: c.leaders,
          area: c.area,
          updated_at: new Date().toISOString()
        })));
      if (error) throw error;
    } catch (e: any) {
      console.error('Supabase seed helper logs:', e?.message || e);
    }
  }

  // --- FINANCIAL RECORDS MODULE API ---

  async getFinancialRecords(): Promise<FinancialRecord[]> {
    try {
      const { data, error } = await supabase
        .from('financial_records')
        .select('*')
        .order('payment_date', { ascending: false });

      if (error) {
        throw error;
      }
      
      const records = (data || []) as FinancialRecord[];
      try {
        localStorage.setItem('sy_cached_financial_records', JSON.stringify(records));
        localStorage.setItem('sy_has_database_financials', records.length > 0 ? 'true' : 'false');
      } catch (e) {
        console.warn('Failed to write financials cache:', e);
      }
      return records;
    } catch (err: any) {
      console.error('Supabase financial_records queries failed:', err?.message || err);
      try {
        const cached = localStorage.getItem('sy_cached_financial_records');
        if (cached) {
          return JSON.parse(cached) as FinancialRecord[];
        }
      } catch (_) {}
      return [];
    }
  }

  async syncProfileBialFromFinancialRecord(name: string, area: string): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserEmail = session?.user?.email;
      if (!currentUserEmail || currentUserEmail.toLowerCase() !== DEFAULT_ADMIN_EMAIL.toLowerCase()) {
        // Only tkpaite2016@gmail.com is authorized to change/assign Bial on profiles
        return;
      }

      const normalizedName = name.trim().toLowerCase();
      const stripPrefix = (s: string) => {
        return s
          .replace(/^(tg\.|tg\s+|lia\s+|lia\.|pa\s+|pa\.|sia\s+|sia\.)/gi, '')
          .trim();
      };
      const strippedMember = stripPrefix(normalizedName);

      // Fetch profiles to find a match
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, bial');

      if (profiles && profiles.length > 0) {
        const matchedProfile = profiles.find(p => {
          const pName = p.name.trim().toLowerCase();
          return pName === normalizedName || stripPrefix(pName) === strippedMember;
        });

        if (matchedProfile && matchedProfile.bial !== area) {
          console.log(`[syncProfileBialFromFinancialRecord] Syncing profile Bial for "${matchedProfile.name}" to "${area}"`);
          await supabase
            .from('profiles')
            .update({ bial: area })
            .eq('id', matchedProfile.id);
        }
      }
    } catch (err) {
      console.warn('[syncProfileBialFromFinancialRecord] Sync profile Bial failed:', err);
    }
  }

  async checkBialAssignmentConflict(name: string, area: string, excludeId?: string): Promise<void> {
    const normalizedName = name.trim().toLowerCase();
    const stripPrefix = (s: string) => {
      return s
        .replace(/^(tg\.|tg\s+|lia\s+|lia\.|pa\s+|pa\.|sia\s+|sia\.)/gi, '')
        .trim();
    };
    const strippedMember = stripPrefix(normalizedName);

    try {
      // 1. Check Profiles table for assigned bial
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, bial')
        .not('bial', 'is', null);

      if (profileData && profileData.length > 0) {
        const matchedProfile = profileData.find(p => {
          if (!p.bial) return false;
          const pName = p.name.trim().toLowerCase();
          return pName === normalizedName || stripPrefix(pName) === strippedMember;
        });

        if (matchedProfile && matchedProfile.bial && matchedProfile.bial !== area) {
          const { data: { session } } = await supabase.auth.getSession();
          const currentUserEmail = session?.user?.email;
          if (currentUserEmail?.toLowerCase() !== DEFAULT_ADMIN_EMAIL.toLowerCase()) {
            throw new Error(`Validation Error: "${name}" is officially assigned to ${matchedProfile.bial} in their profile. Only the administrator (${DEFAULT_ADMIN_EMAIL}) can change their official Bial assignment.`);
          }
        }
      }

      // 2. Check existing financial_records for any existing assignment to a different Bial
      const { data: existingRecords } = await supabase
        .from('financial_records')
        .select('id, name, area');

      if (existingRecords && existingRecords.length > 0) {
        const match = existingRecords.find(r => {
          if (excludeId && r.id === excludeId) return false;
          const rName = r.name.trim().toLowerCase();
          return (rName === normalizedName || stripPrefix(rName) === strippedMember) && r.area !== area;
        });

        if (match) {
          const { data: { session } } = await supabase.auth.getSession();
          const currentUserEmail = session?.user?.email;
          if (currentUserEmail?.toLowerCase() !== DEFAULT_ADMIN_EMAIL.toLowerCase()) {
            throw new Error(`Validation Error: "${name}" has already been assigned to ${match.area} in other records. Only the administrator can change this assignment.`);
          }
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Validation Error')) {
        throw err;
      }
      console.warn('Silent warning on database bial validation check:', err?.message || err);
    }
  }

  async addFinancialRecord(
    record: Omit<FinancialRecord, 'id' | 'created_at' | 'created_by_email' | 'created_by_name'>, 
    activeUserEmail: string, 
    activeUserName: string
  ): Promise<FinancialRecord> {
    await this.checkBialAssignmentConflict(record.name, record.area);

    const newRecord: FinancialRecord = {
      ...record,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      created_by_email: activeUserEmail,
      created_by_name: activeUserName
    };

    try {
      const { error } = await supabase
        .from('financial_records')
        .insert(newRecord);

      if (error) throw error;

      try {
        const cachedStr = localStorage.getItem('sy_cached_financial_records');
        const currentCached = cachedStr ? JSON.parse(cachedStr) : [];
        currentCached.unshift(newRecord);
        localStorage.setItem('sy_cached_financial_records', JSON.stringify(currentCached));
        localStorage.setItem('sy_has_database_financials', 'true');
      } catch (_) {}

      // Realtime synchronization: Grab/sync this Bial to the user's profile
      await this.syncProfileBialFromFinancialRecord(newRecord.name, newRecord.area);
    } catch (err: any) {
      console.error('Supabase financial insert failed:', err?.message || err);
      throw err;
    }

    return newRecord;
  }

  async bulkAddFinancialRecords(
    recordsList: Omit<FinancialRecord, 'id' | 'created_at' | 'created_by_email' | 'created_by_name'>[],
    activeUserEmail: string,
    activeUserName: string
  ): Promise<FinancialRecord[]> {
    // Validate each record before batch insert
    for (const record of recordsList) {
      await this.checkBialAssignmentConflict(record.name, record.area);
    }

    const newRecords: FinancialRecord[] = recordsList.map(record => ({
      ...record,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      created_by_email: activeUserEmail,
      created_by_name: activeUserName
    }));

    try {
      const { error } = await supabase
        .from('financial_records')
        .insert(newRecords);

      if (error) throw error;

      try {
        const cachedStr = localStorage.getItem('sy_cached_financial_records');
        const currentCached = cachedStr ? JSON.parse(cachedStr) : [];
        const updatedCache = [...newRecords, ...currentCached];
        localStorage.setItem('sy_cached_financial_records', JSON.stringify(updatedCache));
        localStorage.setItem('sy_has_database_financials', 'true');
      } catch (_) {}

      // Realtime synchronization: Grab/sync these Bials to the users' profiles
      for (const rec of newRecords) {
        await this.syncProfileBialFromFinancialRecord(rec.name, rec.area);
      }
    } catch (err: any) {
      console.error('Supabase financial bulk insert failed:', err?.message || err);
      throw err;
    }

    return newRecords;
  }

  async updateFinancialRecord(id: string, updated: Partial<FinancialRecord>): Promise<FinancialRecord> {
    try {
      if (updated.name || updated.area) {
        // Fetch existing record to construct the complete updated representation for checking conflicts
        const { data: existing } = await supabase
          .from('financial_records')
          .select('name, area')
          .eq('id', id)
          .maybeSingle();

        const checkName = updated.name !== undefined ? updated.name : (existing?.name || '');
        const checkArea = updated.area !== undefined ? updated.area : (existing?.area || '');
        if (checkName && checkArea) {
          await this.checkBialAssignmentConflict(checkName, checkArea, id);
        }
      }

      const { error } = await supabase
        .from('financial_records')
        .update(updated)
        .eq('id', id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Supabase financial update failed:', err?.message || err);
      throw err;
    }

    const { data, error: fetchErr } = await supabase
      .from('financial_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr || !data) {
      throw new Error('Failed to retrieve updated financial record');
    }

    try {
      const cachedStr = localStorage.getItem('sy_cached_financial_records');
      if (cachedStr) {
        const currentCached = JSON.parse(cachedStr) as FinancialRecord[];
        const index = currentCached.findIndex(r => r.id === id);
        if (index !== -1) {
          currentCached[index] = { ...currentCached[index], ...updated, ...data };
          localStorage.setItem('sy_cached_financial_records', JSON.stringify(currentCached));
        }
      }
    } catch (_) {}

    // Realtime synchronization: Grab/sync the updated Bial to the user's profile
    if (data) {
      await this.syncProfileBialFromFinancialRecord(data.name, data.area);
    }

    return data as FinancialRecord;
  }

  async deleteFinancialRecord(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('financial_records')
        .delete()
        .eq('id', id);

      if (error) throw error;

      try {
        const cachedStr = localStorage.getItem('sy_cached_financial_records');
        if (cachedStr) {
          const currentCached = JSON.parse(cachedStr) as FinancialRecord[];
          const filtered = currentCached.filter(r => r.id !== id);
          localStorage.setItem('sy_cached_financial_records', JSON.stringify(filtered));
        }
      } catch (_) {}

      return true;
    } catch (err: any) {
      console.error('Supabase financial delete failed:', err?.message || err);
      throw err;
    }
  }

  async syncLocalFinancialsToSupabase(): Promise<void> {
    // No-op
  }
}

export const financialsDb = new FinancialsDataManager();
