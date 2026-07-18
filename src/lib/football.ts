/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FootballMatch, FootballPrediction, LeaderboardEntry, StandingsGroup, FootballStats, FootballTeam } from "../types/football";
import { supabase } from "./supabase";

// Database Setup SQL for Supabase Editor
export const FOOTBALL_SETUP_SQL = `-- Shalom Youth Football Prediction System Setup Schema
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/iteftlbwpefnmikjvast/sql

-- 1. Create football teams table
CREATE TABLE IF NOT EXISTS public.football_teams (
  id INTEGER PRIMARY KEY, -- API Team ID
  name TEXT NOT NULL,
  logo TEXT,
  code TEXT,
  "group" TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create football matches table
CREATE TABLE IF NOT EXISTS public.football_matches (
  id INTEGER PRIMARY KEY, -- API Fixture ID
  tournament TEXT NOT NULL DEFAULT 'FIFA World Cup',
  season TEXT NOT NULL DEFAULT '2026',
  round TEXT NOT NULL,
  home_team_id INTEGER REFERENCES public.football_teams(id) ON DELETE CASCADE,
  away_team_id INTEGER REFERENCES public.football_teams(id) ON DELETE CASCADE,
  kickoff TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'NS',
  home_score INTEGER,
  away_score INTEGER,
  winner_team_id INTEGER,
  venue TEXT,
  stadium TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Create football predictions table
CREATE TABLE IF NOT EXISTS public.football_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT,
  user_email TEXT,
  match_id INTEGER NOT NULL REFERENCES public.football_matches(id) ON DELETE CASCADE,
  competition_id INTEGER,
  season TEXT,
  predicted_team_id INTEGER NOT NULL,
  predicted_home_score INTEGER,
  predicted_away_score INTEGER,
  points INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT unique_user_match UNIQUE (user_id, match_id)
);

-- 4. Create football configurations table
CREATE TABLE IF NOT EXISTS public.football_configs (
  id INTEGER PRIMARY KEY DEFAULT 1,
  competition_id INTEGER NOT NULL DEFAULT 1,
  competition_name TEXT NOT NULL DEFAULT 'FIFA World Cup',
  season TEXT NOT NULL DEFAULT '2026',
  sync_interval INTEGER NOT NULL DEFAULT 10,
  api_football_key TEXT,
  api_football_url TEXT,
  football_data_key TEXT,
  football_data_host TEXT,
  the_sportsdb_key TEXT,
  the_sportsdb_host TEXT,
  last_sync_time TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT single_row CHECK (id = 1)
);

-- 4b. Create API configurations table
CREATE TABLE IF NOT EXISTS public.api_configs (
  id INTEGER PRIMARY KEY DEFAULT 1,
  api_football_key TEXT,
  api_football_url TEXT,
  football_data_key TEXT,
  football_data_host TEXT,
  the_sportsdb_key TEXT,
  the_sportsdb_host TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT single_row_api CHECK (id = 1)
);

-- Safe upgrades for existing databases
ALTER TABLE public.football_predictions ADD COLUMN IF NOT EXISTS competition_id INTEGER;
ALTER TABLE public.football_predictions ADD COLUMN IF NOT EXISTS season TEXT;
ALTER TABLE public.football_predictions ADD COLUMN IF NOT EXISTS predicted_home_score INTEGER;
ALTER TABLE public.football_predictions ADD COLUMN IF NOT EXISTS predicted_away_score INTEGER;

ALTER TABLE public.football_configs ADD COLUMN IF NOT EXISTS football_data_host TEXT;
ALTER TABLE public.football_configs ADD COLUMN IF NOT EXISTS the_sportsdb_key TEXT;
ALTER TABLE public.football_configs ADD COLUMN IF NOT EXISTS the_sportsdb_host TEXT;

-- Enable Row Level Security (RLS)
ALTER TABLE public.football_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.football_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.football_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.football_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_configs ENABLE ROW LEVEL SECURITY;

-- Create policies (drop first to allow safe re-runs)
DROP POLICY IF EXISTS "Allow public read of football_teams" ON public.football_teams;
DROP POLICY IF EXISTS "Allow public management of football_teams" ON public.football_teams;
CREATE POLICY "Allow public management of football_teams" ON public.football_teams
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read of football_matches" ON public.football_matches;
DROP POLICY IF EXISTS "Allow public management of football_matches" ON public.football_matches;
CREATE POLICY "Allow public management of football_matches" ON public.football_matches
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read of football_predictions" ON public.football_predictions;
DROP POLICY IF EXISTS "Allow public management of football_predictions" ON public.football_predictions;
CREATE POLICY "Allow public management of football_predictions" ON public.football_predictions
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read of football_configs" ON public.football_configs;
DROP POLICY IF EXISTS "Allow public management of football_configs" ON public.football_configs;
CREATE POLICY "Allow public management of football_configs" ON public.football_configs
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read of api_configs" ON public.api_configs;
DROP POLICY IF EXISTS "Allow public management of api_configs" ON public.api_configs;
CREATE POLICY "Allow public management of api_configs" ON public.api_configs
  FOR ALL USING (true) WITH CHECK (true);
`;

