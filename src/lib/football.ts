/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FootballMatch, FootballPrediction, LeaderboardEntry, StandingsGroup, FootballStats, FootballTeam, MatchStatus } from "../types/football";
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

function getFootballDataOrgCode(id: number): string {
  switch (id) {
    case 1: return "WC";
    case 39: return "PL";
    case 2: return "CL";
    case 140: return "PD";
    case 78: return "BL1";
    case 135: return "SA";
    case 61: return "FL1";
    default: return "";
  }
}

function getTheSportsDbId(id: number): string {
  switch (id) {
    case 1: return "4429"; // FIFA World Cup
    case 39: return "4328"; // Premier League
    case 2: return "4480"; // Champions League
    case 140: return "4335"; // La Liga
    case 78: return "4331"; // Bundesliga
    case 135: return "4332"; // Serie A
    case 61: return "4334"; // Ligue 1
    default: return "";
  }
}

function getQuerySeason(season: string, compId: number): string {
  const match = season.match(/^(\d{4})/);
  return match ? match[1] : season;
}

function cleanRoundName(round: string): string {
  const r = round.toLowerCase();
  if (r.includes("group")) return "Group Stage";
  if (r.includes("16") || r.includes("sixteen")) return "Round of 16";
  if (r.includes("quarter")) return "Quarter-finals";
  if (r.includes("semi")) return "Semi-finals";
  if (r.includes("third") || r.includes("3rd")) return "Third Place Playoff";
  if (r.includes("final") && !r.includes("semi") && !r.includes("quarter")) return "Final";
  return round;
}

function mapFootballDataOrgMatches(fdMatches: any[], tournamentName: string, seasonName: string): { matches: FootballMatch[], teams: FootballTeam[] } {
  const matches: FootballMatch[] = [];
  const teamsMap: Record<number, FootballTeam> = {};

  for (const item of fdMatches) {
    if (!item.id || !item.homeTeam || !item.awayTeam) continue;

    const homeTeam: FootballTeam = {
      id: item.homeTeam.id,
      name: item.homeTeam.name || item.homeTeam.shortName || "TBD",
      logo: item.homeTeam.crest || "https://media.api-sports.io/football/teams/0.png",
      code: item.homeTeam.tla || item.homeTeam.name?.substring(0, 3).toUpperCase(),
      group: item.group || undefined
    };

    const awayTeam: FootballTeam = {
      id: item.awayTeam.id,
      name: item.awayTeam.name || item.awayTeam.shortName || "TBD",
      logo: item.awayTeam.crest || "https://media.api-sports.io/football/teams/0.png",
      code: item.awayTeam.tla || item.awayTeam.name?.substring(0, 3).toUpperCase(),
      group: item.group || undefined
    };

    teamsMap[homeTeam.id] = homeTeam;
    teamsMap[awayTeam.id] = awayTeam;

    let mappedStatus: MatchStatus = "NS";
    if (item.status === "FINISHED") mappedStatus = "FT";
    else if (item.status === "IN_PLAY" || item.status === "PAUSED") mappedStatus = "LIVE";
    else if (item.status === "POSTPONED") mappedStatus = "PST";
    else if (item.status === "CANCELLED") mappedStatus = "CANC";

    let winnerId: number | null = null;
    if (mappedStatus === "FT" && item.score && item.score.winner) {
      if (item.score.winner === "HOME_TEAM") winnerId = homeTeam.id;
      else if (item.score.winner === "AWAY_TEAM") winnerId = awayTeam.id;
    }

    matches.push({
      id: item.id,
      tournament: tournamentName,
      season: seasonName,
      round: cleanRoundName(item.stage || (item.matchday ? `Matchday ${item.matchday}` : "Regular Season")),
      home_team_id: homeTeam.id,
      away_team_id: awayTeam.id,
      kickoff: item.utcDate,
      status: mappedStatus,
      home_score: item.score?.fullTime?.home !== undefined ? item.score.fullTime.home : null,
      away_score: item.score?.fullTime?.away !== undefined ? item.score.fullTime.away : null,
      winner_team_id: winnerId,
      venue: item.venue || "TBD Stadium",
      stadium: item.venue || "TBD City"
    });
  }

  return { matches, teams: Object.values(teamsMap) };
}

