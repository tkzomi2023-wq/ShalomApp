import React from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  Cell, 
  PieChart, 
  Pie, 
  Legend 
} from 'recharts';
import { 
  Users, 
  UserCheck, 
  ShieldCheck, 
  Calendar, 
  Sparkles, 
  TrendingUp, 
  Plus, 
  Database, 
  ShieldAlert, 
  Info, 
  Venus, 
  Mars, 
  Heart, 
  Award,
  Activity
} from 'lucide-react';
import { Member, isOBUser, DEFAULT_ADMIN_EMAIL } from '../types';

interface MemberDemographicsSectionProps {
  members: Member[];
  currentUser: Member | null;
  isCurrentUserAdmin: boolean;
  showRoleDistribution: boolean;
  showMemberDemographics: boolean;
  roleDistributionData: { name: string; count: number; fill: string }[];
  statusDistributionData: { name: string; value: number; color: string }[];
  setAddNewMemberOpen: (open: boolean) => void;
  setIsSQLModalOpen: (open: boolean) => void;
  setIsBialDiagnosticOpen: (open: boolean) => void;
  isFootballEnabled: boolean;
  setIsFootballEnabled: (enabled: boolean) => void;
  isPrayerRequestsEnabled: boolean;
  setIsPrayerRequestsEnabled: (enabled: boolean) => void;
  isCallingEnabled?: boolean;
  setIsCallingEnabled?: (enabled: boolean) => void;
}

// Custom Tooltip for Recharts Bar Chart
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-stone-950 text-white p-3 rounded-xl shadow-xl border border-stone-800 text-xs space-y-1">
        <p className="font-extrabold text-stone-300 uppercase tracking-wider text-[10px]">{label}</p>
        <p className="text-emerald-400 font-black text-sm flex items-center gap-1">
          <span>{data.value} Members</span>
        </p>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Recharts Pie Chart
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-stone-950 text-white p-3 rounded-xl shadow-xl border border-stone-800 text-xs space-y-1">
        <p className="font-bold text-stone-200">{data.name}</p>
        <p className="font-black text-sm" style={{ color: data.payload.color || '#10b981' }}>
          {data.value} {data.value === 1 ? 'Record' : 'Records'}
        </p>
      </div>
    );
  }
  return null;
};