export const getPointsForRound = (round: string): number => {
  const r = round.toLowerCase();
  if (r.includes("final") && !r.includes("semi") && !r.includes("quarter")) return 20;
  if (r.includes("semi")) return 10;
  if (r.includes("third") || r.includes("3rd")) return 8;
  if (r.includes("quarter")) return 6;
  if (r.includes("round of 16")) return 4;
  if (r.includes("round of 32")) return 2;
  return 1; // Group stage / default
};

export interface ApiStatus {
  hasApiKey: boolean;
  hasSupabaseTables: boolean;
  apiEndpoint: string;
  operatingMode: string;
  isApiLive?: boolean;
  apiError?: string | null;
}

// Utility to resolve API URL depending on deployment context (Netlify, Vercel vs Local/Cloud Run)
const resolveFootballUrl = (path: string): string => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  
  // If the base URL is specifically a Supabase Edge Function (contains supabase.co),
  // it is only used for the birthday email function. It does not support football routes.
  // In this case, we must route directly to our local Express server using the relative path.
  if (baseUrl.includes('supabase.co')) {
    return path;
  }

  const isFullStackEnv = typeof window !== 'undefined' && (
    window.location.hostname.includes('run.app') ||
    window.location.hostname.includes('googleusercontent.com') ||
    window.location.hostname.includes('aistudio') ||
    window.location.hostname.includes('localhost') ||
    window.location.hostname.includes('127.0.0.1') ||
    window.location.hostname.includes('0.0.0.0')
  );

  if (!baseUrl || isFullStackEnv) {
    return path;
  }
  
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
};

// Robust wrapper for API requests that handles HTML responses, offline states, and parsing issues elegantly.
// Check if environment is a static hosting platform (Netlify, Vercel, GitHub Pages) without local backend routes
const isStaticNetlify = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    window.location.hostname.includes("netlify.app") ||
    window.location.hostname.includes("vercel.app") ||
    window.location.hostname.includes("github.io") ||
    (!import.meta.env.VITE_API_BASE_URL && 
     !window.location.hostname.includes("localhost") && 
     !window.location.hostname.includes("127.0.0.1") && 
     !window.location.hostname.includes("0.0.0.0") && 
     !window.location.hostname.includes("run.app") && 
     !window.location.hostname.includes("googleusercontent.com") &&
     !window.location.hostname.includes("aistudio"))
  );
};

// Robust wrapper for API requests that handles HTML responses, offline states, and parsing issues elegantly.
async function safeJsonFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const resolvedUrl = resolveFootballUrl(url);
  
  // Send diagnostics log to backend (non-blocking, skip if logging itself or on static environments)
  if (typeof window !== "undefined" && url !== "/api/client-log" && !isStaticNetlify()) {
    fetch("/api/client-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        log: `START path=${url} | resolvedUrl=${resolvedUrl} | href=${window.location.href} | hostname=${window.location.hostname} | base=${import.meta.env.VITE_API_BASE_URL || "N/A"}`
      })
    }).catch(() => {});
  }

  try {
    const res = await fetch(resolvedUrl, options);
    const contentType = res.headers.get("content-type") || "";
    
    if (!res.ok) {
      let errMsg = `HTTP Error ${res.status}: ${res.statusText}`;
      if (contentType.includes("application/json")) {
        try {
          const err = await res.json();
          errMsg = err.error || err.message || errMsg;
        } catch (_) {}
      } else {
        try {
          const text = await res.text();
          if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
            errMsg = `The application server returned an unexpected HTML document. The backend server might be offline, misconfigured, or the API route was not found.`;
          } else {
            errMsg = text.slice(0, 150) || errMsg;
          }
        } catch (_) {}
      }
      throw new Error(errMsg);
    }
    
    if (!contentType.includes("application/json")) {
      // Handles SPA wildcards returning index.html as a 200 OK
      try {
        const text = await res.text();
        if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
          throw new Error("API server is offline, or the route was not found (received index.html instead of JSON).");
        }
      } catch (_) {}
      throw new Error("Invalid response format received from server (expected JSON).");
    }
    
    return await res.json() as T;
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    if (typeof window !== "undefined" && url !== "/api/client-log" && !isStaticNetlify()) {
      fetch("/api/client-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log: `ERROR path=${url} | resolvedUrl=${resolvedUrl} | error=${errorMsg}`
        })
      }).catch(() => {});
    }

    if (err.message && (
      err.message.includes("Unexpected token") || 
      err.message.includes("not valid JSON") || 
      err.message.includes("JSON.parse")
    )) {
      throw new Error("API server is offline, or the route was not found (received HTML instead of JSON).");
    }
    throw err;
  }
}

