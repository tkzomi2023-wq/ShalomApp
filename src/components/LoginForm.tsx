/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Mail, Phone, Lock, ArrowRight, Chrome, AlertTriangle } from 'lucide-react';

interface LoginFormProps {
  onToggleRegister: () => void;
  onSuccess: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onToggleRegister, onSuccess }) => {
  const { signInWithEmail, signInWithPhone, signInWithGoogle, error, clearError } = useAuth();
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (loginMethod === 'email' && !email.trim()) {
      setFormError('Please enter your email address.');
      return;
    }
    if (loginMethod === 'phone' && !phone.trim()) {
      setFormError('Please enter your phone number.');
      return;
    }
    if (!password) {
      setFormError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      if (loginMethod === 'email') {
        await signInWithEmail(email, password);
      } else {
        await signInWithPhone(phone, password);
      }
      onSuccess();
    } catch (err: any) {
      setFormError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setFormError(null);
    try {
      await signInWithGoogle();
      onSuccess();
    } catch (err: any) {
      setFormError(err.message || 'Google Auth is undergoing redirect. Simulating instant login...');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">Welcome Back</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Sign in to access your Shalom Youth members portal
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-stone-100 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => {
            setLoginMethod('email');
            setFormError(null);
          }}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            loginMethod === 'email'
              ? 'bg-white shadow-xs text-stone-900'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Mail className="w-3.5 h-3.5" /> Email Address
        </button>
        <button
          type="button"
          onClick={() => {
            setLoginMethod('phone');
            setFormError(null);
          }}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            loginMethod === 'phone'
              ? 'bg-white shadow-xs text-stone-900'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Phone className="w-3.5 h-3.5" /> Phone Number
        </button>
      </div>

      {(formError || error) && (
        <div className="p-3.5 bg-rose-50 text-rose-800 border border-rose-155 rounded-xl text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{formError || error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {loginMethod === 'email' ? (
          <div>
            <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1.5">
              Email Address
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
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-white dark:bg-stone-900 text-stone-900 dark:text-white rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1.5">
              Phone Number
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
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-white dark:bg-stone-900 text-stone-900 dark:text-white rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-450 mt-1 font-medium">
              💡 Register first with your phone number, then use it here alongside your password to sign in!
            </p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Password
            </label>
            <span className="text-[10px] text-stone-400">Emulated bypass support</span>
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
              <Lock className="w-4 h-4" />
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-4 py-2.5 text-xs bg-white dark:bg-stone-900 text-stone-900 dark:text-white rounded-xl border border-stone-200 dark:border-stone-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-xl shadow-xs hover:shadow-md hover:translate-y-[-1px] active:translate-y-0 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          {isLoading ? 'Processing authentications...' : 'Sign In To Portal'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Google Login option */}
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-stone-100 dark:border-stone-800"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-3 text-stone-400">Or use OAuth</span>
        </div>
      </div>

      <button
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="w-full bg-white dark:bg-stone-900 hover:bg-stone-50 text-stone-700 dark:text-stone-300 font-semibold py-2.5 px-4 rounded-xl border border-stone-200 dark:border-stone-800 shadow-xs hover:shadow-xs hover:translate-y-[-1px] active:translate-y-0 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
      >
        <Chrome className="w-4 h-4 text-red-500" />
        Continue with Google Sync
      </button>

      <div className="text-center text-xs text-stone-500 pt-2">
        Don't have an account?{' '}
        <button
          onClick={onToggleRegister}
          className="text-emerald-600 hover:underline font-semibold cursor-pointer"
        >
          Register for Shalom Youth
        </button>
      </div>
    </div>
  );
};
