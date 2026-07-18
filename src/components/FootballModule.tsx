/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
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
  ExternalLink,
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
  Info,
  Radio,
  Save,
  Key,
  Table
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
import { supabase } from "../lib/supabase";
import { Member } from "../types";
import { checkIsAdmin } from "../lib/auth";
import { Confetti } from "./Confetti";
import { BentoStatsSkeleton, UpcomingMatchSkeleton, FixtureCardSkeleton, LiveMatchSkeleton } from "./FootballSkeletons";
import { D3LeagueTable } from "./D3LeagueTable";

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

const AnimatedScore: React.FC<{
  score: number | string | null;
  className?: string;
}> = ({ score, className = "" }) => {
  const displayScore = score !== null && score !== undefined ? score : "-";
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={displayScore}
        initial={{ opacity: 0, scale: 0.7, y: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.7, y: 5 }}
        transition={{ type: "spring", stiffness: 350, damping: 22 }}
        className={`inline-block min-w-[0.8rem] text-center ${className}`}
      >
        {displayScore}
      </motion.span>
    </AnimatePresence>
  );
};

interface FootballModuleProps {
  currentUser: Member | null;
}

type SubPage = "index" | "fixtures" | "predictions" | "leaderboard" | "standings" | "my-predictions" | "statistics" | "admin" | "league-table";

