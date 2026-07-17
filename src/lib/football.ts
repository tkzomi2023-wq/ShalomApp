/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FootballMatch, FootballPrediction, LeaderboardEntry, StandingsGroup, FootballStats } from "../types/football";

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
  last_sync_time TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Safe upgrades for existing databases
ALTER TABLE public.football_predictions ADD COLUMN IF NOT EXISTS competition_id INTEGER;
ALTER TABLE public.football_predictions ADD COLUMN IF NOT EXISTS season TEXT;
ALTER TABLE public.football_predictions ADD COLUMN IF NOT EXISTS predicted_home_score INTEGER;
ALTER TABLE public.football_predictions ADD COLUMN IF NOT EXISTS predicted_away_score INTEGER;

-- Enable Row Level Security (RLS)
ALTER TABLE public.football_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.football_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.football_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.football_configs ENABLE ROW LEVEL SECURITY;

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
async function safeJsonFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const resolvedUrl = resolveFootballUrl(url);
  
  // Send diagnostics log to backend (non-blocking, skip if logging itself)
  if (typeof window !== "undefined" && url !== "/api/client-log") {
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
    if (typeof window !== "undefined" && url !== "/api/client-log") {
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
    return safeJsonFetch<ApiStatus>("/api/football/api-status");
  },

  // 2. Get Matches (hydrated with teams)
  async getMatches(): Promise<FootballMatch[]> {
    return safeJsonFetch<FootballMatch[]>("/api/football/matches");
  },

  // 3. Get predictions made by user
  async getUserPredictions(userId: string): Promise<FootballPrediction[]> {
    return safeJsonFetch<FootballPrediction[]>(`/api/football/predictions?userId=${encodeURIComponent(userId)}`);
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
    return safeJsonFetch<{ success: boolean; message: string }>("/api/football/predict", {
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
  },

  // 5. Get dynamic leaderboard
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return safeJsonFetch<LeaderboardEntry[]>("/api/football/leaderboard");
  },

  // 6. Get standing groups
  async getStandings(): Promise<StandingsGroup[]> {
    return safeJsonFetch<StandingsGroup[]>("/api/football/standings");
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
    return safeJsonFetch<{ success: boolean; message: string; count: number }>("/api/football/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterEmail })
    });
  },

  // 9. Reset database to seeded bracket (Admin only)
  async resetFootball(requesterEmail: string): Promise<{ success: boolean; message: string }> {
    return safeJsonFetch<{ success: boolean; message: string }>("/api/football/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterEmail })
    });
  },

  // 10. Get football configuration settings
  async getSettings(requesterEmail?: string): Promise<{ competitionId: number; competitionName: string; season: string; syncInterval: number; lastSyncTime?: string; apiFootballKey?: string; apiFootballUrl?: string; footballDataKey?: string }> {
    const url = requesterEmail ? `/api/football/settings?requesterEmail=${encodeURIComponent(requesterEmail)}` : "/api/football/settings";
    return safeJsonFetch<{ competitionId: number; competitionName: string; season: string; syncInterval: number; lastSyncTime?: string; apiFootballKey?: string; apiFootballUrl?: string; footballDataKey?: string }>(url);
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
    footballDataKey?: string
  ): Promise<{ success: boolean; message: string }> {
    return safeJsonFetch<{ success: boolean; message: string }>("/api/football/settings", {
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
        footballDataKey
      })
    });
  },

  // 12. Get system synchronizer logs (Admin only)
  async getLogs(requesterEmail: string): Promise<{ timestamp: string; type: string; message: string }[]> {
    return safeJsonFetch<{ timestamp: string; type: string; message: string }[]>(`/api/football/logs?requesterEmail=${encodeURIComponent(requesterEmail)}`);
  },

  // 13. Get detailed provider health status and configs
  async getProviderStatus(): Promise<any> {
    return safeJsonFetch<any>("/api/football/provider-status");
  }
};
