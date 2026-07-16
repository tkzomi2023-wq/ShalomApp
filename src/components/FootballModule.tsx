/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy,
  Calendar,
  Clock,
  MapPin,
  RefreshCw,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sliders,
  Database,
  Copy,
  Check,
  TrendingUp,
  BarChart3,
  ChevronRight,
  Tv,
  List,
  Flame,
  ShieldCheck,
  Zap,
  Info
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

import { FootballMatch, FootballPrediction, LeaderboardEntry, StandingsGroup, FootballStats, MatchStatus, FootballTeam } from "../types/football";
import { footballApi, ApiStatus, FOOTBALL_SETUP_SQL, getPointsForRound } from "../lib/football";
import { Member } from "../types";
import { Confetti } from "./Confetti";
import { BentoStatsSkeleton, UpcomingMatchSkeleton, FixtureCardSkeleton, LiveMatchSkeleton } from "./FootballSkeletons";

const COMPETITIONS = [
  { id: 1, name: "FIFA World Cup" },
  { id: 39, name: "Premier League (ENG)" },
  { id: 2, name: "UEFA Champions League" },
  { id: 140, name: "La Liga (ESP)" },
  { id: 78, name: "Bundesliga (GER)" },
  { id: 135, name: "Serie A (ITA)" },
  { id: 61, name: "Ligue 1 (FRA)" },
];

const SEASONS = ["2026", "2025", "2024", "2023", "2022"];

const INTERVALS = [
  { label: "10 minutes (Default)", value: 10 },
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "4 hours", value: 240 },
  { label: "12 hours", value: 720 },
  { label: "24 hours", value: 1440 },
];

const getTeamName = (team: FootballTeam | undefined | null): string => {
  if (!team || !team.name || team.name.trim() === "" || team.name.toUpperCase() === "TBD") {
    return "To Be Determined";
  }
  return team.name;
};

interface FootballModuleProps {
  currentUser: Member | null;
}

type SubPage = "index" | "fixtures" | "predictions" | "leaderboard" | "standings" | "my-predictions" | "statistics" | "admin";

