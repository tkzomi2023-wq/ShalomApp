/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { Member, UserRole, DEFAULT_ADMIN_EMAIL, BirthdayWish, ChatMessage } from '../types';

// Define global interface for ImportMeta to satisfy the TypeScript compiler for Vite's env vars
declare global {
  interface ImportMeta {
    readonly env: Record<string, string | undefined>;
  }
}

// Provided Supabase coordinates (falls back to environmental config if supplied)
const getEnvVar = (key: string): string | undefined => {
  try {
    return (import.meta.env && import.meta.env[key]) || (process && process.env && process.env[key]);
  } catch {
    try {
      return process && process.env && process.env[key];
    } catch {
      return undefined;
    }
  }
};

export const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL') || 'https://iteftlbwpefnmikjvast.supabase.co';
export const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0ZWZ0bGJ3cGVmbm1pa2p2YXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NjkzMTQsImV4cCI6MjA5OTI0NTMxNH0.VFnqfV-8dJt4tNw7h0L-FFDkwvhCpgYt1QlH3nMZBbc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// SQL setup script to show and copy
export const SUPABASE_SETUP_SQL = `-- Shalom Youth Member Management Setup Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/iteftlbwpefnmikjvast/sql)

-- 1. Create profiles table
-- Drop foreign key constraint to auth.users if it exists to allow manual user provisioning during auth rate limit bottlenecks
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'pending',
  gender TEXT,
  blood_group TEXT,
  dob TEXT,
  address TEXT,
  avatar TEXT,
  email_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create helper security functions to completely prevent infinite RLS recursion loops
CREATE OR REPLACE FUNCTION public.is_ob_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role IN ('Founder', 'Admin', 'Chairman', 'Vice Chairman', 'Secretary', 'Assistant Secretary', 'Treasurer', 'Financial Secretary')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_finance_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role IN ('Founder', 'Admin', 'Treasurer', 'Financial Secretary')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_secretary_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role IN ('Founder', 'Admin', 'Secretary', 'Assistant Secretary')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_approved_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create policies (drop first to allow safe re-runs)
DROP POLICY IF EXISTS "Allow public read of profiles" ON public.profiles;
CREATE POLICY "Allow public read of profiles" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow individual update of own profile" ON public.profiles;
CREATE POLICY "Allow individual update of own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR LOWER(auth.jwt() ->> 'email') = LOWER(email));

DROP POLICY IF EXISTS "Allow individual insert of own profile" ON public.profiles;
CREATE POLICY "Allow individual insert of own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id OR LOWER(auth.jwt() ->> 'email') = LOWER(email));

DROP POLICY IF EXISTS "Allow individual delete of own profile" ON public.profiles;
CREATE POLICY "Allow individual delete of own profile" ON public.profiles
  FOR DELETE USING (auth.uid() = id OR LOWER(auth.jwt() ->> 'email') = LOWER(email));

DROP POLICY IF EXISTS "Allow OB admins full control" ON public.profiles;
DROP POLICY IF EXISTS "Allow OB admins insert" ON public.profiles;
CREATE POLICY "Allow OB admins insert" ON public.profiles
  FOR INSERT WITH CHECK (
    email = '${DEFAULT_ADMIN_EMAIL}' OR public.is_ob_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Allow OB admins update" ON public.profiles;
CREATE POLICY "Allow OB admins update" ON public.profiles
  FOR UPDATE USING (
    email = '${DEFAULT_ADMIN_EMAIL}' OR public.is_ob_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Allow OB admins delete" ON public.profiles;
CREATE POLICY "Allow OB admins delete" ON public.profiles
  FOR DELETE USING (
    email = '${DEFAULT_ADMIN_EMAIL}' OR public.is_ob_admin(auth.uid())
  );

-- 2. Trigger to automatically provision profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_profile_id UUID;
BEGIN
  -- Check if a profile with the same email already exists
  SELECT id INTO existing_profile_id FROM public.profiles WHERE LOWER(email) = LOWER(new.email) LIMIT 1;
  
  IF existing_profile_id IS NOT NULL THEN
    -- Update the existing profile ID and other details to match the new auth user
    UPDATE public.profiles
    SET 
      id = new.id,
      name = COALESCE(new.raw_user_meta_data->>'name', name, split_part(new.email, '@', 1)),
      phone = COALESCE(new.raw_user_meta_data->>'phone', phone, COALESCE(new.phone, ''))
    WHERE id = existing_profile_id;
  ELSE
    -- Insert a new profile
    INSERT INTO public.profiles (id, email, name, phone, role, status, email_notifications)
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      COALESCE(new.raw_user_meta_data->>'phone', new.phone, ''),
      CASE WHEN new.email = '${DEFAULT_ADMIN_EMAIL}' THEN 'Founder' ELSE 'standard' END,
      CASE WHEN new.email = '${DEFAULT_ADMIN_EMAIL}' THEN 'approved' ELSE 'pending' END,
      true
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Bial Configuration Table
CREATE TABLE IF NOT EXISTS public.bial_configs (
  id TEXT PRIMARY KEY, -- "Bial 1", "Bial 2", etc.
  leaders TEXT NOT NULL DEFAULT 'TBD',
  area TEXT NOT NULL DEFAULT 'TBD',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for Bial configurations
ALTER TABLE public.bial_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read of bial_configs" ON public.bial_configs;
CREATE POLICY "Allow public read of bial_configs" ON public.bial_configs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow financial admins full control of bial_configs" ON public.bial_configs;
DROP POLICY IF EXISTS "Allow authorized admins full control of bial_configs" ON public.bial_configs;
CREATE POLICY "Allow authorized admins full control of bial_configs" ON public.bial_configs
  FOR ALL USING (
    public.is_ob_admin(auth.uid())
  );

-- Pre-seed Bial configs with details
INSERT INTO public.bial_configs (id, leaders, area) VALUES
  ('Bial 1', 'Pastor Jospeh Thang Mun Lian, Lia Cing Lian Nuam, Lia Elizabeth Cing Hau Man, Lia Ciin Biak Dik', 'Zemabawk - Zuangtui Tg. Kapa te Inn'),
  ('Bial 2', 'Tg. Do Lian Zau, Lia Do Uap Kim, Lia Rebecca Cing Sian Hoih, Lia Dim Sian Huai Cing', 'Zuangtui'),
  ('Bial 3', 'Lia Helen Zothankhumi, Tg. Dal Khan KHual, Tg. Lian Sian Nang, Lia Esther Cing Lian Sang', 'Zuangtui Peng - Upa Kamkap te inn'),
  ('Bial 4', 'Lia Nuam San Cing, Tg. Kham Lam Lian, Lia Lun Khawm Kim, Lia Don Sian Zuun', 'Building san pan a nuai dong, bawngkawn'),
  ('Bial 5', 'Tg. Thang Za Sing, Tg. Micheal Sian Muan Sang, Lia Man tawi Kim, Tg. Thang Khan Mang', 'Banwgkawn lamnuai - Ramhlun Tg. Mangpite inn'),
  ('Bial 6', 'Tg. Jospeh Thangremruata, Lia Christy Dim Lawh Cing, Tg. Thang Lam Cin, Tg. Thang Lian Mang', 'banwgkawn Pa Neidai Inn, brigate, durtlang'),
  ('Bial 7', 'Pa Hau Khan Langh, Pa Kham Deih Zam, Lia Cing Sian Zo, Tg. Nang Suan Muang', 'Chaltlang - Laipuitlang'),
  ('Bial 8', 'TBD', 'TBD'),
  ('Bial 9', 'TBD', 'TBD'),
  ('Bial 10', 'TBD', 'TBD'),
  ('Bial 11', 'TBD', 'TBD'),
  ('Bial 12', 'TBD', 'TBD')
ON CONFLICT (id) DO NOTHING;

-- 4. Financial Records Table
CREATE TABLE IF NOT EXISTS public.financial_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  area TEXT NOT NULL REFERENCES public.bial_configs(id) ON DELETE CASCADE,
  payment_month TEXT NOT NULL,
  payment_date TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_by_email TEXT NOT NULL,
  created_by_name TEXT NOT NULL
);

-- Enable RLS for Financial records
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read of financial_records for approved users" ON public.financial_records;
DROP POLICY IF EXISTS "Allow public read of financial_records" ON public.financial_records;
CREATE POLICY "Allow public read of financial_records" ON public.financial_records
  FOR SELECT USING (
    true
  );

DROP POLICY IF EXISTS "Allow financial admins full control of financial_records" ON public.financial_records;
CREATE POLICY "Allow financial admins full control of financial_records" ON public.financial_records
  FOR ALL USING (
    public.is_finance_admin(auth.uid())
  );

-- 5. Youth Service Schedule table
CREATE TABLE IF NOT EXISTS public.youth_service_schedules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  speaker TEXT NOT NULL,
  leader TEXT NOT NULL,
  topic TEXT,
  venue TEXT DEFAULT 'Shalom Sanctuary',
  solo TEXT,
  sumpi_aapna TEXT,
  lst_simna_quiz TEXT,
  sumpi_khon_ding TEXT,
  notes TEXT,
  thumbnail TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_by_email TEXT NOT NULL,
  created_by_name TEXT NOT NULL
);

-- Enable RLS for youth_service_schedules
ALTER TABLE public.youth_service_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read of youth_service_schedules for approved users" ON public.youth_service_schedules;
DROP POLICY IF EXISTS "Allow public read of youth_service_schedules" ON public.youth_service_schedules;
CREATE POLICY "Allow public read of youth_service_schedules" ON public.youth_service_schedules
  FOR SELECT USING (
    true
  );

DROP POLICY IF EXISTS "Allow secretary admins full control of youth_service_schedules" ON public.youth_service_schedules;
CREATE POLICY "Allow secretary admins full control of youth_service_schedules" ON public.youth_service_schedules
  FOR ALL USING (
    public.is_secretary_admin(auth.uid())
  );

-- 6. Birthday Wishes table
CREATE TABLE IF NOT EXISTS public.birthday_wishes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wisher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wisher_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for birthday_wishes
ALTER TABLE public.birthday_wishes ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to insert birthday wishes
DROP POLICY IF EXISTS "Allow authenticated insert of birthday wishes" ON public.birthday_wishes;
CREATE POLICY "Allow authenticated insert of birthday wishes" ON public.birthday_wishes
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Allow any authenticated user to read birthday wishes to prevent duplicates and enable admin insights
DROP POLICY IF EXISTS "Allow receiver read own birthday wishes" ON public.birthday_wishes;
DROP POLICY IF EXISTS "Allow any authenticated user read birthday wishes" ON public.birthday_wishes;
CREATE POLICY "Allow any authenticated user read birthday wishes" ON public.birthday_wishes
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

-- 7. Global Chat Messages table
CREATE TABLE IF NOT EXISTS public.global_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  message TEXT NOT NULL,
  read_by JSONB DEFAULT '[]'::jsonb,
  reactions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Safe DDL update for existing tables
ALTER TABLE public.global_chat_messages ADD COLUMN IF NOT EXISTS read_by JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.global_chat_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- Enable RLS for global_chat_messages
ALTER TABLE public.global_chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to insert chat messages
DROP POLICY IF EXISTS "Allow authenticated insert of global_chat_messages" ON public.global_chat_messages;
CREATE POLICY "Allow authenticated insert of global_chat_messages" ON public.global_chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- Allow any authenticated user to read chat messages
DROP POLICY IF EXISTS "Allow authenticated read of global_chat_messages" ON public.global_chat_messages;
CREATE POLICY "Allow authenticated read of global_chat_messages" ON public.global_chat_messages
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

-- Allow any authenticated user to update read_by column in chat messages
DROP POLICY IF EXISTS "Allow authenticated update of global_chat_messages" ON public.global_chat_messages;
CREATE POLICY "Allow authenticated update of global_chat_messages" ON public.global_chat_messages
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
  );

-- Allow any authenticated user to delete chat messages (for clear history)
DROP POLICY IF EXISTS "Allow authenticated delete of global_chat_messages" ON public.global_chat_messages;
CREATE POLICY "Allow authenticated delete of global_chat_messages" ON public.global_chat_messages
  FOR DELETE USING (
    auth.uid() IS NOT NULL
  );
`;

