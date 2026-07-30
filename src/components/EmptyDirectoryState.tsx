/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { 
  Search, 
  RotateCcw, 
  Users, 
  UserPlus, 
  FilterX, 
  Sparkles, 
  SearchX, 
  ShieldAlert,
  HelpCircle,
  Hash,
  Filter,
  CheckCircle2,
  PhoneCall,
  MapPin
} from 'lucide-react';

interface EmptyDirectoryStateProps {
  totalMembersCount: number;
  searchTerm: string;
  statusFilter: string;
  roleGroupFilter: string;
  activityFilter: string;
  onClearFilters: () => void;
  onSearchChange?: (term: string) => void;
  onAddMember?: () => void;
}

export const EmptyDirectoryState: React.FC<EmptyDirectoryStateProps> = ({
  totalMembersCount,
  searchTerm,
  statusFilter,
  roleGroupFilter,
  activityFilter,
  onClearFilters,
  onSearchChange,
  onAddMember
}) => {
  const hasActiveFilters = 
    searchTerm.trim().length > 0 || 
    statusFilter !== 'All' || 
    roleGroupFilter !== 'All' || 
    activityFilter !== 'All';

  const isDirectoryEmpty = totalMembersCount === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', damping: 22, stiffness: 180 }}
      className="p-8 sm:p-12 text-center bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-xs relative overflow-hidden space-y-6 max-w-3xl mx-auto my-4"
    >
      {/* Background Decorative Mesh Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 right-10 w-64 h-64 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Hero Custom Illustration */}
      <div className="relative flex justify-center items-center py-2">
        {isDirectoryEmpty ? (
          /* Custom SVG Illustration for Empty Member Directory */
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
            {/* Outer Orbit Rings */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 35, ease: 'linear' }}
              className="absolute inset-0 rounded-full border border-dashed border-emerald-300/40 dark:border-emerald-700/40"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 45, ease: 'linear' }}
              className="absolute inset-4 rounded-full border border-dotted border-stone-300/50 dark:border-stone-700/50"
            />

            {/* Orbiting Member Avatars */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              className="absolute top-2 left-6 p-2.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-2xl shadow-md border border-emerald-300 dark:border-emerald-700"
            >
              <Users className="w-5 h-5" />
            </motion.div>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut', delay: 0.5 }}
              className="absolute bottom-4 right-6 p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-2xl shadow-md border border-amber-300 dark:border-amber-700"
            >
              <Sparkles className="w-4 h-4" />
            </motion.div>

            {/* Central Welcome Card Emblem */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-linear-to-br from-emerald-500 via-emerald-600 to-teal-700 p-0.5 shadow-xl flex items-center justify-center transform hover:scale-105 transition-transform">
              <div className="w-full h-full bg-white dark:bg-stone-900 rounded-[22px] flex flex-col items-center justify-center p-3 text-center space-y-1.5">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                  <UserPlus className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Shalom Youth
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Custom SVG Illustration for Search / Filter No Results */
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
            {/* Animated Search Radar Rings */}
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.7, 0.3] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="absolute inset-2 rounded-full bg-emerald-500/10 border border-emerald-400/30 dark:border-emerald-600/30"
            />
            <motion.div
              animate={{ scale: [1.1, 0.95, 1.1], opacity: [0.4, 0.8, 0.4] }}
              transition={{ repeat: Infinity, duration: 3.8, ease: 'easeInOut' }}
              className="absolute inset-8 rounded-full border border-dashed border-stone-300 dark:border-stone-700"
            />

            {/* Floating Query Filter Badges */}
            <motion.div
              animate={{ x: [0, 6, 0], y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
              className="absolute top-3 right-4 px-2.5 py-1 bg-stone-900 text-stone-200 text-[10px] font-mono font-bold rounded-xl shadow-lg border border-stone-700 flex items-center gap-1.5"
            >
              <Search className="w-3 h-3 text-emerald-400" />
              <span>"{searchTerm || 'filter'}"</span>
            </motion.div>

            <motion.div
              animate={{ x: [0, -6, 0], y: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              className="absolute bottom-3 left-3 px-2.5 py-1 bg-rose-950/80 text-rose-300 text-[10px] font-bold rounded-xl shadow-lg border border-rose-800/80 flex items-center gap-1.5"
            >
              <SearchX className="w-3.5 h-3.5 text-rose-400" />
              <span>0 Matches</span>
            </motion.div>

            {/* Center Magnifying Glass Stage */}
            <div className="relative z-10 p-5 bg-white dark:bg-stone-850 rounded-3xl shadow-xl border border-stone-200 dark:border-stone-750 flex flex-col items-center justify-center">
              <div className="relative">
                <Search className="w-12 h-12 text-stone-300 dark:text-stone-600" />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                  className="absolute -top-1 -right-1 p-1 bg-amber-500 text-white rounded-full shadow-md"
                >
                  <FilterX className="w-3.5 h-3.5" />
                </motion.div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Typography & Messaging */}
      <div className="space-y-2 max-w-lg mx-auto">
        <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 dark:text-white tracking-tight">
          {isDirectoryEmpty ? (
            'No Members Registered Yet'
          ) : (
            'No Members Found Matching Search'
          )}
        </h3>

        <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
          {isDirectoryEmpty ? (
            'The Shalom Youth Fellowship directory is currently empty. Get started by adding the first member or approving pending registrations.'
          ) : (
            <>
              We searched across member names, email addresses, phone numbers, and Bial areas, but couldn't find any matches for{' '}
              <span className="font-bold text-stone-800 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded-md">
                {searchTerm ? `"${searchTerm}"` : 'your active filters'}
              </span>.
            </>
          )}
        </p>
      </div>

      {/* Active Filter Badges Set */}
      {hasActiveFilters && (
        <div className="p-3 bg-stone-50 dark:bg-stone-850/60 rounded-2xl border border-stone-150 dark:border-stone-800/80 max-w-md mx-auto space-y-2">
          <div className="flex items-center justify-between text-[10px] text-stone-400 uppercase tracking-wider font-extrabold px-1">
            <span className="flex items-center gap-1">
              <Filter className="w-3 h-3 text-emerald-500" /> Active Search Criteria
            </span>
            <span>0 of {totalMembersCount} shown</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold border border-emerald-300 dark:border-emerald-800 text-[11px]">
                <Search className="w-3 h-3 text-emerald-600" /> "{searchTerm}"
              </span>
            )}
            {statusFilter !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-extrabold border border-amber-300 dark:border-amber-800 text-[11px]">
                Status: {statusFilter}
              </span>
            )}
            {roleGroupFilter !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 font-extrabold border border-sky-300 dark:border-sky-800 text-[11px]">
                Role: {roleGroupFilter}
              </span>
            )}
            {activityFilter !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-extrabold border border-purple-300 dark:border-purple-800 text-[11px]">
                Activity: {activityFilter}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Helpful Search Suggestions */}
      {!isDirectoryEmpty && (
        <div className="pt-2">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2.5 flex items-center justify-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-stone-400" /> Search Tips & Suggestions
          </p>

          <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto text-[11px]">
            <button
              type="button"
              onClick={() => onSearchChange?.('Bial')}
              className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-750 text-stone-600 dark:text-stone-300 rounded-xl font-medium transition-colors cursor-pointer border border-stone-200 dark:border-stone-700 flex items-center gap-1"
            >
              <MapPin className="w-3 h-3 text-emerald-500" /> Search by Bial Area
            </button>
            <button
              type="button"
              onClick={() => onSearchChange?.('09')}
              className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-750 text-stone-600 dark:text-stone-300 rounded-xl font-medium transition-colors cursor-pointer border border-stone-200 dark:border-stone-700 flex items-center gap-1"
            >
              <PhoneCall className="w-3 h-3 text-emerald-500" /> Search by Phone Number
            </button>
            <button
              type="button"
              onClick={() => onSearchChange?.('')}
              className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-750 text-stone-600 dark:text-stone-300 rounded-xl font-medium transition-colors cursor-pointer border border-stone-200 dark:border-stone-700 flex items-center gap-1"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Check Full Name Spelling
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset All Search Filters</span>
          </button>
        )}

        {onAddMember && (
          <button
            type="button"
            onClick={onAddMember}
            className="px-5 py-2.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 text-xs font-extrabold rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>Add New Member</span>
          </button>
        )}
      </div>
    </motion.div>
  );
};
