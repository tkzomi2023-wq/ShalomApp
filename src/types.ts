/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 
  | 'standard' 
  | 'ECM' 
  | 'Founder' 
  | 'Admin'
  | 'Chairman' 
  | 'Vice Chairman' 
  | 'Secretary' 
  | 'Assistant Secretary' 
  | 'Treasurer' 
  | 'Financial Secretary';

export interface Member {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  gender?: 'Male' | 'Female';
  blood_group?: string;
  dob?: string;
  address?: string;
  avatar?: string;
  email_notifications?: boolean;
  hide_notifications_ui?: boolean;
  bial?: string;
  theme?: 'light' | 'dark';
}

export interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  action: string;
  details: string;
  created_at: string;
  targetUserId?: string;
  targetUserName?: string;
}

export const OB_ROLES: UserRole[] = [
  'Founder',
  'Admin',
  'Chairman',
  'Vice Chairman',
  'Secretary',
  'Assistant Secretary',
  'Treasurer',
  'Financial Secretary'
];

export const ALL_ROLES: UserRole[] = [
  'standard',
  'ECM',
  'Founder',
  'Admin',
  'Chairman',
  'Vice Chairman',
  'Secretary',
  'Assistant Secretary',
  'Treasurer',
  'Financial Secretary'
];

export function isOBUser(role: UserRole | string): boolean {
  return OB_ROLES.includes(role as UserRole);
}

export const DEFAULT_ADMIN_EMAIL = 'tkpaite2016@gmail.com';

export interface BirthdayWish {
  id: string;
  receiver_id: string;
  wisher_id: string;
  wisher_name: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  message: string;
  read_by?: string[];
  reactions?: Record<string, string[]>;
  created_at: string;
  parent_id?: string;
  is_pinned?: boolean;
}

export function formatMemberName(name: string, gender?: 'Male' | 'Female' | string): string {
  if (!name) return '';
  if (!gender) return name;
  const lowerGender = gender.toLowerCase();
  let cleanName = name.trim();
  
  if (lowerGender === 'male') {
    if (!cleanName.startsWith('Tg.')) {
      cleanName = `Tg. ${cleanName}`;
    }
  } else if (lowerGender === 'female') {
    if (!cleanName.startsWith('Lia')) {
      cleanName = `Lia ${cleanName}`;
    }
  }
  return cleanName;
}

export function getDefaultAvatar(gender?: 'Male' | 'Female' | string): string {
  if (!gender) return '';
  const lower = gender.toLowerCase();
  if (lower === 'male' || lower === 'tg' || lower === 'tg.') {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23E0F2FE"/><circle cx="50" cy="40" r="18" fill="%230284C7"/><path d="M22 80C22 65 34 56 50 56s28 9 28 24v4H22v-4z" fill="%230284C7"/><path d="M45 52h10v6H45z" fill="%230284C7" opacity="0.8"/></svg>`;
  }
  if (lower === 'female' || lower === 'lia') {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23FCE7F3"/><path d="M30 40c0-15 10-22 20-22s20 7 20 22c0 8-2 15-5 18H35c-3-3-5-10-5-18z" fill="%23DB2777"/><circle cx="50" cy="43" r="16" fill="%23F472B6"/><path d="M25 82C25 68 36 59 50 59s25 9 25 23v3H25v-3z" fill="%23DB2777"/></svg>`;
  }
  return '';
}

export function getCleanAvatar(avatarUrl: string | undefined): string {
  if (!avatarUrl) return '';
  if (avatarUrl.includes('|||')) {
    return avatarUrl.split('|||')[0];
  }
  return avatarUrl;
}

export interface BirthdayLog {
  id: string;
  timestamp: string;
  celebrants: string[];
  recipientCount: number;
  recipients: string[];
  subject: string;
  body: string;
  status: 'sent' | 'simulated' | 'failed' | 'checked_no_birthdays';
  errorMessage?: string;
}


