/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { User, Mail, Phone, Lock, ChevronDown, ChevronUp, Check, AlertCircle, Sparkles } from 'lucide-react';
import { DEFAULT_ADMIN_EMAIL } from '../types';

interface RegistrationFormProps {
  onToggleLogin: () => void;
  onSuccess: () => void;
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({ onToggleLogin, onSuccess }) => {
  const { signUpWithEmail, error, clearError } = useAuth();
  
  // Basic Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Optional Fields
  const [showOptional, setShowOptional] = useState(false);
  const [gender, setGender] = useState<'Male' | 'Female' | undefined>(undefined);
  const [bloodGroup, setBloodGroup] = useState('');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!name.trim()) {
      setFormError('Username is required.');
      return;
    }
    if (!email.trim()) {
      setFormError('Email Address is required.');
      return;
    }
    if (!phone.trim()) {
      setFormError('Phone Number is required so you can log in using your mobile number.');
      return;
    }
    if (!dob) {
      setFormError('Date of Birth is compulsory!');
      return;
    }
    if (!gender) {
      setFormError('Please select your Gender.');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const extraDetails = {
        gender,
        blood_group: bloodGroup || undefined,
        dob: dob || undefined,
        address: address || undefined,
        username: name // Populate username column in Supabase profiles
      };

      await signUpWithEmail(email, password, name, phone, extraDetails);
      onSuccess();
    } catch (err: any) {
      setFormError(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Join Shalom Youth</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Register to represent as a member and access the dynamic dashboard
        </p>
      </div>

      {(formError || error) && (
        <div className="p-3.5 bg-rose-50 text-rose-800 border border-rose-154 rounded-xl text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{formError || error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Username</span>
            <span className="text-[10px] text-emerald-600 font-bold lowercase tracking-normal">Required</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
              <User className="w-4 h-4" />
            </span>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Samuel Kipgen"
              className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-stone-900 text-stone-900 dark:text-white rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Email Address</span>
            <span className="text-[10px] text-emerald-600 font-bold lowercase tracking-normal">Required</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
              <Mail className="w-4 h-4" />
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-stone-900 text-stone-900 dark:text-white rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Phone Number</span>
              <span className="text-[10px] text-emerald-600 font-bold lowercase tracking-normal">Required</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                <Phone className="w-4 h-4" />
              </span>
              <input
                type="tel"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+919876543210"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-stone-900 text-stone-900 dark:text-white rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Date of Birth</span>
              <span className="text-[10px] text-rose-600 font-extrabold uppercase">Required 🎂</span>
            </label>
            <div className="relative">
              <input
                type="date"
                required
                value={dob}
                onChange={e => setDob(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-stone-900 text-stone-900 dark:text-white rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Gender</span>
              <span className="text-[10px] text-emerald-600 font-bold lowercase tracking-normal">Required</span>
            </label>
            <select
              required
              value={gender || ''}
              onChange={e => setGender((e.target.value as 'Male' | 'Female') || undefined)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-stone-900 text-stone-900 dark:text-white rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              <option value="">Select Gender</option>
              <option value="Male">Male (Tg.)</option>
              <option value="Female">Female (Lia)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Password</span>
              <span className="text-[10px] text-emerald-600 font-bold lowercase tracking-normal">Required</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-stone-900 text-stone-900 dark:text-white rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Confirm Password</span>
              <span className="text-[10px] text-emerald-600 font-bold lowercase tracking-normal">Required</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-stone-900 text-stone-900 dark:text-white rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Optional Collapsible Profile Form */}
        <div className="border border-stone-150 dark:border-stone-800 rounded-xl overflow-hidden bg-stone-50/50">
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="w-full px-4 py-2.5 text-left text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center justify-between hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400">
              <Sparkles className="w-3.5 h-3.5 text-emerald-55" /> Additional Profile Details (Optional)
            </span>
            {showOptional ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showOptional && (
            <div className="p-4 border-t border-stone-150 dark:border-stone-800 space-y-3.5 bg-white dark:bg-stone-900">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase mb-1 flex justify-between items-center">
                    <span>Blood Group</span>
                    <span className="text-[10px] text-stone-400 font-medium normal-case">Optional</span>
                  </label>
                  <input
                    type="text"
                    value={bloodGroup}
                    onChange={e => setBloodGroup(e.target.value)}
                    placeholder="e.g. O+, A-"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 text-stone-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase mb-1 flex justify-between items-center">
                    <span>Residential Address</span>
                    <span className="text-[10px] text-stone-400 font-medium normal-case">Optional</span>
                  </label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="e.g. Hill View Colony, Sector 3"
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-xl shadow-xs hover:shadow-md hover:translate-y-[-1px] active:translate-y-0 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          {isLoading ? 'Creating Community Member...' : 'Register For Member Account'}
          <Check className="w-4 h-4" />
        </button>
      </form>

      <div className="text-center text-xs text-stone-500">
        Already have a member account?{' '}
        <button
          onClick={onToggleLogin}
          className="text-emerald-600 hover:underline font-semibold cursor-pointer"
        >
          Sign In
        </button>
      </div>
    </div>
  );
};