export const MemberDemographicsSection: React.FC<MemberDemographicsSectionProps> = ({
  members,
  currentUser,
  isCurrentUserAdmin,
  showRoleDistribution,
  showMemberDemographics,
  roleDistributionData,
  statusDistributionData,
  setAddNewMemberOpen,
  setIsSQLModalOpen,
  setIsBialDiagnosticOpen,
  isFootballEnabled,
  setIsFootballEnabled,
  isPrayerRequestsEnabled,
  setIsPrayerRequestsEnabled,
  isCallingEnabled = true,
  setIsCallingEnabled
}) => {
  // Total stats
  const totalCount = members.length;
  const approvedCount = members.filter(m => m.status === 'approved').length;
  const pendingCount = members.filter(m => m.status === 'pending').length;

  // Demographics computations
  const membersWithDob = members.filter(m => m.dob && !isNaN(new Date(m.dob).getTime()));
  const totalWithDob = membersWithDob.length;
  const dobAccuracyPercent = totalCount > 0 ? Math.round((totalWithDob / totalCount) * 100) : 0;

  const getAge = (dobStr: string): number => {
    const dobDate = new Date(dobStr);
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
      age--;
    }
    return age;
  };

  const memberAges = membersWithDob.map(m => getAge(m.dob!));
  const averageAge = totalWithDob > 0 
    ? parseFloat((memberAges.reduce((sum, age) => sum + age, 0) / totalWithDob).toFixed(1))
    : 0;

  // Gender counters
  const allMaleMembers = members.filter(m => m.gender?.toLowerCase() === 'male');
  const allFemaleMembers = members.filter(m => m.gender?.toLowerCase() === 'female');
  const totalMaleCount = allMaleMembers.length;
  const totalFemaleCount = allFemaleMembers.length;
  const marriedMaleCount = allMaleMembers.filter(m => m.marital_status?.toLowerCase() === 'married').length;
  const singleMaleCount = totalMaleCount - marriedMaleCount;

  const malePercent = totalCount > 0 ? Math.round((totalMaleCount / totalCount) * 100) : 0;
  const femalePercent = totalCount > 0 ? Math.round((totalFemaleCount / totalCount) * 100) : 0;

  const maleMembersWithDob = membersWithDob.filter(m => m.gender?.toLowerCase() === 'male');
  const femaleMembersWithDob = membersWithDob.filter(m => m.gender?.toLowerCase() === 'female');

  const maleAvgAge = maleMembersWithDob.length > 0
    ? parseFloat((maleMembersWithDob.map(m => getAge(m.dob!)).reduce((sum, age) => sum + age, 0) / maleMembersWithDob.length).toFixed(1))
    : 0;

  const femaleAvgAge = femaleMembersWithDob.length > 0
    ? parseFloat((femaleMembersWithDob.map(m => getAge(m.dob!)).reduce((sum, age) => sum + age, 0) / femaleMembersWithDob.length).toFixed(1))
    : 0;

  // Youngest and Oldest members
  let youngestMemberName = '';
  let youngestAge = 999;
  let oldestMemberName = '';
  let oldestAge = -1;

  membersWithDob.forEach(m => {
    const age = getAge(m.dob!);
    if (age < youngestAge) {
      youngestAge = age;
      youngestMemberName = m.display_name || m.name;
    }
    if (age > oldestAge) {
      oldestAge = age;
      oldestMemberName = m.display_name || m.name;
    }
  });

  // Age group ranges
  const ageGroups = {
    under18: 0,
    range18_22: 0,
    range23_27: 0,
    range28_35: 0,
    over35: 0
  };

  memberAges.forEach(age => {
    if (age < 18) ageGroups.under18++;
    else if (age <= 22) ageGroups.range18_22++;
    else if (age <= 27) ageGroups.range23_27++;
    else if (age <= 35) ageGroups.range28_35++;
    else ageGroups.over35++;
  });

  const ageGroupDistributionData = [
    { name: 'Under 18', count: ageGroups.under18, fill: '#ec4899' },
    { name: '18 - 22 yrs', count: ageGroups.range18_22, fill: '#10b981' },
    { name: '23 - 27 yrs', count: ageGroups.range23_27, fill: '#3b82f6' },
    { name: '28 - 35 yrs', count: ageGroups.range28_35, fill: '#f59e0b' },
    { name: '36+ yrs', count: ageGroups.over35, fill: '#8b5cf6' }
  ];

  if (!showRoleDistribution && !showMemberDemographics) {
    return null;
  }

  return (
    <div className="space-y-6 my-6 text-left">
      
      {/* ROLE DISTRIBUTION & DATABASE METRICS BLOCK */}
      {showRoleDistribution && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Role Breakdown Chart Card */}
          <div className={`${isCurrentUserAdmin ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white dark:bg-stone-900 p-5 sm:p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-sm flex flex-col justify-between space-y-5 transition-colors`}>
            
            <div className="flex flex-wrap items-center justify-between border-b pb-4 border-stone-150 dark:border-stone-800 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-stone-900 dark:text-stone-100 text-sm tracking-tight">
                    Youth Fellowship Hierarchy & Application Status
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Live distribution breakdown of registered members and leadership roles
                  </p>
                </div>
              </div>

              <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-3 py-1 text-xs font-bold rounded-xl border border-emerald-200/80 dark:border-emerald-800/60">
                {isCurrentUserAdmin ? 'Officer Bearer Control' : 'Youth Fellowship Core'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Role distribution bar chart */}
              <div className="space-y-3 bg-stone-50/60 dark:bg-stone-850/40 p-4 rounded-2xl border border-stone-200/60 dark:border-stone-800/60 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300 border-b pb-2 border-stone-200/60 dark:border-stone-800">
                  <span className="uppercase tracking-wider text-[11px]">Role Breakdown</span>
                  <span className="text-[10px] text-stone-400 font-normal">Total {totalCount}</span>
                </div>

                <div className="h-48 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={roleDistributionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <ChartTooltip content={<CustomBarTooltip />} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={36}>
                        {roleDistributionData.map((entry, idx) => (
                          <Cell key={`role-cell-${idx}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-around text-[11px] pt-2 border-t border-stone-200/60 dark:border-stone-800">
                  {roleDistributionData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                      <span className="text-stone-600 dark:text-stone-400 font-medium">{item.name.split(' ')[0]}:</span>
                      <strong className="text-stone-900 dark:text-stone-100 font-black">{item.count}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status pie chart */}
              <div className="space-y-3 bg-stone-50/60 dark:bg-stone-850/40 p-4 rounded-2xl border border-stone-200/60 dark:border-stone-800/60 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300 border-b pb-2 border-stone-200/60 dark:border-stone-800">
                  <span className="uppercase tracking-wider text-[11px]">Approval States</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{approvedCount} Approved</span>
                </div>

                <div className="h-48 w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {statusDistributionData.map((entry, index) => (
                          <Cell key={`status-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<CustomPieTooltip />} />
                      <Legend 
                        verticalAlign="bottom" 
                        height={30} 
                        iconSize={10} 
                        wrapperStyle={{ fontSize: '11px', fontWeight: '600' }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 pt-2 border-t border-stone-200/60 dark:border-stone-800">
                  <span>Pending verification: <strong className="text-amber-600 dark:text-amber-400">{pendingCount}</strong></span>
                  <span>Active total: <strong className="text-emerald-600 dark:text-emerald-400">{approvedCount}</strong></span>
                </div>
              </div>

            </div>
          </div>

          {/* Admin Panel Quick Tools */}
          {(isOBUser(currentUser?.role) || currentUser?.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase() || currentUser?.email?.toLowerCase() === 'tkpaite2016@gmail.com') && (
            <div className={`${showRoleDistribution ? 'lg:col-span-4' : 'lg:col-span-12'} bg-white dark:bg-stone-900 p-5 sm:p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-sm flex flex-col justify-between space-y-4`}>
              
              <div className="border-b pb-3 border-stone-150 dark:border-stone-800">
                <h4 className="font-extrabold text-stone-900 dark:text-stone-100 text-sm tracking-tight">
                  Administrative Control Panel
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Officer Bearer management tools & system options
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setAddNewMemberOpen(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs py-3 px-4 rounded-xl shadow-md shadow-emerald-600/15 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Manually Provision Member
                </button>

                {currentUser?.email?.toLowerCase() === 'tkpaite2016@gmail.com' && (
                  <button
                    onClick={() => setIsSQLModalOpen(true)}
                    className="w-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-stone-200 dark:border-stone-700"
                    title="Configure Supabase Database setup and view unified schemas"
                  >
                    <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Database SQL Script Guide
                  </button>
                )}

                {currentUser?.email?.toLowerCase() === 'tkpaite2016@gmail.com' && (
                  <button
                    onClick={() => setIsBialDiagnosticOpen(true)}
                    className="w-full bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-300 font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-amber-200/80 dark:border-amber-800/60"
                    title="Compare financial records against registered user profiles to check Bial assignments"
                  >
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Bial Assignment Diagnostic Tool
                  </button>
                )}

                {currentUser?.email?.toLowerCase() === 'tkpaite2016@gmail.com' && (
                  <div className="p-3 bg-stone-50 dark:bg-stone-850 rounded-xl border border-stone-200/60 dark:border-stone-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Football Predictions Module</span>
                      <label className="relative inline-flex items-center cursor-pointer">
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
                        <div className="w-8 h-4 bg-stone-300 dark:bg-stone-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Prayer Requests Module</span>
                      <label className="relative inline-flex items-center cursor-pointer">
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
                        <div className="w-8 h-4 bg-stone-300 dark:bg-stone-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Audio/Video Calling & History Module</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isCallingEnabled}
                          onChange={(e) => {
                            const newValue = e.target.checked;
                            if (setIsCallingEnabled) {
                              setIsCallingEnabled(newValue);
                            }
                            localStorage.setItem('sy_enable_calling_services', newValue ? 'true' : 'false');
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-stone-300 dark:bg-stone-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                  </div>
                )}
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
          )}

        </div>
      )}

      {/* MEMBER DEMOGRAPHICS MAIN SECTION */}
      {showMemberDemographics && (
        <div className="space-y-6">
          
          {/* Header Bar */}
          <div className="bg-white dark:bg-stone-900 p-5 sm:p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-sm transition-colors space-y-6">
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-5 border-stone-150 dark:border-stone-800">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black uppercase tracking-wider">
                      Analytics Hub
                    </span>
                    <span className="text-xs text-stone-400 font-medium">
                      {dobAccuracyPercent}% DOB Profile Precision
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-stone-900 dark:text-stone-100 tracking-tight leading-tight mt-0.5">
                    Youth Member Demographics & Age Analytics
                  </h3>
                </div>
              </div>

              {/* Quick Summary Pill Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/60 text-blue-900 dark:text-blue-300 font-extrabold text-xs flex items-center gap-2">
                  <Mars className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Male: <strong>{totalMaleCount}</strong> ({singleMaleCount} Tg. | {marriedMaleCount} Pa)</span>
                </div>

                <div className="px-3.5 py-1.5 rounded-xl bg-pink-50 dark:bg-pink-950/50 border border-pink-200/80 dark:border-pink-800/60 text-pink-900 dark:text-pink-300 font-extrabold text-xs flex items-center gap-2">
                  <Venus className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                  <span>Female: <strong>{totalFemaleCount}</strong> (Lia)</span>
                </div>

                <div className="px-3.5 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-stone-500" />
                  <span>Avg Youth Age: <strong>{averageAge > 0 ? `${averageAge} yrs` : 'N/A'}</strong></span>
                </div>
              </div>
            </div>

            {/* Top 4 Key Metric Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Total Registered & DOB Accuracy */}
              <div className="p-4 rounded-2xl bg-stone-50/80 dark:bg-stone-850/60 border border-stone-200/70 dark:border-stone-800/70 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-500 dark:text-stone-400">
                  <span className="uppercase tracking-wider text-[11px]">Total Members</span>
                  <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-stone-900 dark:text-stone-100">{totalCount}</span>
                  <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    {totalWithDob} DOB records
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  {dobAccuracyPercent}% profile birthdate completion accuracy
                </p>
              </div>

              {/* Card 2: Gender Balance Ratio */}
              <div className="p-4 rounded-2xl bg-stone-50/80 dark:bg-stone-850/60 border border-stone-200/70 dark:border-stone-800/70 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-500 dark:text-stone-400">
                  <span className="uppercase tracking-wider text-[11px]">Gender Ratio</span>
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">{malePercent}% M</span>
                    <span>/</span>
                    <span className="text-pink-600 dark:text-pink-400 font-bold">{femalePercent}% F</span>
                  </div>
                </div>

                {/* Progress bar ratio visualization */}
                <div className="h-3 w-full bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-blue-500 transition-all duration-500 h-full" 
                    style={{ width: `${malePercent}%` }} 
                    title={`Male: ${totalMaleCount} (${malePercent}%)`}
                  />
                  <div 
                    className="bg-pink-500 transition-all duration-500 h-full" 
                    style={{ width: `${femalePercent}%` }} 
                    title={`Female: ${totalFemaleCount} (${femalePercent}%)`}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-blue-700 dark:text-blue-300">Male: {totalMaleCount}</span>
                  <span className="text-pink-700 dark:text-pink-300">Female: {totalFemaleCount}</span>
                </div>
              </div>

              {/* Card 3: Gender Specific Averages */}
              <div className="p-4 rounded-2xl bg-stone-50/80 dark:bg-stone-850/60 border border-stone-200/70 dark:border-stone-800/70 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-500 dark:text-stone-400">
                  <span className="uppercase tracking-wider text-[11px]">Gender Average Age</span>
                  <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div className="bg-blue-50/80 dark:bg-blue-950/40 p-2 rounded-xl border border-blue-200/60 dark:border-blue-800/50 text-center">
                    <span className="text-[10px] text-blue-700 dark:text-blue-300 font-extrabold uppercase">Male Avg</span>
                    <p className="text-base font-black text-blue-900 dark:text-blue-200">{maleAvgAge > 0 ? `${maleAvgAge}y` : 'N/A'}</p>
                  </div>
                  <div className="bg-pink-50/80 dark:bg-pink-950/40 p-2 rounded-xl border border-pink-200/60 dark:border-pink-800/50 text-center">
                    <span className="text-[10px] text-pink-700 dark:text-pink-300 font-extrabold uppercase">Female Avg</span>
                    <p className="text-base font-black text-pink-900 dark:text-pink-200">{femaleAvgAge > 0 ? `${femaleAvgAge}y` : 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Card 4: Age Extrema (Youngest & Oldest) */}
              <div className="p-4 rounded-2xl bg-stone-50/80 dark:bg-stone-850/60 border border-stone-200/70 dark:border-stone-800/70 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-500 dark:text-stone-400">
                  <span className="uppercase tracking-wider text-[11px]">Age Span</span>
                  <Award className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500 dark:text-stone-400">Youngest:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 truncate max-w-[120px]" title={youngestMemberName}>
                      {youngestMemberName ? `${youngestMemberName} (${youngestAge}y)` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500 dark:text-stone-400">Oldest:</span>
                    <span className="font-bold text-purple-700 dark:text-purple-400 truncate max-w-[120px]" title={oldestMemberName}>
                      {oldestMemberName ? `${oldestMemberName} (${oldestAge}y)` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Charts Section: Age Distribution & Detailed Composition */}
            {totalWithDob > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                
                {/* Age Group Distribution Chart (8 cols) */}
                <div className="lg:col-span-7 bg-stone-50/60 dark:bg-stone-850/40 p-5 rounded-2xl border border-stone-200/70 dark:border-stone-800/70 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between border-b pb-3 border-stone-200/60 dark:border-stone-800">
                    <div>
                      <h4 className="font-extrabold text-stone-900 dark:text-stone-100 text-xs uppercase tracking-wider">
                        Age Group Demographics Distribution
                      </h4>
                      <p className="text-[10px] text-stone-400">Categorized youth fellowship age brackets</p>
                    </div>
                    <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      {totalWithDob} Active Records
                    </span>
                  </div>

                  <div className="h-56 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ageGroupDistributionData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <ChartTooltip content={<CustomBarTooltip />} />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
                          {ageGroupDistributionData.map((entry, idx) => (
                            <Cell key={`age-cell-${idx}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Age Bracket Summary Pill Grid */}
                  <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-stone-200/60 dark:border-stone-800 text-center">
                    {ageGroupDistributionData.map((group, idx) => (
                      <div key={idx} className="p-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/60 dark:border-stone-800">
                        <span className="text-[9px] font-extrabold text-stone-400 uppercase block truncate">{group.name}</span>
                        <strong className="text-xs font-black block mt-0.5" style={{ color: group.fill }}>{group.count}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gender & Marital Breakdown Breakdown Panel (5 cols) */}
                <div className="lg:col-span-5 bg-stone-50/60 dark:bg-stone-850/40 p-5 rounded-2xl border border-stone-200/70 dark:border-stone-800/70 flex flex-col justify-between space-y-4">
                  <div className="flex items-center justify-between border-b pb-3 border-stone-200/60 dark:border-stone-800">
                    <h4 className="font-extrabold text-stone-900 dark:text-stone-100 text-xs uppercase tracking-wider">
                      Gender & Marital Composition
                    </h4>
                    <span className="text-[10px] text-stone-400 font-bold">Total {totalCount}</span>
                  </div>

                  <div className="space-y-3 flex-1 flex flex-col justify-center">
                    
                    {/* Male Members Detail Card */}
                    <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                          <Mars className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>Male Youth Members:</span>
                        </span>
                        <span className="font-black text-blue-900 dark:text-blue-200 text-sm">{totalMaleCount}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-[11px] text-blue-800 dark:text-blue-300 pt-1 border-t border-blue-200/50 dark:border-blue-800/40">
                        <span>Single (Tangval): <strong>{singleMaleCount}</strong></span>
                        <span>Married (Pa): <strong>{marriedMaleCount}</strong></span>
                        <span>Avg: <strong>{maleAvgAge > 0 ? `${maleAvgAge}y` : 'N/A'}</strong></span>
                      </div>
                    </div>

                    {/* Female Members Detail Card */}
                    <div className="p-3.5 rounded-2xl bg-pink-50/70 dark:bg-pink-950/40 border border-pink-200/70 dark:border-pink-800/60 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-pink-900 dark:text-pink-200 flex items-center gap-1.5">
                          <Venus className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                          <span>Female Youth Members (Lia):</span>
                        </span>
                        <span className="font-black text-pink-900 dark:text-pink-200 text-sm">{totalFemaleCount}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-pink-800 dark:text-pink-300 pt-1 border-t border-pink-200/50 dark:border-pink-800/40">
                        <span>Total Female Members: <strong>{totalFemaleCount}</strong></span>
                        <span>Avg Age: <strong>{femaleAvgAge > 0 ? `${femaleAvgAge}y` : 'N/A'}</strong></span>
                      </div>
                    </div>

                    {/* Insights Note */}
                    <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed">
                        Demographic distributions assist committee leaders in organizing age-targeted spiritual retreats, fellowship activities, and ministry task assignments.
                      </p>
                    </div>

                  </div>

                </div>

              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-stone-400 text-xs text-center border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-2xl bg-stone-50/50 dark:bg-stone-850/50 p-6">
                <Calendar className="w-8 h-8 text-stone-300 dark:text-stone-700 mb-2 animate-pulse" />
                <p className="font-bold text-stone-700 dark:text-stone-300 text-sm">No member Date of Birth records found.</p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm">
                  Encourage members to update their profile birth dates to generate live demographic charts and age group analytics!
                </p>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
};
