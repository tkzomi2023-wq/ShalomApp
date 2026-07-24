import React, { useState } from 'react';
import { Member, DEFAULT_ADMIN_EMAIL, isOBUser } from '../types';
import { 
  Plus, 
  Database, 
  ShieldAlert, 
  ShieldCheck, 
  Trophy, 
  Heart, 
  PhoneCall, 
  Users, 
  Clock, 
  Sparkles, 
  UserPlus, 
  Settings,
  SlidersHorizontal,
  CheckCircle2,
  Lock,
  Mail,
  Globe
} from 'lucide-react';
import BirthdayEmailSettingsPage from './BirthdayEmailSettingsPage';
import { WebsiteMetaSettingsPage } from './WebsiteMetaSettingsPage';

interface AdminControlPageProps {
  currentUser: Member | null;
  members?: Member[];
  onOpenProvisionModal: () => void;
  onOpenSQLModal: () => void;
  onOpenBialModal: () => void;
  onOpenRetentionModal?: () => void;
  isFootballEnabled: boolean;
  setIsFootballEnabled: (enabled: boolean) => void;
  isPrayerRequestsEnabled: boolean;
  setIsPrayerRequestsEnabled: (enabled: boolean) => void;
  isCallingEnabled: boolean;
  setIsCallingEnabled: (enabled: boolean) => void;
  membersCount?: number;
  pendingCount?: number;
}