function mapTheSportsDbMatches(tsdbEvents: any[], tournamentName: string, seasonName: string): { matches: FootballMatch[], teams: FootballTeam[] } {
  const matches: FootballMatch[] = [];
  const teamsMap: Record<number, FootballTeam> = {};

  for (const item of tsdbEvents) {
    const idEvent = Number(item.idEvent);
    const idHome = Number(item.idHomeTeam);
    const idAway = Number(item.idAwayTeam);
    if (!idEvent || !idHome || !idAway) continue;

    const homeTeam: FootballTeam = {
      id: idHome,
      name: item.strHomeTeam || "TBD",
      logo: item.strHomeTeamBadge || `https://www.thesportsdb.com/images/media/team/badge/small/${idHome}.png`,
      code: item.strHomeTeam?.substring(0, 3).toUpperCase(),
      group: item.strGroup || undefined
    };

    const awayTeam: FootballTeam = {
      id: idAway,
      name: item.strAwayTeam || "TBD",
      logo: item.strAwayTeamBadge || `https://www.thesportsdb.com/images/media/team/badge/small/${idAway}.png`,
      code: item.strAwayTeam?.substring(0, 3).toUpperCase(),
      group: item.strGroup || undefined
    };

    teamsMap[idHome] = homeTeam;
    teamsMap[idAway] = awayTeam;

    let mappedStatus: MatchStatus = "NS";
    if (item.strPostponed === "yes") mappedStatus = "PST";
    else if (item.intHomeScore !== null && item.intAwayScore !== null) {
      mappedStatus = "FT";
    }

    let winnerId: number | null = null;
    if (mappedStatus === "FT") {
      const hScore = Number(item.intHomeScore);
      const aScore = Number(item.intAwayScore);
      if (hScore > aScore) winnerId = idHome;
      else if (aScore > hScore) winnerId = idAway;
    }

    const kickoffStr = item.strTimestamp || (item.dateEvent && item.strTime ? `${item.dateEvent}T${item.strTime}` : new Date().toISOString());

    matches.push({
      id: idEvent,
      tournament: tournamentName,
      season: seasonName,
      round: cleanRoundName(item.strRound || "Regular Season"),
      home_team_id: idHome,
      away_team_id: idAway,
      kickoff: kickoffStr,
      status: mappedStatus,
      home_score: item.intHomeScore !== null ? Number(item.intHomeScore) : null,
      away_score: item.intAwayScore !== null ? Number(item.intAwayScore) : null,
      winner_team_id: winnerId,
      venue: item.strVenue || "TBD Stadium",
      stadium: item.strCity || "TBD City"
    });
  }

  return { matches, teams: Object.values(teamsMap) };
}

