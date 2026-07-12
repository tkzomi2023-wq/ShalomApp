/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Member, UserRole, ALL_ROLES, formatMemberName, ActivityLog } from '../types';
import { useAuth } from '../lib/auth';
import { supabase, db } from '../lib/supabase';
import { X, User, Mail, Phone, Calendar, MapPin, HeartPulse, UserCheck, ShieldCheck, Edit3, Check, Camera, Bell, Coins, History, Clock } from 'lucide-react';
import { RoleBadge } from './RoleBadge';
import { FinancialRecord, financialsDb, MONTHS } from '../lib/financials';
import { getActivityLogs } from '../lib/activity';

interface UserProfileModalProps {
  member: Member;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedMember: Member) => void;
  isCurrentUserAdmin: boolean;
  initialEditMode?: boolean;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  member,
  isOpen,
  onClose,
  onUpdate,
  isCurrentUserAdmin,
  initialEditMode = false
}) => {
  const { user: currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState<number>(0);
  
  const [isSaving, setIsSaving] = useState(false);
  
  // Field values
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone || '');
  const [gender, setGender] = useState<'Male' | 'Female' | undefined>(member.gender);
  const [bloodGroup, setBloodGroup] = useState(member.blood_group || '');
  const [dob, setDob] = useState(member.dob || '');
  const [address, setAddress] = useState(member.address || '');
  const [role, setRole] = useState<UserRole>(member.role);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>(member.status);
  const [avatar, setAvatar] = useState(member.avatar || '');
  const [emailNotifications, setEmailNotifications] = useState<boolean>(member.email_notifications !== false);
  const [userRecords, setUserRecords] = useState<FinancialRecord[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  // Password change states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [passwordStatusMsg, setPasswordStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const handlePasswordUpdate = async () => {
    if (!newPassword) return;
    if (newPassword.length < 6) {
      setPasswordStatusMsg({ text: 'Password must be at least 6 characters long.', isError: true });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatusMsg({ text: 'Passwords do not match.', isError: true });
      return;
    }

    setPasswordUpdating(true);
    setPasswordStatusMsg(null);
    try {
      const isLocalStorage = db.isLocalStorageMode();
      if (!isLocalStorage) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }
      
      setPasswordStatusMsg({ text: 'Password updated successfully! Next time, log in using this new password.', isError: false });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Failed to update password:', err);
      setPasswordStatusMsg({ text: err.message || 'Failed to update password.', isError: true });
    } finally {
      setPasswordUpdating(false);
    }
  };

  useEffect(() => {
    setName(member.name);
    setPhone(member.phone || '');
    setGender(member.gender);
    setBloodGroup(member.blood_group || '');
    setDob(member.dob || '');
    setAddress(member.address || '');
    setRole(member.role);
    setStatus(member.status);
    setAvatar(member.avatar || '');
    setEmailNotifications(member.email_notifications !== false);
    if (initialEditMode) {
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
  }, [member, isOpen, initialEditMode]);

  useEffect(() => {
    if (isOpen) {
      const fetchRecords = async () => {
        try {
          const recs = await financialsDb.getFinancialRecords();
          const filtered = recs.filter(rec => {
            const rName = rec.name.trim().toLowerCase();
            const mName = member.name.trim().toLowerCase();
            const fmName = formatMemberName(member.name, member.gender).trim().toLowerCase();
            
            const stripPrefix = (s: string) => {
              return s
                .replace(/^(tg\.|tg\s+|lia\s+|lia\.|pa\s+|pa\.|sia\s+|sia\.)/gi, '')
                .trim();
            };
            
            return rName === mName || rName === fmName || stripPrefix(rName) === stripPrefix(mName);
          });
          setUserRecords(filtered);
        } catch (e) {
          console.warn('Could not load financial records for user profile:', e);
        }
      };
      fetchRecords();
      setLogs(getActivityLogs());
    }
  }, [isOpen, member]);

  if (!isOpen) return null;

  const isSelf = currentUser?.id === member.id || (currentUser?.email && currentUser.email.toLowerCase() === member.email.toLowerCase());
  const canEdit = isSelf || isCurrentUserAdmin;

  const currentYear = 2026; // Match mock and app default data year
  const currentMonthIndex = new Date().getMonth();
  const activeMonths = MONTHS.slice(0, currentMonthIndex + 1);

  const monthlySumMap = activeMonths.map(monthName => {
    const monthRecords = userRecords.filter(r => {
      const recordYear = new Date(r.payment_date).getFullYear();
      return r.payment_month === monthName && recordYear === currentYear;
    });
    const total = monthRecords.reduce((sum, r) => sum + r.amount, 0);
    return { month: monthName, total };
  });

  const totalAddUp = monthlySumMap.reduce((sum, item) => sum + item.total, 0);

  // Filter and sort logs for this specific member (either specifically targeting them or containing their email/name)
  const memberLogs = logs.filter(log => {
    const isTargetId = log.targetUserId === member.id;
    const isTargetNameInDetails = log.details?.toLowerCase().includes(member.name.toLowerCase());
    const isTargetEmailInDetails = log.details?.toLowerCase().includes(member.email.toLowerCase());
    const isSelfModification = log.userId === member.id && (log.action === 'Profile Modified' || log.action === 'Profile Updated');
    return isTargetId || isTargetNameInDetails || isTargetEmailInDetails || isSelfModification;
  });
  const sortedMemberLogs = [...memberLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!canEdit) {
      setAvatarUploadError("Permission denied! You can only edit your own profile.");
      return;
    }

    if (!file.type.startsWith('image/')) {
      setAvatarUploadError("Invalid file type. Please select a valid image file (PNG, JPG, or JPEG).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarUploadError(`File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Profile images must be under 2MB.`);
      return;
    }

    setIsAvatarUploading(true);
    setAvatarUploadError(null);
    setAvatarUploadProgress(10);

    const progressInterval = setInterval(() => {
      setAvatarUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 15;
      });
    }, 120);

    try {
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `${member.id}/avatar_${Date.now()}.${ext}`;
      const imageUrl = await db.uploadToStorage('avatars', filePath, file);
      
      clearInterval(progressInterval);
      setAvatarUploadProgress(100);
      setAvatar(imageUrl);
      
      // Auto-save picture details immediately ONLY if not editing
      if (!isEditing) {
        const updated: Member = {
          ...member,
          avatar: imageUrl
        };
        onUpdate(updated);
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error('Error uploading profile photo:', err);
      setAvatarUploadError(`Upload Failed: ${err.message || 'Network issue or storage permission error.'}`);
    } finally {
      setIsAvatarUploading(false);
      setTimeout(() => setAvatarUploadProgress(0), 800);
    }
  };

  const handleSave = async () => {
    if (!dob) {
      alert('Date of Birth is compulsory! Please provide your birthday so we can celebrate with community alerts and custom themes.');
      return;
    }
    
    setIsSaving(true);
    try {
      const updated: Member = {
        ...member,
        name,
        phone,
        gender,
        blood_group: bloodGroup,
        dob,
        address,
        role: isCurrentUserAdmin ? role : member.role,
        status: isCurrentUserAdmin ? status : member.status,
        avatar,
        email_notifications: emailNotifications
      };
      await onUpdate(updated);
      setIsEditing(false);
    } catch (err: any) {
      console.error('Failed to save profile changes inside modal:', err);
      alert(err.message || 'Failed to save profile changes. Please try again or contact support.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
    >
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800"
      >
        
        {/* Header */}
        <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-920 dark:text-emerald-400 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-stone-900 dark:text-white text-base">
                  {isEditing ? 'Edit Profile Details' : 'Member Profile Card'}
                </h3>
                {!isEditing && (
                  <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${
                    canEdit 
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' 
                      : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400 border border-stone-200 dark:border-stone-700'
                  }`}>
                    {canEdit ? 'Editable' : 'View Only'}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400">Shalom Youth Registration ID: {member.id.substring(0, 8)}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5 text-xs text-stone-600 dark:text-stone-300">
          
          {/* Avatar and Primary Identity */}
          <div className="flex flex-col items-center text-center pb-4 border-b border-stone-100 dark:border-stone-800">
            <div 
              onClick={() => {
                if (canEdit) {
                  document.getElementById('avatar-file-input')?.click();
                }
              }}
              className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black mb-3 border-4 select-none relative overflow-hidden group transition-all duration-300 ${
                canEdit ? 'cursor-pointer hover:border-emerald-500 hover:scale-105 hover:shadow-lg' : ''
              } ${
                member.status === 'approved' 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-250 dark:border-emerald-900/40' 
                  : member.status === 'rejected'
                  ? 'bg-rose-100 text-rose-800 border-rose-250 dark:border-rose-900/40'
                  : 'bg-amber-100 text-amber-800 border-amber-250 dark:border-amber-900/40'
              }`}
              title={canEdit ? "Tap to update profile photo" : "Member photo"}
            >
              {avatar ? (
                <img 
                  src={avatar} 
                  alt={name} 
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{name.charAt(0).toUpperCase()}</span>
              )}

              {/* Uploading overlay */}
              {isAvatarUploading && (
                <div className="absolute inset-0 bg-stone-900/70 flex flex-col items-center justify-center text-white z-10">
                  <span className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
                  <span className="text-[8px] font-bold mt-1 uppercase tracking-wider">Uploading</span>
                </div>
              )}

              {/* Hover overlay if editable and not uploading */}
              {canEdit && !isAvatarUploading && (
                <div className="absolute inset-0 bg-stone-900/60 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Camera className="w-5 h-5 text-emerald-200" />
                  <span className="text-[9px] font-black tracking-wider uppercase mt-1">Update</span>
                </div>
              )}
            </div>

            {/* Hidden Input File Element */}
            {canEdit && (
              <input 
                type="file" 
                id="avatar-file-input" 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageUpload} 
              />
            )}

            {/* Avatar upload status, progress, error, and preview helper */}
            {canEdit && (isAvatarUploading || avatarUploadError || avatar) && (
              <div className="w-full max-w-sm mt-2 mb-4 p-3 rounded-xl border border-stone-150 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/20 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">Profile Photo Preview</span>
                  {avatar && isEditing && (
                    <button
                      type="button"
                      onClick={() => setAvatar('')}
                      className="text-[9px] font-black text-rose-600 dark:text-rose-400 hover:underline uppercase tracking-wider cursor-pointer"
                    >
                      Clear / Reset
                    </button>
                  )}
                </div>

                {avatar ? (
                  <div className="flex items-center gap-3">
                    <img 
                      src={avatar} 
                      alt="Avatar preview" 
                      className="w-12 h-12 rounded-lg object-cover border border-stone-200 dark:border-stone-800"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-stone-700 dark:text-stone-300 truncate">
                        {avatar.startsWith('data:') ? 'Newly Selected File' : 'Current Profile Photo Link'}
                      </p>
                      <p className="text-[9px] text-stone-400 truncate">
                        {avatar.startsWith('data:') ? 'Saved after clicking "Save Details" below' : 'Synchronized with Supabase'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-stone-400 italic">No custom image. Default monogram will be used.</p>
                )}

                {/* Progress Indicator */}
                {isAvatarUploading && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 border border-t-transparent border-emerald-600 dark:border-emerald-400 rounded-full animate-spin"></span>
                        Uploading to Supabase...
                      </span>
                      <span>{avatarUploadProgress}%</span>
                    </div>
                    <div className="w-full h-1 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-600 transition-all duration-150 rounded-full"
                        style={{ width: `${avatarUploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Helpful Error Display with retry & dismiss info */}
                {avatarUploadError && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded-lg text-[10px] leading-relaxed border border-rose-100 dark:border-rose-900/30 space-y-1">
                    <p className="font-bold flex items-center gap-1 uppercase tracking-wider text-[9px]">
                      ⚠️ Upload Failure
                    </p>
                    <p>{avatarUploadError}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <button 
                        type="button"
                        onClick={() => document.getElementById('avatar-file-input')?.click()}
                        className="bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 px-2 py-0.5 rounded font-bold uppercase text-[8px] tracking-wider transition-colors cursor-pointer"
                      >
                        Try Another
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAvatarUploadError(null)}
                        className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 font-bold uppercase text-[8px] tracking-wider transition-colors cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isEditing ? (
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="text-base font-bold text-stone-900 dark:text-white bg-stone-50 dark:bg-stone-850 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-850 text-center w-full max-w-xs focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Full Name"
              />
            ) : (
              <h4 className="text-lg font-extrabold text-stone-900 dark:text-white flex items-center gap-1.5 justify-center">
                {formatMemberName(name, gender)}
                {member.status === 'approved' && (
                  <UserCheck className="w-4 h-4 text-emerald-600 bg-emerald-50 p-0.5 rounded-full" />
                )}
              </h4>
            )}

            <div className="mt-1.5 flex flex-wrap gap-1.5 justify-center">
              <RoleBadge role={isEditing && isCurrentUserAdmin ? role : member.role} />
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                member.status === 'approved'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : member.status === 'rejected'
                  ? 'bg-rose-50 text-rose-700 border-rose-100'
                  : 'bg-amber-50 text-amber-700 border-amber-100'
              }`}>
                Status: {member.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Contact Information */}
            <div className="space-y-3">
              <h5 className="font-bold text-stone-900 dark:text-white uppercase tracking-wider text-[10px] border-l-2 border-emerald-600 pl-1.5">
                Contact Details
              </h5>
              
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-stone-400 shrink-0" />
                <div className="truncate">
                  <p className="text-[10px] text-stone-400 uppercase tracking-wide">Email</p>
                  <p className="font-semibold text-stone-900 dark:text-white truncate">{member.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-stone-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-wide">Phone Number</p>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="text-xs bg-stone-50 dark:bg-stone-850 px-2 py-1 rounded-md border border-stone-200 mt-0.5"
                    />
                  ) : (
                    <p className="font-semibold text-stone-900 dark:text-white">{phone || 'Not Provided'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Demographics / Personal Information */}
            <div className="space-y-3">
              <h5 className="font-bold text-stone-900 dark:text-white uppercase tracking-wider text-[10px] border-l-2 border-emerald-600 pl-1.5">
                Demographics
              </h5>

              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-wide">
                    Date of Birth {isEditing && <span className="text-rose-500 font-extrabold font-sans text-[9px] lowercase tracking-normal">(Compulsory 🎂)</span>}
                  </p>
                  {isEditing ? (
                    <input
                      type="date"
                      value={dob}
                      onChange={e => setDob(e.target.value)}
                      className="text-xs bg-stone-50 dark:bg-stone-850 px-2 py-1 rounded-md border border-stone-200 mt-0.5"
                    />
                  ) : (
                    <p className="font-semibold text-stone-900 dark:text-white">{dob || 'Not Provided'}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <HeartPulse className="w-4 h-4 text-stone-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] text-stone-400 uppercase tracking-wide">Blood Group & Gender</p>
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                      <select
                        value={gender || ''}
                        onChange={e => setGender((e.target.value as 'Male' | 'Female') || undefined)}
                        className="text-xs bg-stone-50 border px-1.5 py-0.5 rounded-md"
                      >
                        <option value="">Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                      <input
                        type="text"
                        value={bloodGroup}
                        onChange={e => setBloodGroup(e.target.value)}
                        placeholder="Blood"
                        className="text-xs bg-stone-50 border px-1.5 py-0.5 rounded-md w-full"
                      />
                    </div>
                  ) : (
                    <p className="font-semibold text-stone-900 dark:text-white">
                      {gender || 'Unspecified'} {bloodGroup ? `(${bloodGroup})` : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Residential Address */}
          <div className="space-y-1.5">
            <h5 className="font-bold text-stone-900 dark:text-white uppercase tracking-wider text-[10px] border-l-2 border-emerald-600 pl-1.5">
              Address & Residence
            </h5>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                {isEditing ? (
                  <textarea
                    rows={2}
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full text-xs bg-stone-50 dark:bg-stone-850 px-2 py-1 rounded-md border border-stone-200"
                    placeholder="Enter resident address details"
                  />
                ) : (
                  <p className="text-stone-800 dark:text-stone-200 font-semibold">{address || 'No residential address on file.'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Preferences setting toggle */}
          <div className="space-y-2 border-t pt-4 border-stone-100 dark:border-stone-800">
            <h5 className="font-bold text-stone-900 dark:text-white uppercase tracking-wider text-[10px] border-l-2 border-emerald-600 pl-1.5 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-emerald-600" /> Preferences
            </h5>
            <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-950/10 rounded-xl border border-stone-150 dark:border-stone-800/80">
              <div className="space-y-0.5">
                <span className="font-bold text-stone-850 dark:text-stone-150">Email Notifications</span>
                <p className="text-[10px] text-stone-450 dark:text-stone-400">Receive schedule and service updates instantly</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={emailNotifications} 
                  disabled={!canEdit}
                  onChange={e => {
                    const newVal = e.target.checked;
                    setEmailNotifications(newVal);
                    // Direct auto-save if editing is not active
                    if (!isEditing) {
                      onUpdate({
                        ...member,
                        email_notifications: newVal
                      });
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-200 peer-focus:outline-hidden rounded-full peer dark:bg-stone-750 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>

          {/* Security & Password section (Only for the user themselves) */}
          {isSelf && (
            <div className="space-y-3 border-t pt-4 border-stone-100 dark:border-stone-800">
              <h5 className="font-bold text-stone-900 dark:text-white uppercase tracking-wider text-[10px] border-l-2 border-emerald-600 pl-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Account Security
              </h5>
              <div className="p-3 bg-stone-50 dark:bg-stone-950/10 rounded-xl border border-stone-150 dark:border-stone-800/80 space-y-3">
                <p className="text-[10px] text-stone-400">
                  Update your account password. If you logged in with a temporary password, please set a strong, memorable one.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[9px] font-bold text-stone-450 uppercase mb-0.5">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 bg-white text-stone-800 dark:text-white dark:bg-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-stone-450 uppercase mb-0.5">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 bg-white text-stone-800 dark:text-white dark:bg-stone-900"
                    />
                  </div>
                </div>

                {passwordStatusMsg && (
                  <p className={`text-[10px] font-bold ${passwordStatusMsg.isError ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {passwordStatusMsg.text}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handlePasswordUpdate}
                  disabled={passwordUpdating || !newPassword}
                  className="w-full py-1.5 px-3 bg-stone-900 hover:bg-stone-850 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {passwordUpdating ? 'Updating...' : 'Update Login Password'}
                </button>
              </div>
            </div>
          )}

          {/* Contribution Breakdown Grid */}
          <div className="space-y-3 border-t pt-4 border-stone-100 dark:border-stone-800">
            <h5 className="font-bold text-stone-900 dark:text-white uppercase tracking-wider text-[10px] border-l-2 border-emerald-600 pl-1.5 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-emerald-600" /> Financial Contribution Audit ({currentYear} YTD)
            </h5>
            
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-100/80 dark:border-emerald-900/30 flex items-center justify-between">
              <span className="font-bold text-stone-700 dark:text-stone-300">Jan - {MONTHS[currentMonthIndex]} Cumulative Sum:</span>
              <span className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md">₹{totalAddUp.toLocaleString('en-IN')}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {monthlySumMap.map(({ month, total }) => (
                <div 
                  key={month} 
                  className="p-2 bg-stone-50 dark:bg-stone-950/10 rounded-lg border border-stone-150 dark:border-stone-800/80 flex items-center justify-between font-mono"
                >
                  <span className="text-stone-500 dark:text-stone-400 font-bold text-[10px]">{month.slice(0, 3)}</span>
                  <span className={`font-bold ${total > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 dark:text-stone-550'}`}>
                    {total > 0 ? `₹${total.toLocaleString('en-IN')}` : '₹0'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Admin Override controls */}
          {isEditing && isCurrentUserAdmin && (
            <div className="p-4 bg-stone-50 dark:bg-stone-950/20 border border-stone-150 dark:border-stone-800 rounded-xl space-y-3">
              <h5 className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Administrative Access overrides
              </h5>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">
                    Set User Role
                  </label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as UserRole)}
                    className="w-full text-xs bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-750 p-1.5 rounded-lg focus:outline-hidden cursor-pointer text-stone-900 dark:text-white"
                  >
                    {ALL_ROLES.map(r => (
                      <option key={r} value={r}>
                        {r === 'standard' ? 'standard (Member)' : r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">
                    Membership status
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full text-xs bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-750 p-1.5 rounded-lg focus:outline-hidden cursor-pointer text-stone-900 dark:text-white"
                  >
                    <option value="pending">pending (review)</option>
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Member Activity Timeline */}
          <div className="space-y-3 border-t pt-4 border-stone-100 dark:border-stone-800">
            <h5 className="font-bold text-stone-900 dark:text-white uppercase tracking-wider text-[10px] border-l-2 border-emerald-600 pl-1.5 flex items-center gap-1.5 justify-between">
              <span className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-emerald-600" /> Account Audit History
              </span>
              <span className="text-[9px] px-1.5 py-0.2 bg-stone-100 dark:bg-stone-800 text-stone-500 rounded font-mono font-bold uppercase leading-none">
                {sortedMemberLogs.length} {sortedMemberLogs.length === 1 ? 'event' : 'events'}
              </span>
            </h5>

            <p className="text-[10px] text-stone-400 dark:text-stone-400">
              A transparent history of administrative, profile status, and system modifications related to this account.
            </p>

            {sortedMemberLogs.length > 0 ? (
              <div className="relative pl-4 space-y-4 border-l border-stone-200 dark:border-stone-800 ml-1.5 py-1">
                {sortedMemberLogs.map((log) => {
                  const isActionByAdmin = log.userId !== member.id || log.action === 'Admin Action' || log.action === 'Member Manual Provision';
                  
                  return (
                    <div key={log.id} className="relative group">
                      {/* Timeline Dot */}
                      <span className={`absolute -left-[20.5px] top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-white dark:bg-stone-900 flex items-center justify-center transition-transform group-hover:scale-115 ${
                        log.action === 'Member Manual Provision'
                          ? 'border-blue-500 text-blue-500'
                          : log.action === 'Member Removed'
                          ? 'border-rose-500 text-rose-500'
                          : isActionByAdmin
                          ? 'border-emerald-500 text-emerald-500'
                          : 'border-amber-500 text-amber-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          log.action === 'Member Manual Provision'
                            ? 'bg-blue-500'
                            : log.action === 'Member Removed'
                            ? 'bg-rose-500'
                            : isActionByAdmin
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                        }`} />
                      </span>

                      {/* Timeline Content */}
                      <div className="bg-stone-50/75 dark:bg-stone-950/20 p-2.5 rounded-xl border border-stone-150 dark:border-stone-850/80 hover:border-stone-300 dark:hover:border-stone-700 transition-colors">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                          <span className="font-extrabold text-stone-800 dark:text-white text-[10px] flex items-center gap-1">
                            {log.action}
                            {isActionByAdmin && (
                              <span className="text-[8px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 font-bold px-1 rounded uppercase tracking-wide leading-none">
                                Admin Override
                              </span>
                            )}
                          </span>
                          <span className="text-[8.5px] text-stone-400 font-mono flex items-center gap-1 shrink-0">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(log.created_at).toLocaleString('en-IN', {
                              dateStyle: 'short',
                              timeStyle: 'short'
                            })}
                          </span>
                        </div>

                        <p className="text-[10px] text-stone-600 dark:text-stone-300 font-medium leading-relaxed">
                          {log.details}
                        </p>

                        <div className="mt-1.5 pt-1.5 border-t border-dashed border-stone-200 dark:border-stone-800 flex items-center justify-between text-[8.5px] text-stone-400 font-bold">
                          <span>
                            By: <span className="text-stone-500 dark:text-stone-300">{log.userName}</span>
                          </span>
                          <span className="font-mono text-[8px] tracking-wide truncate max-w-[120px] sm:max-w-none" title={log.userEmail}>
                            {log.userEmail}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-950/10 border border-dashed border-stone-200 dark:border-stone-850 flex flex-col items-center justify-center text-center text-stone-400 py-6">
                <History className="w-6 h-6 text-stone-300 mb-1.5" />
                <span className="font-bold text-[10px] text-stone-500">No account activity recorded yet</span>
                <p className="text-[9px] text-stone-400 max-w-xs mt-0.5">
                  Administrative overrides or status adjustments will be automatically documented here.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-stone-100 dark:border-stone-800 flex justify-end gap-2 bg-stone-50/50">
          {canEdit && (
            <>
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3.5 py-1.5 bg-white border border-stone-250 text-stone-700 hover:bg-stone-50 font-bold text-[11px] rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-50 text-white font-bold text-[11px] rounded-lg shadow-xs hover:shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <Clock className="w-3.5 h-3.5 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" /> Save Changes
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3.5 py-1.5 bg-emerald-55 text-white hover:bg-emerald-600 font-bold text-[11px] rounded-lg shadow-xs hover:shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Profile Details
                </button>
              )}
            </>
          )}

          {!isEditing && (
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-stone-950 text-white hover:bg-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 font-bold text-[11px] rounded-lg cursor-pointer"
            >
              Close Card
            </button>
          )}
        </div>

      </motion.div>
    </motion.div>
  );
};