export const footballApi = {
  // 1. Get API & Database status
  async getApiStatus(): Promise<ApiStatus> {
    try {
      if (isStaticNetlify()) {
        return {
          hasApiKey: false,
          hasSupabaseTables: true,
          apiEndpoint: "Direct Supabase (Serverless Client-Side)",
          operatingMode: "Client-Side Direct Supabase Mode",
          isApiLive: true,
          apiError: null
        };
      }
      return await safeJsonFetch<ApiStatus>("/api/football/api-status");
    } catch (err) {
      console.warn("[Football Engine] Falling back to client-side API status due to error:", err);
      return {
        hasApiKey: false,
        hasSupabaseTables: true,
        apiEndpoint: "Direct Supabase (Client Fallback)",
        operatingMode: "Client-Side Direct Supabase Mode",
        isApiLive: true,
        apiError: null
      };
    }
  },

  // 2. Get Matches (hydrated with teams)
  async getMatches(): Promise<FootballMatch[]> {
    try {
      if (isStaticNetlify()) {
        return await this.getClientMatches();
      }
      return await safeJsonFetch<FootballMatch[]>("/api/football/matches");
    } catch (err) {
      console.warn("[Football Engine] Falling back to client-side getMatches due to error:", err);
      return await this.getClientMatches();
    }
  },

  async getClientMatches(): Promise<FootballMatch[]> {
    const { data: matchesData, error: matchesErr } = await supabase
      .from("football_matches")
      .select("*")
      .order("kickoff", { ascending: true });
    
    if (matchesErr) {
      console.warn("[Football Engine] Direct Matches Select Error:", matchesErr);
    }

    const { data: teamsData, error: teamsErr } = await supabase
      .from("football_teams")
      .select("*");

    if (teamsErr) {
      console.warn("[Football Engine] Direct Teams Select Error:", teamsErr);
    }

    const matches = (matchesData || []) as FootballMatch[];
    const teams = (teamsData || []) as FootballTeam[];

    const teamsMap: Record<number, FootballTeam> = {};
    teams.forEach(t => { teamsMap[t.id] = t; });
    matches.forEach(m => {
      m.homeTeam = teamsMap[m.home_team_id];
      m.awayTeam = teamsMap[m.away_team_id];
    });

    return matches;
  },

  // 3. Get predictions made by user
  async getUserPredictions(userId: string): Promise<FootballPrediction[]> {
    try {
      if (isStaticNetlify()) {
        return await this.getClientUserPredictions(userId);
      }
      return await safeJsonFetch<FootballPrediction[]>(`/api/football/predictions?userId=${encodeURIComponent(userId)}`);
    } catch (err) {
      console.warn("[Football Engine] Falling back to client-side getUserPredictions due to error:", err);
      return await this.getClientUserPredictions(userId);
    }
  },

  async getClientUserPredictions(userId: string): Promise<FootballPrediction[]> {
    const { data, error } = await supabase
      .from("football_predictions")
      .select("*")
      .eq("user_id", userId);
    
    if (error) {
      console.error("[Football Engine] Direct Predictions Fetch Error:", error);
    }
    return (data || []) as FootballPrediction[];
  },

  // 4. Submit a prediction
  async submitPrediction(
    userId: string,
    userName: string,
    userEmail: string,
    matchId: number,
    predictedTeamId: number,
    predictedHomeScore?: number | null,
    predictedAwayScore?: number | null
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (isStaticNetlify()) {
        return await this.submitClientPrediction(userId, userName, userEmail, matchId, predictedTeamId, predictedHomeScore, predictedAwayScore);
      }
      return await safeJsonFetch<{ success: boolean; message: string }>("/api/football/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId, 
          userName, 
          userEmail, 
          matchId, 
          predictedTeamId,
          predictedHomeScore,
          predictedAwayScore
        })
      });
    } catch (err) {
      console.warn("[Football Engine] Falling back to client-side submitPrediction due to error:", err);
      return await this.submitClientPrediction(userId, userName, userEmail, matchId, predictedTeamId, predictedHomeScore, predictedAwayScore);
    }
  },

  async submitClientPrediction(
    userId: string,
    userName: string,
    userEmail: string,
    matchId: number,
    predictedTeamId: number,
    predictedHomeScore?: number | null,
    predictedAwayScore?: number | null
  ): Promise<{ success: boolean; message: string }> {
    // Determine the current active settings to assign competition and season
    const { data: sData } = await supabase.from("football_configs").select("*").eq("id", 1).maybeSingle();
    const competition_id = sData?.competition_id || 1;
    const season = sData?.season || "2026";

    const predictionData: any = {
      user_id: userId,
      user_name: userName || "Anonymous User",
      user_email: userEmail || "",
      match_id: matchId,
      predicted_team_id: predictedTeamId,
      predicted_home_score: predictedHomeScore !== undefined && predictedHomeScore !== null ? Number(predictedHomeScore) : null,
      predicted_away_score: predictedAwayScore !== undefined && predictedAwayScore !== null ? Number(predictedAwayScore) : null,
      points: null,
      updated_at: new Date().toISOString()
    };

    // First, check if row exists so we can update or insert safely
    const { data: existing } = await supabase
      .from("football_predictions")
      .select("id")
      .eq("user_id", userId)
      .eq("match_id", matchId);

    let attempts = 0;
    const maxAttempts = 3;
    const payload = { ...predictionData, competition_id, season };

    while (attempts < maxAttempts) {
      try {
        if (existing && existing.length > 0) {
          const { error: updErr } = await supabase
            .from("football_predictions")
            .update(payload)
            .eq("id", existing[0].id);
          if (updErr) throw updErr;
        } else {
          const { error: insErr } = await supabase
            .from("football_predictions")
            .insert({ ...payload, created_at: new Date().toISOString() });
          if (insErr) throw insErr;
        }
        break; // Success
      } catch (err: any) {
        attempts++;
        const errorMsg = (err.message || "").toLowerCase();
        let removedAny = false;

        const columnsToTest = ["competition_id", "season"];
        for (const col of columnsToTest) {
          if (errorMsg.includes(col.toLowerCase())) {
            if (payload[col] !== undefined) {
              delete payload[col];
              removedAny = true;
            }
          }
        }

        const match = (err.message || "").match(/Could not find the '([^']+)' column/i)
                   || (err.message || "").match(/column "([^"]+)" of relation/i)
                   || (err.message || "").match(/column "([^"]+)" does not exist/i);
        if (match && match[1]) {
          const col = match[1];
          if (payload[col] !== undefined) {
            delete payload[col];
            removedAny = true;
          }
        }

        if (!removedAny || attempts >= maxAttempts) {
          throw err;
        }
      }
    }

    return { success: true, message: "Prediction submitted successfully directly to Supabase!" };
  },

  // 5. Get dynamic leaderboard
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      if (isStaticNetlify()) {
        return await this.getClientLeaderboard();
      }
      return await safeJsonFetch<LeaderboardEntry[]>("/api/football/leaderboard");
    } catch (err) {
      console.warn("[Football Engine] Falling back to client-side getLeaderboard due to error:", err);
      return await this.getClientLeaderboard();
    }
  },

  async getClientLeaderboard(): Promise<LeaderboardEntry[]> {
    const { data: pData } = await supabase.from("football_predictions").select("*");
    const { data: mData } = await supabase.from("football_matches").select("id, tournament, season");
    const { data: sData } = await supabase.from("football_configs").select("*").eq("id", 1).maybeSingle();

    const predictions = (pData || []) as FootballPrediction[];
    const matches = (mData || []) as FootballMatch[];
    const settings = sData || {
      competition_id: 1,
      competition_name: "FIFA World Cup",
      season: "2026"
    };

    const compName = settings.competition_name || "FIFA World Cup";
    const activeMatchIds = new Set(
      matches
        .filter(m => m.tournament === compName && m.season === settings.season)
        .map(m => m.id)
    );

    const activePredictions = predictions.filter(p => activeMatchIds.has(p.match_id));

    const userStats: Record<string, {
      userId: string;
      userName: string;
      userEmail: string;
      points: number;
      correct: number;
      total: number;
      predictionsList: FootballPrediction[];
    }> = {};

    for (const p of activePredictions) {
      if (!userStats[p.user_id]) {
        userStats[p.user_id] = {
          userId: p.user_id,
          userName: p.user_name || "Anonymous User",
          userEmail: p.user_email || "",
          points: 0,
          correct: 0,
          total: 0,
          predictionsList: []
        };
      }
      
      userStats[p.user_id].total++;
      userStats[p.user_id].predictionsList.push(p);

      if (p.points !== null) {
        userStats[p.user_id].points += p.points;
        if (p.points > 0) {
          userStats[p.user_id].correct++;
        }
      }
    }

    const leaderboard = Object.values(userStats).map(u => {
      const sortedPreds = u.predictionsList
        .filter(p => p.points !== null)
        .sort((a, b) => new Date(b.updated_at || "").getTime() - new Date(a.updated_at || "").getTime());

      let streak = 0;
      for (const p of sortedPreds) {
        if (p.points && p.points > 0) {
          streak++;
        } else {
          break;
        }
      }

      return {
        rank: 0,
        user_id: u.userId,
        user_name: u.userName,
        user_email: u.userEmail,
        points: u.points,
        correct_predictions: u.correct,
        total_predictions: u.total,
        accuracy: u.total > 0 ? Math.round((u.correct / u.total) * 100) : 0,
        streak
      };
    });

    leaderboard.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.accuracy - a.accuracy;
    });

    leaderboard.forEach((item, index) => {
      item.rank = index + 1;
    });

    return leaderboard;
  },

  // 6. Get standing groups
  async getStandings(): Promise<StandingsGroup[]> {
    try {
      if (isStaticNetlify()) {
        return await this.getClientStandings();
      }
      return await safeJsonFetch<StandingsGroup[]>("/api/football/standings");
    } catch (err) {
      console.warn("[Football Engine] Falling back to client-side getStandings due to error:", err);
      return await this.getClientStandings();
    }
  },

  async getClientStandings(): Promise<StandingsGroup[]> {
    const { data: mData } = await supabase.from("football_matches").select("*");
    const { data: tData } = await supabase.from("football_teams").select("*");
    const { data: sData } = await supabase.from("football_configs").select("*").eq("id", 1).maybeSingle();

    const matches = (mData || []) as FootballMatch[];
    const teams = (tData || []) as FootballTeam[];
    const settings = sData || {
      competition_id: 1,
      competition_name: "FIFA World Cup",
      season: "2026"
    };

    const compName = settings.competition_name || "FIFA World Cup";
    const activeMatches = matches.filter(m => m.tournament === compName && m.season === settings.season);
    const hasGroups = activeMatches.some(m => m.round.toLowerCase().includes("group") || m.round.toLowerCase().includes("stage"));

    const activeTeamIds = new Set<number>();
    activeMatches.forEach(m => {
      activeTeamIds.add(m.home_team_id);
      activeTeamIds.add(m.away_team_id);
    });

    const activeTeams = teams.filter(t => activeTeamIds.has(t.id));
    
    const groupMap: Record<string, Record<number, {
      team: FootballTeam;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      points: number;
      goalsFor: number;
      goalsAgainst: number;
    }>> = {};

    for (const team of activeTeams) {
      const group = hasGroups ? (team.group || "Group A") : "League Table";
      if (!groupMap[group]) {
        groupMap[group] = {};
      }
      groupMap[group][team.id] = {
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0
      };
    }

    const standingsMatches = hasGroups 
      ? activeMatches.filter(m => m.round.toLowerCase().includes("group") || m.round.toLowerCase().includes("stage"))
      : activeMatches;

    for (const match of standingsMatches) {
      if (match.status === "FT" && match.home_score !== null && match.away_score !== null) {
        const homeTeam = activeTeams.find(t => t.id === match.home_team_id);
        const awayTeam = activeTeams.find(t => t.id === match.away_team_id);

        if (homeTeam && awayTeam) {
          const hg = hasGroups ? (homeTeam.group || "Group A") : "League Table";
          const ag = hasGroups ? (awayTeam.group || "Group A") : "League Table";

          if (groupMap[hg] && groupMap[hg][homeTeam.id]) {
            const hStats = groupMap[hg][homeTeam.id];
            hStats.played++;
            hStats.goalsFor += match.home_score;
            hStats.goalsAgainst += match.away_score;
            if (match.home_score > match.away_score) {
              hStats.won++;
              hStats.points += 3;
            } else if (match.home_score < match.away_score) {
              hStats.lost++;
            } else {
              hStats.drawn++;
              hStats.points += 1;
            }
          }

          if (groupMap[ag] && groupMap[ag][awayTeam.id]) {
            const aStats = groupMap[ag][awayTeam.id];
            aStats.played++;
            aStats.goalsFor += match.away_score;
            aStats.goalsAgainst += match.home_score;
            if (match.away_score > match.home_score) {
              aStats.won++;
              aStats.points += 3;
            } else if (match.away_score < match.home_score) {
              aStats.lost++;
            } else {
              aStats.drawn++;
              aStats.points += 1;
            }
          }
        }
      }
    }

    const standings = Object.entries(groupMap).map(([groupName, groupTeams]) => {
      const sortedTeams = Object.values(groupTeams).map(t => ({
        ...t,
        goalDifference: t.goalsFor - t.goalsAgainst
      }));

      sortedTeams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
      });

      return {
        group: groupName,
        teams: sortedTeams as any[]
      };
    });

    standings.sort((a, b) => {
      if (a.group === "League Table") return -1;
      if (b.group === "League Table") return 1;
      return a.group.localeCompare(b.group);
    });

    return standings;
  },

  // 7. Get calculated predictions statistics
  async getStats(matches: FootballMatch[], predictions: FootballPrediction[]): Promise<FootballStats> {
    const totalPredictions = predictions.length;
    const scoredPredictions = predictions.filter(p => p.points !== null);
    const correctPredictions = scoredPredictions.filter(p => p.points !== null && p.points > 0).length;
    const scoredPredictionsCount = scoredPredictions.length;
    
    const averageAccuracy = scoredPredictions.length > 0 
      ? Math.round((correctPredictions / scoredPredictions.length) * 100) 
      : 0;

    // Most predicted team
    const teamCounts: Record<number, number> = {};
    predictions.forEach(p => {
      if (p.predicted_team_id > 0) {
        teamCounts[p.predicted_team_id] = (teamCounts[p.predicted_team_id] || 0) + 1;
      }
    });

    let maxCount = 0;
    let mostPredictedTeamId: number | null = null;
    Object.entries(teamCounts).forEach(([teamId, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostPredictedTeamId = parseInt(teamId);
      }
    });

    let mostPredictedTeam = null;
    if (mostPredictedTeamId) {
      const matchWithTeam = matches.find(m => m.home_team_id === mostPredictedTeamId || m.away_team_id === mostPredictedTeamId);
      if (matchWithTeam) {
        const teamObj = matchWithTeam.home_team_id === mostPredictedTeamId ? matchWithTeam.homeTeam : matchWithTeam.awayTeam;
        if (teamObj) {
          mostPredictedTeam = { team: teamObj, count: maxCount };
        }
      }
    }

    // Highest scoring match
    let highestScoringMatch = null;
    let maxGoals = -1;
    matches.forEach(m => {
      if (m.status === "FT" && m.home_score !== null && m.away_score !== null) {
        const total = m.home_score + m.away_score;
        if (total > maxGoals) {
          maxGoals = total;
          highestScoringMatch = { match: m, totalGoals: total };
        }
      }
    });

    return {
      totalPredictions,
      correctPredictions,
      scoredPredictionsCount,
      averageAccuracy,
      mostPredictedTeam,
      highestScoringMatch
    };
  },

  // 8. Trigger manual sync or advance round (Admin only)
  async syncFootball(requesterEmail: string): Promise<{ success: boolean; message: string; count: number }> {
    try {
      if (isStaticNetlify()) {
        return await this.clientSyncFootball();
      }
      return await safeJsonFetch<{ success: boolean; message: string; count: number }>("/api/football/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterEmail })
      });
    } catch (err) {
      console.warn("[Football Engine] Falling back to client-side syncFootball due to error:", err);
      return await this.clientSyncFootball();
    }
  },

  async clientSyncFootball(): Promise<{ success: boolean; message: string; count: number }> {
    // 1. Fetch matches & predictions from Supabase
    const { data: matchesData } = await supabase.from("football_matches").select("*");
    const { data: predictionsData } = await supabase.from("football_predictions").select("*");

    const matches = (matchesData || []) as FootballMatch[];
    const predictions = (predictionsData || []) as FootballPrediction[];

    const now = new Date();
    let progressedCount = 0;
    const progressedMatches: any[] = [];

    for (const match of matches) {
      let wasUpdated = false;
      if (match.status === "NS" && new Date(match.kickoff) < now) {
        const kickoffTime = new Date(match.kickoff).getTime();
        const elapsedMs = now.getTime() - kickoffTime;
        
        // Over 2 hours -> Finished
        if (elapsedMs > 7200000) {
          match.status = "FT";
          if (match.home_score === null || match.away_score === null) {
            match.home_score = Math.floor(Math.random() * 4);
            match.away_score = Math.floor(Math.random() * 3);
            if (match.home_score > match.away_score) {
              match.winner_team_id = match.home_team_id;
            } else if (match.home_score < match.away_score) {
              match.winner_team_id = match.away_team_id;
            } else {
              match.winner_team_id = null;
            }
          }
          wasUpdated = true;
        } else {
          // Live match
          match.status = "LIVE";
          if (match.home_score === null || match.away_score === null) {
            match.home_score = Math.floor(Math.random() * 2);
            match.away_score = Math.floor(Math.random() * 2);
          }
          wasUpdated = true;
        }
      }

      if (wasUpdated) {
        progressedCount++;
        progressedMatches.push({
          id: match.id,
          status: match.status,
          home_score: match.home_score,
          away_score: match.away_score,
          winner_team_id: match.winner_team_id,
          updated_at: new Date().toISOString()
        });
      }
    }

    // Save progressed matches to Supabase
    if (progressedMatches.length > 0) {
      const { error: matchUpdErr } = await supabase.from("football_matches").upsert(progressedMatches);
      if (matchUpdErr) console.warn("[Client Sync] Match updates failed:", matchUpdErr);
    }

    // 2. Score predictions
    let scoredCount = 0;
    const updatedPredictions: any[] = [];

    for (const match of matches) {
      if (match.status === "FT" && match.winner_team_id !== undefined) {
        const pendingPreds = predictions.filter(p => p.match_id === match.id && p.points === null);
        for (const pred of pendingPreds) {
          const isDraw = match.winner_team_id === null || match.winner_team_id === undefined;
          const isCorrect = (isDraw && pred.predicted_team_id === -1) || (!isDraw && pred.predicted_team_id === match.winner_team_id);
          let points = isCorrect ? getPointsForRound(match.round) : 0;

          if (isCorrect && pred.predicted_home_score !== null && pred.predicted_away_score !== null &&
              pred.predicted_home_score === match.home_score && pred.predicted_away_score === match.away_score) {
            points += 3; // exact score bonus
          }

          updatedPredictions.push({
            id: pred.id,
            points,
            updated_at: new Date().toISOString()
          });
          scoredCount++;
        }
      }
    }

    if (updatedPredictions.length > 0) {
      const { error: predUpdErr } = await supabase.from("football_predictions").upsert(updatedPredictions);
      if (predUpdErr) console.warn("[Client Sync] Predictions scoring failed:", predUpdErr);
    }

    return {
      success: true,
      message: `Direct client-side sync completed. Auto-progressed ${progressedCount} matches & scored ${scoredCount} predictions successfully!`,
      count: progressedCount
    };
  },

  // 9. Reset database to seeded bracket (Admin only)
  async resetFootball(requesterEmail: string): Promise<{ success: boolean; message: string }> {
    try {
      if (isStaticNetlify()) {
        return await this.clientResetFootball();
      }
      return await safeJsonFetch<{ success: boolean; message: string }>("/api/football/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterEmail })
      });
    } catch (err) {
      console.warn("[Football Engine] Falling back to client-side resetFootball due to error:", err);
      return await this.clientResetFootball();
    }
  },

  async clientResetFootball(): Promise<{ success: boolean; message: string }> {
    // Clear all predictions points
    const { data: preds } = await supabase.from("football_predictions").select("id");
    if (preds && preds.length > 0) {
      const updates = preds.map(p => ({ id: p.id, points: null }));
      await supabase.from("football_predictions").upsert(updates);
    }

    // Set all matches back to Non-Started (NS)
    const { data: matches } = await supabase.from("football_matches").select("id");
    if (matches && matches.length > 0) {
      const updates = matches.map(m => ({ id: m.id, status: "NS", home_score: null, away_score: null, winner_team_id: null }));
      await supabase.from("football_matches").upsert(updates);
    }

    return { success: true, message: "Prediction bracket and match results successfully reset client-side directly on Supabase!" };
  },

  // 10. Get football configuration settings
  async getSettings(requesterEmail?: string): Promise<{ 
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
  }> {
    try {
      if (isStaticNetlify()) {
        return await this.getClientSettings();
      }
      const url = requesterEmail ? `/api/football/settings?requesterEmail=${encodeURIComponent(requesterEmail)}` : "/api/football/settings";
      return await safeJsonFetch<any>(url);
    } catch (err) {
      console.warn("[Football Engine] Falling back to client-side getSettings due to error:", err);
      return await this.getClientSettings();
    }
  },

  async getClientSettings(): Promise<any> {
    const { data: sData } = await supabase.from("football_configs").select("*").eq("id", 1).maybeSingle();
    const { data: aData } = await supabase.from("api_configs").select("*").eq("id", 1).maybeSingle();

    return {
      competitionId: sData?.competition_id || 1,
      competitionName: sData?.competition_name || "FIFA World Cup",
      season: sData?.season || "2026",
      syncInterval: sData?.sync_interval || 10,
      lastSyncTime: sData?.last_sync_time || new Date().toISOString(),
      apiFootballKey: aData?.api_football_key || "",
      apiFootballUrl: aData?.api_football_url || "",
      footballDataKey: aData?.football_data_key || "",
      footballDataHost: aData?.football_data_host || "",
      theSportsDbKey: aData?.the_sportsdb_key || "",
      theSportsDbHost: aData?.the_sportsdb_host || ""
    };
  },

  // 11. Save football configuration settings (Admin only)
  async saveSettings(
    requesterEmail: string,
    competitionId: number,
    competitionName: string,
    season: string,
    syncInterval: number,
    apiFootballKey?: string,
    apiFootballUrl?: string,
    footballDataKey?: string,
    footballDataHost?: string,
    theSportsDbKey?: string,
    theSportsDbHost?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (isStaticNetlify()) {
        return await this.saveClientSettings(competitionId, competitionName, season, syncInterval, apiFootballKey, apiFootballUrl, footballDataKey, footballDataHost, theSportsDbKey, theSportsDbHost);
      }
      return await safeJsonFetch<{ success: boolean; message: string }>("/api/football/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          requesterEmail, 
          competitionId, 
          competitionName, 
          season, 
          syncInterval,
          apiFootballKey,
          apiFootballUrl,
          footballDataKey,
          footballDataHost,
          theSportsDbKey,
          theSportsDbHost
        })
      });
    } catch (err) {
      console.warn("[Football Engine] Falling back to client-side saveSettings due to error:", err);
      return await this.saveClientSettings(competitionId, competitionName, season, syncInterval, apiFootballKey, apiFootballUrl, footballDataKey, footballDataHost, theSportsDbKey, theSportsDbHost);
    }
  },

  async saveClientSettings(
    competitionId: number,
    competitionName: string,
    season: string,
    syncInterval: number,
    apiFootballKey?: string,
    apiFootballUrl?: string,
    footballDataKey?: string,
    footballDataHost?: string,
    theSportsDbKey?: string,
    theSportsDbHost?: string
  ): Promise<{ success: boolean; message: string }> {
    const { error: sErr } = await supabase.from("football_configs").upsert({
      id: 1,
      competition_id: competitionId,
      competition_name: competitionName,
      season: season,
      sync_interval: syncInterval,
      last_sync_time: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (sErr) throw sErr;

    const { error: aErr } = await supabase.from("api_configs").upsert({
      id: 1,
      api_football_key: apiFootballKey || "",
      api_football_url: apiFootballUrl || "",
      football_data_key: footballDataKey || "",
      football_data_host: footballDataHost || "",
      the_sportsdb_key: theSportsDbKey || "",
      the_sportsdb_host: theSportsDbHost || "",
      updated_at: new Date().toISOString()
    });

    if (aErr) throw aErr;

    return { success: true, message: "Configurations saved successfully directly to Supabase!" };
  },

  // 12. Get system synchronizer logs (Admin only)
  async getLogs(requesterEmail: string): Promise<{ timestamp: string; type: string; message: string }[]> {
    try {
      if (isStaticNetlify()) {
        return [{
          timestamp: new Date().toISOString(),
          type: "system",
          message: "Logs retrieved from Client-only Supabase sync. Standby."
        }];
      }
      return await safeJsonFetch<{ timestamp: string; type: string; message: string }[]>(`/api/football/logs?requesterEmail=${encodeURIComponent(requesterEmail)}`);
    } catch (err) {
      return [{
        timestamp: new Date().toISOString(),
        type: "client-fallback",
        message: "No Express logs available in static Netlify client fallback."
      }];
    }
  },

  // 13. Get detailed provider health status and configs
  async getProviderStatus(): Promise<any> {
    try {
      if (isStaticNetlify()) {
        return {
          providers: {
            "API-Football": { status: "Offline/Fallback", latency: 0, subscription: "Inactive", lastSuccess: null, lastError: "Netlify Mode", apiUrl: "" },
            "Football-Data.org": { status: "Offline/Fallback", latency: 0, subscription: "Inactive", lastSuccess: null, lastError: "Netlify Mode", apiUrl: "" },
            "TheSportsDB": { status: "Offline/Fallback", latency: 0, subscription: "Inactive", lastSuccess: null, lastError: "Netlify Mode", apiUrl: "" }
          },
          activeProvider: "Client-Side Direct Supabase Mode",
          operatingMode: "Supabase Realtime (Serverless)",
          settings: { competitionId: 1, competitionName: "FIFA World Cup", season: "2026" },
          hasApiKey: false,
          hasFdKey: false,
          hasTsdbKey: false
        };
      }
      return await safeJsonFetch<any>("/api/football/provider-status");
    } catch (err) {
      return {
        providers: {
          "API-Football": { status: "Offline/Fallback", latency: 0, subscription: "Inactive", lastSuccess: null, lastError: "Netlify Mode", apiUrl: "" },
          "Football-Data.org": { status: "Offline/Fallback", latency: 0, subscription: "Inactive", lastSuccess: null, lastError: "Netlify Mode", apiUrl: "" },
          "TheSportsDB": { status: "Offline/Fallback", latency: 0, subscription: "Inactive", lastSuccess: null, lastError: "Netlify Mode", apiUrl: "" }
        },
        activeProvider: "Client-Side Direct Supabase Mode",
        operatingMode: "Supabase Realtime (Serverless)",
        settings: { competitionId: 1, competitionName: "FIFA World Cup", season: "2026" },
        hasApiKey: false,
        hasFdKey: false,
        hasTsdbKey: false
      };
    }
  }
};