export const FootballModule: React.FC<FootballModuleProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<SubPage>("index");
  
  const [matches, setMatches] = useState<FootballMatch[]>(() => {
    try {
      const saved = localStorage.getItem("sy_football_matches");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [predictions, setPredictions] = useState<FootballPrediction[]>(() => {
    try {
      const saved = currentUser ? localStorage.getItem(`sy_football_predictions_${currentUser.id}`) : null;
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
    try {
      const saved = localStorage.getItem("sy_football_leaderboard");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [standings, setStandings] = useState<StandingsGroup[]>(() => {
    try {
      const saved = localStorage.getItem("sy_football_standings");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [stats, setStats] = useState<FootballStats | null>(() => {
    try {
      const saved = currentUser ? localStorage.getItem(`sy_football_stats_${currentUser.id}`) : null;
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [systemLogs, setSystemLogs] = useState<{ timestamp: string; type: string; message: string }[]>([]);
  const [providerStatus, setProviderStatus] = useState<any>(null);

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
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "connected" | "error">("connecting");

  // Confetti and settings states
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [settings, setSettings] = useState<{
    competitionId: number;
    competitionName: string;
    season: string;
    syncInterval: number;
    lastSyncTime?: string;
    apiFootballKey?: string;
    apiFootballUrl?: string;
    footballDataKey?: string;
    footballDataHost?: string;
    theSportsDbKey?: string;
    theSportsDbHost?: string;
  }>({
    competitionId: 1,
    competitionName: "FIFA World Cup",
    season: "2026",
    syncInterval: 10,
    apiFootballKey: "",
    apiFootballUrl: "",
    footballDataKey: "",
    footballDataHost: "",
    theSportsDbKey: "",
    theSportsDbHost: ""
  });
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  const [toasts, setToasts] = useState<Array<{
    id: string;
    matchId: number;
    title: string;
    desc: string;
    matchDisplay: string;
    logo?: string;
  }>>([]);

  const matchesRef = useRef<FootballMatch[]>([]);
  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  const [savingApiSettings, setSavingApiSettings] = useState<boolean>(false);
  const [apiSettingsError, setApiSettingsError] = useState<string | null>(null);
  const [apiSettingsSuccess, setApiSettingsSuccess] = useState<string | null>(null);

  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [fallbackBanner, setFallbackBanner] = useState<{
    active: boolean;
    primaryStatus: number | string;
    primaryProvider: string;
    fallbackProvider: string;
    timestamp: string;
  } | null>(null);

  // Filter states for fixtures page
  const [roundFilter, setRoundFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("All Teams");
  const [upcomingOnly, setUpcomingOnly] = useState<boolean>(true);

  const isAdmin = checkIsAdmin(currentUser?.email);

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
        footballApi.getSettings(currentUser?.email).catch(() => null)
      ]);

      setApiStatus(statusRes);
      setMatches(matchesRes);
      setLeaderboard(leaderboardRes);
      setStandings(standingsRes);
      if (settingsRes) {
        setSettings(settingsRes);
      }

      try {
        localStorage.setItem("sy_football_matches", JSON.stringify(matchesRes));
        localStorage.setItem("sy_football_leaderboard", JSON.stringify(leaderboardRes));
        localStorage.setItem("sy_football_standings", JSON.stringify(standingsRes));
        if (settingsRes) {
          localStorage.setItem("sy_football_settings", JSON.stringify(settingsRes));
        }
      } catch (e) {}

      // If user is authenticated, fetch their predictions
      if (currentUser) {
        const userPreds = await footballApi.getUserPredictions(currentUser.id).catch(() => []);
        setPredictions(userPreds);

        // Compute statistics dynamically
        const calculatedStats = await footballApi.getStats(matchesRes, userPreds);
        setStats(calculatedStats);

        try {
          localStorage.setItem(`sy_football_predictions_${currentUser.id}`, JSON.stringify(userPreds));
          localStorage.setItem(`sy_football_stats_${currentUser.id}`, JSON.stringify(calculatedStats));
        } catch (e) {}
      }

      if (isAdmin && currentUser) {
        const logsRes = await footballApi.getLogs(currentUser.email).catch(() => []);
        setSystemLogs(logsRes);
        const provRes = await footballApi.getProviderStatus().catch(() => null);
        setProviderStatus(provRes);
      }
    } catch (err: any) {
      setActionError("Failed to synchronize module data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      try {
        const cachedPreds = localStorage.getItem(`sy_football_predictions_${currentUser.id}`);
        if (cachedPreds) {
          setPredictions(JSON.parse(cachedPreds));
        } else {
          setPredictions([]);
        }
        const cachedStats = localStorage.getItem(`sy_football_stats_${currentUser.id}`);
        if (cachedStats) {
          setStats(JSON.parse(cachedStats));
        } else {
          setStats(null);
        }
      } catch (e) {}
    } else {
      setPredictions([]);
      setStats(null);
    }
    loadData();
  }, [currentUser]);

  // Load fallback warning event from localStorage when sync finishes
  useEffect(() => {
    const saved = localStorage.getItem("football_fallback_event");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.active) {
          setFallbackBanner(parsed);
        } else {
          setFallbackBanner(null);
        }
      } catch (_) {
        setFallbackBanner(null);
      }
    } else {
      setFallbackBanner(null);
    }
  }, [syncing]);

  // Realtime Supabase Subscriptions for Live Match Data Updates
  useEffect(() => {
    setRealtimeStatus("connecting");
    
    const matchesChannel = supabase
      .channel("football-matches-realtime-sub")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "football_matches" },
        (payload) => {
          console.log("[Realtime] Match change detected:", payload);
          if (payload.eventType === "UPDATE") {
            const oldRow = payload.old;
            const newRow = payload.new;
            if (oldRow && newRow) {
              const prevMatch = matchesRef.current.find(m => m.id === newRow.id);
              const oldHome = prevMatch ? prevMatch.home_score : oldRow.home_score;
              const oldAway = prevMatch ? prevMatch.away_score : oldRow.away_score;
              const newHome = newRow.home_score;
              const newAway = newRow.away_score;

              const homeGoal = (newHome !== null && oldHome !== null && newHome > oldHome);
              const awayGoal = (newAway !== null && oldAway !== null && newAway > oldAway);

              if (homeGoal || awayGoal) {
                const homeTeamName = prevMatch?.homeTeam?.name || "Home Team";
                const awayTeamName = prevMatch?.awayTeam?.name || "Away Team";
                const scorerName = homeGoal ? homeTeamName : awayTeamName;
                const scorerLogo = homeGoal ? prevMatch?.homeTeam?.logo : prevMatch?.awayTeam?.logo;

                const toastId = Math.random().toString();
                const goalToast = {
                  id: toastId,
                  matchId: newRow.id,
                  title: "GOAL!!! ⚽",
                  desc: `${scorerName} has scored!`,
                  matchDisplay: `${homeTeamName} ${newHome} - ${newAway} ${awayTeamName}`,
                  logo: scorerLogo || undefined
                };

                setToasts(prev => [...prev, goalToast]);
                setTimeout(() => {
                  setToasts(prev => prev.filter(t => t.id !== toastId));
                }, 6000);
              }
            }
          }
          loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "football_predictions" },
        (payload) => {
          console.log("[Realtime] Prediction change detected:", payload);
          loadData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "football_configs" },
        (payload) => {
          console.log("[Realtime] Config change detected:", payload);
          loadData();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setRealtimeStatus("error");
        }
      });

    return () => {
      supabase.removeChannel(matchesChannel);
    };
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
    if (!canPredictMatch(match)) {
      setActionError("Prediction is disabled: This match is either already started, finished, or is not scheduled within the 10-15 days window.");
      return;
    }
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
    
    if (!canPredictMatch(predictingMatch)) {
      setActionError("This match has already started or predictions are closed.");
      return;
    }
    
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
      
      try {
        localStorage.setItem("sy_football_matches", JSON.stringify(updatedMatches));
        localStorage.setItem(`sy_football_predictions_${currentUser.id}`, JSON.stringify(updatedPreds));
      } catch (e) {}

      const updatedStats = await footballApi.getStats(updatedMatches, updatedPreds);
      setStats(updatedStats);

      try {
        localStorage.setItem(`sy_football_stats_${currentUser.id}`, JSON.stringify(updatedStats));
      } catch (e) {}

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
      if (res && (res as any).fallbackEvent) {
        localStorage.setItem("football_fallback_event", JSON.stringify((res as any).fallbackEvent));
        setFallbackBanner((res as any).fallbackEvent);
      }
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // Manual sync for all logged-in users to trigger full synchronization of the selected competition/season
  const handleManualSync = async () => {
    if (!currentUser) {
      setActionError("Please log in to synchronize data.");
      return;
    }
    try {
      setSyncing(true);
      setActionError(null);
      setActionSuccess(null);
      
      const res = await footballApi.syncFootball(currentUser.email);
      setActionSuccess(res.message);
      if (res && (res as any).fallbackEvent) {
        localStorage.setItem("football_fallback_event", JSON.stringify((res as any).fallbackEvent));
        setFallbackBanner((res as any).fallbackEvent);
      }
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Synchronization failed");
    } finally {
      setSyncing(false);
    }
  };

  // Reset Data (Admin action)
  const handleResetData = async () => {
    if (!currentUser || !isAdmin) return;
    setShowResetConfirm(true);
  };

  const confirmResetData = async () => {
    setShowResetConfirm(false);
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
      setSettingsError(null);
      setSettingsSuccess(null);
      setActionError(null);
      setActionSuccess(null);
      
      const res = await footballApi.saveSettings(
        currentUser.email,
        settings.competitionId,
        settings.competitionName,
        settings.season,
        settings.syncInterval,
        settings.apiFootballKey,
        settings.apiFootballUrl,
        settings.footballDataKey,
        settings.footballDataHost,
        settings.theSportsDbKey,
        settings.theSportsDbHost
      );
      
      const successMessage = res.message || "Configurations saved successfully!";
      setSettingsSuccess(successMessage);
      setActionSuccess(successMessage);
      await loadData();
    } catch (err: any) {
      const errorMessage = err.message || "Failed to save settings";
      setSettingsError(errorMessage);
      setActionError(errorMessage);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleLeague = async (compId: number) => {
    if (!currentUser || !isAdmin) return;
    
    try {
      setSyncing(true);
      setActionError(null);
      setActionSuccess(null);
      
      const comp = COMPETITIONS.find(c => c.id === compId);
      if (!comp) return;

      // 1. Save new settings to Supabase
      const res = await footballApi.saveSettings(
        currentUser.email,
        compId,
        comp.name,
        settings.season,
        settings.syncInterval,
        settings.apiFootballKey,
        settings.apiFootballUrl,
        settings.footballDataKey,
        settings.footballDataHost,
        settings.theSportsDbKey,
        settings.theSportsDbHost
      );
      
      // Update local settings state so the header reflects it instantly
      setSettings(prev => ({
        ...prev,
        competitionId: compId,
        competitionName: comp.name
      }));

      // 2. Trigger active sync to fetch matches of the newly selected league
      const syncRes = await footballApi.syncFootball(currentUser.email);
      setActionSuccess(`Switched to ${comp.name} and synced matches successfully!`);
      if (syncRes && (syncRes as any).fallbackEvent) {
        localStorage.setItem("football_fallback_event", JSON.stringify((syncRes as any).fallbackEvent));
        setFallbackBanner((syncRes as any).fallbackEvent);
      }
      
      // 3. Reload everything
      await loadData();
    } catch (err: any) {
      setActionError(err.message || "Failed to switch league and synchronize matches");
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveApiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isAdmin) return;
    
    try {
      setSavingApiSettings(true);
      setApiSettingsError(null);
      setApiSettingsSuccess(null);
      setActionError(null);
      setActionSuccess(null);
      
      const res = await footballApi.saveSettings(
        currentUser.email,
        settings.competitionId,
        settings.competitionName,
        settings.season,
        settings.syncInterval,
        settings.apiFootballKey,
        settings.apiFootballUrl,
        settings.footballDataKey,
        settings.footballDataHost,
        settings.theSportsDbKey,
        settings.theSportsDbHost
      );
      
      const successMessage = res.message || "API configurations saved successfully!";
      setApiSettingsSuccess(successMessage);
      setActionSuccess(successMessage);
      await loadData();
    } catch (err: any) {
      const errorMessage = err.message || "Failed to save API configurations";
      setApiSettingsError(errorMessage);
      setActionError(errorMessage);
    } finally {
      setSavingApiSettings(false);
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

  const canPredictMatch = (match: FootballMatch): boolean => {
    if (match.status !== "NS") return false;
    const kickoff = new Date(match.kickoff).getTime();
    const now = Date.now();
    const fifteenDaysInMs = 15 * 24 * 60 * 60 * 1000;
    return kickoff > now && (kickoff - now) <= fifteenDaysInMs;
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
  const upcomingMatches = matches.filter(m => m.status === "NS" && canPredictMatch(m)).slice(0, 3);
  const finishedMatches = matches.filter(m => m.status === "FT").reverse().slice(0, 3);

  // Navigation Items
  const navItems = [
    { id: "index", label: "Dashboard", icon: Trophy },
    { id: "fixtures", label: "Fixtures", icon: Calendar },
    { id: "my-predictions", label: "My Predictions", icon: CheckCircle2 },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy },
    { id: "standings", label: "Standings", icon: List },
    { id: "league-table", label: "League Table", icon: Table },
    { id: "statistics", label: "Statistics", icon: BarChart3 }
  ];

  if (isAdmin) {
    navItems.push({ id: "admin", label: "Admin Console", icon: Sliders });
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 relative" id="football-module-container">
      {/* Realtime Goal scoring toast notifications */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="bg-stone-900/95 dark:bg-stone-950/95 text-white p-4 rounded-2xl shadow-2xl border border-stone-800 pointer-events-auto flex gap-3.5 items-center backdrop-blur-md"
            >
              {toast.logo ? (
                <img
                  src={toast.logo}
                  alt=""
                  className="w-10 h-10 object-contain p-1 bg-white dark:bg-stone-900 rounded-xl shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-lg shrink-0">
                  ⚽
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase font-black tracking-widest text-emerald-400">
                  {toast.title}
                </div>
                <div className="text-sm font-black mt-0.5 leading-snug truncate">
                  {toast.desc}
                </div>
                <div className="text-xs font-mono font-bold text-stone-300 mt-1.5 px-2.5 py-1 bg-stone-800/80 rounded-lg inline-block truncate max-w-full">
                  {toast.matchDisplay}
                </div>
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-stone-400 hover:text-white font-bold text-xl px-1.5 focus:outline-none cursor-pointer shrink-0"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {isAdmin && (
            <div className="flex items-center gap-2 bg-stone-100 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 shadow-sm min-w-[180px]">
              <span className="text-xs font-black text-stone-500 dark:text-stone-400 whitespace-nowrap">
                🏆 League:
              </span>
              <select
                value={settings.competitionId}
                disabled={loading || syncing}
                onChange={(e) => handleToggleLeague(Number(e.target.value))}
                className="bg-transparent border-none text-xs font-black text-stone-850 dark:text-stone-100 focus:outline-none focus:ring-0 cursor-pointer disabled:opacity-50 w-full"
              >
                {COMPETITIONS.map((comp) => (
                  <option key={comp.id} value={comp.id} className="bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100">
                    {comp.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 bg-stone-100 dark:bg-stone-850 hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-stone-200 dark:border-stone-800 disabled:opacity-50 h-[38px] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Stats
          </button>
        </div>
      </div>

      {/* API Connection & Data Sync Health Monitor Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-stone-50 dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800 p-5 rounded-3xl animate-fadeIn" id="api-status-monitor-banner">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white dark:bg-stone-800 rounded-2xl border border-stone-150 dark:border-stone-750 flex-shrink-0 shadow-sm">
            <Radio className={`w-5 h-5 ${apiStatus?.isApiLive ? "text-emerald-500 animate-pulse" : "text-rose-500"}`} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-stone-400 block leading-none">API-Football Link</span>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={`w-2 h-2 rounded-full ${apiStatus?.isApiLive ? "bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse" : "bg-rose-500"}`} />
              <span className="text-xs font-black text-stone-850 dark:text-stone-100">
                {apiStatus?.isApiLive ? "Live & Verified" : "Offline / Unreachable"}
              </span>
            </div>
            {apiStatus?.apiError && (
              <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-0.5 truncate max-w-[200px]" title={apiStatus.apiError}>
                Error: {apiStatus.apiError}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <span className="text-[10px] uppercase font-black tracking-wider text-stone-400 block leading-none">Active Tournament & Season</span>
          <span className="text-xs font-black text-stone-800 dark:text-stone-200 mt-1.5">
            {settings.competitionName} ({settings.season})
          </span>
          {apiStatus?.operatingMode && (
            <span className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 block leading-none">
              Mode: {apiStatus.operatingMode}
            </span>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${realtimeStatus === "connected" ? "bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse" : realtimeStatus === "connecting" ? "bg-amber-500" : "bg-rose-500"}`} />
            <span className="text-[10px] font-bold text-stone-600 dark:text-stone-300">
              Realtime Feed: {realtimeStatus === "connected" ? "Live Stream Connected" : realtimeStatus === "connecting" ? "Establishing stream..." : "Offline / Standby"}
            </span>
          </div>
        </div>

        <div className="flex items-center md:justify-end gap-3">
          <button
            onClick={handleManualSync}
            disabled={syncing || !currentUser}
            className="w-full md:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 disabled:opacity-50 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10 cursor-pointer disabled:cursor-not-allowed"
            id="manual-refresh-data-btn"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing Matches..." : "Refresh Data"}
          </button>
        </div>
      </div>

      {/* Success/Error Alerts */}
      <AnimatePresence>
        {actionError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-2xl text-xs font-bold flex flex-col gap-3 border border-rose-200 dark:border-rose-900 shadow-sm"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="block font-black text-rose-800 dark:text-rose-200">Operation Error</span>
                <span className="font-semibold text-rose-700 dark:text-rose-300">{actionError}</span>
              </div>
            </div>
            {(actionError.includes("HTML document") || actionError.includes("unexpected HTML") || actionError.includes("offline") || actionError.includes("route was not found") || actionError.includes("404") || actionError.includes("500")) && (
              <div className="mt-1 pl-6 text-[11px] font-normal text-stone-600 dark:text-stone-300 border-t border-rose-200/50 dark:border-rose-900/40 pt-2.5 space-y-2">
                <p className="leading-relaxed">
                  <strong>💡 Root Cause:</strong> This application is hosted inside an AI Studio preview iframe. Many browsers (including Chrome Incognito, Safari, and Firefox) block 3rd-party cookies inside iframes by default. This causes the proxy server to intercept and redirect the application's API requests to cookie checking pages, returning an HTML document instead of JSON.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-wider rounded-lg transition shadow-sm"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open App in New Tab (Bypasses Iframe)
                  </a>
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-black text-[10px] uppercase tracking-wider rounded-lg transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reload Page
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
        {fallbackBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded-2xl text-xs font-medium flex items-start gap-3 border border-amber-200 dark:border-amber-900 shadow-sm relative overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
            <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
              <Zap className="w-4 h-4 animate-pulse" />
            </div>
            <div className="flex-1 pr-6">
              <div className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                Automatic API Provider Fallback Triggered
              </div>
              <p className="mt-1 leading-relaxed text-amber-700 dark:text-amber-300/90">
                The primary endpoint <strong className="font-black">({fallbackBanner.primaryProvider})</strong> returned status code <strong className="font-black">{fallbackBanner.primaryStatus}</strong>.
                To maintain uninterrupted prediction dashboard services, the engine automatically switched to secondary provider <strong className="font-black">({fallbackBanner.fallbackProvider})</strong>.
              </p>
              <div className="text-[10px] text-stone-500 dark:text-stone-400 font-mono mt-2 flex items-center gap-1">
                <span>Timestamp:</span>
                <span>{new Date(fallbackBanner.timestamp).toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem("football_fallback_event");
                setFallbackBanner(null);
              }}
              className="absolute top-3.5 right-3.5 text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-100 transition-colors cursor-pointer text-base leading-none font-bold p-1 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg"
              title="Dismiss warning"
            >
              ×
            </button>
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
                <div className="bg-stone-900 dark:bg-black rounded-3xl p-6 text-white border border-rose-600 relative overflow-hidden shadow-2xl animate-live-border-pulse">
                  <div className="absolute top-4 right-4 flex items-center gap-2 bg-rose-600 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse-glow">
                    <Tv className="w-3.5 h-3.5" />
                    Live Match
                  </div>
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-dot-pulse"></span>
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
                          <AnimatedScore score={match.home_score} className="text-4xl font-black min-w-[2rem]" />
                          <span className="text-stone-500 font-black text-lg">:</span>
                          <AnimatedScore score={match.away_score} className="text-4xl font-black min-w-[2rem]" />
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

                              {canPredictMatch(match) ? (
                                <button
                                  onClick={() => handleOpenPredictModal(match)}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer"
                                >
                                  {hasPredicted ? "Edit Predict" : "Predict"}
                                </button>
                              ) : (
                                <span className="text-[10px] text-stone-400 dark:text-stone-500 font-bold bg-stone-100 dark:bg-stone-800/50 px-2.5 py-1.5 rounded-xl border border-stone-200/50 dark:border-stone-800/50">
                                  Closed
                                </span>
                              )}
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
                                <div className="px-3 py-1 bg-stone-200 dark:bg-stone-800 rounded-lg font-black font-mono flex items-center gap-1 justify-center min-w-[4.5rem]">
                                  <AnimatedScore score={match.home_score} />
                                  <span className="text-stone-400 dark:text-stone-600 font-bold">-</span>
                                  <AnimatedScore score={match.away_score} />
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
                            ? "animate-live-border-pulse bg-rose-500/5" 
                            : "border-stone-200 dark:border-stone-800"
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-center mb-4">
                            <span className="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded text-[10px] font-bold">
                              {match.round}
                            </span>
                            {match.status === "LIVE" ? (
                              <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider animate-pulse-glow flex items-center gap-1.5 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-dot-pulse"></span> Live
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
                                <div className="px-3 py-1 bg-stone-100 dark:bg-stone-800 rounded-lg text-sm font-black font-mono flex items-center gap-1 justify-center min-w-[4rem]">
                                  <AnimatedScore score={match.home_score} />
                                  <span className="text-stone-400 dark:text-stone-600 font-bold">-</span>
                                  <AnimatedScore score={match.away_score} />
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
                            canPredictMatch(match) ? (
                              <button
                                onClick={() => handleOpenPredictModal(match)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer"
                              >
                                {hasPredicted ? "Edit" : "Predict"}
                              </button>
                            ) : (
                              <span className="text-[9px] text-amber-600 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded">
                                Predictions Closed (Too Early)
                              </span>
                            )
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

          {/* D3 LEAGUE TABLE VIEW */}
          {activeTab === "league-table" && (
            <D3LeagueTable standings={standings} />
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
                              <span className="px-1.5 py-0.5 bg-stone-200 dark:bg-stone-800 rounded font-black font-mono flex items-center gap-1 justify-center min-w-[3.5rem]">
                                {match.status === "FT" || match.status === "LIVE" ? (
                                  <>
                                    <AnimatedScore score={match.home_score} />
                                    <span className="text-stone-400 dark:text-stone-600 font-bold">-</span>
                                    <AnimatedScore score={match.away_score} />
                                  </>
                                ) : (
                                  "VS"
                                )}
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
                    {stats && stats.scoredPredictionsCount > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Correct", value: stats.correctPredictions },
                              { name: "Incorrect", value: stats.scoredPredictionsCount - stats.correctPredictions }
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
                      <p className="text-stone-550 text-xs dark:text-stone-450 text-center px-4 leading-relaxed font-semibold">No completed or scored match predictions available yet to chart accuracy ratio.</p>
                    )}
                  </div>
                  {stats && stats.scoredPredictionsCount > 0 && (
                    <div className="flex justify-center gap-6 mt-4 text-xs font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
                        <span>Correct ({stats.correctPredictions})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                        <span>Incorrect ({stats.scoredPredictionsCount - stats.correctPredictions})</span>
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                {/* Football Settings Panel */}
                <div className="bg-white dark:bg-stone-850 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-6 flex flex-col justify-between">
                  <div className="space-y-6">
                    <h3 className="text-sm font-black text-stone-900 dark:text-white border-b border-stone-100 dark:border-stone-800 pb-3 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-emerald-600" /> Football Settings
                    </h3>

                    <form onSubmit={handleSaveSettings} className="space-y-4" autoComplete="off">
                      {/* Dummy inputs to capture browser autocomplete and prevent autofilling API credentials with admin email/password */}
                      <input type="text" name="dummy-username-autofill" style={{ display: 'none' }} autoComplete="new-username" />
                      <input type="password" name="dummy-password-autofill" style={{ display: 'none' }} autoComplete="new-password" />

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

                      {/* Inline Settings Error and Success Indicators */}
                      {settingsError && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-xl text-[11px] font-bold flex items-center gap-2 border border-rose-200 dark:border-rose-900">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
                          <span className="break-all">{settingsError}</span>
                        </div>
                      )}

                      {settingsSuccess && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-[11px] font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-900">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>{settingsSuccess}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={savingSettings}
                        className={`w-full py-2.5 font-black text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                          savingSettings 
                            ? "bg-emerald-700/50 text-stone-300 cursor-not-allowed animate-pulse" 
                            : settingsError 
                              ? "bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-500 ring-offset-2" 
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        }`}
                      >
                        {savingSettings ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving Settings...</span>
                          </>
                        ) : settingsError ? (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Retry Saving</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>Save Settings</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>

                {/* API Configuration Panel */}
                <div className="bg-white dark:bg-stone-850 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-6">
                  <h3 className="text-sm font-black text-stone-900 dark:text-white border-b border-stone-100 dark:border-stone-800 pb-3 flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-600" /> API Configuration
                  </h3>

                  <form onSubmit={handleSaveApiSettings} className="space-y-4" autoComplete="off">
                    {/* Dummy inputs to capture browser autocomplete and prevent autofilling API credentials with admin email/password */}
                    <input type="text" name="dummy-username-autofill" style={{ display: 'none' }} autoComplete="new-username" />
                    <input type="password" name="dummy-password-autofill" style={{ display: 'none' }} autoComplete="new-password" />

                    <div className="space-y-3 h-96 overflow-y-auto pr-1 scrollbar-thin">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                          ⚽ API-Football URL
                        </label>
                        <input
                          type="text"
                          name="apiFootballUrl"
                          id="apiFootballUrl"
                          autoComplete="off"
                          value={settings.apiFootballUrl || ""}
                          onChange={(e) => setSettings(prev => ({ ...prev, apiFootballUrl: e.target.value }))}
                          placeholder="https://v3.football.api-sports.io"
                          className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                          ⚽ API-Football Key
                        </label>
                        <input
                          type="password"
                          name="apiFootballKey"
                          id="apiFootballKey"
                          autoComplete="new-password"
                          value={settings.apiFootballKey || ""}
                          onChange={(e) => setSettings(prev => ({ ...prev, apiFootballKey: e.target.value }))}
                          placeholder="Enter API-Football Key"
                          className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                          📊 Football-Data.org Host URL
                        </label>
                        <input
                          type="text"
                          name="footballDataHost"
                          id="footballDataHost"
                          autoComplete="off"
                          value={settings.footballDataHost || ""}
                          onChange={(e) => setSettings(prev => ({ ...prev, footballDataHost: e.target.value }))}
                          placeholder="https://api.football-data.org/v4"
                          className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                          📊 Football-Data.org Key
                        </label>
                        <input
                          type="password"
                          name="footballDataKey"
                          id="footballDataKey"
                          autoComplete="new-password"
                          value={settings.footballDataKey || ""}
                          onChange={(e) => setSettings(prev => ({ ...prev, footballDataKey: e.target.value }))}
                          placeholder="Enter Football-Data.org Key"
                          className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                          🏆 TheSportsDB Host URL
                        </label>
                        <input
                          type="text"
                          name="theSportsDbHost"
                          id="theSportsDbHost"
                          autoComplete="off"
                          value={settings.theSportsDbHost || ""}
                          onChange={(e) => setSettings(prev => ({ ...prev, theSportsDbHost: e.target.value }))}
                          placeholder="https://www.thesportsdb.com/api/v1/json"
                          className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                          🏆 TheSportsDB Key
                        </label>
                        <input
                          type="password"
                          name="theSportsDbKey"
                          id="theSportsDbKey"
                          autoComplete="new-password"
                          value={settings.theSportsDbKey || ""}
                          onChange={(e) => setSettings(prev => ({ ...prev, theSportsDbKey: e.target.value }))}
                          placeholder="Enter TheSportsDB Key"
                          className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Inline API Settings Error and Success Indicators */}
                    {apiSettingsError && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-xl text-[11px] font-bold flex items-center gap-2 border border-rose-200 dark:border-rose-900">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
                        <span className="break-all">{apiSettingsError}</span>
                      </div>
                    )}

                    {apiSettingsSuccess && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-[11px] font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-900">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>{apiSettingsSuccess}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={savingApiSettings}
                      className={`w-full py-2.5 font-black text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                        savingApiSettings 
                          ? "bg-emerald-700/50 text-stone-300 cursor-not-allowed animate-pulse" 
                          : apiSettingsError 
                            ? "bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-500 ring-offset-2" 
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                    >
                      {savingApiSettings ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Updating api_configs...</span>
                        </>
                      ) : apiSettingsError ? (
                        <>
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Retry Saving API Config</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save API Configs</span>
                        </>
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

              {/* Football API Multi-Provider Debug Panel */}
              <div className="bg-white dark:bg-stone-850 p-6 rounded-3xl border border-stone-200 dark:border-stone-800 space-y-4 mt-8">
                <h3 className="text-sm font-black text-stone-900 dark:text-white border-b border-stone-100 dark:border-stone-800 pb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-600 animate-pulse" /> Football API Debug & Multi-Provider Health
                  </span>
                  {providerStatus && (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold uppercase text-[9px]">
                      Active Provider: {providerStatus.activeProvider}
                    </span>
                  )}
                </h3>

                <p className="text-xs text-stone-500">
                  The Football Prediction Engine utilizes an intelligent Service Layer that automatically cycles through multiple global APIs when rate limits are exceeded, subscription errors occur, or requests fail.
                </p>

                {providerStatus ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    {Object.entries(providerStatus.providers || {})
                      .map(([pName, pInfo]: [string, any]) => {
                        const isCurrentlyActive = providerStatus.activeProvider === pName;
                        const hasKey = pName === "API-Football" ? providerStatus.hasApiKey : pName === "Football-Data.org" ? providerStatus.hasFdKey : providerStatus.hasTsdbKey;
                      
                      return (
                        <div key={pName} className={`p-5 rounded-2xl border transition flex flex-col justify-between ${
                          isCurrentlyActive 
                            ? "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-500/30" 
                            : "bg-stone-50/50 dark:bg-stone-900/30 border-stone-150 dark:border-stone-800"
                        }`}>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-black text-stone-900 dark:text-white flex items-center gap-1.5">
                                {pName}
                                {isCurrentlyActive && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                )}
                              </h4>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                pInfo.status === "Healthy"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                  : pInfo.status === "Degraded"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                              }`}>
                                {pInfo.status}
                              </span>
                            </div>

                            <div className="space-y-1.5 text-[10px]">
                              <div className="flex justify-between">
                                <span className="text-stone-400">API URL:</span>
                                <span className="font-mono text-stone-600 dark:text-stone-300 truncate max-w-[120px]">{pInfo.apiUrl}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-stone-400">API Key:</span>
                                <span className={hasKey ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-stone-400 font-medium"}>
                                  {hasKey ? "✓ Configured" : "✗ Not Set"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-stone-400">Latency:</span>
                                <span className="font-mono text-stone-700 dark:text-stone-200">{pInfo.latency}ms</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-stone-400">Requests Remaining:</span>
                                <span className="font-mono font-bold text-stone-800 dark:text-stone-100">{pInfo.remainingRequests}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-stone-400">Tier:</span>
                                <span className="text-stone-600 dark:text-stone-300">{pInfo.subscription}</span>
                              </div>
                            </div>
                          </div>

                          {pInfo.lastError && (
                            <div className="mt-3 p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-lg text-[9px] font-mono leading-tight border border-rose-100 dark:border-rose-900/30">
                              Error: {pInfo.lastError}
                            </div>
                          )}

                          {isCurrentlyActive && (
                            <div className="mt-3 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-100/40 dark:bg-emerald-950/30 px-2 py-1 rounded-lg">
                              <ShieldCheck className="w-3.5 h-3.5" /> Core provider delivering live matches
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500 py-4 text-center">Loading provider statuses...</p>
                )}
              </div>

              {/* System Audit Logs Panel */}
              <div className="bg-white dark:bg-stone-850 p-6 rounded-3xl border border-stone-200 dark:border-stone-800 space-y-4 mt-8">
                <h3 className="text-sm font-black text-stone-900 dark:text-white border-b border-stone-100 dark:border-stone-800 pb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <List className="w-4 h-4 text-emerald-600" /> System Audit Logs
                  </span>
                  <span className="text-[10px] text-stone-500 font-bold uppercase">
                    Latest {systemLogs.length} Events
                  </span>
                </h3>
                
                {systemLogs.length === 0 ? (
                  <p className="text-xs text-stone-500 py-10 text-center">No synchronization or operation logs accumulated yet.</p>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                    {systemLogs.map((log, idx) => (
                      <div key={idx} className="p-4 bg-stone-50 dark:bg-stone-900/40 rounded-2xl border border-stone-150 dark:border-stone-800 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-stone-400 font-bold">
                            {formatToISTDate(log.timestamp)} {formatToISTTime(log.timestamp)}
                          </span>
                          <span className={`px-2 py-0.5 rounded font-black uppercase text-[8px] ${
                            log.type === "sync" || log.type === "sync_check"
                              ? "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400"
                              : log.type === "settings_update"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                          }`}>
                            {log.type}
                          </span>
                        </div>
                        <pre className="font-mono text-xs text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">
                          {log.message}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
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

        {/* Custom Reset Database Confirmation Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-stone-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in">
            <div className="bg-white dark:bg-stone-900 border border-stone-150 dark:border-stone-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-scale-up space-y-4 text-center">
              <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/30 text-rose-500 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-100/30 dark:border-rose-900/30">
                <AlertCircle className="w-7 h-7 animate-pulse" />
              </div>
              
              <div className="space-y-1.5">
                <h3 className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100 leading-tight">
                  Reset Football Database?
                </h3>
                <p className="text-xs sm:text-sm text-stone-550 dark:text-stone-400 leading-relaxed font-medium">
                  Are you absolutely sure you want to delete all predictions and reset match fixtures to initial states? This action cannot be undone.
                </p>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2.5 px-4 bg-stone-100 hover:bg-stone-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmResetData}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Yes, Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
