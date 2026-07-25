import React, { useState } from 'react';
import { 
  X, 
  UserPlus, 
  ShieldCheck, 
  Loader2, 
  AlertCircle, 
  Mail, 
  Phone, 
  User, 
  Key, 
  CheckCircle2 
} from 'lucide-react';
import { Member, UserRole, ALL_ROLES, DEFAULT_ADMIN_EMAIL } from '../types';
import { db } from '../lib/supabase';
import { addActivityLog, getActivityLogs } from '../lib/activity';

interface ManualProvisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Member | null;
  onRefresh?: () => void;
  setLogs?: (logs: any) => void;
}

export const ManualProvisionModal: React.FC<ManualProvisionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onRefresh,
  setLogs
}) => {
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('shalomyouth');
  const [newMemberRole, setNewMemberRole] = useState<UserRole>('standard');
  const [newMemberStatus, setNewMemberStatus] = useState<'approved' | 'pending'>('approved');
  const [newMemberGender, setNewMemberGender] = useState<'Male' | 'Female' | ''>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!newMemberEmail.trim()) {
      setFormError('Email address is required.');
      return;
    }
    if (!newMemberName.trim()) {
      setFormError('Username (Legal Name) is required.');
      return;
    }

    const isMainAdmin = currentUser?.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || currentUser?.email?.toLowerCase() === 'tkpaite2016@gmail.com';

    if (newMemberRole !== 'standard' && !isMainAdmin) {
      setFormError('Permission Denied: Only primary administrators can manually provision members with elevated roles.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await db.provisionMemberWithAuth(
        newMemberEmail.trim().toLowerCase(),
        newMemberPassword.trim() || 'shalomyouth',
        newMemberName.trim(),
        newMemberPhone.trim(),
        newMemberRole,
        newMemberStatus,
        newMemberGender || undefined
      );

      if (currentUser) {
        addActivityLog(
          currentUser.id,
          currentUser.email,
          currentUser.name,
          'Member Manual Provision',
          `Manually created account "${result.name}" with role "${result.role}".`,
          result.id,
          result.name
        );
        if (setLogs) {
          setLogs(getActivityLogs());
        }
      }

      setSuccessMessage(`Successfully registered ${result.name} (${result.email}).`);

      // Reset fields
      setNewMemberEmail('');
      setNewMemberName('');
      setNewMemberPhone('');
      setNewMemberPassword('shalomyouth');
      setNewMemberRole('standard');
      setNewMemberStatus('approved');
      setNewMemberGender('');

      if (onRefresh) {
        await onRefresh();
      }

      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1200);

    } catch (err: any) {
      setFormError(err.message || 'Failed to provision new member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 animate-fade-in text-left">
      <div className="bg-white dark:bg-stone-900 w-full max-w-xl rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden transition-all my-auto max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                Manually Provision New Youth Member
              </h3>
              <p className="text-xs text-emerald-100 font-medium">
                Administrative Control Panel • Direct Account Registration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-emerald-100 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {formError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-xs rounded-2xl border border-rose-200 dark:border-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <form id="provision-member-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            
            {/* Legal Name */}
            <div className="space-y-1.5">
              <label className="block font-bold text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1">
                <User className="w-3 h-3 text-emerald-600" />
                <span>Full Name (Legal Name) *</span>
              </label>
              <input
                type="text"
                required
                value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)}
                placeholder="e.g. Samuel Kipgen"
                className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="block font-bold text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1">
                <Mail className="w-3 h-3 text-emerald-600" />
                <span>Email Address *</span>
              </label>
              <input
                type="email"
                required
                value={newMemberEmail}
                onChange={e => setNewMemberEmail(e.target.value)}
                placeholder="member@shalomyouth.org"
                className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="block font-bold text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-600" />
                  Phone Number
                </span>
                <span className="text-[9px] text-emerald-600 lowercase tracking-normal font-semibold">For SMS / Login</span>
              </label>
              <input
                type="tel"
                value={newMemberPhone}
                onChange={e => setNewMemberPhone(e.target.value)}
                placeholder="+919876543210"
                className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block font-bold text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3 text-emerald-600" />
                  Login Password *
                </span>
                <span className="text-[9px] text-stone-400 lowercase tracking-normal font-semibold">Temporary password</span>
              </label>
              <input
                type="text"
                required
                value={newMemberPassword}
                onChange={e => setNewMemberPassword(e.target.value)}
                placeholder="e.g. shalomyouth"
                className="w-full px-3.5 py-2.5 bg-emerald-50/40 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-950 dark:text-emerald-200 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <label className="block font-bold text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Assigned System Role
              </label>
              <select
                value={newMemberRole}
                onChange={e => setNewMemberRole(e.target.value as UserRole)}
                disabled={currentUser?.email?.toLowerCase() !== DEFAULT_ADMIN_EMAIL.toLowerCase() && currentUser?.email?.toLowerCase() !== 'tkpaite2016@gmail.com'}
                className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {ALL_ROLES.map(r => (
                  <option key={r} value={r}>
                    {r === 'standard' ? 'standard (Youth Member)' : r}
                  </option>
                ))}
              </select>
            </div>

            {/* Direct Status */}
            <div className="space-y-1.5">
              <label className="block font-bold text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Direct Approval Status
              </label>
              <select
                value={newMemberStatus}
                onChange={e => setNewMemberStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white font-semibold cursor-pointer"
              >
                <option value="approved">Approved Immediately (Cleared)</option>
                <option value="pending">Awaiting Review (Pending)</option>
              </select>
            </div>

            {/* Gender */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block font-bold text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Gender Classification
              </label>
              <select
                value={newMemberGender}
                onChange={e => setNewMemberGender(e.target.value as 'Male' | 'Female' | '')}
                className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-white font-semibold cursor-pointer"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male (Tg.)</option>
                <option value="Female">Female (Lia)</option>
              </select>
            </div>

          </form>

          {/* Security Banner */}
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200/80 dark:border-stone-800 flex items-center gap-2.5 text-xs text-stone-600 dark:text-stone-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-[11px] leading-relaxed">
              New member accounts created here receive full Supabase authentication clearance and immediate database linkage.
            </p>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-5 bg-stone-50 dark:bg-stone-850 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-bold text-xs hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="provision-member-form"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Provisioning Account...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Verify & Provision Member</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