export const FootballModule: React.FC<FootballModuleProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<SubPage>("index");
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [predictions, setPredictions] = useState<FootballPrediction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [standings, setStandings] = useState<StandingsGroup[]>([]);
  const [stats, setStats] = useState<FootballStats | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [predictingMatch, setPredictingMatch] = useState<FootballMatch | null>(null);
  const [selectedPrediction, setSelectedPrediction] = useState<number | null>(null);
  const [predictedHomeScore, setPredictedHomeScore] = useState<number | "">("");
  const [predictedAwayScore, setPredictedAwayScore] = useState<number | "">("");
  const [submittingPrediction, setSubmittingPrediction] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Confetti and settings states
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [settings, setSettings] = useState<{
    competitionId: number;
    competitionName: string;
    season: string;
    syncInterval: number;
    lastSyncTime?: string;
  }>({
    competitionId: 1,
    competitionName: "FIFA World Cup",
    season: "2026",
    syncInterval: 10,
  });
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  // Filter states for fixtures page
  const [roundFilter, setRoundFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("All Teams");
  const [upcomingOnly, setUpcomingOnly] = useState<boolean>(true);

  const isAdmin = currentUser?.email.toLowerCase() === "tkpaite2016@gmail.com";

  // Load all initial football modules data
  const loadData = async () => {
    try {
      setLoading(true);
      setActionError(null);

      // Fetch status, matches, leaderboard, standings, and settings
      const [statusRes, matchesRes, leaderboardRes, standingsRes, settingsRes] = await Promise.all([
        footballApi.getApiStatus().catch(() => null),
        footballApi.getMatches().catch(() => []),
        footballApi.getLeaderboard().catch(() => []),
        footballApi.getStandings().catch(() => []),
        footballApi.getSettings().catch(() => null)
      ]);

      setApiStatus(statusRes);
      setMatches(matchesRes);
      setLeaderboard(leaderboardRes);
      setStandings(standingsRes);
      if (settingsRes) {
        setSettings(settingsRes);
      }

      // If user is authenticated, fetch their predictions
      if (currentUser) {
        const userPreds = await footballApi.getUserPredictions(currentUser.id).catch(() => []);
        setPredictions(userPreds);

        // Compute statistics dynamically
        const calculatedStats = await footballApi.getStats(matchesRes, userPreds);
        setStats(calculatedStats);
      }
    } catch (err: any) {
      setActionError("Failed to synchronize module data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === "my-predictions" && predictions.length > 0) {
      // Check if they have earned points for a correct match prediction
      const hasCorrect = predictions.some(pred => {
        const match = matches.find(m => m.id === pred.match_id);
        return match && match.status === "FT" && match.winner_team_id === pred.predicted_team_id;
      });
      if (hasCorrect) {
        setShowConfetti(true);
      }
    } else {
      setShowConfetti(false);
    }
  }, [activeTab, predictions, matches]);

  // Handle predicting a match
  const handleOpenPredictModal = (match: FootballMatch) => {
    setActionError(null);
    setActionSuccess(null);
    setPredictingMatch(match);
    
    // Find pre-existing prediction
    const existing = predictions.find(p => p.match_id === match.id);
    setSelectedPrediction(existing ? existing.predicted_team_id : null);
    setPredictedHomeScore(existing && existing.predicted_home_score !== undefined && existing.predicted_home_score !== null ? existing.predicted_home_score : "");
    setPredictedAwayScore(existing && existing.predicted_away_score !== undefined && existing.predicted_away_score !== null ? existing.predicted_away_score : "");
  };

  const handleSavePrediction = async () => {
    if (!currentUser || !predictingMatch || selectedPrediction === null) return;
    
    try {
      setSubmittingPrediction(true);
      setActionError(null);
      setActionSuccess(null);

      const hScore = predictedHomeScore !== "" ? Number(predictedHomeScore) : null;
      const aScore = predictedAwayScore !== "" ? Number(predictedAwayScore) : null;

      await footballApi.submitPrediction(
        currentUser.id,
        currentUser.name,
        currentUser.email,
        predictingMatch.id,
        selectedPrediction,
        hScore,
        aScore
      );

      setActionSuccess(`Successfully saved your prediction for ${getTeamName(predictingMatch.homeTeam)} vs ${getTeamName(predictingMatch.awayTeam)}!`);
      
      // Reload matches and predictions
      const [updatedMatches, updatedPreds] = await Promise.all([
        footballApi.getMatches(),
        footballApi.getUserPredictions(currentUser.id)
      ]);

      setMatches(updatedMatches);
      setPredictions(updatedPreds);
      
      const updatedStats = await footballApi.getStats(updatedMatches, updatedPreds);
      setStats(updatedStats);

      setPredictingMatch(null);
    } catch (err: any) {
      setActionError(err.message || "Failed to submit prediction");
    } finally {
      setSubmittingPrediction(false);
    }
  };

  // Force Sync (Admin action)
  const handleForceSync = async () => {
    if (!currentUser || !isAdmin) return;
    try {
      setSyncing(true);
      setActionError(null);
      setActionSuccess(null);
      
      const res = await footballApi.syncFootball(currentUser.email);
      setActionSuccess(res.message);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // Reset Data (Admin action)
  const handleResetData = async () => {
    if (!currentUser || !isAdmin) return;
    if (!window.confirm("Are you absolutely sure you want to delete all predictions and reset match fixtures to initial states? This cannot be undone.")) return;
    
    try {
      setSyncing(true);
      setActionError(null);
      setActionSuccess(null);
      
      const res = await footballApi.resetFootball(currentUser.email);
      setActionSuccess(res.message);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Reset failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isAdmin) return;
    
    try {
      setSavingSettings(true);
      setActionError(null);
      setActionSuccess(null);
      
      const res = await footballApi.saveSettings(
        currentUser.email,
        settings.competitionId,
        settings.competitionName,
        settings.season,
        settings.syncInterval
      );
      
      setActionSuccess(res.message || "Configurations saved successfully!");
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(FOOTBALL_SETUP_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // IST Timezone helpers
  const formatToISTDate = (dateStr: string): string => {
    try {
      return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(new Date(dateStr));
    } catch (e) {
      return new Date(dateStr).toLocaleDateString();
    }
  };

  const formatToISTTime = (dateStr: string): string => {
    try {
      return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      }).format(new Date(dateStr)) + " IST";
    } catch (e) {
      return new Date(dateStr).toLocaleTimeString() + " IST";
    }
  };

  // Dynamic Countdown Timer Hook
  const MatchCountdown: React.FC<{ dateStr: string }> = ({ dateStr }) => {
    const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

    useEffect(() => {
      const calculateTimeLeft = () => {
        const difference = +new Date(dateStr) - +new Date();
        if (difference <= 0) {
          setTimeLeft(null);
          return;
        }

        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      };

      calculateTimeLeft();
      const timer = setInterval(calculateTimeLeft, 1000);
      return () => clearInterval(timer);
    }, [dateStr]);

    if (!timeLeft) {
      return (
        <div className="flex flex-col items-end">
          <span className="text-stone-500 font-bold text-xs">Match Started / Closed</span>
          <span className="text-[10px] text-stone-400 font-bold mt-0.5">
            ({formatToISTDate(dateStr)} {formatToISTTime(dateStr)})
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-end">
        <div className="flex items-center gap-1.5 font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          <span>{timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s</span>
        </div>
        <span className="text-[10px] text-stone-400 font-semibold mt-0.5">
          ({formatToISTDate(dateStr)} {formatToISTTime(dateStr)})
        </span>
      </div>
    );
  };

  // Extracted lists of rounds for filter dropdowns
  const availableRounds = ["All", ...Array.from(new Set(matches.map(m => m.round)))];
  const activeRoundMatches = matches.filter(m => {
    const roundMatch = roundFilter === "All" || m.round === roundFilter;
    const teamMatch = searchQuery === "All Teams" || 
      getTeamName(m.homeTeam).toLowerCase().includes(searchQuery.toLowerCase()) || 
      getTeamName(m.awayTeam).toLowerCase().includes(searchQuery.toLowerCase());
    const statusMatch = !upcomingOnly || m.status === "NS" || m.status === "LIVE";
    return roundMatch && teamMatch && statusMatch;
  });

  // Derived dashboard details
  const liveMatches = matches.filter(m => m.status === "LIVE");
  const upcomingMatches = matches.filter(m => m.status === "NS").slice(0, 3);
  const finishedMatches = matches.filter(m => m.status === "FT").reverse().slice(0, 3);

  // Navigation Items
  const navItems = [
    { id: "index", label: "Dashboard", icon: Trophy },
    { id: "fixtures", label: "Fixtures", icon: Calendar },
    { id: "my-predictions", label: "My Predictions", icon: CheckCircle2 },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy },
    { id: "standings", label: "Standings", icon: List },
    { id: "statistics", label: "Statistics", icon: BarChart3 }
  ];

  if (isAdmin) {
    navItems.push({ id: "admin", label: "Admin Console", icon: Sliders });
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6" id="football-module-container">
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      {/* Upper Module header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Mundial 2026
            </span>
            {apiStatus && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                apiStatus.operatingMode.includes("Realtime") 
                  ? "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-400"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
              }`}>
                {apiStatus.operatingMode}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-black text-stone-900 dark:text-white tracking-tight mt-1.5 flex items-center gap-2">
            Football Prediction <span className="text-emerald-600">Engine</span>
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 max-w-2xl">
            Synchronize live FIFA World Cup 2026 match results, predict bracket outcomes, earn points, and climb the leaderboard standings.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 bg-stone-100 dark:bg-stone-850 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-stone-200 dark:border-stone-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Stats
        </button>
      </div>

      {/* Success/Error Alerts */}
      <AnimatePresence>
        {actionError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-2xl text-xs font-bold flex items-center gap-2.5 border border-rose-200 dark:border-rose-900"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{actionError}</span>
          </motion.div>
        )}
        {actionSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2.5 border border-emerald-200 dark:border-emerald-900"
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Tabs Menu */}
      <div className="flex border-b border-stone-200 dark:border-stone-800 overflow-x-auto scrollbar-none mb-8">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as SubPage);
                setActionError(null);
                setActionSuccess(null);
              }}
              className={`px-5 py-3 text-sm font-extrabold border-b-2 flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-white"
              }`}
            >
              <IconComponent className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {loading && matches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mb-4" />
          <p className="text-stone-500 text-xs font-bold">Synchronizing matches database, please hold...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {/* 1. DASHBOARD VIEW */}
          {activeTab === "index" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              {/* Live Match Tracker */}
              {loading ? (
                <LiveMatchSkeleton />
              ) : liveMatches.length > 0 ? (
                <div className="bg-stone-900 dark:bg-black rounded-3xl p-6 text-white border border-rose-600 relative overflow-hidden shadow-2xl">
                  <div className="absolute top-4 right-4 flex items-center gap-2 bg-rose-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                    <Tv className="w-3.5 h-3.5" />
                    Live Match
                  </div>
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
                    In Progress
                  </span>
                  
                  {liveMatches.map(match => (
                    <div key={match.id} className="mt-6 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center justify-center gap-6 w-full md:w-auto">
                        <div className="text-center w-24">
                          <img src={match.homeTeam?.logo || ""} alt="" className="w-12 h-12 mx-auto object-contain" />
                          <h3 className="text-sm font-black mt-2 truncate">{getTeamName(match.homeTeam)}</h3>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <span className="text-4xl font-black">{match.home_score}</span>
                          <span className="text-stone-500 font-black text-lg">:</span>
                          <span className="text-4xl font-black">{match.away_score}</span>
                        </div>

                        <div className="text-center w-24">
                          <img src={match.awayTeam?.logo || ""} alt="" className="w-12 h-12 mx-auto object-contain" />
                          <h3 className="text-sm font-black mt-2 truncate">{getTeamName(match.awayTeam)}</h3>
                        </div>
                      </div>

                      <div className="text-center md:text-right">
                        <p className="text-xs text-stone-400 font-bold">{match.round}</p>
                        <p className="text-[10px] text-stone-500 mt-1 flex items-center justify-center md:justify-end gap-1">
                          <MapPin className="w-3 h-3" /> {match.stadium}, {match.venue}
                        </p>
                        {currentUser && !predictions.some(p => p.match_id === match.id) && (
                          <span className="inline-block mt-3 px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black rounded-lg">
                            Closed: Already Started
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Bento Quick statistics Row */}
              {loading ? (
                <BentoStatsSkeleton />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-stone-850 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-stone-500 uppercase">My Total Points</p>
                      <h3 className="text-xl font-black text-stone-900 dark:text-white mt-1">
                        {stats ? stats.correctPredictions * getPointsForRound("Group Stage") : 0} pts
                      </h3>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-stone-850 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-stone-500 uppercase">Prediction Accuracy</p>
                      <h3 className="text-xl font-black text-stone-900 dark:text-white mt-1">
                        {stats ? stats.averageAccuracy : 0}%
                      </h3>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-stone-850 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 flex items-center gap-4">
                    <div className="p-3 bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 rounded-xl">
                      <Flame className="w-6 h-6 animate-bounce" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-stone-500 uppercase">My Total Predicts</p>
                      <h3 className="text-xl font-black text-stone-900 dark:text-white mt-1">
                        {stats ? stats.totalPredictions : 0} matches
                      </h3>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-stone-850 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 flex items-center gap-4">
                    <div className="p-3 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-stone-500 uppercase">Tournament Matches</p>
                      <h3 className="text-xl font-black text-stone-900 dark:text-white mt-1">
                        {matches.length} active
                      </h3>
                    </div>
                  </div>
                </div>
              )}

              {/* Main Dashboard Layout Splits */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upcoming and Live Predictions Block */}
                <div className="lg:col-span-2 space-y-6">
                  <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-600" />
                    Open for Prediction ({matches.filter(m => m.status === "NS").length})
                  </h3>

                  {loading ? (
                    <UpcomingMatchSkeleton />
                  ) : upcomingMatches.length === 0 ? (
                    <div className="p-8 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-2xl text-center">
                      <p className="text-stone-500 text-xs">All upcoming match predictions are currently closed.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {upcomingMatches.map(match => {
                        const hasPredicted = predictions.some(p => p.match_id === match.id);
                        const predObj = predictions.find(p => p.match_id === match.id);
                        const teamPredicted = predObj?.predicted_team_id === match.home_team_id 
                          ? getTeamName(match.homeTeam) 
                          : predObj?.predicted_team_id === match.away_team_id 
                            ? getTeamName(match.awayTeam) 
                            : predObj?.predicted_team_id === -1 
                              ? "Draw" 
                              : "None";

                        return (
                          <div key={match.id} className="bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 hover:shadow-lg transition flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-center mb-3">
                                <span className="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded text-[10px] font-bold">
                                  {match.round}
                                </span>
                                <MatchCountdown dateStr={match.kickoff} />
                              </div>

                              <div className="flex items-center justify-around py-2">
                                <div className="text-center w-20">
                                  <img src={match.homeTeam?.logo || ""} alt="" className="w-10 h-10 mx-auto object-contain" />
                                  <p className="text-xs font-bold mt-1 text-stone-800 dark:text-stone-200 truncate">{getTeamName(match.homeTeam)}</p>
                                </div>
                                <span className="text-xs font-black text-stone-400">VS</span>
                                <div className="text-center w-20">
                                  <img src={match.awayTeam?.logo || ""} alt="" className="w-10 h-10 mx-auto object-contain" />
                                  <p className="text-xs font-bold mt-1 text-stone-800 dark:text-stone-200 truncate">{getTeamName(match.awayTeam)}</p>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-between items-center">
                              {hasPredicted ? (
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-stone-500">Your Prediction</span>
                                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> {teamPredicted}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-amber-600 font-bold">No Prediction Submitted</span>
                              )}

                              <button
                                onClick={() => handleOpenPredictModal(match)}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition"
                              >
                                {hasPredicted ? "Edit Predict" : "Predict"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Recent Completed Games */}
                  <div className="pt-4">
                    <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2 mb-4">
                      Recent results
                    </h3>
                    <div className="space-y-3">
                      {finishedMatches.length === 0 ? (
                        <p className="text-stone-500 text-xs">No completed matches found.</p>
                      ) : (
                        finishedMatches.map(match => {
                          const pred = predictions.find(p => p.match_id === match.id);
                          const isCorrect = pred && pred.points !== null && pred.points > 0;
                          return (
                            <div key={match.id} className="bg-stone-50 dark:bg-stone-900 p-4 rounded-xl border border-stone-200 dark:border-stone-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
                              <div>
                                <span className="px-1.5 py-0.5 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded text-[9px] font-bold mr-2">
                                  {match.round}
                                </span>
                                <span className="text-stone-500">{formatToISTDate(match.kickoff)} {formatToISTTime(match.kickoff)}</span>
                              </div>

                              <div className="flex items-center gap-6 font-bold">
                                <span className="text-right w-20 truncate">{getTeamName(match.homeTeam)}</span>
                                <div className="px-3 py-1 bg-stone-200 dark:bg-stone-800 rounded-lg font-black font-mono">
                                  {match.home_score} - {match.away_score}
                                </div>
                                <span className="text-left w-20 truncate">{getTeamName(match.awayTeam)}</span>
                              </div>

                              <div>
                                {pred ? (
                                  <span className={`px-2 py-1 rounded-full font-black text-[9px] uppercase ${
                                    isCorrect 
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400" 
                                      : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-400"
                                  }`}>
                                    {isCorrect ? `+${pred.points} pts` : "0 pts"}
                                  </span>
                                ) : (
                                  <span className="text-stone-500 text-[10px]">No Prediction</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Leaderboard Preview Card */}
                <div className="bg-white dark:bg-stone-850 rounded-2xl border border-stone-200 dark:border-stone-800 p-5 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-stone-100 dark:border-stone-800">
                    <h3 className="text-sm font-black text-stone-900 dark:text-white flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-500" /> Leaderboard standings
                    </h3>
                    <button
                      onClick={() => setActiveTab("leaderboard")}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-0.5 hover:underline"
                    >
                      View All <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {leaderboard.slice(0, 5).map((user, idx) => {
                      const isSelf = user.user_id === currentUser?.id;
                      return (
                        <div
                          key={user.user_id}
                          className={`flex justify-between items-center p-2.5 rounded-xl transition ${
                            isSelf 
                              ? "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50" 
                              : "hover:bg-stone-50 dark:hover:bg-stone-800/50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono font-black text-xs text-stone-400 w-4">
                              {idx + 1}
                            </span>
                            <div className="w-7 h-7 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center font-black text-xs uppercase border border-stone-200 dark:border-stone-700">
                              {user.user_name.substring(0, 2)}
                            </div>
                            <div>
                              <p className="text-xs font-black text-stone-850 dark:text-white truncate max-w-28">
                                {user.user_name}
                              </p>
                              {user.streak > 1 && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] text-rose-500 font-black">
                                  <Flame className="w-3 h-3 fill-rose-500" /> {user.streak} streak
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-black text-stone-900 dark:text-white">
                              {user.points} pts
                            </span>
                            <p className="text-[9px] text-stone-400">{user.accuracy}% acc</p>
                          </div>
                        </div>
                      );
                    })}

                    {leaderboard.length === 0 && (
                      <p className="text-stone-500 text-xs py-4 text-center">No scores posted yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 2. FIXTURES VIEW */}
          {activeTab === "fixtures" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Filter controls */}
              <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-stone-50 dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500 font-bold">Round:</span>
                    <select
                      value={roundFilter}
                      onChange={(e) => setRoundFilter(e.target.value)}
                      className="px-3 py-1.5 bg-white dark:bg-stone-800 text-xs font-bold rounded-lg border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 cursor-pointer"
                    >
                      {availableRounds.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 border-l border-stone-200 dark:border-stone-800 pl-4">
                    <input
                      type="checkbox"
                      id="upcoming-only-checkbox"
                      checked={upcomingOnly}
                      onChange={(e) => setUpcomingOnly(e.target.checked)}
                      className="rounded border-stone-300 dark:border-stone-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="upcoming-only-checkbox" className="text-xs text-stone-700 dark:text-stone-300 font-bold cursor-pointer select-none">
                      Upcoming & Live Only
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 items-center w-full md:w-auto">
                  <span className="text-xs text-stone-500 font-bold">Search Team:</span>
                  <input
                    type="text"
                    placeholder="Search country..."
                    value={searchQuery === "All Teams" ? "" : searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value || "All Teams")}
                    className="px-3.5 py-1.5 bg-white dark:bg-stone-800 text-xs font-bold rounded-lg border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 outline-none w-full md:w-48"
                  />
                </div>
              </div>

              {/* Match Grid list */}
              {loading ? (
                <FixtureCardSkeleton />
              ) : activeRoundMatches.length === 0 ? (
                <div className="p-16 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-3xl text-center">
                  <AlertCircle className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-stone-500 text-xs font-bold">No fixtures found matching your filter criteria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeRoundMatches.map(match => {
                    const hasPredicted = predictions.some(p => p.match_id === match.id);
                    const predObj = predictions.find(p => p.match_id === match.id);
                    const teamPredicted = predObj?.predicted_team_id === match.home_team_id 
                      ? getTeamName(match.homeTeam) 
                      : predObj?.predicted_team_id === match.away_team_id 
                        ? getTeamName(match.awayTeam) 
                        : predObj?.predicted_team_id === -1 
                          ? "Draw" 
                          : "None";

                    return (
                      <div
                        key={match.id}
                        className={`bg-white dark:bg-stone-850 border rounded-2xl p-5 hover:shadow-lg transition flex flex-col justify-between ${
                          match.status === "LIVE" 
                            ? "border-rose-500 bg-rose-500/5" 
                            : "border-stone-200 dark:border-stone-800"
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-center mb-4">
                            <span className="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded text-[10px] font-bold">
                              {match.round}
                            </span>
                            {match.status === "LIVE" ? (
                              <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[9px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span> Live
                              </span>
                            ) : match.status === "FT" ? (
                              <span className="px-2 py-0.5 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded text-[9px] font-bold uppercase">
                                Finished
                              </span>
                            ) : (
                              <MatchCountdown dateStr={match.kickoff} />
                            )}
                          </div>

                          <div className="flex items-center justify-around py-3">
                            <div className="text-center w-20">
                              <img src={match.homeTeam?.logo || ""} alt="" className="w-12 h-12 mx-auto object-contain" />
                              <p className="text-xs font-black mt-2 text-stone-900 dark:text-white truncate">{getTeamName(match.homeTeam)}</p>
                            </div>
                            
                            <div className="text-center">
                              {match.status === "FT" || match.status === "LIVE" ? (
                                <div className="px-3 py-1 bg-stone-100 dark:bg-stone-800 rounded-lg text-sm font-black font-mono">
                                  {match.home_score} - {match.away_score}
                                </div>
                              ) : (
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] text-stone-400 font-bold">
                                    {formatToISTDate(match.kickoff)}
                                  </span>
                                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-black font-mono">
                                    {formatToISTTime(match.kickoff)}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="text-center w-20">
                              <img src={match.awayTeam?.logo || ""} alt="" className="w-12 h-12 mx-auto object-contain" />
                              <p className="text-xs font-black mt-2 text-stone-900 dark:text-white truncate">{getTeamName(match.awayTeam)}</p>
                            </div>
                          </div>

                          <p className="text-[10px] text-stone-400 text-center flex items-center justify-center gap-1 mt-2">
                            <MapPin className="w-3 h-3" /> {match.stadium}
                          </p>
                        </div>

                        <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-between items-center">
                          {hasPredicted ? (
                            <div className="flex flex-col">
                              <span className="text-[9px] text-stone-500">Your Prediction</span>
                              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> {teamPredicted}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[9px] text-stone-400">No Prediction Submitted</span>
                          )}

                          {match.status === "NS" ? (
                            <button
                              onClick={() => handleOpenPredictModal(match)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer"
                            >
                              {hasPredicted ? "Edit" : "Predict"}
                            </button>
                          ) : (
                            <span className="text-[9px] text-stone-400 font-bold bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded">
                              Predictions Closed
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* 3. LEADERBOARD VIEW */}
          {activeTab === "leaderboard" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-white dark:bg-stone-850 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-4 mb-6">
                  <h3 className="text-lg font-black text-stone-900 dark:text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" /> Predictions standings
                  </h3>
                  <span className="text-xs text-stone-500 font-bold">Sorted by Points & Accuracy</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-stone-800 dark:text-stone-200 text-xs">
                    <thead>
                      <tr className="border-b border-stone-100 dark:border-stone-800 text-[10px] text-stone-400 font-black uppercase">
                        <th className="py-3 px-4 w-12">Rank</th>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4 text-center">Predictions</th>
                        <th className="py-3 px-4 text-center">Correct</th>
                        <th className="py-3 px-4 text-center">Streak</th>
                        <th className="py-3 px-4 text-center">Accuracy</th>
                        <th className="py-3 px-4 text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((user, index) => {
                        const isSelf = user.user_id === currentUser?.id;
                        let rankBadge = "";
                        if (index === 0) rankBadge = "🥇";
                        else if (index === 1) rankBadge = "🥈";
                        else if (index === 2) rankBadge = "🥉";

                        return (
                          <tr
                            key={user.user_id}
                            className={`border-b border-stone-50 dark:border-stone-900 transition ${
                              isSelf 
                                ? "bg-emerald-50 dark:bg-emerald-950/20 font-bold text-stone-900 dark:text-white" 
                                : "hover:bg-stone-50 dark:hover:bg-stone-800/20"
                            }`}
                          >
                            <td className="py-4 px-4 font-mono font-black text-sm text-stone-500">
                              {rankBadge ? <span className="text-lg">{rankBadge}</span> : index + 1}
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center font-black text-xs border border-stone-200 dark:border-stone-700">
                                  {user.user_name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-extrabold flex items-center gap-1.5">
                                    {user.user_name}
                                    {isSelf && <span className="text-[9px] bg-emerald-600 text-white px-1 rounded uppercase">You</span>}
                                  </span>
                                  <span className="block text-[10px] text-stone-400 mt-0.5">{user.user_email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center font-mono font-bold">{user.total_predictions}</td>
                            <td className="py-4 px-4 text-center font-mono text-emerald-600 dark:text-emerald-400 font-bold">{user.correct_predictions}</td>
                            <td className="py-4 px-4 text-center">
                              {user.streak > 1 ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-rose-100 text-rose-850 dark:bg-rose-950/30 dark:text-rose-400 rounded-full font-black text-[10px]">
                                  <Flame className="w-3.5 h-3.5 fill-rose-500 animate-pulse text-rose-600" /> {user.streak}
                                </span>
                              ) : (
                                <span className="text-stone-400">-</span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center font-mono font-bold">
                              <div className="flex items-center justify-center gap-1.5">
                                <span>{user.accuracy}%</span>
                                <div className="w-12 bg-stone-200 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden hidden md:block">
                                  <div className="bg-emerald-600 h-full" style={{ width: `${user.accuracy}%` }}></div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right font-mono text-sm font-black text-stone-900 dark:text-white">
                              {user.points} pts
                            </td>
                          </tr>
                        );
                      })}

                      {leaderboard.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-stone-500">
                            No leaderboard score logs available yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* 4. STANDINGS VIEW */}
          {activeTab === "standings" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              {standings.length === 0 ? (
                <div className="p-16 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-3xl text-center">
                  <p className="text-stone-500 text-xs">Standings matches have not started yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {standings.map(group => (
                    <div key={group.group} className="bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 shadow-sm">
                      <h3 className="text-sm font-black text-stone-900 dark:text-white border-b border-stone-100 dark:border-stone-800 pb-3 mb-4 uppercase tracking-wider">
                        {group.group}
                      </h3>

                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-[10px] text-stone-400 font-bold uppercase">
                            <th className="py-2">Pos</th>
                            <th className="py-2">Team</th>
                            <th className="py-2 text-center">P</th>
                            <th className="py-2 text-center">W</th>
                            <th className="py-2 text-center">D</th>
                            <th className="py-2 text-center">L</th>
                            <th className="py-2 text-center">GD</th>
                            <th className="py-2 text-right">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.teams.map((t, idx) => (
                            <tr key={t.team.id} className="border-b border-stone-50 dark:border-stone-900 py-2.5">
                              <td className="py-2.5 font-bold text-stone-400">{idx + 1}</td>
                              <td className="py-2.5">
                                <div className="flex items-center gap-2">
                                  <img src={t.team.logo || ""} alt="" className="w-4 h-4 object-contain" />
                                  <span className="font-extrabold text-stone-800 dark:text-stone-200">{getTeamName(t.team)}</span>
                                </div>
                              </td>
                              <td className="py-2.5 text-center font-mono text-stone-600 dark:text-stone-400">{t.played}</td>
                              <td className="py-2.5 text-center font-mono">{t.won}</td>
                              <td className="py-2.5 text-center font-mono">{t.drawn}</td>
                              <td className="py-2.5 text-center font-mono">{t.lost}</td>
                              <td className={`py-2.5 text-center font-mono font-bold ${
                                t.goalDifference > 0 
                                  ? "text-emerald-600 dark:text-emerald-400" 
                                  : t.goalDifference < 0 
                                    ? "text-rose-600" 
                                    : "text-stone-400"
                              }`}>
                                {t.goalDifference > 0 ? `+${t.goalDifference}` : t.goalDifference}
                              </td>
                              <td className="py-2.5 text-right font-mono font-black text-stone-900 dark:text-white">{t.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* 5. MY PREDICTIONS VIEW */}
          {activeTab === "my-predictions" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-white dark:bg-stone-850 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
                <h3 className="text-base font-black text-stone-900 dark:text-white border-b border-stone-100 dark:border-stone-800 pb-4 mb-6 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" /> My predictions tracker
                </h3>

                {predictions.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-stone-500 text-xs">You haven't submitted any predictions yet.</p>
                    <button
                      onClick={() => setActiveTab("fixtures")}
                      className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl"
                    >
                      Browse Fixtures to Predict
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {predictions.map(pred => {
                      const match = matches.find(m => m.id === pred.match_id);
                      if (!match) return null;

                      const teamPredicted = pred.predicted_team_id === match.home_team_id 
                        ? match.homeTeam 
                        : pred.predicted_team_id === match.away_team_id 
                          ? match.awayTeam 
                          : null;

                      const isWinnerCorrect = match.status === "FT" && match.winner_team_id === pred.predicted_team_id;

                      return (
                        <div key={pred.id} className="p-4 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 flex flex-col md:flex-row justify-between items-center gap-4">
                          <div className="flex flex-col">
                            <span className="px-2 py-0.5 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded text-[9px] font-bold self-start mb-1.5">
                              {match.round}
                            </span>
                            <div className="flex items-center gap-4 text-xs font-bold">
                              <span className="truncate max-w-24">{getTeamName(match.homeTeam)}</span>
                              <span className="px-1.5 py-0.5 bg-stone-200 dark:bg-stone-800 rounded font-black font-mono">
                                {match.status === "FT" || match.status === "LIVE" ? `${match.home_score} - ${match.away_score}` : "VS"}
                              </span>
                              <span className="truncate max-w-24">{getTeamName(match.awayTeam)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-center md:text-left">
                              <span className="text-[10px] text-stone-400 block">Your choice</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {teamPredicted ? (
                                  <>
                                    <img src={teamPredicted.logo || ""} alt="" className="w-4 h-4 object-contain" />
                                    <span className="text-xs font-black text-stone-900 dark:text-white">
                                      {getTeamName(teamPredicted)}
                                      {pred.predicted_home_score !== null && pred.predicted_away_score !== null && (
                                        <span className="font-mono text-emerald-600 dark:text-emerald-400 ml-1.5 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded text-[10px]">
                                          ({pred.predicted_home_score} - {pred.predicted_away_score})
                                        </span>
                                      )}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs font-black text-stone-500">
                                    Draw
                                    {pred.predicted_home_score !== null && pred.predicted_away_score !== null && (
                                      <span className="font-mono text-emerald-600 dark:text-emerald-400 ml-1.5 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded text-[10px]">
                                        ({pred.predicted_home_score} - {pred.predicted_away_score})
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            {match.status === "FT" ? (
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1 ${
                                  isWinnerCorrect 
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" 
                                    : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                                }`}>
                                  {isWinnerCorrect ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3.5 h-3.5" /> Incorrect
                                    </>
                                  )}
                                </span>
                                <span className="font-mono font-black text-sm text-stone-900 dark:text-white">
                                  +{pred.points ?? 0} pts
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 px-2 py-1 rounded font-bold">
                                Pending Result
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* 6. STATISTICS VIEW */}
          {activeTab === "statistics" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Stats Splits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Accuracy Pie Chart */}
                <div className="bg-white dark:bg-stone-850 p-6 rounded-2xl border border-stone-200 dark:border-stone-800">
                  <h3 className="text-sm font-black text-stone-900 dark:text-white border-b border-stone-100 dark:border-stone-800 pb-3 mb-4">
                    Correct Predictions Ratio
                  </h3>
                  <div className="h-64 flex items-center justify-center">
                    {stats && stats.totalPredictions > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Correct", value: stats.correctPredictions },
                              { name: "Incorrect", value: stats.totalPredictions - stats.correctPredictions }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#059669" />
                            <Cell fill="#ef4444" />
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-stone-500 text-xs">No completed predictions to chart accuracy.</p>
                    )}
                  </div>
                  {stats && stats.totalPredictions > 0 && (
                    <div className="flex justify-center gap-6 mt-4 text-xs font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
                        <span>Correct ({stats.correctPredictions})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                        <span>Incorrect ({stats.totalPredictions - stats.correctPredictions})</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Most Predicted Team */}
                <div className="bg-white dark:bg-stone-850 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-black text-stone-900 dark:text-white border-b border-stone-100 dark:border-stone-800 pb-3 mb-4">
                      Prediction insights
                    </h3>
                    
                    {stats && stats.mostPredictedTeam ? (
                      <div className="space-y-4 pt-4">
                        <div className="flex items-center gap-4 bg-stone-50 dark:bg-stone-900 p-4 rounded-xl">
                          <img src={stats.mostPredictedTeam.team.logo || ""} alt="" className="w-12 h-12 object-contain" />
                          <div>
                            <p className="text-[10px] text-stone-500 font-bold uppercase">Most Predicted Team</p>
                            <h4 className="text-base font-black text-stone-900 dark:text-white">{getTeamName(stats.mostPredictedTeam.team)}</h4>
                            <p className="text-xs text-stone-500 mt-0.5">Selected in {stats.mostPredictedTeam.count} predictions</p>
                          </div>
                        </div>

                        {stats.highestScoringMatch && (
                          <div className="flex items-center gap-4 bg-stone-50 dark:bg-stone-900 p-4 rounded-xl">
                            <div className="p-3 bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-xl">
                              <BarChart3 className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="text-[10px] text-stone-500 font-bold uppercase">Highest Scoring Match</p>
                              <h4 className="text-xs font-black text-stone-900 dark:text-white">
                                {getTeamName(stats.highestScoringMatch.match.homeTeam)} VS {getTeamName(stats.highestScoringMatch.match.awayTeam)}
                              </h4>
                              <p className="text-[10px] text-stone-400 mt-1">
                                Finished {stats.highestScoringMatch.match.home_score} - {stats.highestScoringMatch.match.away_score} ({stats.highestScoringMatch.totalGoals} goals)
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-stone-500 text-xs py-10 text-center">No prediction statistics accumulated yet.</p>
                    )}
                  </div>

                  <div className="p-4 bg-stone-50 dark:bg-stone-900 rounded-xl mt-4 flex items-center gap-2 text-[10px] text-stone-500 border border-stone-200 dark:border-stone-800">
                    <Info className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Point Allocation scales with rounds: Group Stage (1pt), R32 (2pts), R16 (4pts), QF (6pts), 3rd Place (8pts), Semis (10pts), Finals (20pts).</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 7. ADMIN VIEW */}
          {activeTab === "admin" && isAdmin && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Football Settings Panel */}
                <div className="bg-white dark:bg-stone-850 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-6">
                  <h3 className="text-sm font-black text-stone-900 dark:text-white border-b border-stone-100 dark:border-stone-800 pb-3 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-600" /> Football Settings
                  </h3>

                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1.5">
                        🌍 Select Competition
                      </label>
                      <select
                        value={settings.competitionId}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const comp = COMPETITIONS.find(c => c.id === val);
                          setSettings(prev => ({
                            ...prev,
                            competitionId: val,
                            competitionName: comp ? comp.name : prev.competitionName
                          }));
                        }}
                        className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {COMPETITIONS.map((comp) => (
                          <option key={comp.id} value={comp.id}>
                            {comp.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1.5">
                        📅 Select Season
                      </label>
                      <select
                        value={settings.season}
                        onChange={(e) => setSettings(prev => ({ ...prev, season: e.target.value }))}
                        className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {SEASONS.map((season) => (
                          <option key={season} value={season}>
                            {season}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1.5">
                        🔄 Sync Interval
                      </label>
                      <select
                        value={settings.syncInterval}
                        onChange={(e) => setSettings(prev => ({ ...prev, syncInterval: Number(e.target.value) }))}
                        className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {INTERVALS.map((int) => (
                          <option key={int.value} value={int.value}>
                            {int.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {settings.lastSyncTime && (
                      <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 flex items-center gap-2 text-[10px] text-stone-500">
                        <Clock className="w-3.5 h-3.5 text-stone-400" />
                        <span>
                          Last Synced: <strong className="text-stone-700 dark:text-stone-300">{formatToISTDate(settings.lastSyncTime)} {formatToISTTime(settings.lastSyncTime)}</strong>
                        </span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {savingSettings ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                        </>
                      ) : (
                        "Save Configurations"
                      )}
                    </button>
                  </form>
                </div>

                {/* Control Actions Panel */}
                <div className="bg-white dark:bg-stone-850 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-6">
                  <h3 className="text-sm font-black text-stone-900 dark:text-white border-b border-stone-100 dark:border-stone-800 pb-3 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-600" /> Administrative Operations
                  </h3>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800">
                      <h4 className="text-xs font-black text-stone-800 dark:text-stone-200">Force Bracket Synchronization</h4>
                      <p className="text-[10px] text-stone-500 mt-1">
                        Pulls latest match results, kickoff updates, and new round teams from API-Football. If no API key is specified, this advances the simulated bracket match days.
                      </p>
                      <button
                        onClick={handleForceSync}
                        disabled={syncing}
                        className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center gap-2 disabled:opacity-50 transition cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                        Trigger Live Sync / Simulate Matchday
                      </button>
                    </div>

                    <div className="p-4 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800">
                      <h4 className="text-xs font-black text-rose-700">Wipe & Reset Bracket</h4>
                      <p className="text-[10px] text-stone-500 mt-1">
                        Deletes all users predictions, deletes custom matches, and re-seeds starting World Cup bracket games for initial prediction tests.
                      </p>
                      <button
                        onClick={handleResetData}
                        disabled={syncing}
                        className="mt-3 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl flex items-center gap-2 disabled:opacity-50 transition cursor-pointer"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        Reset Prediction Database
                      </button>
                    </div>
                  </div>
                </div>

                {/* SQL setup Panel */}
                <div className="bg-white dark:bg-stone-850 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-4">
                  <h3 className="text-sm font-black text-stone-900 dark:text-white border-b border-stone-100 dark:border-stone-800 pb-3 flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-600" /> Supabase Schema Migration
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    To transition from local sandbox cache storage into durable real-time cloud storage, copy and run the following migration script in your Supabase SQL Editor.
                  </p>

                  <div className="relative">
                    <pre className="p-4 bg-stone-950 text-emerald-400 font-mono text-[10px] rounded-xl overflow-x-auto h-48 border border-stone-800 scrollbar-thin">
                      {FOOTBALL_SETUP_SQL}
                    </pre>
                    <button
                      onClick={copySqlToClipboard}
                      className="absolute top-2 right-2 p-2 bg-stone-900 hover:bg-stone-850 text-stone-300 rounded-lg hover:text-white transition"
                      title="Copy SQL"
                    >
                      {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Prediction Placement Modal */}
      <AnimatePresence>
        {predictingMatch && (
          <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-stone-850 max-w-md w-full rounded-3xl p-6 border border-stone-200 dark:border-stone-800 shadow-2xl relative"
            >
              <h3 className="text-base font-black text-stone-900 dark:text-white mb-2">
                Predict Match Winner & Score
              </h3>
              <p className="text-[11px] text-stone-400 mb-6">
                Predict the winning team and optionally input the exact score to earn massive bonus points on the leaderboard.
              </p>

              {/* Contestant Choice cards */}
              <div className="space-y-3">
                <button
                  onClick={() => setSelectedPrediction(predictingMatch.home_team_id)}
                  className={`w-full p-4 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                    selectedPrediction === predictingMatch.home_team_id
                      ? "border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img src={predictingMatch.homeTeam?.logo || ""} alt="" className="w-8 h-8 object-contain" />
                    <span className="font-extrabold text-sm">{getTeamName(predictingMatch.homeTeam)}</span>
                  </div>
                  {selectedPrediction === predictingMatch.home_team_id && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                </button>

                {predictingMatch.round.toLowerCase().includes("group") && (
                  <button
                    onClick={() => setSelectedPrediction(-1)}
                    className={`w-full p-4 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                      selectedPrediction === -1
                        ? "border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-xs text-stone-500 font-extrabold font-mono">X</div>
                      <span className="font-extrabold text-sm text-stone-700 dark:text-stone-350">Predict Draw</span>
                    </div>
                    {selectedPrediction === -1 && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  </button>
                )}

                <button
                  onClick={() => setSelectedPrediction(predictingMatch.away_team_id)}
                  className={`w-full p-4 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                    selectedPrediction === predictingMatch.away_team_id
                      ? "border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img src={predictingMatch.awayTeam?.logo || ""} alt="" className="w-8 h-8 object-contain" />
                    <span className="font-extrabold text-sm">{getTeamName(predictingMatch.awayTeam)}</span>
                  </div>
                  {selectedPrediction === predictingMatch.away_team_id && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                </button>
              </div>

              {/* Exact Score inputs */}
              <div className="mt-6 p-4 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl">
                <h4 className="text-xs font-black text-stone-900 dark:text-white flex items-center gap-1.5 mb-1">
                  🎯 Exact Score Prediction
                </h4>
                <p className="text-[10px] text-stone-500 mb-4">
                  Predict exact full-time scores for an extra <strong className="text-emerald-600">+3 bonus points</strong>! Leave blank to only predict match outcome.
                </p>

                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-stone-500 block mb-1 truncate max-w-24">
                      {getTeamName(predictingMatch.homeTeam)}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={predictedHomeScore}
                      onChange={(e) => setPredictedHomeScore(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                      className="w-16 h-12 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-750 text-center font-mono font-black text-lg rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <span className="text-stone-400 font-bold mt-4">:</span>

                  <div className="text-center">
                    <span className="text-[10px] font-bold text-stone-500 block mb-1 truncate max-w-24">
                      {getTeamName(predictingMatch.awayTeam)}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={predictedAwayScore}
                      onChange={(e) => setPredictedAwayScore(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                      className="w-16 h-12 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-750 text-center font-mono font-black text-lg rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setPredictingMatch(null)}
                  className="flex-1 py-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-750 text-stone-600 dark:text-stone-300 font-black text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePrediction}
                  disabled={submittingPrediction || selectedPrediction === null}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition disabled:opacity-50 cursor-pointer"
                >
                  {submittingPrediction ? "Submitting..." : "Save Choice"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