async function ensureBracketIntegrityClient(matches: FootballMatch[], settings: any): Promise<number> {
  const activeMatches = matches.filter((m: any) => m.tournament === settings.competitionName && m.season === settings.season);
  const sfs = activeMatches.filter((m: any) => m.round.toLowerCase().includes("semi"));
  const final = activeMatches.find((m: any) => m.round.toLowerCase() === "final" || m.round.toLowerCase().includes("grand final") || m.round.toLowerCase() === "finales");
  let thirdPlace = activeMatches.find((m: any) => m.round.toLowerCase().includes("third place") || m.round.toLowerCase().includes("3rd place") || m.round.toLowerCase().includes("3 place"));

  let syncCount = 0;
  const matchesToUpsert: FootballMatch[] = [];

  if (sfs.length === 2 && final) {
    const sfMatches = [...sfs].sort((a, b) => a.id - b.id);
    const sf1 = sfMatches[0];
    const sf2 = sfMatches[1];

    if (!thirdPlace) {
      console.log(`[Bracket Engine] Third Place Playoff is missing. Creating it dynamically...`);
      const finalKickoff = new Date(final.kickoff);
      const thirdPlaceKickoff = new Date(finalKickoff.getTime() - 24 * 60 * 60 * 1000).toISOString();
      
      thirdPlace = {
        id: final.id + 9999,
        tournament: settings.competitionName,
        season: settings.season,
        round: "Third Place Playoff",
        home_team_id: null,
        away_team_id: null,
        kickoff: thirdPlaceKickoff,
        status: "NS",
        home_score: null,
        away_score: null,
        winner_team_id: null,
        venue: final.venue || "TBD Stadium",
        stadium: final.stadium || "TBD City"
      };
      matchesToUpsert.push(thirdPlace);
      syncCount++;
    }

    const bothSemisFinished = sf1.status === "FT" && sf2.status === "FT";

    if (bothSemisFinished) {
      const winner1 = sf1.winner_team_id;
      const winner2 = sf2.winner_team_id;
      const loser1 = sf1.winner_team_id === sf1.home_team_id ? sf1.away_team_id : sf1.home_team_id;
      const loser2 = sf2.winner_team_id === sf2.home_team_id ? sf2.away_team_id : sf2.home_team_id;

      if (winner1 && winner2) {
        if (final.home_team_id !== winner1 || final.away_team_id !== winner2) {
          final.home_team_id = winner1;
          final.away_team_id = winner2;
          matchesToUpsert.push(final);
          syncCount++;
        }
        if (thirdPlace && (thirdPlace.home_team_id !== loser1 || thirdPlace.away_team_id !== loser2)) {
          thirdPlace.home_team_id = loser1;
          thirdPlace.away_team_id = loser2;
          matchesToUpsert.push(thirdPlace);
          syncCount++;
        }
      }
    } else {
      if (final.home_team_id !== null || final.away_team_id !== null) {
        final.home_team_id = null;
        final.away_team_id = null;
        matchesToUpsert.push(final);
        syncCount++;
      }
      if (thirdPlace && (thirdPlace.home_team_id !== null || thirdPlace.away_team_id !== null)) {
        thirdPlace.home_team_id = null;
        thirdPlace.away_team_id = null;
        matchesToUpsert.push(thirdPlace);
        syncCount++;
      }
    }
  }

  if (matchesToUpsert.length > 0) {
    try {
      await supabase.from("football_matches").upsert(matchesToUpsert);
    } catch (err) {
      console.error(`[Bracket Engine] Failed bulk upsert of matches to Supabase:`, err);
    }
  }

  return syncCount;
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
    const addClientLog = (type: string, message: string) => {
      let logs = [];
      const saved = localStorage.getItem("football_sync_logs_v2");
      if (saved) {
        try { logs = JSON.parse(saved); } catch (_) {}
      }
      if (!Array.isArray(logs)) logs = [];
      logs.unshift({
        timestamp: new Date().toISOString(),
        type,
        message
      });
      if (logs.length > 100) logs = logs.slice(0, 100);
      localStorage.setItem("football_sync_logs_v2", JSON.stringify(logs));
    };

    addClientLog("SYSTEM", "Initiating direct client-side multi-provider synchronisation...");

    // 1. Get configurations
    const settings = await this.getClientSettings();
    const compId = settings.competitionId;
    const compName = settings.competitionName;
    const season = settings.season;
    const querySeason = getQuerySeason(season, compId);

    const apiFootballKey = settings.apiFootballKey || "";
    const apiFootballUrl = settings.apiFootballUrl || "https://v3.football.api-sports.io";
    const footballDataKey = settings.footballDataKey || "";
    const footballDataHost = settings.footballDataHost || "https://api.football-data.org/v4";
    const theSportsDbKey = settings.theSportsDbKey || "3";
    const theSportsDbHost = settings.theSportsDbHost || "https://www.thesportsdb.com/api/v1/json";

    const hasApiKey = !!apiFootballKey && apiFootballKey !== "7bd67bdab71254a48036fa1eff71ed21" && apiFootballKey !== "7042e46eb559f59187b674889b0257d1";
    const hasFdKey = !!footballDataKey && footballDataKey !== "2a0cdc4facce4172818124d35506bc28";
    const hasTsdbKey = !!theSportsDbKey && theSportsDbKey !== "3";

    let fetchedMatches: FootballMatch[] = [];
    let fetchedTeams: FootballTeam[] = [];
    let successProvider = "";
    
    // We'll update this health states map in localStorage
    let healthStates: Record<string, any> = {
      "API-Football": { status: "Offline/Fallback", latency: 0, remainingRequests: 100, subscription: "Inactive", lastSuccess: null, lastError: "Key Not Set", apiUrl: apiFootballUrl },
      "Football-Data.org": { status: "Offline/Fallback", latency: 0, remainingRequests: 10, subscription: "Inactive", lastSuccess: null, lastError: "Key Not Set", apiUrl: footballDataHost },
      "TheSportsDB": { status: "Offline/Fallback", latency: 0, remainingRequests: 100, subscription: "Free/Public", lastSuccess: null, lastError: "Key Not Set", apiUrl: theSportsDbHost }
    };
    const savedHealth = localStorage.getItem("football_provider_health_v2");
    if (savedHealth) {
      try { healthStates = { ...healthStates, ...JSON.parse(savedHealth) }; } catch (e) {}
    }

    // ==========================================
    // PROVIDER 1: API-Football (Primary)
    // ==========================================
    if (hasApiKey) {
      const start = Date.now();
      try {
        addClientLog("API-FOOTBALL", `Connecting to API-Football: league ${compId}, season ${querySeason}...`);
        const apiHost = apiFootballUrl.match(/^https?:\/\/([^/]+)/)?.[1] || "v3.football.api-sports.io";
        
        const res = await fetch(`${apiFootballUrl}/fixtures?league=${compId}&season=${querySeason}`, {
          headers: {
            "x-apisports-key": apiFootballKey,
            "x-rapidapi-key": apiFootballKey,
            "x-apisports-host": apiHost
          }
        });

        const latency = Date.now() - start;
        healthStates["API-Football"].latency = latency;

        if (res.ok) {
          const payload = await res.json();
          if (payload.errors && Object.keys(payload.errors).length > 0) {
            const errMsg = JSON.stringify(payload.errors);
            addClientLog("API-FOOTBALL", `API returned subscription or access errors: ${errMsg}`);
            healthStates["API-Football"].status = "Degraded";
            healthStates["API-Football"].lastError = errMsg;
          } else if (payload.response && payload.response.length > 0) {
            const teamGroupsMap: Record<number, string> = {};
            try {
              const standingsRes = await fetch(`${apiFootballUrl}/standings?league=${compId}&season=${querySeason}`, {
                headers: {
                  "x-apisports-key": apiFootballKey,
                  "x-rapidapi-key": apiFootballKey,
                  "x-apisports-host": apiHost
                }
              });
              if (standingsRes.ok) {
                const standingsPayload = await standingsRes.json();
                if (standingsPayload.response && standingsPayload.response.length > 0) {
                  const leagueData = standingsPayload.response[0].league;
                  if (leagueData && Array.isArray(leagueData.standings)) {
                    for (const groupList of leagueData.standings) {
                      if (Array.isArray(groupList)) {
                        for (const entry of groupList) {
                          if (entry && entry.team && entry.team.id && entry.group) {
                            teamGroupsMap[entry.team.id] = entry.group;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } catch (stErr: any) {
              console.warn("API-Football standings fetch skipped:", stErr);
            }

            for (const item of payload.response) {
              const { fixture, league, teams: apiTeams, goals } = item;
              if (!fixture || !fixture.id || !fixture.date || !apiTeams || !apiTeams.home || !apiTeams.away) continue;

              const homeTeam: FootballTeam = {
                id: apiTeams.home.id,
                name: apiTeams.home.name,
                logo: apiTeams.home.logo,
                code: apiTeams.home.code || apiTeams.home.name.substring(0, 3).toUpperCase(),
                group: teamGroupsMap[apiTeams.home.id] || (league.round.includes("Group") ? league.round : undefined)
              };

              const awayTeam: FootballTeam = {
                id: apiTeams.away.id,
                name: apiTeams.away.name,
                logo: apiTeams.away.logo,
                code: apiTeams.away.code || apiTeams.away.name.substring(0, 3).toUpperCase(),
                group: teamGroupsMap[apiTeams.away.id] || (league.round.includes("Group") ? league.round : undefined)
              };

              if (!fetchedTeams.some(t => t.id === homeTeam.id)) fetchedTeams.push(homeTeam);
              if (!fetchedTeams.some(t => t.id === awayTeam.id)) fetchedTeams.push(awayTeam);

              let mappedStatus: MatchStatus = "NS";
              let homeScore: number | null = null;
              let awayScore: number | null = null;
              let winnerId: number | null = null;

              const shortStatus = fixture.status.short;
              if (["PST", "POSTPONED", "POST", "CANCELLED", "CANC", "ABD", "SUSP"].includes(shortStatus)) {
                mappedStatus = "PST";
              } else if (["FT", "AET", "PEN"].includes(shortStatus)) {
                mappedStatus = "FT";
                homeScore = goals.home;
                awayScore = goals.away;
                if (apiTeams.home.winner === true) winnerId = homeTeam.id;
                else if (apiTeams.away.winner === true) winnerId = awayTeam.id;
              } else if (["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(shortStatus)) {
                mappedStatus = "LIVE";
                homeScore = goals.home ?? 0;
                awayScore = goals.away ?? 0;
              }

              fetchedMatches.push({
                id: fixture.id,
                tournament: compName,
                season: season,
                round: cleanRoundName(league.round),
                home_team_id: homeTeam.id,
                away_team_id: awayTeam.id,
                kickoff: fixture.date,
                status: mappedStatus,
                home_score: homeScore,
                away_score: awayScore,
                winner_team_id: winnerId,
                venue: fixture.venue?.name || "TBD Stadium",
                stadium: fixture.venue?.city || "TBD City"
              });
            }

            if (fetchedMatches.length > 0) {
              successProvider = "API-Football";
              healthStates["API-Football"].status = "Healthy";
              healthStates["API-Football"].lastSuccess = new Date().toISOString();
              healthStates["API-Football"].lastError = null;
              healthStates["API-Football"].remainingRequests = Number(res.headers.get("x-ratelimit-requests-remaining") || "99");
              addClientLog("API-FOOTBALL", `Successfully synchronised ${fetchedMatches.length} matches & ${fetchedTeams.length} teams.`);
            }
          }
        } else {
          healthStates["API-Football"].status = "Failed";
          healthStates["API-Football"].lastError = `HTTP ${res.status}`;
          addClientLog("API-FOOTBALL", `Connection failed with status HTTP ${res.status}`);
        }
      } catch (err: any) {
        healthStates["API-Football"].status = "Failed";
        healthStates["API-Football"].lastError = err.message || String(err);
        addClientLog("API-FOOTBALL", `Fetch error: ${err.message || String(err)}`);
      }
    }

    // ==========================================
    // PROVIDER 2: Football-Data.org (Secondary)
    // ==========================================
    if (fetchedMatches.length === 0 && hasFdKey) {
      const start = Date.now();
      const fdCode = getFootballDataOrgCode(compId);
      try {
        if (fdCode) {
          addClientLog("FOOTBALL-DATA", `Connecting to Football-Data.org for competition code: ${fdCode}...`);
          const res = await fetch(`${footballDataHost}/competitions/${fdCode}/matches?season=${querySeason}`, {
            headers: {
              "X-Auth-Token": footballDataKey
            }
          });

          const latency = Date.now() - start;
          healthStates["Football-Data.org"].latency = latency;

          if (res.ok) {
            const payload = await res.json();
            if (payload.matches && payload.matches.length > 0) {
              const mapped = mapFootballDataOrgMatches(payload.matches, compName, season);
              fetchedMatches = mapped.matches;
              fetchedTeams = mapped.teams;

              successProvider = "Football-Data.org";
              healthStates["Football-Data.org"].status = "Healthy";
              healthStates["Football-Data.org"].lastSuccess = new Date().toISOString();
              healthStates["Football-Data.org"].lastError = null;
              healthStates["Football-Data.org"].remainingRequests = Number(res.headers.get("x-requests-remaining") || "9");
              addClientLog("FOOTBALL-DATA", `Successfully synchronised ${fetchedMatches.length} matches & ${fetchedTeams.length} teams.`);
            } else {
              healthStates["Football-Data.org"].status = "Degraded";
              healthStates["Football-Data.org"].lastError = "No matches returned for season";
              addClientLog("FOOTBALL-DATA", `Response empty: no matches returned for season ${querySeason}`);
            }
          } else {
            healthStates["Football-Data.org"].status = "Failed";
            healthStates["Football-Data.org"].lastError = `HTTP ${res.status}`;
            addClientLog("FOOTBALL-DATA", `Connection failed with status HTTP ${res.status}`);
          }
        }
      } catch (err: any) {
        healthStates["Football-Data.org"].status = "Failed";
        healthStates["Football-Data.org"].lastError = err.message || String(err);
        addClientLog("FOOTBALL-DATA", `Fetch error: ${err.message || String(err)}`);
      }
    }

    // ==========================================
    // PROVIDER 3: TheSportsDB (Tertiary)
    // ==========================================
    if (fetchedMatches.length === 0 && hasTsdbKey) {
      const start = Date.now();
      const tsdbId = getTheSportsDbId(compId);
      try {
        if (tsdbId) {
          addClientLog("THESPORTSDB", `Connecting to TheSportsDB for league ID: ${tsdbId}...`);
          const res = await fetch(`${theSportsDbHost}/${theSportsDbKey}/eventsseason.php?id=${tsdbId}&s=${querySeason}`);

          const latency = Date.now() - start;
          healthStates["TheSportsDB"].latency = latency;

          if (res.ok) {
            const payload = await res.json();
            if (payload.events && payload.events.length > 0) {
              const mapped = mapTheSportsDbMatches(payload.events, compName, season);
              fetchedMatches = mapped.matches;
              fetchedTeams = mapped.teams;

              successProvider = "TheSportsDB";
              healthStates["TheSportsDB"].status = "Healthy";
              healthStates["TheSportsDB"].lastSuccess = new Date().toISOString();
              healthStates["TheSportsDB"].lastError = null;
              addClientLog("THESPORTSDB", `Successfully synchronised ${fetchedMatches.length} matches & ${fetchedTeams.length} teams.`);
            } else {
              healthStates["TheSportsDB"].status = "Degraded";
              healthStates["TheSportsDB"].lastError = "No events returned";
              addClientLog("THESPORTSDB", `Response empty: no events found for season ${querySeason}`);
            }
          } else {
            healthStates["TheSportsDB"].status = "Failed";
            healthStates["TheSportsDB"].lastError = `HTTP ${res.status}`;
            addClientLog("THESPORTSDB", `Connection failed with status HTTP ${res.status}`);
          }
        }
      } catch (err: any) {
        healthStates["TheSportsDB"].status = "Failed";
        healthStates["TheSportsDB"].lastError = err.message || String(err);
        addClientLog("THESPORTSDB", `Fetch error: ${err.message || String(err)}`);
      }
    }

    // Save our updated healthStates to localStorage
    localStorage.setItem("football_provider_health_v2", JSON.stringify(healthStates));

    let processedCount = 0;

    if (fetchedMatches.length > 0) {
      addClientLog("SYSTEM", `Writing ${fetchedTeams.length} teams and ${fetchedMatches.length} matches to Supabase...`);
      
      // Upsert Teams
      if (fetchedTeams.length > 0) {
        const { error: teamErr } = await supabase.from("football_teams").upsert(fetchedTeams);
        if (teamErr) {
          addClientLog("SYSTEM", `Teams upsert failed: ${teamErr.message}`);
          console.warn("[Client Sync] Teams upsert error:", teamErr);
        }
      }

      // Clean old matches first
      const { error: delErr } = await supabase
        .from("football_matches")
        .delete()
        .eq("tournament", compName)
        .eq("season", season);
      
      if (delErr) {
        console.warn("[Client Sync] Failed to clear old matches:", delErr);
      }

      // Upsert Matches
      if (fetchedMatches.length > 0) {
        const { error: matchErr } = await supabase.from("football_matches").upsert(fetchedMatches);
        if (matchErr) {
          addClientLog("SYSTEM", `Matches upsert failed: ${matchErr.message}`);
          console.warn("[Client Sync] Matches upsert error:", matchErr);
        } else {
          processedCount = fetchedMatches.length;
        }
      }

      // Save sync state in settings table
      await supabase.from("football_configs").upsert({
        id: 1,
        competition_id: compId,
        competition_name: compName,
        season: season,
        last_sync_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      addClientLog("SYSTEM", `Database write finished. Advancing knockouts bracket integrity...`);
      await ensureBracketIntegrityClient(fetchedMatches, { competitionName: compName, season });

    } else {
      // Offline/fallback progression of matches
      addClientLog("SYSTEM", "No API keys configured or all providers offline. Running simulated progression of matches...");
      const simulatedResult = await this.clientSimulateProgression(compName, season);
      processedCount = simulatedResult.count;
      addClientLog("SYSTEM", simulatedResult.message);
    }

    // 2. Score predictions
    addClientLog("SYSTEM", "Synchronising and scoring predictions against latest match results...");
    const { data: latestMatches } = await supabase.from("football_matches").select("*").eq("tournament", compName).eq("season", season);
    const { data: predictions } = await supabase.from("football_predictions").select("*");

    let scoredCount = 0;
    const updatedPredictions: any[] = [];

    const matchesList = (latestMatches || []) as FootballMatch[];
    const predsList = (predictions || []) as FootballPrediction[];

    for (const match of matchesList) {
      if (match.status === "FT" && match.winner_team_id !== undefined) {
        const pendingPreds = predsList.filter(p => p.match_id === match.id && p.points === null);
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
      if (predUpdErr) {
        addClientLog("SYSTEM", `Predictions scoring save failed: ${predUpdErr.message}`);
        console.warn("[Client Sync] Predictions scoring failed:", predUpdErr);
      } else {
        addClientLog("SYSTEM", `Successfully graded ${scoredCount} predictions.`);
      }
    }

    addClientLog("SYSTEM", "Client-side sync successfully completed.");

    return {
      success: true,
      message: successProvider 
        ? `Successfully fetched ${processedCount} live fixtures from ${successProvider}, synchronised bracket, and graded ${scoredCount} predictions!`
        : `Direct client-side simulated sync completed. Auto-progressed ${processedCount} matches & scored ${scoredCount} predictions successfully!`,
      count: processedCount
    };
  },

  async clientSimulateProgression(compName: string, season: string): Promise<{ message: string, count: number }> {
    // Fetch matches
    const { data: matchesData } = await supabase.from("football_matches").select("*").eq("tournament", compName).eq("season", season);
    const matches = (matchesData || []) as FootballMatch[];

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

    if (progressedMatches.length > 0) {
      const { error: matchUpdErr } = await supabase.from("football_matches").upsert(progressedMatches);
      if (matchUpdErr) console.warn("[Client Sim] Match updates failed:", matchUpdErr);
    }

    return {
      message: `Simulated sync completed. Auto-progressed ${progressedCount} matches successfully!`,
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
      apiFootballKey: aData?.api_football_key || sData?.api_football_key || "",
      apiFootballUrl: aData?.api_football_url || sData?.api_football_url || "",
      footballDataKey: aData?.football_data_key || sData?.football_data_key || "",
      footballDataHost: aData?.football_data_host || sData?.football_data_host || "",
      theSportsDbKey: aData?.the_sportsdb_key || sData?.the_sportsdb_key || "",
      theSportsDbHost: aData?.the_sportsdb_host || sData?.the_sportsdb_host || ""
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
        return this.getClientLogs();
      }
      return await safeJsonFetch<{ timestamp: string; type: string; message: string }[]>(`/api/football/logs?requesterEmail=${encodeURIComponent(requesterEmail)}`);
    } catch (err) {
      return this.getClientLogs();
    }
  },

  async getClientLogs(): Promise<{ timestamp: string; type: string; message: string }[]> {
    const saved = localStorage.getItem("football_sync_logs_v2");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [{
      timestamp: new Date().toISOString(),
      type: "SYSTEM",
      message: "Direct Client-only Supabase sync. No previous execution logs found."
    }];
  },

  // 13. Get detailed provider health status and configs
  async getProviderStatus(): Promise<any> {
    try {
      if (isStaticNetlify()) {
        return await this.getClientProviderStatus();
      }
      return await safeJsonFetch<any>("/api/football/provider-status");
    } catch (err) {
      console.warn("Falling back to client-side provider status check:", err);
      return await this.getClientProviderStatus();
    }
  },

  async getClientProviderStatus(): Promise<any> {
    const settings = await this.getClientSettings();
    const apiFootballKey = settings.apiFootballKey || "";
    const apiFootballUrl = settings.apiFootballUrl || "https://v3.football.api-sports.io";
    const footballDataKey = settings.footballDataKey || "";
    const footballDataHost = settings.footballDataHost || "https://api.football-data.org/v4";
    const theSportsDbKey = settings.theSportsDbKey || "3";
    const theSportsDbHost = settings.theSportsDbHost || "https://www.thesportsdb.com/api/v1/json";

    const hasApiKey = !!apiFootballKey && apiFootballKey !== "7bd67bdab71254a48036fa1eff71ed21" && apiFootballKey !== "7042e46eb559f59187b674889b0257d1";
    const hasFdKey = !!footballDataKey && footballDataKey !== "2a0cdc4facce4172818124d35506bc28";
    const hasTsdbKey = !!theSportsDbKey && theSportsDbKey !== "3";

    let storedHealth = {
      "API-Football": {
        status: hasApiKey ? "Healthy" : "Offline/Fallback",
        latency: 0,
        remainingRequests: 100,
        subscription: hasApiKey ? "Active/Free" : "Inactive",
        lastSuccess: null,
        lastError: hasApiKey ? null : "Key Not Set",
        apiUrl: apiFootballUrl
      },
      "Football-Data.org": {
        status: hasFdKey ? "Healthy" : "Offline/Fallback",
        latency: 0,
        remainingRequests: 10,
        subscription: hasFdKey ? "Active/Free" : "Inactive",
        lastSuccess: null,
        lastError: hasFdKey ? null : "Key Not Set",
        apiUrl: footballDataHost
      },
      "TheSportsDB": {
        status: hasTsdbKey ? "Healthy" : "Offline/Fallback",
        latency: 0,
        remainingRequests: 100,
        subscription: hasTsdbKey ? "Free/Public" : "Inactive",
        lastSuccess: null,
        lastError: hasTsdbKey ? null : "Key Not Set",
        apiUrl: theSportsDbHost
      }
    };

    const saved = localStorage.getItem("football_provider_health_v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        storedHealth = { ...storedHealth, ...parsed };
      } catch (e) {}
    }

    storedHealth["API-Football"].apiUrl = apiFootballUrl;
    storedHealth["Football-Data.org"].apiUrl = footballDataHost;
    storedHealth["TheSportsDB"].apiUrl = theSportsDbHost;

    storedHealth["API-Football"].status = hasApiKey ? (storedHealth["API-Football"].status === "Offline/Fallback" ? "Healthy" : storedHealth["API-Football"].status) : "Offline/Fallback";
    storedHealth["Football-Data.org"].status = hasFdKey ? (storedHealth["Football-Data.org"].status === "Offline/Fallback" ? "Healthy" : storedHealth["Football-Data.org"].status) : "Offline/Fallback";
    storedHealth["TheSportsDB"].status = hasTsdbKey ? (storedHealth["TheSportsDB"].status === "Offline/Fallback" ? "Healthy" : storedHealth["TheSportsDB"].status) : "Offline/Fallback";

    storedHealth["API-Football"].subscription = hasApiKey ? "Active/Free" : "Inactive";
    storedHealth["Football-Data.org"].subscription = hasFdKey ? "Active/Free" : "Inactive";
    storedHealth["TheSportsDB"].subscription = hasTsdbKey ? "Free/Public" : "Inactive";

    let activeProvider = "Simulated Seed";
    if (hasApiKey) activeProvider = "API-Football";
    else if (hasFdKey) activeProvider = "Football-Data.org";
    else if (hasTsdbKey) activeProvider = "TheSportsDB";

    return {
      providers: storedHealth,
      activeProvider,
      operatingMode: "Client-Side Direct Supabase Mode",
      settings: {
        competitionId: settings.competitionId,
        competitionName: settings.competitionName,
        season: settings.season,
        activeProvider
      },
      hasApiKey,
      hasFdKey,
      hasTsdbKey
    };
  }
};