export const AdminControlPage: React.FC<AdminControlPageProps> = ({
  currentUser,
  members = [],
  onOpenProvisionModal,
  onOpenSQLModal,
  onOpenBialModal,
  onOpenRetentionModal,
  isFootballEnabled,
  setIsFootballEnabled,
  isPrayerRequestsEnabled,
  setIsPrayerRequestsEnabled,
  isCallingEnabled,
  setIsCallingEnabled,
  membersCount = 0,
  pendingCount = 0
}) => {
  const isSuperAdmin = currentUser?.email?.toLowerCase() === 'tkpaite2016@gmail.com' || currentUser?.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase();
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'birthday' | 'meta'>('overview');

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="bg-white dark:bg-stone-900 p-6 sm:p-8 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black uppercase tracking-wider">
                System Administration
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Officer Bearer Clearance
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
              Administrative Control Panel
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
              Manage member provisioning, system features, database tools, and security controls.
            </p>
          </div>
        </div>

        {/* Quick Info Badges */}
        <div className="flex items-center gap-3 self-stretch md:self-auto justify-end">
          <div className="bg-stone-50 dark:bg-stone-850 px-4 py-2.5 rounded-2xl border border-stone-200/70 dark:border-stone-800 text-center">
            <div className="text-[10px] uppercase font-extrabold text-stone-400 tracking-wider">Total Registered</div>
            <div className="text-lg font-black text-stone-900 dark:text-white">{membersCount}</div>
          </div>
          {pendingCount > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 text-center">
              <div className="text-[10px] uppercase font-extrabold text-amber-600 dark:text-amber-400 tracking-wider">Pending Approvals</div>
              <div className="text-lg font-black text-amber-700 dark:text-amber-300">{pendingCount}</div>
            </div>
          )}
        </div>
      </div>

      {/* Sub Navigation Bar - Visible strictly to Founder/SuperAdmin only */}
      {isSuperAdmin && (
        <div className="flex items-center gap-2 p-1.5 bg-stone-100/90 dark:bg-stone-900/90 rounded-2xl border border-stone-200/80 dark:border-stone-800 w-full sm:w-auto self-start overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('overview')}
            className={`py-2 px-4 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === 'overview'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Overview & Controls</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('birthday')}
            className={`py-2 px-4 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === 'birthday'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <Mail className="w-4 h-4 shrink-0" />
            <span>Birthday Email Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('meta')}
            className={`py-2 px-4 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === 'meta'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4 shrink-0" />
            <span>Website Meta Settings</span>
          </button>
        </div>
      )}

      {/* Sub Tab Content Rendering */}
      {activeSubTab === 'birthday' && isSuperAdmin ? (
        currentUser ? (
          <BirthdayEmailSettingsPage currentUser={currentUser} members={members} />
        ) : null
      ) : activeSubTab === 'meta' && isSuperAdmin ? (
        currentUser ? (
          <WebsiteMetaSettingsPage currentUser={currentUser} />
        ) : null
      ) : (
        /* Main Grid Options */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Card 1: Member Provisioning & Quick Actions */}
          <div className={`bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between space-y-5 ${isSuperAdmin ? '' : 'lg:col-span-3 max-w-xl w-full mx-auto'}`}>
            <div>
              <div className="flex items-center justify-between border-b pb-4 border-stone-150 dark:border-stone-800 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-stone-900 dark:text-stone-100 text-base tracking-tight">
                      Member Actions
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Direct user creation & account setup
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={onOpenProvisionModal}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-xs py-3.5 px-4 rounded-xl shadow-md shadow-emerald-600/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Manually Provision Member
                </button>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed px-1">
                  Instantly register and clear a new youth member profile without waiting for self-registration.
                </p>

                {onOpenRetentionModal && isSuperAdmin && (
                  <div className="pt-2 border-t border-stone-150 dark:border-stone-800 mt-3">
                    <button
                      type="button"
                      onClick={onOpenRetentionModal}
                      className="w-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-stone-200 dark:border-stone-700"
                    >
                      <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Message Retention Policy
                    </button>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed px-1 mt-1">
                      Configure automated chat message cleanup schedules and policies.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-xs leading-relaxed text-emerald-900 dark:text-emerald-200 space-y-1">
              <div className="flex items-center gap-1.5 font-black text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Officer Bearer Authority</span>
              </div>
              <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/90">
                Manage clearances, assign Bial, and promote members to ECM or Officer Bearer roles.
              </p>
            </div>
          </div>

          {/* Modules Controls & Database Diagnostics (Founder/Admin ONLY) */}
          {isSuperAdmin && (
            <>
              {/* Card 2: System Feature Modules Control */}
              <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex items-center justify-between border-b pb-4 border-stone-150 dark:border-stone-800 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                        <SlidersHorizontal className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-stone-900 dark:text-stone-100 text-base tracking-tight">
                          Module Controls
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          Enable or disable application tabs globally
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200/70 dark:border-stone-800 space-y-3.5">
                    
                    {/* Football Toggle */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-stone-800 dark:text-stone-200 block">Football Predictions</span>
                          <span className="text-[10px] text-stone-400 block">Match predictor & leaderboard</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isFootballEnabled}
                          onChange={(e) => {
                            const newValue = e.target.checked;
                            setIsFootballEnabled(newValue);
                            localStorage.setItem('sy_enable_football_predictions', newValue ? 'true' : 'false');
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-stone-300 dark:bg-stone-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    <div className="border-t border-stone-200/60 dark:border-stone-800" />

                    {/* Prayer Requests Toggle */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-rose-500 fill-rose-500 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-stone-800 dark:text-stone-200 block">Prayer Requests</span>
                          <span className="text-[10px] text-stone-400 block">Community prayer wall</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isPrayerRequestsEnabled}
                          onChange={(e) => {
                            const newValue = e.target.checked;
                            setIsPrayerRequestsEnabled(newValue);
                            localStorage.setItem('sy_enable_prayer_requests', newValue ? 'true' : 'false');
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-stone-300 dark:bg-stone-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    <div className="border-t border-stone-200/60 dark:border-stone-800" />

                    {/* Calling Services Toggle */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <PhoneCall className="w-4 h-4 text-sky-500 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-stone-800 dark:text-stone-200 block">Calling & History Services</span>
                          <span className="text-[10px] text-stone-400 block">Voice/video calling & call logs</span>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isCallingEnabled}
                          onChange={(e) => {
                            const newValue = e.target.checked;
                            setIsCallingEnabled(newValue);
                            localStorage.setItem('sy_enable_calling_services', newValue ? 'true' : 'false');
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-stone-300 dark:bg-stone-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                  </div>
                </div>

                <div className="text-[11px] text-stone-400 dark:text-stone-500 px-1">
                  Toggle features on or off as needed for youth programs or server maintenance.
                </div>
              </div>

              {/* Card 3: Database & Diagnostics Guide */}
              <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex items-center justify-between border-b pb-4 border-stone-150 dark:border-stone-800 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-stone-900 dark:text-stone-100 text-base tracking-tight">
                          Database & Diagnostics
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          Schema setup & Bial records validation
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={onOpenSQLModal}
                      className="w-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 font-bold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-stone-200 dark:border-stone-700"
                      title="Configure Supabase Database setup and view unified schemas"
                    >
                      <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Database SQL Script Guide
                    </button>

                    <button
                      type="button"
                      onClick={onOpenBialModal}
                      className="w-full bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-300 font-bold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-200/80 dark:border-amber-800/60"
                      title="Compare financial records against registered user profiles to check Bial assignments"
                    >
                      <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      Bial Assignment Diagnostic Tool
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200/60 dark:border-stone-800 text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  Use these diagnostic tools to verify table columns, check Supabase real-time configurations, and ensure financial records match member Bial assignments.
                </div>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
};
