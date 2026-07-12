/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, db } from './supabase';

export interface FinancialRecord {
  id: string;
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
      if (records.length > 0) {
        try {
          localStorage.setItem('sy_cached_financial_records', JSON.stringify(records));
          localStorage.setItem('sy_has_database_financials', 'true');
        } catch (e) {
          console.warn('Failed to write financials cache:', e);
        }
        return records;
      }
      
      // Fallback to local storage cache if database returned 0 records (e.g. restricted by old RLS policies)
      try {
        const cached = localStorage.getItem('sy_cached_financial_records');
        if (cached) {
          const cachedRecords = JSON.parse(cached) as FinancialRecord[];
          if (cachedRecords.length > 0) {
            return cachedRecords;
          }
        }
      } catch (_) {}
      
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

  async addFinancialRecord(
    record: Omit<FinancialRecord, 'id' | 'created_at' | 'created_by_email' | 'created_by_name'>, 
    activeUserEmail: string, 
    activeUserName: string
  ): Promise<FinancialRecord> {
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
    } catch (err: any) {
      console.error('Supabase financial insert failed:', err?.message || err);
      throw err;
    }

    return newRecord;
  }

  async updateFinancialRecord(id: string, updated: Partial<FinancialRecord>): Promise<FinancialRecord> {
    try {
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
