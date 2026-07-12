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