// Initial Mock data for local fallback & presentation
const INITIAL_MOCK_MEMBERS: Member[] = [
  {
    id: 'admin-uuid-001',
    name: 'T.K. Paite (Founder)',
    email: DEFAULT_ADMIN_EMAIL,
    phone: '+919876543210',
    role: 'Founder',
    status: 'approved',
    gender: 'Male',
    blood_group: 'O+',
    dob: '1995-04-12',
    address: 'Shalom Youth Center, Block A',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-uuid-002',
    name: 'Samuel Kipgen',
    email: 'samuel.kipgen@shalomyouth.org',
    phone: '+919988776655',
    role: 'Vice Chairman',
    status: 'approved',
    gender: 'Male',
    blood_group: 'A+',
    dob: '1997-08-25',
    address: 'Hill View Colony, Sector 3',
    created_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-uuid-003',
    name: 'Lydia Hangsing',
    email: 'lydia.h@shalomyouth.org',
    phone: '+918877665544',
    role: 'Secretary',
    status: 'approved',
    gender: 'Female',
    blood_group: 'B-',
    dob: '1999-01-15',
    address: 'Greenwood Lane, House 42',
    created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-uuid-004',
    name: 'Esther Guite',
    email: 'esther.g@shalomyouth.org',
    phone: '+917766554433',
    role: 'Treasurer',
    status: 'approved',
    gender: 'Female',
    blood_group: 'AB+',
    dob: '1998-11-30',
    address: 'Highland Avenue, Flat 2B',
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-uuid-005',
    name: 'Emmanuel Thang',
    email: 'emmanuel.t@gmail.com',
    phone: '+916655443322',
    role: 'ECM',
    status: 'approved',
    gender: 'Male',
    blood_group: 'O-',
    dob: '2001-05-18',
    address: 'Mission Road, Block C',
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-uuid-006',
    name: 'Mary Lal',
    email: 'mary.lal@gmail.com',
    phone: '+915544332211',
    role: 'standard',
    status: 'pending',
    gender: 'Female',
    blood_group: 'A-',
    dob: '2003-09-02',
    address: 'Zomi Villa, House 10',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
];

class HybridDatabaseManager {
  private useLocalOnly: boolean = false;
  public lastError: string | null = null;

  constructor() {
    this.useLocalOnly = false;
  }

  // Check if live Supabase is fully configured with our custom tables
  async testConnection(): Promise<boolean> {
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error) {
        const fullMsg = `[Code: ${error.code || 'unknown'}] ${error.message || 'No message'}`;
        console.warn('Supabase profiles query returned an error:', fullMsg);
        this.lastError = fullMsg;
        return false;
      }
      this.lastError = null;
      return true;
    } catch (e: any) {
      console.warn('Supabase connection test failed:', e?.message || e);
      this.lastError = e?.message || String(e);
      return false;
    }
  }

  isLocalStorageMode(): boolean {
    return false;
  }

  setDatabaseMode(local: boolean) {
    // No-op: exclusive database mode
  }

  // --- Members API ---

  async getMembers(): Promise<Member[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      return data as Member[];
    } catch (err: any) {
      console.error('Supabase members query error:', err?.message || err);
      throw err;
    }
  }

  async getCurrentUserRole(): Promise<UserRole | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      return data?.role as UserRole || null;
    } catch {
      return null;
    }
  }

  async isCurrentUserAdmin(): Promise<boolean> {
    const role = await this.getCurrentUserRole();
    return role ? ['Founder', 'Admin', 'Chairman', 'Vice Chairman', 'Secretary', 'Assistant Secretary', 'Treasurer', 'Financial Secretary'].includes(role) : false;
  }

  async createOrUpdateMember(member: Partial<Member> & { email: string }): Promise<Member> {
    let finalRole: UserRole = member.role || 'standard';
    let finalStatus: 'pending' | 'approved' | 'rejected' = member.status || 'pending';

    // Force default admin email to be Founder & approved
    if (member.email.toLowerCase().trim() === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
      finalRole = 'Founder';
      finalStatus = 'approved';
    }

    const newMember: Member = {
      id: member.id || crypto.randomUUID(),
      email: member.email,
      name: member.name || member.email.split('@')[0],
      phone: member.phone || '',
      role: finalRole,
      status: finalStatus,
      gender: member.gender,
      blood_group: member.blood_group,
      dob: member.dob,
      address: member.address,
      avatar: member.avatar,
      email_notifications: member.email_notifications !== undefined ? member.email_notifications : true,
      created_at: member.created_at || new Date().toISOString()
    };

    let existingProfile: any = null;

    try {
      // Check if profile exists by ID or email to handle potential ID mismatch
      const { data: profileById, error: selectIdErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', newMember.id)
        .maybeSingle();

      if (selectIdErr) {
        console.warn('Error checking profile by ID:', selectIdErr.message);
      }

      if (profileById) {
        existingProfile = profileById;
      } else {
        // Fallback: Check by email to catch ID mismatches
        const { data: profileByEmail, error: selectEmailErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', newMember.email)
          .maybeSingle();

        if (selectEmailErr) {
          console.warn('Error checking profile by email:', selectEmailErr.message);
        }

        if (profileByEmail) {
          existingProfile = profileByEmail;
          // ID mismatch detected! Repair/sync it in the database right now before performing update
          if (profileByEmail.id !== newMember.id) {
            console.log(`[createOrUpdateMember] Repairing ID mismatch on-the-fly: updating profile ID from ${profileByEmail.id} to ${newMember.id}`);
            const success = await this.updateProfileId(profileByEmail.id, newMember.id);
            if (success) {
              existingProfile.id = newMember.id;
            }
          }
        }
      }

      if (existingProfile) {
        // It exists, so we perform an UPDATE
        const isAdmin = await this.isCurrentUserAdmin();

        const updatePayload: any = {
          name: newMember.name,
          phone: newMember.phone,
          gender: newMember.gender,
          blood_group: newMember.blood_group,
          dob: newMember.dob,
          address: newMember.address,
          avatar: newMember.avatar,
          email_notifications: newMember.email_notifications
        };

        // Only allow updating role/status if user is admin, or if it's the default admin email
        // Standard users cannot change their own role or status
        if (isAdmin || newMember.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
          updatePayload.role = newMember.role;
          updatePayload.status = newMember.status;
        }

        const { data: updatedRows, error: updateErr } = await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', newMember.id)
          .select();

        if (updateErr) {
          throw updateErr;
        }

        if (!updatedRows || updatedRows.length === 0) {
          console.warn('Update by ID returned 0 rows, attempting to update by email due to potential ID/auth mismatch...');
          
          // Since we are updating by email due to ID mismatch, let's include the ID update in the payload to fix the mismatch on the fly!
          const updatePayloadWithId = {
            ...updatePayload,
            id: newMember.id
          };

          const { data: updatedByEmailRows, error: updateByEmailErr } = await supabase
            .from('profiles')
            .update(updatePayloadWithId)
            .eq('email', newMember.email)
            .select();

          if (updateByEmailErr) {
            throw updateByEmailErr;
          }

          if (!updatedByEmailRows || updatedByEmailRows.length === 0) {
            throw new Error('Failed to update profile: Profile row was not found or write was denied by database policies.');
          }
        }
      } else {
        // Doesn't exist, perform an INSERT
        const { error: insertErr } = await supabase
          .from('profiles')
          .insert({
            id: newMember.id,
            email: newMember.email,
            name: newMember.name,
            phone: newMember.phone,
            role: newMember.role,
            status: newMember.status,
            gender: newMember.gender,
            blood_group: newMember.blood_group,
            dob: newMember.dob,
            address: newMember.address,
            avatar: newMember.avatar,
            email_notifications: newMember.email_notifications,
            created_at: newMember.created_at
          });

        if (insertErr) {
          // If the trigger already inserted the profile in the background, we might get a duplicate key error.
          // Let's handle that gracefully by doing an update or returning the existing row.
          if (insertErr.code === '23505') {
            console.log('Profile was inserted concurrently, performing update instead...');
            const isAdmin = await this.isCurrentUserAdmin();
            const updatePayload: any = {
              name: newMember.name,
              phone: newMember.phone,
              gender: newMember.gender,
              blood_group: newMember.blood_group,
              dob: newMember.dob,
              address: newMember.address,
              avatar: newMember.avatar,
              email_notifications: newMember.email_notifications
            };
            if (isAdmin || newMember.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
              updatePayload.role = newMember.role;
              updatePayload.status = newMember.status;
            }
            const { error: updateErr } = await supabase
              .from('profiles')
              .update(updatePayload)
              .eq('id', newMember.id);
            if (updateErr) throw updateErr;
          } else {
            throw insertErr;
          }
        }
      }
    } catch (err: any) {
      // If we get an RLS or permission error on an INSERT, check if the profile exists anyway
      if (!existingProfile && (err.code === '42501' || err.message?.toLowerCase().includes('security') || err.message?.toLowerCase().includes('permission'))) {
        console.warn('Profile operation failed due to RLS, checking if profile exists via SELECT...');
        const { data, error: selectError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', newMember.id)
          .maybeSingle();
        
        if (!selectError && data) {
          console.log('Profile exists, returning it despite RLS failure:', data);
          return data as Member;
        }
      }
      console.error("Could not create/update profile:", err.message || err);
      throw err;
    }

    return newMember;
  }

  async provisionMemberWithAuth(
    email: string,
    password?: string,
    name?: string,
    phone?: string,
    role?: UserRole,
    status?: 'approved' | 'pending' | 'rejected',
    gender?: 'Male' | 'Female'
  ): Promise<Member> {
    const emailTrim = email.trim().toLowerCase();
    const cleanPhone = phone?.trim() || '';
    let authUserId: string = '';

    const tempSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    try {
      const { data: signUpData, error: supaErr } = await tempSupabase.auth.signUp({
        email: emailTrim,
        password: password || 'shalomyouth',
        options: {
          data: {
            name: name || emailTrim.split('@')[0],
            phone: cleanPhone
          }
        }
      });

      if (supaErr) {
        // If they are already registered/already exists, we handle it gracefully below. Otherwise throw.
        const msg = supaErr.message?.toLowerCase() || '';
        if (!msg.includes('already registered') && !msg.includes('already exists')) {
          throw supaErr;
        }
      }

      if (signUpData.user?.id) {
        authUserId = signUpData.user.id;
      } else {
        // Fetch existing user ID from public profiles to sync properly
        const { data: existingProfiles, error: fetchErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', emailTrim)
          .maybeSingle();
        if (fetchErr) throw fetchErr;

        if (existingProfiles?.id) {
          authUserId = existingProfiles.id;
        } else {
          // If they exist in auth but have no profile yet, let's try to log in with their password to get their ID
          try {
            const { data: signInData, error: signInErr } = await tempSupabase.auth.signInWithPassword({
              email: emailTrim,
              password: password || 'shalomyouth'
            });
            if (!signInErr && signInData.user?.id) {
              authUserId = signInData.user.id;
            } else {
              throw new Error(signInErr?.message || 'User already exists in authentication but has no profile.');
            }
          } catch (e: any) {
            throw new Error(`The email address "${emailTrim}" is already registered in Supabase Auth, but we could not access its ID. Please ask this member to log in using their registered password.`);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to provision Supabase auth account:', err.message || err);
      throw new Error(`Authentication Provisioning Failed: ${err.message || err}. Please ensure the email format is correct, password has at least 6 characters, and Supabase Auth is active.`);
    }

    const result = await this.createOrUpdateMember({
      id: authUserId,
      email: emailTrim,
      name: name || emailTrim.split('@')[0],
      phone: cleanPhone,
      role: role || 'standard',
      status: status || 'pending',
      gender: gender
    });

    return result;
  }

  async updateProfileId(oldId: string, newId: string): Promise<boolean> {
    try {
      const { data: profile, error: getErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', oldId)
        .maybeSingle();

      if (getErr || !profile) return false;

      // Check if profile with newId already exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', newId)
        .maybeSingle();

      if (existing) {
        // If a profile with the new ID already exists, update its fields to match the old one
        const { error: updErr } = await supabase
          .from('profiles')
          .update({
            email: profile.email,
            name: profile.name,
            phone: profile.phone,
            role: profile.role,
            status: profile.status,
            gender: profile.gender,
            blood_group: profile.blood_group,
            dob: profile.dob,
            address: profile.address,
            avatar: profile.avatar,
            email_notifications: profile.email_notifications
          })
          .eq('id', newId);
        if (updErr) throw updErr;

        // Delete the old one as it has been merged
        await supabase.from('profiles').delete().eq('id', oldId);
      } else {
        // Create new row with new ID and then delete old row
        const { error: insErr } = await supabase
          .from('profiles')
          .insert({
            ...profile,
            id: newId
          });

        if (insErr) {
          console.warn("Could not insert upgraded profile ID, trying direct update:", insErr.message);
          const { error: updErr } = await supabase
            .from('profiles')
            .update({ id: newId })
            .eq('id', oldId);
          if (updErr) throw updErr;
        } else {
          await supabase.from('profiles').delete().eq('id', oldId);
        }
      }
      return true;
    } catch (err: any) {
      console.error("Failed to upgrade profile ID:", err.message || err);
      return false;
    }
  }

  async syncLocalDataToSupabase(): Promise<void> {
    // No-op
  }

  async uploadToStorage(bucket: 'avatars' | 'thumbnails', filePath: string, file: File): Promise<string> {
    const isLocalStorage = this.isLocalStorageMode();
    if (isLocalStorage) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to read file in offline mode'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          upsert: true,
          cacheControl: '3600',
        });

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (err: any) {
      console.warn(`Supabase Storage upload failed, falling back to local base64:`, err.message || err);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to read file on storage upload fallback'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
  }

  async updateMemberRoleAndStatus(id: string, role: UserRole, status: 'approved' | 'pending' | 'rejected'): Promise<boolean> {
    const { data: m, error: getErr } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', id)
      .maybeSingle();

    if (!getErr && m && m.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
      role = 'Founder';
      status = 'approved';
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role, status })
      .eq('id', id);
    
    if (error) {
      throw error;
    }
    return true;
  }

  async deleteMember(id: string): Promise<boolean> {
    const { data: m, error: getErr } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', id)
      .maybeSingle();

    if (!getErr && m && m.email.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
      // Cannot delete default admin
      return false;
    }

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw error;
    }
    return true;
  }

  // --- Birthday Wishes API ---
  async getBirthdayWishes(receiverId: string): Promise<BirthdayWish[]> {
    try {
      const { data, error } = await supabase
        .from('birthday_wishes')
        .select('*')
        .eq('receiver_id', receiverId);
      
      if (error) {
        throw error;
      }
      
      // Filter out wishes older than 24 hours
      const now = Date.now();
      const validWishes = (data as BirthdayWish[]).filter(wish => {
        const wishTime = new Date(wish.created_at).getTime();
        return now - wishTime <= 24 * 60 * 60 * 1000;
      });

      // Deduplicate to only keep the latest wish per wisher_id
      const uniqueWishesMap = new Map<string, BirthdayWish>();
      validWishes.forEach(wish => {
        const existing = uniqueWishesMap.get(wish.wisher_id);
        if (!existing || new Date(wish.created_at) > new Date(existing.created_at)) {
          uniqueWishesMap.set(wish.wisher_id, wish);
        }
      });
      return Array.from(uniqueWishesMap.values());
    } catch (err: any) {
      console.warn('Supabase birthday_wishes query failed, falling back to local storage:', err.message || err);
      // Fallback to local storage
      const localWishesStr = localStorage.getItem(`sy_birthday_wishes_${receiverId}`);
      if (localWishesStr) {
        try {
          const wishes = JSON.parse(localWishesStr) as BirthdayWish[];
          const now = Date.now();
          const validWishes = wishes.filter(wish => {
            const wishTime = new Date(wish.created_at).getTime();
            return now - wishTime <= 24 * 60 * 60 * 1000;
          });
          localStorage.setItem(`sy_birthday_wishes_${receiverId}`, JSON.stringify(validWishes));
          
          // Deduplicate to only keep the latest wish per wisher_id
          const uniqueWishesMap = new Map<string, BirthdayWish>();
          validWishes.forEach(wish => {
            const existing = uniqueWishesMap.get(wish.wisher_id);
            if (!existing || new Date(wish.created_at) > new Date(existing.created_at)) {
              uniqueWishesMap.set(wish.wisher_id, wish);
            }
          });
          return Array.from(uniqueWishesMap.values());
        } catch {
          return [];
        }
      }
      return [];
    }
  }

  async sendBirthdayWish(receiverId: string, wisherId: string, wisherName: string): Promise<BirthdayWish> {
    const newWish: BirthdayWish = {
      id: crypto.randomUUID(),
      receiver_id: receiverId,
      wisher_id: wisherId,
      wisher_name: wisherName,
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('birthday_wishes')
        .insert({
          id: newWish.id,
          receiver_id: newWish.receiver_id,
          wisher_id: newWish.wisher_id,
          wisher_name: newWish.wisher_name,
          created_at: newWish.created_at
        });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.warn('Supabase birthday_wishes insert failed, using local storage fallback:', err.message || err);
    }

    // Always keep local storage in sync as a robust fallback/cache
    const localWishesStr = localStorage.getItem(`sy_birthday_wishes_${receiverId}`) || '[]';
    try {
      const wishes = JSON.parse(localWishesStr) as BirthdayWish[];
      wishes.push(newWish);
      const now = Date.now();
      const validWishes = wishes.filter(wish => {
        const wishTime = new Date(wish.created_at).getTime();
        return now - wishTime <= 24 * 60 * 60 * 1000;
      });
      localStorage.setItem(`sy_birthday_wishes_${receiverId}`, JSON.stringify(validWishes));
    } catch {
      localStorage.setItem(`sy_birthday_wishes_${receiverId}`, JSON.stringify([newWish]));
    }

    // Keep wisher local storage in sync as a cache to track who they have wished!
    const wisherLocalKey = `sy_wished_ids_${wisherId}`;
    const localWishedStr = localStorage.getItem(wisherLocalKey) || '[]';
    try {
      const items = JSON.parse(localWishedStr) as { receiverId: string, timestamp: string }[];
      if (!items.some(item => item.receiverId === receiverId)) {
        items.push({ receiverId, timestamp: newWish.created_at });
      }
      localStorage.setItem(wisherLocalKey, JSON.stringify(items));
    } catch {
      localStorage.setItem(wisherLocalKey, JSON.stringify([{ receiverId, timestamp: newWish.created_at }]));
    }

    return newWish;
  }

  async getSentBirthdayWishes(wisherId: string): Promise<string[]> {
    const dbWished: string[] = [];
    try {
      const { data, error } = await supabase
        .from('birthday_wishes')
        .select('receiver_id')
        .eq('wisher_id', wisherId);
      
      if (!error && data) {
        dbWished.push(...(data as { receiver_id: string }[]).map(d => d.receiver_id));
      }
    } catch (err: any) {
      console.warn('Supabase getSentBirthdayWishes query failed:', err.message || err);
    }

    // Always merge with local storage cache to handle offline/local fallbacks and guarantee 1-time wishing
    const wisherLocalKey = `sy_wished_ids_${wisherId}`;
    const localWishedStr = localStorage.getItem(wisherLocalKey);
    const localWishedIds: string[] = [];
    if (localWishedStr) {
      try {
        const items = JSON.parse(localWishedStr) as { receiverId: string, timestamp: string }[];
        const now = Date.now();
        const validItems = items.filter(item => {
          const time = new Date(item.timestamp).getTime();
          return now - time <= 24 * 60 * 60 * 1000;
        });
        localStorage.setItem(wisherLocalKey, JSON.stringify(validItems));
        localWishedIds.push(...validItems.map(item => item.receiverId));
      } catch (e) {
        console.error('Failed to parse local wished ids:', e);
      }
    }

    // Return unique IDs from both sources
    return Array.from(new Set([...dbWished, ...localWishedIds]));
  }

  async getAllBirthdayWishes(): Promise<BirthdayWish[]> {
    try {
      const { data, error } = await supabase
        .from('birthday_wishes')
        .select('*');
      
      if (error) {
        throw error;
      }
      return data as BirthdayWish[];
    } catch (err: any) {
      console.warn('Supabase getAllBirthdayWishes failed, compiling from local storage:', err.message || err);
      const allWishes: BirthdayWish[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sy_birthday_wishes_')) {
            const dataStr = localStorage.getItem(key);
            if (dataStr) {
              const wishes = JSON.parse(dataStr) as BirthdayWish[];
              allWishes.push(...wishes);
            }
          }
        }
        // Deduplicate wishes by ID
        const seenIds = new Set<string>();
        return allWishes.filter(wish => {
          if (seenIds.has(wish.id)) return false;
          seenIds.add(wish.id);
          return true;
        });
      } catch (e) {
        console.error('Failed to parse local birthday wishes:', e);
      }
      return allWishes;
    }
  }

  async getChatMessages(): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('global_chat_messages')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) {
        throw error;
      }
      
      // Overwrite local storage with the exact database state to prevent reverting cleared chats
      try {
        localStorage.setItem('sy_global_chat_messages', JSON.stringify(data || []));
      } catch (e) {
        console.warn('Failed to sync database state to local storage:', e);
      }
      
      return data as ChatMessage[];
    } catch (err: any) {
      console.warn('Supabase global_chat_messages query failed, falling back to local storage:', err.message || err);
      try {
        const localData = localStorage.getItem('sy_global_chat_messages');
        if (localData) {
          return JSON.parse(localData) as ChatMessage[];
        }
      } catch (e) {
        console.error('Failed to parse local chat messages:', e);
      }
      return [];
    }
  }

  async sendChatMessage(messageText: string, userId: string, userName: string, userAvatar?: string): Promise<ChatMessage> {
    const newMsg: ChatMessage = {
      id: crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      user_name: userName,
      user_avatar: userAvatar || '',
      message: messageText,
      read_by: [userId],
      reactions: {},
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('global_chat_messages')
        .insert({
          id: newMsg.id,
          user_id: newMsg.user_id,
          user_name: newMsg.user_name,
          user_avatar: newMsg.user_avatar,
          message: newMsg.message,
          read_by: newMsg.read_by,
          reactions: newMsg.reactions,
          created_at: newMsg.created_at
        })
        .select()
        .single();

      if (error) {
        throw error;
      }
      
      // Also cache locally
      try {
        const localData = localStorage.getItem('sy_global_chat_messages');
        const list = localData ? JSON.parse(localData) as ChatMessage[] : [];
        list.push(data as ChatMessage);
        localStorage.setItem('sy_global_chat_messages', JSON.stringify(list.slice(-100)));
      } catch (e) {
        console.warn('Failed to cache sent message to local storage:', e);
      }

      return data as ChatMessage;
    } catch (err: any) {
      console.warn('Supabase insert global_chat_messages failed, storing in local storage fallback:', err.message || err);
      try {
        const localData = localStorage.getItem('sy_global_chat_messages');
        const list = localData ? JSON.parse(localData) as ChatMessage[] : [];
        list.push(newMsg);
        localStorage.setItem('sy_global_chat_messages', JSON.stringify(list.slice(-100)));
      } catch (e) {
        console.error('Failed to write to local storage:', e);
      }
      return newMsg;
    }
  }

  async markMessagesAsRead(messageIds: string[], userId: string): Promise<void> {
    if (!messageIds.length || !userId) return;
    try {
      // Fetch messages that we need to update
      const { data: msgs, error: fetchErr } = await supabase
        .from('global_chat_messages')
        .select('id, read_by')
        .in('id', messageIds);

      if (fetchErr) throw fetchErr;

      if (msgs && msgs.length > 0) {
        for (const msg of msgs) {
          let readBy: string[] = [];
          if (Array.isArray(msg.read_by)) {
            readBy = msg.read_by;
          } else if (typeof msg.read_by === 'string') {
            try { readBy = JSON.parse(msg.read_by); } catch {}
          }

          if (!readBy.includes(userId)) {
            const updatedReadBy = [...readBy, userId];
            await supabase
              .from('global_chat_messages')
              .update({ read_by: updatedReadBy })
              .eq('id', msg.id);
          }
        }
      }

      // Also update local cache
      try {
        const localData = localStorage.getItem('sy_global_chat_messages');
        if (localData) {
          const list = JSON.parse(localData) as ChatMessage[];
          let changed = false;
          list.forEach(m => {
            if (messageIds.includes(m.id)) {
              if (!m.read_by) m.read_by = [];
              if (!m.read_by.includes(userId)) {
                m.read_by.push(userId);
                changed = true;
              }
            }
          });
          if (changed) {
            localStorage.setItem('sy_global_chat_messages', JSON.stringify(list));
          }
        }
      } catch (e) {
        console.warn('Failed to update local storage cache in markMessagesAsRead:', e);
      }
    } catch (err: any) {
      console.warn('Supabase markMessagesAsRead failed, applying local-only updates:', err.message || err);
      try {
        const localData = localStorage.getItem('sy_global_chat_messages');
        if (localData) {
          const list = JSON.parse(localData) as ChatMessage[];
          let changed = false;
          list.forEach(m => {
            if (messageIds.includes(m.id)) {
              if (!m.read_by) m.read_by = [];
              if (!m.read_by.includes(userId)) {
                m.read_by.push(userId);
                changed = true;
              }
            }
          });
          if (changed) {
            localStorage.setItem('sy_global_chat_messages', JSON.stringify(list));
          }
        }
      } catch (e) {
        console.error('Local fallback batch read update failed:', e);
      }
    }
  }

  async toggleMessageReaction(messageId: string, emoji: string, userId: string): Promise<ChatMessage | null> {
    try {
      const { data: msg, error: fetchErr } = await supabase
        .from('global_chat_messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (fetchErr) throw fetchErr;

      let reactions: Record<string, string[]> = {};
      if (msg.reactions) {
        if (typeof msg.reactions === 'string') {
          try { reactions = JSON.parse(msg.reactions); } catch {}
        } else if (typeof msg.reactions === 'object') {
          reactions = msg.reactions as Record<string, string[]>;
        }
      }

      if (!reactions) reactions = {};

      const currentUsersList = reactions[emoji] || [];
      if (currentUsersList.includes(userId)) {
        reactions[emoji] = currentUsersList.filter(id => id !== userId);
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      } else {
        reactions[emoji] = [...currentUsersList, userId];
      }

      const { data: updatedMsg, error: updateErr } = await supabase
        .from('global_chat_messages')
        .update({ reactions })
        .eq('id', messageId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Also update local cache
      try {
        const localData = localStorage.getItem('sy_global_chat_messages');
        if (localData) {
          const list = JSON.parse(localData) as ChatMessage[];
          const idx = list.findIndex(m => m.id === messageId);
          if (idx !== -1) {
            list[idx].reactions = reactions;
            localStorage.setItem('sy_global_chat_messages', JSON.stringify(list));
          }
        }
      } catch (e) {
        console.warn('Failed to update local storage cache in toggleMessageReaction:', e);
      }

      return updatedMsg as ChatMessage;
    } catch (err: any) {
      console.warn('Supabase toggleMessageReaction failed, applying local-only update:', err.message || err);
      try {
        const localData = localStorage.getItem('sy_global_chat_messages');
        if (localData) {
          const list = JSON.parse(localData) as ChatMessage[];
          const idx = list.findIndex(m => m.id === messageId);
          if (idx !== -1) {
            let reactions = list[idx].reactions || {};
            const currentUsersList = reactions[emoji] || [];
            if (currentUsersList.includes(userId)) {
              reactions[emoji] = currentUsersList.filter(id => id !== userId);
              if (reactions[emoji].length === 0) {
                delete reactions[emoji];
              }
            } else {
              reactions[emoji] = [...currentUsersList, userId];
            }
            list[idx].reactions = reactions;
            localStorage.setItem('sy_global_chat_messages', JSON.stringify(list));
            return list[idx];
          }
        }
      } catch (e) {
        console.error('Local fallback toggleMessageReaction failed:', e);
      }
      return null;
    }
  }

  async clearAllChatMessages(): Promise<void> {
    try {
      const { error } = await supabase
        .from('global_chat_messages')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      // Insert an official system notice indicating the chat was cleared
      const sysId = crypto.randomUUID ? crypto.randomUUID() : `sys-${Date.now()}`;
      await supabase.from('global_chat_messages').insert({
        id: sysId,
        user_id: 'system',
        user_name: 'Admin',
        user_avatar: '',
        message: 'Deleted by Admin',
        read_by: [],
        reactions: {},
        created_at: new Date().toISOString()
      });

      // Clear local cache
      localStorage.removeItem('sy_global_chat_messages');
    } catch (err: any) {
      console.warn('Supabase clearAllChatMessages failed, clearing local storage:', err.message || err);
      localStorage.removeItem('sy_global_chat_messages');
    }
  }

  async editChatMessage(messageId: string, text: string): Promise<ChatMessage | null> {
    try {
      const { data: updatedMsg, error } = await supabase
        .from('global_chat_messages')
        .update({ message: text })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;

      // Update local cache
      try {
        const localData = localStorage.getItem('sy_global_chat_messages');
        if (localData) {
          const list = JSON.parse(localData) as ChatMessage[];
          const idx = list.findIndex(m => m.id === messageId);
          if (idx !== -1) {
            list[idx].message = text;
            localStorage.setItem('sy_global_chat_messages', JSON.stringify(list));
          }
        }
      } catch (e) {
        console.warn('Failed to update local storage cache in editChatMessage:', e);
      }

      return updatedMsg as ChatMessage;
    } catch (err: any) {
      console.warn('Supabase editChatMessage failed, applying local-only update:', err.message || err);
      try {
        const localData = localStorage.getItem('sy_global_chat_messages');
        if (localData) {
          const list = JSON.parse(localData) as ChatMessage[];
          const idx = list.findIndex(m => m.id === messageId);
          if (idx !== -1) {
            list[idx].message = text;
            localStorage.setItem('sy_global_chat_messages', JSON.stringify(list));
            return list[idx];
          }
        }
      } catch (e) {
        console.error('Local fallback editChatMessage failed:', e);
      }
      return null;
    }
  }

  async deleteChatMessage(messageId: string): Promise<ChatMessage | null> {
    const deletedText = "This message was deleted";
    try {
      const { data: updatedMsg, error } = await supabase
        .from('global_chat_messages')
        .update({ message: deletedText, reactions: {} })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;

      // Update local cache
      try {
        const localData = localStorage.getItem('sy_global_chat_messages');
        if (localData) {
          const list = JSON.parse(localData) as ChatMessage[];
          const idx = list.findIndex(m => m.id === messageId);
          if (idx !== -1) {
            list[idx].message = deletedText;
            list[idx].reactions = {};
            localStorage.setItem('sy_global_chat_messages', JSON.stringify(list));
          }
        }
      } catch (e) {
        console.warn('Failed to update local storage cache in deleteChatMessage:', e);
      }

      return updatedMsg as ChatMessage;
    } catch (err: any) {
      console.warn('Supabase deleteChatMessage failed, applying local-only update:', err.message || err);
      try {
        const localData = localStorage.getItem('sy_global_chat_messages');
        if (localData) {
          const list = JSON.parse(localData) as ChatMessage[];
          const idx = list.findIndex(m => m.id === messageId);
          if (idx !== -1) {
            list[idx].message = deletedText;
            list[idx].reactions = {};
            localStorage.setItem('sy_global_chat_messages', JSON.stringify(list));
            return list[idx];
          }
        }
      } catch (e) {
        console.error('Local fallback deleteChatMessage failed:', e);
      }
      return null;
    }
  }
}

export const db = new HybridDatabaseManager();
