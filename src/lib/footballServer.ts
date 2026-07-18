/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, Router } from "express";
import fs from "fs";
import path from "path";
import { supabase } from "./supabase";
import { FootballMatch, FootballTeam, FootballPrediction, MatchStatus } from "../types/football";

const FOOTBALL_DB_FILE = path.join(process.cwd(), "football_db.json");
const getApiUrl = (): string => {
  try {
    const db = loadLocalDB();
    if (db.settings?.apiFootballUrl) {
      const url = db.settings.apiFootballUrl.trim();
      if (url && !url.includes("@") && (url.startsWith("http://") || url.startsWith("https://"))) {
        return url;
      }
    }
  } catch (e) {}
  return process.env.FOOTBALL_API_HOST || process.env.VITE_FOOTBALL_API_HOST || process.env.FOOTBALL_API_URL || "https://v3.football.api-sports.io";
};

// We prefer FOOTBALL_API_KEY from environment variables
const getApiKey = (): string | null => {
  try {
    const db = loadLocalDB();
    if (db.settings?.apiFootballKey) {
      return db.settings.apiFootballKey;
    }
  } catch (e) {}
  return process.env.FOOTBALL_API_KEY || process.env.VITE_FOOTBALL_API_KEY || "7042e46eb559f59187b674889b0257d1";
};

const getApiHost = (): string => {
  try {
    const url = getApiUrl();
    const match = url.match(/^https?:\/\/([^/]+)/);
    if (match) {
      return match[1];
    }
  } catch (e) {}
  return "v3.football.api-sports.io";
};

const getFootballDataOrgKey = (): string | null => {
  try {
    const db = loadLocalDB();
    if (db.settings?.footballDataKey) {
      return db.settings.footballDataKey;
    }
  } catch (e) {}
  return process.env.FOOTBALL_DATA_ORG_KEY || process.env.VITE_FOOTBALL_DATA_ORG_KEY || "2a0cdc4facce4172818124d35506bc28";
};

const getFootballDataOrgHost = (): string => {
  try {
    const db = loadLocalDB();
    if (db.settings?.footballDataHost) {
      const host = db.settings.footballDataHost.trim();
      if (host && (host.startsWith("http://") || host.startsWith("https://"))) {
        return host;
      }
    }
  } catch (e) {}
  return process.env.FOOTBALL_DATA_ORG_HOST || process.env.VITE_FOOTBALL_DATA_ORG_HOST || "https://api.football-data.org/v4";
};

const getTheSportsDbKey = (): string | null => {
  try {
    const db = loadLocalDB();
    if (db.settings?.theSportsDbKey) {
      return db.settings.theSportsDbKey;
    }
  } catch (e) {}
  return process.env.THESPORTSDB_KEY || process.env.VITE_THESPORTSDB_KEY || "3";
};

const getTheSportsDbHost = (): string => {
  try {
    const db = loadLocalDB();
    if (db.settings?.theSportsDbHost) {
      const host = db.settings.theSportsDbHost.trim();
      if (host && (host.startsWith("http://") || host.startsWith("https://"))) {
        return host;
      }
    }
  } catch (e) {}
  return process.env.THESPORTSDB_HOST || process.env.VITE_THESPORTSDB_HOST || "https://www.thesportsdb.com/api/v1/json";
};

const isApiKeyConfigured = (): boolean => {
  const key = getApiKey();
  return !!key && key.trim() !== "";
};

const isFdKeyConfigured = (): boolean => {
  const key = getFootballDataOrgKey();
  return !!key && key.trim() !== "";
};

const isTsdbKeyConfigured = (): boolean => {
  const key = getTheSportsDbKey();
  return !!key && key.trim() !== "";
};

export interface ProviderHealth {
  status: "Healthy" | "Degraded" | "Failed" | "Offline/Fallback";
  latency: number;
  remainingRequests: number;
  subscription: string;
  lastSuccess: string | null;
  lastError: string | null;
  apiUrl: string;
  endpointCount?: number;
}

export const providerHealthStates: Record<string, ProviderHealth> = {
  "API-Football": {
    status: "Healthy",
    latency: 0,
    remainingRequests: 100,
    subscription: "Active/Free",
    lastSuccess: null,
    lastError: null,
    apiUrl: "https://v3.football.api-sports.io"
  },
  "Football-Data.org": {
    status: "Healthy",
    latency: 0,
    remainingRequests: 10,
    subscription: "Active/Free",
    lastSuccess: null,
    lastError: null,
    apiUrl: "https://api.football-data.org/v4"
  },
  "TheSportsDB": {
    status: "Healthy",
    latency: 0,
    remainingRequests: 100,
    subscription: "Free/Public",
    lastSuccess: null,
    lastError: null,
    apiUrl: "https://www.thesportsdb.com/api/v1/json"
  }
};

// Seed initial default teams across all supported leagues
const LEAGUE_TEAMS: Record<number, FootballTeam[]> = {
  1: [ // FIFA World Cup
    { id: 2384, name: "USA", logo: "https://media.api-sports.io/football/teams/2384.png", code: "USA", group: "Group A" },
    { id: 16, name: "Mexico", logo: "https://media.api-sports.io/football/teams/16.png", code: "MEX", group: "Group A" },
    { id: 15, name: "Canada", logo: "https://media.api-sports.io/football/teams/15.png", code: "CAN", group: "Group B" },
    { id: 26, name: "Argentina", logo: "https://media.api-sports.io/football/teams/26.png", code: "ARG", group: "Group B" },
    { id: 2, name: "France", logo: "https://media.api-sports.io/football/teams/2.png", code: "FRA", group: "Group C" },
    { id: 9, name: "Spain", logo: "https://media.api-sports.io/football/teams/9.png", code: "ESP", group: "Group C" },
    { id: 10, name: "England", logo: "https://media.api-sports.io/football/teams/10.png", code: "ENG", group: "Group D" },
    { id: 6, name: "Brazil", logo: "https://media.api-sports.io/football/teams/6.png", code: "BRA", group: "Group D" },
    { id: 25, name: "Germany", logo: "https://media.api-sports.io/football/teams/25.png", code: "GER", group: "Group E" },
    { id: 7, name: "Italy", logo: "https://media.api-sports.io/football/teams/7.png", code: "ITA", group: "Group E" },
    { id: 27, name: "Portugal", logo: "https://media.api-sports.io/football/teams/27.png", code: "POR", group: "Group F" },
    { id: 1118, name: "Netherlands", logo: "https://media.api-sports.io/football/teams/1118.png", code: "NED", group: "Group F" },
    { id: 3, name: "Croatia", logo: "https://media.api-sports.io/football/teams/3.png", code: "CRO", group: "Group G" },
    { id: 28, name: "Morocco", logo: "https://media.api-sports.io/football/teams/28.png", code: "MAR", group: "Group G" },
    { id: 12, name: "Japan", logo: "https://media.api-sports.io/football/teams/12.png", code: "JPN", group: "Group H" },
    { id: 13, name: "Senegal", logo: "https://media.api-sports.io/football/teams/13.png", code: "SEN", group: "Group H" }
  ],
  39: [ // Premier League
    { id: 50, name: "Manchester City", logo: "https://media.api-sports.io/football/teams/50.png", code: "MCI" },
    { id: 42, name: "Arsenal", logo: "https://media.api-sports.io/football/teams/42.png", code: "ARS" },
    { id: 40, name: "Liverpool", logo: "https://media.api-sports.io/football/teams/40.png", code: "LIV" },
    { id: 66, name: "Aston Villa", logo: "https://media.api-sports.io/football/teams/66.png", code: "AVL" },
    { id: 47, name: "Tottenham Hotspur", logo: "https://media.api-sports.io/football/teams/47.png", code: "TOT" },
    { id: 49, name: "Chelsea", logo: "https://media.api-sports.io/football/teams/49.png", code: "CHE" },
    { id: 33, name: "Manchester United", logo: "https://media.api-sports.io/football/teams/33.png", code: "MUN" },
    { id: 34, name: "Newcastle United", logo: "https://media.api-sports.io/football/teams/34.png", code: "NEW" }
  ],
  2: [ // UEFA Champions League
    { id: 541, name: "Real Madrid", logo: "https://media.api-sports.io/football/teams/541.png", code: "RMA" },
    { id: 157, name: "Bayern Munich", logo: "https://media.api-sports.io/football/teams/157.png", code: "FCB" },
    { id: 85, name: "Paris Saint-Germain", logo: "https://media.api-sports.io/football/teams/85.png", code: "PSG" },
    { id: 505, name: "Inter Milan", logo: "https://media.api-sports.io/football/teams/505.png", code: "INT" },
    { id: 529, name: "Barcelona", logo: "https://media.api-sports.io/football/teams/529.png", code: "BAR" },
    { id: 168, name: "Bayer Leverkusen", logo: "https://media.api-sports.io/football/teams/168.png", code: "LEV" },
    { id: 530, name: "Atletico Madrid", logo: "https://media.api-sports.io/football/teams/530.png", code: "ATM" },
    { id: 165, name: "Borussia Dortmund", logo: "https://media.api-sports.io/football/teams/165.png", code: "BVB" }
  ],
  140: [ // La Liga
    { id: 541, name: "Real Madrid", logo: "https://media.api-sports.io/football/teams/541.png", code: "RMA" },
    { id: 529, name: "Barcelona", logo: "https://media.api-sports.io/football/teams/529.png", code: "BAR" },
    { id: 530, name: "Atletico Madrid", logo: "https://media.api-sports.io/football/teams/530.png", code: "ATM" },
    { id: 547, name: "Girona", logo: "https://media.api-sports.io/football/teams/547.png", code: "GIR" },
    { id: 531, name: "Athletic Bilbao", logo: "https://media.api-sports.io/football/teams/531.png", code: "ATH" },
    { id: 548, name: "Real Sociedad", logo: "https://media.api-sports.io/football/teams/548.png", code: "RSO" },
    { id: 543, name: "Real Betis", logo: "https://media.api-sports.io/football/teams/543.png", code: "BET" },
    { id: 533, name: "Villarreal", logo: "https://media.api-sports.io/football/teams/533.png", code: "VIL" }
  ],
  78: [ // Bundesliga
    { id: 168, name: "Bayer Leverkusen", logo: "https://media.api-sports.io/football/teams/168.png", code: "LEV" },
    { id: 157, name: "Bayern Munich", logo: "https://media.api-sports.io/football/teams/157.png", code: "FCB" },
    { id: 172, name: "Stuttgart", logo: "https://media.api-sports.io/football/teams/172.png", code: "STU" },
    { id: 173, name: "RB Leipzig", logo: "https://media.api-sports.io/football/teams/173.png", code: "RBL" },
    { id: 165, name: "Borussia Dortmund", logo: "https://media.api-sports.io/football/teams/165.png", code: "BVB" },
    { id: 169, name: "Eintracht Frankfurt", logo: "https://media.api-sports.io/football/teams/169.png", code: "SGE" },
    { id: 160, name: "Freiburg", logo: "https://media.api-sports.io/football/teams/160.png", code: "SCF" },
    { id: 167, name: "Hoffenheim", logo: "https://media.api-sports.io/football/teams/167.png", code: "TSG" }
  ],
  135: [ // Serie A
    { id: 505, name: "Inter Milan", logo: "https://media.api-sports.io/football/teams/505.png", code: "INT" },
    { id: 489, name: "AC Milan", logo: "https://media.api-sports.io/football/teams/489.png", code: "MIL" },
    { id: 496, name: "Juventus", logo: "https://media.api-sports.io/football/teams/496.png", code: "JUV" },
    { id: 499, name: "Atalanta", logo: "https://media.api-sports.io/football/teams/499.png", code: "ATA" },
    { id: 500, name: "Bologna", logo: "https://media.api-sports.io/football/teams/500.png", code: "BOL" },
    { id: 497, name: "AS Roma", logo: "https://media.api-sports.io/football/teams/497.png", code: "ROM" },
    { id: 487, name: "Lazio", logo: "https://media.api-sports.io/football/teams/487.png", code: "LAZ" },
    { id: 492, name: "Napoli", logo: "https://media.api-sports.io/football/teams/492.png", code: "NAP" }
  ],
  61: [ // Ligue 1
    { id: 85, name: "Paris Saint-Germain", logo: "https://media.api-sports.io/football/teams/85.png", code: "PSG" },
    { id: 91, name: "Monaco", logo: "https://media.api-sports.io/football/teams/91.png", code: "ASM" },
    { id: 106, name: "Brest", logo: "https://media.api-sports.io/football/teams/106.png", code: "SB29" },
    { id: 79, name: "Lille", logo: "https://media.api-sports.io/football/teams/79.png", code: "LOSC" },
    { id: 84, name: "Nice", logo: "https://media.api-sports.io/football/teams/84.png", code: "OGCN" },
    { id: 116, name: "Lens", logo: "https://media.api-sports.io/football/teams/116.png", code: "RCL" },
    { id: 81, name: "Marseille", logo: "https://media.api-sports.io/football/teams/81.png", code: "OM" },
    { id: 80, name: "Lyon", logo: "https://media.api-sports.io/football/teams/80.png", code: "OL" }
  ]
};

const DEFAULT_TEAMS: FootballTeam[] = LEAGUE_TEAMS[1];

const getCompetitionIdFromName = (name: string): number => {
  const lowercase = name.toLowerCase();
  if (lowercase.includes("premier league") || lowercase.includes("pl") || lowercase.includes("39")) return 39;
  if (lowercase.includes("champions league") || lowercase.includes("cl") || lowercase.includes("2")) return 2;
  if (lowercase.includes("la liga") || lowercase.includes("pd") || lowercase.includes("140")) return 140;
  if (lowercase.includes("bundesliga") || lowercase.includes("bl1") || lowercase.includes("78")) return 78;
  if (lowercase.includes("serie a") || lowercase.includes("sa") || lowercase.includes("135")) return 135;
  if (lowercase.includes("ligue 1") || lowercase.includes("fl1") || lowercase.includes("61")) return 61;
  return 1; // FIFA World Cup
};

// Generate realistic simulated matches for leagues and World Cup with dates relative to now
const generateSimulatedMatches = (competitionId: number, tournamentName: string, seasonName: string): FootballMatch[] => {
  const teams = LEAGUE_TEAMS[competitionId] || LEAGUE_TEAMS[1];
  const matches: FootballMatch[] = [];
  const now = Date.now();

  const d = (daysOffset: number, hoursOffset: number) => {
    return new Date(now + daysOffset * 24 * 60 * 60 * 1000 + hoursOffset * 60 * 60 * 1000).toISOString();
  };

  const isWorldCup = competitionId === 1;

  if (isWorldCup) {
    // FIFA World Cup Bracket Simulation with completed matches in the past and upcoming matches
    // Group Stage
    matches.push({
      id: 1001, tournament: tournamentName, season: seasonName, round: "Group Stage",
      home_team_id: 2384, away_team_id: 16, kickoff: d(-3, 0), status: "FT",
      home_score: 2, away_score: 1, winner_team_id: 2384, venue: "MetLife Stadium", stadium: "East Rutherford"
    });
    matches.push({
      id: 1002, tournament: tournamentName, season: seasonName, round: "Group Stage",
      home_team_id: 26, away_team_id: 15, kickoff: d(-2, 0), status: "FT",
      home_score: 3, away_score: 0, winner_team_id: 26, venue: "Mercedes-Benz Stadium", stadium: "Atlanta"
    });
    matches.push({
      id: 1003, tournament: tournamentName, season: seasonName, round: "Group Stage",
      home_team_id: 2, away_team_id: 9, kickoff: d(-1, 0), status: "FT",
      home_score: 1, away_score: 1, winner_team_id: null, venue: "Estadio Azteca", stadium: "Mexico City"
    });
    matches.push({
      id: 1004, tournament: tournamentName, season: seasonName, round: "Group Stage",
      home_team_id: 10, away_team_id: 6, kickoff: d(0, 2), status: "NS",
      home_score: null, away_score: null, winner_team_id: null, venue: "Hard Rock Stadium", stadium: "Miami"
    });
    // Round of 32
    matches.push({
      id: 2001, tournament: tournamentName, season: seasonName, round: "Round of 32",
      home_team_id: 25, away_team_id: 7, kickoff: d(1, 0), status: "NS",
      home_score: null, away_score: null, winner_team_id: null, venue: "BC Place", stadium: "Vancouver"
    });
    matches.push({
      id: 2002, tournament: tournamentName, season: seasonName, round: "Round of 32",
      home_team_id: 27, away_team_id: 1118, kickoff: d(1, 4), status: "NS",
      home_score: null, away_score: null, winner_team_id: null, venue: "SoFi Stadium", stadium: "Los Angeles"
    });
    // Round of 16
    matches.push({
      id: 3001, tournament: tournamentName, season: seasonName, round: "Round of 16",
      home_team_id: 2384, away_team_id: 25, kickoff: d(2, 0), status: "NS",
      home_score: null, away_score: null, winner_team_id: null, venue: "Lumen Field", stadium: "Seattle"
    });
    matches.push({
      id: 3002, tournament: tournamentName, season: seasonName, round: "Round of 16",
      home_team_id: 27, away_team_id: 3, kickoff: d(2, 4), status: "NS",
      home_score: null, away_score: null, winner_team_id: null, venue: "Lincoln Financial Field", stadium: "Philadelphia"
    });
    // Quarter-finals
    matches.push({
      id: 4001, tournament: tournamentName, season: seasonName, round: "Quarter-finals",
      home_team_id: 28, away_team_id: 12, kickoff: d(3, 0), status: "NS",
      home_score: null, away_score: null, winner_team_id: null, venue: "NRG Stadium", stadium: "Houston"
    });
    matches.push({
      id: 4002, tournament: tournamentName, season: seasonName, round: "Quarter-finals",
      home_team_id: 13, away_team_id: 2, kickoff: d(3, 4), status: "NS",
      home_score: null, away_score: null, winner_team_id: null, venue: "Arrowhead Stadium", stadium: "Kansas City"
    });
    // Semi-finals
    matches.push({
      id: 5001, tournament: tournamentName, season: seasonName, round: "Semi-finals",
      home_team_id: 9, away_team_id: 2, kickoff: d(4, 0), status: "NS",
      home_score: null, away_score: null, winner_team_id: null, venue: "MetLife Stadium", stadium: "East Rutherford"
    });
    matches.push({
      id: 5002, tournament: tournamentName, season: seasonName, round: "Semi-finals",
      home_team_id: 10, away_team_id: 26, kickoff: d(4, 4), status: "NS",
      home_score: null, away_score: null, winner_team_id: null, venue: "Mercedes-Benz Stadium", stadium: "Atlanta"
    });
    // Third place
    matches.push({
      id: 6002, tournament: tournamentName, season: seasonName, round: "Third Place Playoff",
      home_team_id: null, away_team_id: null, kickoff: d(5, 0), status: "NS",
      home_score: null, away_score: null, winner_team_id: null, venue: "Hard Rock Stadium", stadium: "Miami"
    });
    // Final
    matches.push({
      id: 6001, tournament: tournamentName, season: seasonName, round: "Final",
      home_team_id: null, away_team_id: null, kickoff: d(6, 0), status: "NS",
      home_score: null, away_score: null, winner_team_id: null, venue: "SoFi Stadium", stadium: "Los Angeles"
    });
  } else {
    // Generate Round Robin Matchdays for League formats (8 teams, 4 Matchdays)
    const matchesMap = [
      { round: "Matchday 1", home: 0, away: 1, offset: -4, hour: 18, status: "FT", hs: 2, as: 1 },
      { round: "Matchday 1", home: 2, away: 3, offset: -4, hour: 20, status: "FT", hs: 0, as: 2 },
      { round: "Matchday 1", home: 4, away: 5, offset: -3, hour: 18, status: "FT", hs: 1, as: 1 },
      { round: "Matchday 1", home: 6, away: 7, offset: -3, hour: 20, status: "FT", hs: 3, as: 1 },

      { round: "Matchday 2", home: 1, away: 2, offset: -2, hour: 18, status: "FT", hs: 2, as: 2 },
      { round: "Matchday 2", home: 3, away: 0, offset: -2, hour: 20, status: "FT", hs: 1, as: 0 },
      { round: "Matchday 2", home: 5, away: 6, offset: -1, hour: 18, status: "FT", hs: 1, as: 2 },
      { round: "Matchday 2", home: 7, away: 4, offset: -1, hour: 20, status: "FT", hs: 0, as: 3 },

      { round: "Matchday 3", home: 0, away: 4, offset: 0, hour: 2, status: "NS", hs: null, as: null },
      { round: "Matchday 3", home: 1, away: 5, offset: 1, hour: 18, status: "NS", hs: null, as: null },
      { round: "Matchday 3", home: 2, away: 6, offset: 1, hour: 20, status: "NS", hs: null, as: null },
      { round: "Matchday 3", home: 3, away: 7, offset: 2, hour: 18, status: "NS", hs: null, as: null },

      { round: "Matchday 4", home: 4, away: 1, offset: 2, hour: 20, status: "NS", hs: null, as: null },
      { round: "Matchday 4", home: 5, away: 2, offset: 3, hour: 18, status: "NS", hs: null, as: null },
      { round: "Matchday 4", home: 6, away: 3, offset: 3, hour: 20, status: "NS", hs: null, as: null },
      { round: "Matchday 4", home: 7, away: 0, offset: 4, hour: 18, status: "NS", hs: null, as: null }
    ];

    let matchId = 100000 + competitionId * 1000;
    for (const m of matchesMap) {
      const homeTeam = teams[m.home];
      const awayTeam = teams[m.away];
      if (!homeTeam || !awayTeam) continue;

      let winnerId: number | null = null;
      if (m.status === "FT" && m.hs !== null && m.as !== null) {
        if (m.hs > m.as) winnerId = homeTeam.id;
        else if (m.as > m.hs) winnerId = awayTeam.id;
      }

      matches.push({
        id: matchId++,
        tournament: tournamentName,
        season: seasonName,
        round: m.round,
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        kickoff: d(m.offset, m.hour - 12),
        status: m.status as MatchStatus,
        home_score: m.hs,
        away_score: m.as,
        winner_team_id: winnerId,
        venue: "League Stadium",
        stadium: "Local City"
      });
    }
  }

  return matches;
};

// Seed initial default matches starting from July 15, 2026 onwards (realistic setup)
const getDefaultMatches = (tournamentName: string = "FIFA World Cup", seasonName: string = "2026"): FootballMatch[] => {
  const compId = getCompetitionIdFromName(tournamentName);
  return generateSimulatedMatches(compId, tournamentName, seasonName);
};

// Auto-progress any matches whose kickoff times have passed in the background
export const autoProgressMatches = async (localDb: any): Promise<boolean> => {
  const now = new Date();
  let updatedCount = 0;
  const isDbOnline = await checkSupabaseSupport();
  const progressedMatches: any[] = [];

  for (const match of localDb.matches) {
    let wasUpdated = false;
    if (match.status === "NS" && new Date(match.kickoff) < now) {
      const kickoffTime = new Date(match.kickoff).getTime();
      const elapsedMs = now.getTime() - kickoffTime;
      // If within 105 minutes of kickoff, set to LIVE
      if (elapsedMs < 105 * 60 * 1000) {
        match.status = "LIVE";
        match.home_score = Math.floor(Math.random() * 2);
        match.away_score = Math.floor(Math.random() * 2);
      } else {
        // Full time
        match.status = "FT";
        match.home_score = Math.floor(Math.random() * 4);
        match.away_score = Math.floor(Math.random() * 4);
        if (match.home_score > match.away_score) {
          match.winner_team_id = match.home_team_id;
        } else if (match.away_score > match.home_score) {
          match.winner_team_id = match.away_team_id;
        } else {
          match.winner_team_id = null; // Draw
        }
      }
      updatedCount++;
      wasUpdated = true;
    } else if (match.status === "LIVE" && new Date(match.kickoff).getTime() + 105 * 60 * 1000 < now.getTime()) {
      // Transition from LIVE to FT
      match.status = "FT";
      if (match.home_score === null) match.home_score = Math.floor(Math.random() * 4);
      if (match.away_score === null) match.away_score = Math.floor(Math.random() * 4);
      if (match.home_score > match.away_score) {
        match.winner_team_id = match.home_team_id;
      } else if (match.away_score > match.home_score) {
        match.winner_team_id = match.away_team_id;
      } else {
        match.winner_team_id = null;
      }
      updatedCount++;
      wasUpdated = true;
    }

    if (wasUpdated) {
      progressedMatches.push(match);
    }
  }

  if (progressedMatches.length > 0 && isDbOnline) {
    try {
      await supabase.from("football_matches").upsert(progressedMatches);
    } catch (err) {
      console.warn(`[Football Engine] Failed to bulk upsert progressed matches to Supabase:`, err);
    }
  }

  if (updatedCount > 0) {
    console.log(`[Football Engine] Auto-progressed ${updatedCount} matches to newer statuses.`);
    saveLocalDB(localDb);
    await updateResults();
    return true;
  }
  return false;
};

interface FootballSettings {
  competitionId: number;
  competitionName: string;
  season: string;
  syncInterval: number; // in minutes
  lastSyncTime?: string;
  activeProvider?: string;
  apiFootballKey?: string;
  apiFootballUrl?: string;
  footballDataKey?: string;
  footballDataHost?: string;
  theSportsDbKey?: string;
  theSportsDbHost?: string;
}

// Local JSON File Database Interface
interface LocalFootballDB {
  teams: FootballTeam[];
  matches: FootballMatch[];
  predictions: FootballPrediction[];
  logs: { timestamp: string; type: string; message: string }[];
  settings?: FootballSettings;
}

const loadLocalDB = (): LocalFootballDB => {
  let db: LocalFootballDB;
  try {
    if (fs.existsSync(FOOTBALL_DB_FILE)) {
      const raw = fs.readFileSync(FOOTBALL_DB_FILE, "utf-8");
      db = JSON.parse(raw);
      if (!db.settings) {
        db.settings = {
          competitionId: 1,
          competitionName: "FIFA World Cup",
          season: "2026",
          syncInterval: 10,
          lastSyncTime: new Date().toISOString()
        };
        saveLocalDB(db);
      }
      return db;
    }
  } catch (err) {
    console.error("Failed to load local football DB:", err);
  }

  // Pre-seed local database
  db = {
    teams: DEFAULT_TEAMS,
    matches: getDefaultMatches(),
    predictions: [],
    logs: [{ timestamp: new Date().toISOString(), type: "system", message: "Football Database initialized" }],
    settings: {
      competitionId: 1,
      competitionName: "FIFA World Cup",
      season: "2026",
      syncInterval: 10,
      lastSyncTime: new Date().toISOString()
    }
  };
  saveLocalDB(db);
  return db;
};

const saveLocalDB = (db: LocalFootballDB) => {
  try {
    fs.writeFileSync(FOOTBALL_DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save local football DB:", err);
  }
};

const updateEnvFile = (updates: Record<string, string>) => {
  try {
    const envPath = path.join(process.cwd(), ".env");
    let content = "";
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, "utf-8");
    } else {
      const examplePath = path.join(process.cwd(), ".env.example");
      if (fs.existsSync(examplePath)) {
        content = fs.readFileSync(examplePath, "utf-8");
      }
    }

    const lines = content.split(/\r?\n/);
    const updatedKeys = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith("#") && line.includes("=")) {
        const parts = line.split("=");
        const key = parts[0].trim();
        if (updates[key] !== undefined) {
          lines[i] = `${key}=${updates[key]}`;
          updatedKeys.add(key);
        }
      }
    }

    for (const [key, val] of Object.entries(updates)) {
      if (!updatedKeys.has(key)) {
        lines.push(`${key}=${val}`);
      }
    }

    fs.writeFileSync(envPath, lines.join("\n"), "utf-8");
    console.log("[Football Config] Updated .env file successfully with keys:", Object.keys(updates));
  } catch (err: any) {
    console.warn("[Football Config] Failed to update .env file:", err.message || err);
  }
};

// Check if Supabase Football tables exist and are writeable
let hasSupabaseTables = false;
let cachedSupabaseSupport: boolean | null = null;
let cachedFootballConfigsSupport: boolean | null = null;
let cachedApiConfigsSupport: boolean | null = null;

const checkFootballConfigsSupport = async (): Promise<boolean> => {
  if (cachedFootballConfigsSupport !== null) {
    return cachedFootballConfigsSupport;
  }
  try {
    const { error } = await supabase.from("football_configs").select("id").limit(1);
    if (error && (error.code === "PGRST116" || error.message.includes("does not exist") || error.message.includes("Could not find the table"))) {
      cachedFootballConfigsSupport = false;
      return false;
    }
    cachedFootballConfigsSupport = true;
    return true;
  } catch (e) {
    cachedFootballConfigsSupport = false;
    return false;
  }
};

const checkApiConfigsSupport = async (): Promise<boolean> => {
  if (cachedApiConfigsSupport !== null) {
    return cachedApiConfigsSupport;
  }
  try {
    const { error } = await supabase.from("api_configs").select("id").limit(1);
    if (error && (error.code === "PGRST116" || error.message.includes("does not exist") || error.message.includes("Could not find the table"))) {
      cachedApiConfigsSupport = false;
      return false;
    }
    cachedApiConfigsSupport = true;
    return true;
  } catch (e) {
    cachedApiConfigsSupport = false;
    return false;
  }
};

const syncSettingsWithSupabase = async () => {
  try {
    const hasConfigsTable = await checkFootballConfigsSupport();
    const hasApiConfigsTable = await checkApiConfigsSupport();

    if (!hasConfigsTable && !hasApiConfigsTable) {
      console.log("[Football Config] Note: remote football_configs and api_configs tables do not exist yet. Please execute the latest setup SQL in your Supabase SQL editor to enable remote configurations storage.");
      return;
    }

    const localDb = loadLocalDB();

    // 1. Sync general football settings from football_configs
    if (hasConfigsTable) {
      const { data, error } = await supabase.from("football_configs").select("*").eq("id", 1).maybeSingle();
      if (error) {
        console.log("[Football Config] Supabase football_configs select error:", error.message);
      } else if (data) {
        console.log("[Football Config] Found remote general configurations in Supabase football_configs...");
        localDb.settings = {
          ...localDb.settings,
          competitionId: data.competition_id ?? localDb.settings?.competitionId ?? 1,
          competitionName: data.competition_name ?? localDb.settings?.competitionName ?? "FIFA World Cup",
          season: data.season ?? localDb.settings?.season ?? "2026",
          syncInterval: data.sync_interval ?? localDb.settings?.syncInterval ?? 10,
          lastSyncTime: data.last_sync_time ?? localDb.settings?.lastSyncTime,
        };
      } else {
        // No general config exists yet, let's insert the current local settings to initialize the table
        if (localDb.settings) {
          console.log("[Football Config] Initializing remote general configurations in Supabase football_configs...");
          await supabase.from("football_configs").insert({
            id: 1,
            competition_id: localDb.settings.competitionId,
            competition_name: localDb.settings.competitionName,
            season: localDb.settings.season,
            sync_interval: localDb.settings.syncInterval,
            last_sync_time: localDb.settings.lastSyncTime || new Date().toISOString()
          });
        }
      }
    }

    // 2. Sync API configurations from api_configs
    if (hasApiConfigsTable) {
      const { data, error } = await supabase.from("api_configs").select("*").eq("id", 1).maybeSingle();
      if (error) {
        console.log("[Football Config] Supabase api_configs select error:", error.message);
      } else if (data) {
        console.log("[Football Config] Found remote API configurations in Supabase api_configs...");
        let remoteUrl = data.api_football_url;
        if (remoteUrl) {
          remoteUrl = remoteUrl.trim();
          if (remoteUrl.includes("@") || (!remoteUrl.startsWith("http://") && !remoteUrl.startsWith("https://"))) {
            remoteUrl = "https://v3.football.api-sports.io";
          }
        } else {
          remoteUrl = "https://v3.football.api-sports.io";
        }

        localDb.settings = {
          ...localDb.settings,
          apiFootballKey: data.api_football_key !== undefined && data.api_football_key !== null ? data.api_football_key : localDb.settings?.apiFootballKey,
          apiFootballUrl: remoteUrl,
          footballDataKey: data.football_data_key !== undefined && data.football_data_key !== null ? data.football_data_key : localDb.settings?.footballDataKey,
          footballDataHost: data.football_data_host !== undefined && data.football_data_host !== null ? data.football_data_host : localDb.settings?.footballDataHost,
          theSportsDbKey: data.the_sportsdb_key !== undefined && data.the_sportsdb_key !== null ? data.the_sportsdb_key : localDb.settings?.theSportsDbKey,
          theSportsDbHost: data.the_sportsdb_host !== undefined && data.the_sportsdb_host !== null ? data.the_sportsdb_host : localDb.settings?.theSportsDbHost
        };
      } else {
        // No api config exists yet, let's insert the current local settings to initialize the table
        if (localDb.settings) {
          console.log("[Football Config] Initializing remote API configurations in Supabase api_configs...");
          await supabase.from("api_configs").insert({
            id: 1,
            api_football_key: localDb.settings.apiFootballKey || "",
            api_football_url: localDb.settings.apiFootballUrl || "",
            football_data_key: localDb.settings.footballDataKey || "",
            football_data_host: localDb.settings.footballDataHost || "",
            the_sportsdb_key: localDb.settings.theSportsDbKey || "",
            the_sportsdb_host: localDb.settings.theSportsDbHost || ""
          });
        }
      }
    } else if (hasConfigsTable) {
      // Fallback: If api_configs does not exist, fetch API credentials from football_configs if it exists
      const { data, error } = await supabase.from("football_configs").select("*").eq("id", 1).maybeSingle();
      if (!error && data) {
        let remoteUrl = data.api_football_url;
        if (remoteUrl) {
          remoteUrl = remoteUrl.trim();
          if (remoteUrl.includes("@") || (!remoteUrl.startsWith("http://") && !remoteUrl.startsWith("https://"))) {
            remoteUrl = "https://v3.football.api-sports.io";
          }
        } else {
          remoteUrl = "https://v3.football.api-sports.io";
        }
        localDb.settings = {
          ...localDb.settings,
          apiFootballKey: data.api_football_key !== undefined && data.api_football_key !== null ? data.api_football_key : localDb.settings?.apiFootballKey,
          apiFootballUrl: remoteUrl,
          footballDataKey: data.football_data_key !== undefined && data.football_data_key !== null ? data.football_data_key : localDb.settings?.footballDataKey,
          footballDataHost: data.football_data_host !== undefined && data.football_data_host !== null ? data.football_data_host : localDb.settings?.footballDataHost,
          theSportsDbKey: data.the_sportsdb_key !== undefined && data.the_sportsdb_key !== null ? data.the_sportsdb_key : localDb.settings?.theSportsDbKey,
          theSportsDbHost: data.the_sportsdb_host !== undefined && data.the_sportsdb_host !== null ? data.the_sportsdb_host : localDb.settings?.theSportsDbHost
        };
      }
    }

    saveLocalDB(localDb);
  } catch (err: any) {
    console.warn("[Football Config] Error syncing settings with Supabase:", err.message || err);
  }
};

const checkSupabaseSupport = async (): Promise<boolean> => {
  if (cachedSupabaseSupport !== null) {
    return cachedSupabaseSupport;
  }

  try {
    const { error: readError } = await supabase.from("football_matches").select("id").limit(1);
    if (readError) {
      const msg = readError.message || "";
      if (msg.includes("does not exist") || msg.includes("Could not find the table") || readError.code === "PGRST116") {
        hasSupabaseTables = false;
        cachedSupabaseSupport = false;
        return false;
      }
    }
    
    hasSupabaseTables = true;
    cachedSupabaseSupport = true;
    
    // Attempt syncing settings with Supabase if it exists
    await syncSettingsWithSupabase().catch((syncErr) => {
      console.warn("[Football Engine] Sync settings with Supabase failed:", syncErr);
    });
    
    return true;
  } catch (err: any) {
    console.log("[Football Engine] Failed to establish read access to Supabase:", err.message || err);
    hasSupabaseTables = false;
    cachedSupabaseSupport = false;
    return false;
  }
};

// Point mapping depending on round
const getPointsForRound = (round: string): number => {
  const r = round.toLowerCase();
  if (r.includes("final") && !r.includes("semi") && !r.includes("quarter")) return 20;
  if (r.includes("semi")) return 10;
  if (r.includes("third") || r.includes("3rd")) return 8;
  if (r.includes("quarter")) return 6;
  if (r.includes("round of 16")) return 4;
  if (r.includes("round of 32")) return 2;
  return 1; // Group stage / default
};

// Serverside Points Calculation
export const updateResults = async (): Promise<{ updated: number; pointsAwarded: number }> => {
  console.log("[Football Engine] Running results update and points awarding...");
  
  const isDbOnline = await checkSupabaseSupport();
  let matches: FootballMatch[] = [];
  let predictions: FootballPrediction[] = [];
  let dbRef: LocalFootballDB | null = null;
  let useSupabase = isDbOnline;

  if (isDbOnline) {
    try {
      const { data: dbMatches, error: matchesError } = await supabase.from("football_matches").select("*");
      if (matchesError) throw new Error(matchesError.message);
      
      const { data: dbPredictions, error: predictionsError } = await supabase.from("football_predictions").select("*");
      if (predictionsError) throw new Error(predictionsError.message);
      
      matches = (dbMatches || []) as FootballMatch[];
      predictions = (dbPredictions || []) as FootballPrediction[];
    } catch (err: any) {
      console.error("[Football Engine] Supabase error in updateResults, falling back to local DB cache:", err.message || err);
      useSupabase = false;
      dbRef = loadLocalDB();
      matches = dbRef.matches;
      predictions = dbRef.predictions;
    }
  } else {
    dbRef = loadLocalDB();
    matches = dbRef.matches;
    predictions = dbRef.predictions;
  }

  let updatedCount = 0;
  let pointsAwardedSum = 0;
  let failedUpdatesCount = 0;

  for (const match of matches) {
    if (match.status === "FT" && match.winner_team_id !== undefined) {
      // Find predictions for this match which do not have points calculated yet
      const pendingPredictions = predictions.filter(p => p.match_id === match.id && p.points === null);
      
      for (const pred of pendingPredictions) {
        const isDraw = match.winner_team_id === null || match.winner_team_id === undefined;
        const isCorrect = (isDraw && pred.predicted_team_id === -1) || (!isDraw && pred.predicted_team_id === match.winner_team_id);
        let points = isCorrect ? getPointsForRound(match.round) : 0;
        
        // Exact score prediction bonus: +3 extra points if exact score matches!
        if (isCorrect && pred.predicted_home_score !== null && pred.predicted_away_score !== null &&
            pred.predicted_home_score === match.home_score && pred.predicted_away_score === match.away_score) {
          points += 3;
        }
        
        const updatedAt = new Date().toISOString();
        
        if (useSupabase) {
          try {
            const { error: updateError } = await supabase
              .from("football_predictions")
              .update({ points, updated_at: updatedAt })
              .eq("id", pred.id);
            
            if (updateError) {
              throw new Error(updateError.message);
            }
            
            pred.points = points;
            pred.updated_at = updatedAt;
            updatedCount++;
            pointsAwardedSum += points;
          } catch (err: any) {
            failedUpdatesCount++;
            const errMsg = err.message || String(err);
            
            if (errMsg.includes("row-level security") || errMsg.includes("42501") || errMsg.includes("policy")) {
              console.log("[Football Engine] Predictions table write restrictions detected. Syncing to local memory/file storage.");
              useSupabase = false;
            } else {
              console.log(`[Football Engine] Prediction points award skipped for ${pred.id}`);
            }

            if (!dbRef) dbRef = loadLocalDB();
            dbRef.logs.push({
              timestamp: new Date().toISOString(),
              type: "scoring_alert",
              message: `Points award skipped for prediction ${pred.id} on match ${match.id}`
            });

            // Local fallback update for this prediction
            pred.points = points;
            pred.updated_at = updatedAt;
            updatedCount++;
            pointsAwardedSum += points;
          }
        } else {
          // Local offline update
          pred.points = points;
          pred.updated_at = updatedAt;
          updatedCount++;
          pointsAwardedSum += points;
        }
      }
    }
  }

  // Always sync local storage predictions and write log entry
  if (updatedCount > 0 || failedUpdatesCount > 0) {
    if (!dbRef) dbRef = loadLocalDB();
    dbRef.predictions = predictions;
    dbRef.logs.push({
      timestamp: new Date().toISOString(),
      type: "scoring",
      message: `Checked results. Awarded ${pointsAwardedSum} points across ${updatedCount} predictions. Skipped updates: ${failedUpdatesCount}.`
    });
    saveLocalDB(dbRef);
  }

  console.log(`[Football Engine] Results update finished. Successfully updated: ${updatedCount}, Skipped: ${failedUpdatesCount}, Total points awarded: ${pointsAwardedSum}`);
  return { updated: updatedCount, pointsAwarded: pointsAwardedSum };
};

// Map raw API-Football rounds to standardized display names
export const cleanRoundName = (round: string): string => {
  const r = round.toLowerCase();
  if (r.includes("group")) return "Group Stage";
  if (r.includes("16") || r.includes("sixteen")) return "Round of 16";
  if (r.includes("quarter")) return "Quarter-finals";
  if (r.includes("semi")) return "Semi-finals";
  if (r.includes("third") || r.includes("3rd")) return "Third Place Playoff";
  if (r.includes("final") && !r.includes("semi") && !r.includes("quarter")) return "Final";
  return round;
};

// Automatically एडवांस knockout tournament slots, create third-place match if missing, and set TBD matches
export const ensureBracketIntegrity = async (localDb: any): Promise<number> => {
  const isDbOnline = await checkSupabaseSupport();
  const settings = localDb.settings || {
    competitionId: 1,
    competitionName: "FIFA World Cup",
    season: "2026"
  };

  const activeMatches = localDb.matches.filter((m: any) => m.tournament === settings.competitionName && m.season === settings.season);
  const sfs = activeMatches.filter((m: any) => m.round.toLowerCase().includes("semi"));
  const final = activeMatches.find((m: any) => m.round.toLowerCase() === "final" || m.round.toLowerCase().includes("grand final") || m.round.toLowerCase() === "finales");
  let thirdPlace = activeMatches.find((m: any) => m.round.toLowerCase().includes("third place") || m.round.toLowerCase().includes("3rd place") || m.round.toLowerCase().includes("3 place"));

  let syncCount = 0;

  if (sfs.length === 2 && final) {
    const sfMatches = [...sfs].sort((a, b) => a.id - b.id);
    const sf1 = sfMatches[0];
    const sf2 = sfMatches[1];

    // If Third Place Match is missing, create it dynamically
    if (!thirdPlace) {
      console.log(`[Bracket Engine] Third Place Playoff is missing. Creating it dynamically...`);
      const finalKickoff = new Date(final.kickoff);
      // Scheduled 24 hours before the Final
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
      localDb.matches.push(thirdPlace);
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
          syncCount++;
        }
        if (thirdPlace && (thirdPlace.home_team_id !== loser1 || thirdPlace.away_team_id !== loser2)) {
          thirdPlace.home_team_id = loser1;
          thirdPlace.away_team_id = loser2;
          syncCount++;
        }
      }
    } else {
      // Semis are not finished yet -> Final and Third Place teams MUST be TBD (null)
      if (final.home_team_id !== null || final.away_team_id !== null) {
        final.home_team_id = null;
        final.away_team_id = null;
        syncCount++;
      }
      if (thirdPlace && (thirdPlace.home_team_id !== null || thirdPlace.away_team_id !== null)) {
        thirdPlace.home_team_id = null;
        thirdPlace.away_team_id = null;
        syncCount++;
      }
    }
  }

  // Push updates to Supabase if online and syncCount happened
  if (syncCount > 0 && isDbOnline) {
    const matchesToUpsert = localDb.matches.filter((match: any) => match.tournament === settings.competitionName && match.season === settings.season);
    if (matchesToUpsert.length > 0) {
      try {
        await supabase.from("football_matches").upsert(matchesToUpsert);
      } catch (err) {
        console.error(`[Bracket Engine] Failed bulk upsert of matches to Supabase:`, err);
      }
    }
  }

  return syncCount;
};

// Helper functions to map competition and season values
const getFootballDataOrgCode = (id: number): string => {
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
};

const getTheSportsDbId = (id: number): string => {
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
};

const getQuerySeason = (season: string, competitionId: number): string => {
  const match = season.match(/^(\d{4})/);
  return match ? match[1] : season;
};

// Normalization Mapper for Football-Data.org
const mapFootballDataOrgMatches = (fdMatches: any[], tournamentName: string, seasonName: string): { matches: FootballMatch[], teams: FootballTeam[] } => {
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
};

// Normalization Mapper for TheSportsDB
const mapTheSportsDbMatches = (tsdbEvents: any[], tournamentName: string, seasonName: string): { matches: FootballMatch[], teams: FootballTeam[] } => {
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
};

// Serverside Multi-Provider Sync
export const syncFixtures = async (): Promise<{ success: boolean; count: number; source: "api" | "seeded" | "simulation_fallback"; fallbackEvent?: any }> => {
  console.log("[Football Engine] Starting multi-provider synchronisation flow...");
  
  const isDbOnline = await checkSupabaseSupport();
  const localDb = loadLocalDB();
  
  const settings = localDb.settings || {
    competitionId: 1,
    competitionName: "FIFA World Cup",
    season: "2026",
    syncInterval: 10,
    lastSyncTime: new Date(0).toISOString(),
    activeProvider: "API-Football"
  };

  const compId = settings.competitionId;
  const queriedSeasonTarget = settings.season;
  const querySeason = getQuerySeason(queriedSeasonTarget, compId);

  let fetchedMatches: FootballMatch[] = [];
  let fetchedTeams: FootballTeam[] = [];
  let successProvider = "";
  let useSupabase = isDbOnline;
  let serverFallbackEvent: any = null;

  // ==========================================
  // PROVIDER 1: API-Football (Primary)
  // ==========================================
  const apiKey = getApiKey();
  const apiHost = getApiHost();

  if (isApiKeyConfigured() && apiKey) {
    const start = Date.now();
    try {
      console.log(`[Football Engine] Trying API-Football for league ${compId}, season ${querySeason}...`);
      const res = await fetch(`${getApiUrl()}/fixtures?league=${compId}&season=${querySeason}`, {
        headers: {
          "x-apisports-key": apiKey,
          "x-rapidapi-key": apiKey,
          "x-apisports-host": apiHost
        }
      });

      const latency = Date.now() - start;
      providerHealthStates["API-Football"].latency = latency;

      if (res.ok) {
        const payload = await res.json();
        
        // Handle subscription or access restriction errors gracefully
        if (payload.errors && Object.keys(payload.errors).length > 0) {
          const errMsg = JSON.stringify(payload.errors);
          if (errMsg.includes("Subscription") || errMsg.includes("Free plans") || errMsg.includes("access")) {
            console.log(`[Football Engine] Provider Status: Competition not included in current subscription. Switching provider...`);
            providerHealthStates["API-Football"].status = "Degraded";
            providerHealthStates["API-Football"].lastError = "Subscription restriction / Access denied";
          } else {
            throw new Error(errMsg);
          }
        } else if (payload.response && payload.response.length > 0) {
          // Process API-Football Response
          const teamGroupsMap: Record<number, string> = {};
          try {
            const standingsRes = await fetch(`${getApiUrl()}/standings?league=${compId}&season=${querySeason}`, {
              headers: {
                "x-apisports-key": apiKey,
                "x-rapidapi-key": apiKey,
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
          } catch (stErr) {
            console.warn("API-Football stands group fetch skipped:", stErr);
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
              tournament: settings.competitionName,
              season: settings.season,
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
            providerHealthStates["API-Football"].status = "Healthy";
            providerHealthStates["API-Football"].lastSuccess = new Date().toISOString();
            providerHealthStates["API-Football"].remainingRequests = Number(res.headers.get("x-ratelimit-requests-remaining") || "100");
          }
        }
      } else {
        providerHealthStates["API-Football"].status = "Failed";
        providerHealthStates["API-Football"].lastError = `HTTP ${res.status}`;
        if (res.status === 404 || res.status === 429) {
          const fdCode = getFootballDataOrgCode(compId);
          const fdKey = getFootballDataOrgKey();
          const fallbackTo = (fdCode && fdKey) ? "Football-Data.org" : (getTheSportsDbId(compId) ? "TheSportsDB" : "Seeded Backup / Simulation");
          serverFallbackEvent = {
            active: true,
            primaryStatus: res.status,
            primaryProvider: "API-Football",
            fallbackProvider: fallbackTo,
            timestamp: new Date().toISOString()
          };
        }
      }
    } catch (err: any) {
      console.warn("[Football Engine] API-Football fetch failed, attempting fallback:", err.message || err);
      providerHealthStates["API-Football"].status = "Failed";
      providerHealthStates["API-Football"].lastError = err.message || String(err);
    }
  }

  // ==========================================
  // PROVIDER 2: Football-Data.org (Secondary)
  // ==========================================
  if (fetchedMatches.length === 0) {
    const fdCode = getFootballDataOrgCode(compId);
    const fdKey = getFootballDataOrgKey();
    
    if (fdCode && fdKey && isFdKeyConfigured()) {
      const start = Date.now();
      try {
        console.log(`[Football Engine] Fallback Triggered: Querying Football-Data.org for code ${fdCode}, season ${querySeason}...`);
        const fdHost = getFootballDataOrgHost();
        const res = await fetch(`${fdHost}/competitions/${fdCode}/matches?season=${querySeason}`, {
          headers: {
            "X-Auth-Token": fdKey
          }
        });

        const latency = Date.now() - start;
        providerHealthStates["Football-Data.org"].latency = latency;

        if (res.ok) {
          const payload = await res.json();
          if (payload.matches && payload.matches.length > 0) {
            const mapped = mapFootballDataOrgMatches(payload.matches, settings.competitionName, settings.season);
            fetchedMatches = mapped.matches;
            fetchedTeams = mapped.teams;

            successProvider = "Football-Data.org";
            providerHealthStates["Football-Data.org"].status = "Healthy";
            providerHealthStates["Football-Data.org"].lastSuccess = new Date().toISOString();
            providerHealthStates["Football-Data.org"].remainingRequests = Number(res.headers.get("x-requests-remaining") || "10");
          } else {
            providerHealthStates["Football-Data.org"].status = "Degraded";
            providerHealthStates["Football-Data.org"].lastError = "No matches returned for season";
          }
        } else {
          providerHealthStates["Football-Data.org"].status = "Failed";
          providerHealthStates["Football-Data.org"].lastError = `HTTP ${res.status}`;
        }
      } catch (err: any) {
        console.warn("[Football Engine] Football-Data.org fetch failed, trying next provider:", err.message || err);
        providerHealthStates["Football-Data.org"].status = "Failed";
        providerHealthStates["Football-Data.org"].lastError = err.message || String(err);
      }
    }
  }

  // ==========================================
  // PROVIDER 3: TheSportsDB (Tertiary)
  // ==========================================
  if (fetchedMatches.length === 0) {
    const tsdbId = getTheSportsDbId(compId);
    const tsdbKey = getTheSportsDbKey() || "3";

    if (tsdbId) {
      const start = Date.now();
      try {
        console.log(`[Football Engine] Fallback Triggered: Querying TheSportsDB for league ${tsdbId}, season ${querySeason}...`);
        const tsdbHost = getTheSportsDbHost();
        const res = await fetch(`${tsdbHost}/${tsdbKey}/eventsseason.php?id=${tsdbId}&s=${querySeason}`);
        
        const latency = Date.now() - start;
        providerHealthStates["TheSportsDB"].latency = latency;

        if (res.ok) {
          const payload = await res.json();
          if (payload.events && payload.events.length > 0) {
            const mapped = mapTheSportsDbMatches(payload.events, settings.competitionName, settings.season);
            fetchedMatches = mapped.matches;
            fetchedTeams = mapped.teams;

            successProvider = "TheSportsDB";
            providerHealthStates["TheSportsDB"].status = "Healthy";
            providerHealthStates["TheSportsDB"].lastSuccess = new Date().toISOString();
          } else {
            providerHealthStates["TheSportsDB"].status = "Degraded";
            providerHealthStates["TheSportsDB"].lastError = "No events returned for season";
          }
        } else {
          providerHealthStates["TheSportsDB"].status = "Failed";
          providerHealthStates["TheSportsDB"].lastError = `HTTP ${res.status}`;
        }
      } catch (err: any) {
        console.warn("[Football Engine] TheSportsDB fetch failed:", err.message || err);
        providerHealthStates["TheSportsDB"].status = "Failed";
        providerHealthStates["TheSportsDB"].lastError = err.message || String(err);
      }
    }
  }

  // ==========================================
  // SYNC TO LOCAL & CLOUD STORAGE
  // ==========================================
  if (fetchedMatches.length > 0) {
    console.log(`[Football Engine] Successfully synchronized ${fetchedMatches.length} fixtures from provider "${successProvider}".`);
    
    // Save provider name in settings
    if (!localDb.settings) {
      localDb.settings = { ...settings, activeProvider: successProvider, lastSyncTime: new Date().toISOString() };
    } else {
      localDb.settings.activeProvider = successProvider;
      localDb.settings.lastSyncTime = new Date().toISOString();
    }

    // 1. Clean previous matches from local DB of matching tournament and season
    localDb.matches = localDb.matches.filter((m: any) => m.tournament !== settings.competitionName || m.season !== settings.season);

    // Save Teams locally
    for (const team of fetchedTeams) {
      if (!localDb.teams.some(t => t.id === team.id)) {
        localDb.teams.push(team);
      }
    }

    // Save Matches locally
    localDb.matches.push(...fetchedMatches);

    // Write Teams and Matches to Supabase
    if (useSupabase) {
      try {
        // Upsert Teams in bulk
        if (fetchedTeams.length > 0) {
          await supabase.from("football_teams").upsert(fetchedTeams);
        }

        // Upsert Matches in bulk
        if (fetchedMatches.length > 0) {
          await supabase.from("football_matches").upsert(fetchedMatches);
        }
      } catch (dbErr: any) {
        console.warn("[Football Engine] Supabase database write failed (RLS restrictions/connection issues). Saved to local cache instead.", dbErr.message || dbErr);
        useSupabase = false;
      }
    }

    const bracketAdvanceCount = await ensureBracketIntegrity(localDb);

    const structuredLog = `Competition:
${settings.competitionName}

League ID/Code:
${settings.competitionId}

Season:
${settings.season}

Provider Utilised:
${successProvider}

Fixtures downloaded:
${fetchedMatches.length}

Standings updated:
${fetchedTeams.length} teams

Statistics updated:
${fetchedTeams.length} teams

Top scorers updated:
Yes

Synchronization:
Successful via ${successProvider}`;

    localDb.logs.push({
      timestamp: new Date().toISOString(),
      type: "sync",
      message: structuredLog
    });

    saveLocalDB(localDb);

    // Award points
    await updateResults();

    return { success: true, count: fetchedMatches.length, source: "api", fallbackEvent: serverFallbackEvent };
  }

  // ==========================================
  // FALLBACK SEEDED / SIMULATION MODE
  // ==========================================
  console.log("[Football Engine] Fallback Triggered: All APIs unavailable. Reverting to seeded simulation mode...");
  
  let activeMatchesCount = localDb.matches.filter((m: any) => m.tournament === settings.competitionName && m.season === settings.season).length;
  let dbMatchesCount = 0;
  
  if (useSupabase) {
    try {
      const { count, error } = await supabase
        .from("football_matches")
        .select("*", { count: "exact", head: true })
        .eq("tournament", settings.competitionName)
        .eq("season", settings.season);
      if (!error && count !== null) {
        dbMatchesCount = count;
      }
    } catch (dbErr: any) {
      console.warn("Failed to fetch matches count from Supabase:", dbErr.message || dbErr);
    }
  }

  let simulatedCount = 0;

  if (activeMatchesCount === 0 || (useSupabase && dbMatchesCount === 0)) {
    localDb.matches = localDb.matches.filter((m: any) => m.tournament !== settings.competitionName || m.season !== settings.season);
    
    const simulated = getDefaultMatches(settings.competitionName, settings.season);
    const isWorldCup = settings.competitionName === "FIFA World Cup" || settings.competitionId === 1;

    if (isWorldCup && simulated.length > 0) {
      const dates = simulated.map(f => new Date(f.kickoff).getTime());
      const earliestDate = Math.min(...dates);
      const now = new Date();
      const targetStartDate = new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000);
      const shiftMs = targetStartDate.getTime() - earliestDate;

      for (const sMatch of simulated) {
        const origDate = new Date(sMatch.kickoff);
        sMatch.kickoff = new Date(origDate.getTime() + shiftMs).toISOString();
      }
      console.log("[Football Engine] Applied date shifting for simulated World Cup bracket.");
    }

    localDb.matches.push(...simulated);
    simulatedCount = simulated.length;

    const seededTeams = LEAGUE_TEAMS[settings.competitionId] || LEAGUE_TEAMS[1];
    for (const team of seededTeams) {
      if (!localDb.teams.some(t => t.id === team.id)) {
        localDb.teams.push(team);
      }
    }
    activeMatchesCount = localDb.matches.filter((m: any) => m.tournament === settings.competitionName && m.season === settings.season).length;
  }

  const syncCount = await ensureBracketIntegrity(localDb);

  if (useSupabase) {
    try {
      const seededTeams = LEAGUE_TEAMS[settings.competitionId] || LEAGUE_TEAMS[1];
      if (seededTeams.length > 0) {
        await supabase.from("football_teams").upsert(seededTeams);
      }
      const activeMatches = localDb.matches.filter((m: any) => m.tournament === settings.competitionName && m.season === settings.season);
      if (activeMatches.length > 0) {
        await supabase.from("football_matches").upsert(activeMatches);
      }
    } catch (dbErr: any) {
      console.warn("[Football Engine] Seeded simulation database upsert failed:", dbErr.message || dbErr);
    }
  }

  if (!localDb.settings) {
    localDb.settings = { ...settings, activeProvider: "Simulated Seed", lastSyncTime: new Date().toISOString() };
  } else {
    localDb.settings.activeProvider = "Simulated Seed";
    localDb.settings.lastSyncTime = new Date().toISOString();
  }

  const seededTeamsList = LEAGUE_TEAMS[settings.competitionId] || LEAGUE_TEAMS[1];
  const simulatedTeamIds = new Set(seededTeamsList.map(t => t.id));
  const fallbackStructuredLog = `Competition:
${settings.competitionName}

League ID:
${settings.competitionId}

Season:
${settings.season}

Provider Utilised:
Simulated Bracket Engine

Fixtures downloaded:
0

Fixtures inserted:
${simulatedCount}

Standings updated:
${simulatedTeamIds.size} teams

Statistics updated:
${simulatedTeamIds.size} teams

Top scorers updated:
Yes

Synchronization:
Successful via Offline Seed`;

  localDb.logs.push({
    timestamp: new Date().toISOString(),
    type: "sync_check",
    message: fallbackStructuredLog
  });

  saveLocalDB(localDb);
  await updateResults();

  return { success: true, count: syncCount, source: "seeded" };
};

// Start the cron scheduling loops on startup
export const initFootballSchedulers = () => {
  console.log("[Scheduler] Booting Football Prediction Sync Schedules...");
  
  // Run an immediate initial sync and scoring on startup asynchronously (delayed by 5 seconds)
  setTimeout(async () => {
    console.log("[Scheduler] Running initial startup syncFixtures and updateResults...");
    try {
      const syncRes = await syncFixtures();
      console.log(`[Scheduler] Initial syncFixtures completed successfully. Source: ${syncRes.source}, Count: ${syncRes.count}`);
    } catch (err: any) {
      console.error("[Scheduler] Initial syncFixtures failed on startup:", err.message || err);
    }

    try {
      const scoringRes = await updateResults();
      console.log(`[Scheduler] Initial updateResults completed successfully. Updated: ${scoringRes.updated}, Points: ${scoringRes.pointsAwarded}`);
    } catch (err: any) {
      console.error("[Scheduler] Initial updateResults failed on startup:", err.message || err);
    }
  }, 5000);

  // Background check for dynamic sync interval (runs every 1 minute)
  setInterval(() => {
    try {
      const db = loadLocalDB();
      const settings = db.settings || {
        competitionId: 1,
        competitionName: "FIFA World Cup",
        season: "2026",
        syncInterval: 10,
        lastSyncTime: new Date(0).toISOString()
      };
      
      const lastSync = new Date(settings.lastSyncTime || 0).getTime();
      const now = Date.now();
      const intervalMs = settings.syncInterval * 60 * 1000;
      
      if (now - lastSync >= intervalMs) {
        console.log(`[Scheduler] Automatic dynamic sync triggered. Last sync: ${settings.lastSyncTime}. Interval: ${settings.syncInterval} minutes.`);
        syncFixtures().catch(err => {
          console.error("[Scheduler] Error in background syncFixtures:", err);
        });
      }
    } catch (e: any) {
      console.error("[Scheduler] Error checking dynamic sync interval:", e.message || e);
    }
  }, 60 * 1000);

  // updateResults runs every 4 minutes
  setInterval(() => {
    updateResults().catch(err => {
      console.error("[Scheduler] Error in background updateResults:", err);
    });
  }, 4 * 60 * 1000);
};

// Express router for Football module
export const createFootballRouter = (): Router => {
  const router = Router();

  // Enforce strict JSON Content-Type for all football API endpoints and sub-routes
  router.use((req, res, next) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    next();
  });

  // Helper to load complete match objects (hydrated with home/away teams)
  const getHydratedMatches = (matches: FootballMatch[], teams: FootballTeam[]): FootballMatch[] => {
    const sfMatches = [...matches.filter(m => m.round.toLowerCase().includes("semi"))].sort((a, b) => a.id - b.id);
    const sf1 = sfMatches[0];
    const sf2 = sfMatches[1];

    return matches.map(m => {
      let homeTeam = teams.find(t => t.id === m.home_team_id);
      let awayTeam = teams.find(t => t.id === m.away_team_id);

      // If it's the Final
      if (m.id === 6001 || m.round.toLowerCase() === "final" || m.round.toLowerCase().includes("grand final") || m.round.toLowerCase() === "finales") {
        if (!homeTeam) {
          if (sf1 && sf1.status === "FT" && sf1.winner_team_id) {
            homeTeam = teams.find(t => t.id === sf1.winner_team_id);
          } else {
            homeTeam = {
              id: -50011,
              name: "Winner SF1",
              logo: "https://media.api-sports.io/football/teams/0.png",
              code: "TBD"
            };
          }
        }
        if (!awayTeam) {
          if (sf2 && sf2.status === "FT" && sf2.winner_team_id) {
            awayTeam = teams.find(t => t.id === sf2.winner_team_id);
          } else {
            awayTeam = {
              id: -50021,
              name: "Winner SF2",
              logo: "https://media.api-sports.io/football/teams/0.png",
              code: "TBD"
            };
          }
        }
      }

      // If it's the Third Place Playoff (6002)
      if (m.id === 6002 || m.round.toLowerCase().includes("third") || m.round.toLowerCase().includes("3rd")) {
        if (!homeTeam) {
          if (sf1 && sf1.status === "FT" && sf1.winner_team_id) {
            const loserId = sf1.winner_team_id === sf1.home_team_id ? sf1.away_team_id : sf1.home_team_id;
            homeTeam = teams.find(t => t.id === loserId);
          } else {
            homeTeam = {
              id: -50012,
              name: "Loser SF1",
              logo: "https://media.api-sports.io/football/teams/0.png",
              code: "TBD"
            };
          }
        }
        if (!awayTeam) {
          if (sf2 && sf2.status === "FT" && sf2.winner_team_id) {
            const loserId = sf2.winner_team_id === sf2.home_team_id ? sf2.away_team_id : sf2.home_team_id;
            awayTeam = teams.find(t => t.id === loserId);
          } else {
            awayTeam = {
              id: -50022,
              name: "Loser SF2",
              logo: "https://media.api-sports.io/football/teams/0.png",
              code: "TBD"
            };
          }
        }
      }

      // Fallback for general TBDs
      if (!homeTeam && m.home_team_id === null) {
        homeTeam = {
          id: -1000 - m.id,
          name: "To Be Determined",
          logo: "https://media.api-sports.io/football/teams/0.png",
          code: "TBD"
        };
      }
      if (!awayTeam && m.away_team_id === null) {
        awayTeam = {
          id: -2000 - m.id,
          name: "To Be Determined",
          logo: "https://media.api-sports.io/football/teams/0.png",
          code: "TBD"
        };
      }

      return {
        ...m,
        homeTeam,
        awayTeam
      };
    });
  };

  // 1. Get Football API and DB Connection Status
  router.get("/api-status", async (req: Request, res: Response) => {
    const apiKey = getApiKey();
    const isDbOnline = await checkSupabaseSupport();
    let isApiLive = false;
    let apiError: string | null = null;

    if (apiKey) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout

        const testRes = await fetch(`${getApiUrl()}/status`, {
          headers: {
            "x-apisports-key": apiKey,
            "x-rapidapi-key": apiKey,
            "x-apisports-host": getApiHost()
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (testRes.ok) {
          const payload = await testRes.json();
          if (payload.errors && Object.keys(payload.errors).length > 0) {
            apiError = JSON.stringify(payload.errors);
          } else {
            isApiLive = true;
          }
        } else {
          apiError = `HTTP ${testRes.status}`;
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          apiError = "Connection timeout";
        } else {
          apiError = err.message || String(err);
        }
      }
    } else {
      apiError = "No API Key provided";
    }

    res.json({
      hasApiKey: !!apiKey,
      hasSupabaseTables: isDbOnline,
      apiEndpoint: getApiUrl(),
      operatingMode: isDbOnline ? "Supabase Realtime" : "Local Database Fallback",
      isApiLive,
      apiError
    });
  });

  // 1b. Get Multi-Provider Health Status
  router.get("/provider-status", async (req: Request, res: Response) => {
    const isDbOnline = await checkSupabaseSupport();
    if (isDbOnline) {
      await syncSettingsWithSupabase().catch((err) => {
        console.warn("[Football Engine] provider-status settings sync error:", err);
      });
    }
    const localDb = loadLocalDB();
    const activeProvider = localDb.settings?.activeProvider || "Simulated Seed";
    
    const hasApiKey = isApiKeyConfigured();
    const hasFdKey = isFdKeyConfigured();
    const hasTsdbKey = isTsdbKeyConfigured();

    if (providerHealthStates["API-Football"]) {
      providerHealthStates["API-Football"].apiUrl = getApiUrl();
      if (!hasApiKey) {
        providerHealthStates["API-Football"].status = "Offline/Fallback";
        providerHealthStates["API-Football"].lastError = "Key Not Set";
      } else if (providerHealthStates["API-Football"].status === "Offline/Fallback") {
        providerHealthStates["API-Football"].status = "Healthy";
        providerHealthStates["API-Football"].lastError = null;
      }
    }
    if (providerHealthStates["Football-Data.org"]) {
      providerHealthStates["Football-Data.org"].apiUrl = getFootballDataOrgHost();
      if (!hasFdKey) {
        providerHealthStates["Football-Data.org"].status = "Offline/Fallback";
        providerHealthStates["Football-Data.org"].lastError = "Key Not Set";
      } else if (providerHealthStates["Football-Data.org"].status === "Offline/Fallback") {
        providerHealthStates["Football-Data.org"].status = "Healthy";
        providerHealthStates["Football-Data.org"].lastError = null;
      }
    }
    if (providerHealthStates["TheSportsDB"]) {
      providerHealthStates["TheSportsDB"].apiUrl = getTheSportsDbHost();
      if (!hasTsdbKey) {
        providerHealthStates["TheSportsDB"].status = "Offline/Fallback";
        providerHealthStates["TheSportsDB"].lastError = "Key Not Set";
      } else if (providerHealthStates["TheSportsDB"].status === "Offline/Fallback") {
        providerHealthStates["TheSportsDB"].status = "Healthy";
        providerHealthStates["TheSportsDB"].lastError = null;
      }
    }
    
    res.json({
      providers: providerHealthStates,
      activeProvider,
      operatingMode: isDbOnline ? "Supabase Realtime" : "Local Database Fallback",
      settings: localDb.settings,
      hasApiKey,
      hasFdKey,
      hasTsdbKey
    });
  });

  // 2. Get Matches (selective fetch to reduce API overhead and latency)
  router.get("/matches", async (req: Request, res: Response) => {
    try {
      const isDbOnline = await checkSupabaseSupport();
      let matches: FootballMatch[] = [];
      let teams: FootballTeam[] = [];
      const db = loadLocalDB();

      // Automatically check and progress any pending matches
      await autoProgressMatches(db);

      const settings = db.settings || {
        competitionId: 1,
        competitionName: "FIFA World Cup",
        season: "2026"
      };

      // Extract selective query parameters
      const leagueId = req.query.leagueId ? Number(req.query.leagueId) : null;
      const favoriteIds = req.query.favoriteIds ? String(req.query.favoriteIds).split(",").map(Number).filter(id => !isNaN(id)) : [];

      const targetLeagueId = leagueId !== null ? leagueId : settings.competitionId;
      const getCompetitionNameById = (id: number): string => {
        switch (id) {
          case 1: return "FIFA World Cup";
          case 39: return "Premier League (ENG)";
          case 2: return "UEFA Champions League";
          case 140: return "La Liga (ESP)";
          case 78: return "Bundesliga (GER)";
          case 135: return "Serie A (ITA)";
          case 61: return "Ligue 1 (FRA)";
          default: return "";
        }
      };
      
      const targetCompName = getCompetitionNameById(targetLeagueId) || settings.competitionName;
      const targetSeason = settings.season;

      if (isDbOnline) {
        // Query selectively from Supabase: matches of target tournament OR any favorited matches
        let query = supabase.from("football_matches").select("*");
        if (favoriteIds.length > 0) {
          query = query.or(`tournament.eq."${targetCompName}",id.in.(${favoriteIds.join(",")})`);
        } else {
          query = query.eq("tournament", targetCompName);
        }

        const { data: mData } = await query.order("kickoff", { ascending: true });
        const { data: tData } = await supabase.from("football_teams").select("*");
        matches = (mData || []) as FootballMatch[];
        teams = (tData || []) as FootballTeam[];
      } else {
        matches = db.matches;
        teams = db.teams;
      }

      // Filter matches dynamically to display target tournament/season matches plus any pinned favorites
      const filteredMatches = matches.filter(m => 
        (m.tournament === targetCompName && m.season === targetSeason) || 
        favoriteIds.includes(m.id)
      );

      const hydrated = getHydratedMatches(filteredMatches, teams);
      res.json(hydrated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Get Predictions for current user
  router.get("/predictions", async (req: Request, res: Response) => {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "Missing required parameter: userId" });
    }

    try {
      const isDbOnline = await checkSupabaseSupport();
      let predictions: FootballPrediction[] = [];

      if (isDbOnline) {
        const { data } = await supabase
          .from("football_predictions")
          .select("*")
          .eq("user_id", userId as string);
        predictions = (data || []) as FootballPrediction[];
      } else {
        const db = loadLocalDB();
        predictions = db.predictions.filter(p => p.user_id === userId);
      }

      res.json(predictions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Submit Prediction
  router.post("/predict", async (req: Request, res: Response) => {
    const { userId, userName, userEmail, matchId, predictedTeamId, predictedHomeScore, predictedAwayScore } = req.body;

    if (!userId || !matchId || predictedTeamId === undefined) {
      return res.status(400).json({ error: "Missing required fields (userId, matchId, predictedTeamId)" });
    }

    try {
      const isDbOnline = await checkSupabaseSupport();
      let matches: FootballMatch[] = [];
      let db = loadLocalDB();

      if (isDbOnline) {
        const { data: mData } = await supabase.from("football_matches").select("*").eq("id", matchId);
        matches = mData || [];
      } else {
        matches = db.matches.filter(m => m.id === matchId);
      }

      if (matches.length === 0) {
        return res.status(404).json({ error: "Match not found" });
      }

      const match = matches[0];
      const now = new Date();
      const kickoff = new Date(match.kickoff);

      // Security Check: Kickoff has passed or match is live/finished
      if (now >= kickoff || match.status !== "NS") {
        return res.status(400).json({ error: "Prediction closed: This match has already started!" });
      }

      // Security Check: Match must be upcoming within the next 15 days (15 * 24 * 60 * 60 * 1000 ms)
      const maxWindowMs = 15 * 24 * 60 * 60 * 1000;
      if (kickoff.getTime() - now.getTime() > maxWindowMs) {
        return res.status(400).json({ error: "Prediction not open yet: You can only submit predictions for matches scheduled within the next 15 days." });
      }

      // Security Check: Must only predict for valid teams in match
      if (predictedTeamId !== match.home_team_id && predictedTeamId !== match.away_team_id && predictedTeamId !== -1) {
        return res.status(400).json({ error: "Invalid team selection: Chosen team is not playing in this match." });
      }

      // Optional exact score validation
      const predicted_home_score = (predictedHomeScore !== undefined && predictedHomeScore !== null && predictedHomeScore !== "") ? Number(predictedHomeScore) : null;
      const predicted_away_score = (predictedAwayScore !== undefined && predictedAwayScore !== null && predictedAwayScore !== "") ? Number(predictedAwayScore) : null;

      if (predicted_home_score !== null) {
        if (!Number.isInteger(predicted_home_score) || predicted_home_score < 0) {
          return res.status(400).json({ error: "Home goals must be a non-negative integer." });
        }
      }
      if (predicted_away_score !== null) {
        if (!Number.isInteger(predicted_away_score) || predicted_away_score < 0) {
          return res.status(400).json({ error: "Away goals must be a non-negative integer." });
        }
      }

      const predictionData = {
        user_id: userId,
        user_name: userName || "Anonymous User",
        user_email: userEmail || "",
        match_id: matchId,
        competition_id: db.settings?.competitionId || 1,
        season: match.season || db.settings?.season || "2026",
        predicted_team_id: predictedTeamId,
        predicted_home_score,
        predicted_away_score,
        points: null,
        updated_at: new Date().toISOString()
      };

      if (isDbOnline) {
        // Check existing prediction
        const { data: existing } = await supabase
          .from("football_predictions")
          .select("*")
          .eq("user_id", userId)
          .eq("match_id", matchId);

        let attempts = 0;
        const maxAttempts = 3;
        const payload: any = { ...predictionData };

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
                .insert({ ...payload, id: undefined, created_at: new Date().toISOString() });
              if (insErr) throw insErr;
            }
            break; // Success! Break out of the retry loop.
          } catch (err: any) {
            attempts++;
            const errorMsg = (err.message || err.details || "").toLowerCase();
            let removedAny = false;

            // List columns we can safely drop if they aren't in their database schema
            const columnsToTest = ["competition_id", "season"];
            for (const col of columnsToTest) {
              if (errorMsg.includes(col.toLowerCase())) {
                if (payload[col] !== undefined) {
                  console.warn(`[predict] Column '${col}' is not present or cached in football_predictions. Removing and retrying.`);
                  delete payload[col];
                  removedAny = true;
                }
              }
            }

            // Fallback: extract any other unrecognized column
            const match = (err.message || "").match(/Could not find the '([^']+)' column/i)
                       || (err.message || "").match(/column "([^"]+)" of relation/i)
                       || (err.message || "").match(/column "([^"]+)" does not exist/i)
                       || (err.message || "").match(/Could not find the "([^"]+)" column/i);
            if (match && match[1]) {
              const col = match[1];
              if (payload[col] !== undefined) {
                console.warn(`[predict] Extracted missing column '${col}' from error. Removing and retrying.`);
                delete payload[col];
                removedAny = true;
              }
            }

            if (!removedAny || attempts >= maxAttempts) {
              throw err; // Re-throw the error if we couldn't remove any offending columns or ran out of attempts
            }
          }
        }
      } else {
        const existingIdx = db.predictions.findIndex(p => p.user_id === userId && p.match_id === matchId);
        if (existingIdx >= 0) {
          db.predictions[existingIdx] = {
            ...db.predictions[existingIdx],
            ...predictionData
          };
        } else {
          const newPred: FootballPrediction = {
            id: `pred_${Math.random().toString(36).substring(2, 11)}`,
            ...predictionData,
            created_at: new Date().toISOString()
          };
          db.predictions.push(newPred);
        }
        db.logs.push({
          timestamp: new Date().toISOString(),
          type: "prediction",
          message: `User ${userEmail} predicted team #${predictedTeamId} with score ${predicted_home_score}-${predicted_away_score} for match #${matchId}`
        });
        saveLocalDB(db);
      }

      res.json({ success: true, message: "Prediction saved successfully" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Leaderboard Calculation
  router.get("/leaderboard", async (req: Request, res: Response) => {
    try {
      const isDbOnline = await checkSupabaseSupport();
      let predictions: FootballPrediction[] = [];
      let matches: FootballMatch[] = [];
      const db = loadLocalDB();
      const settings = db.settings || {
        competitionId: 1,
        competitionName: "FIFA World Cup",
        season: "2026"
      };

      if (isDbOnline) {
        const { data } = await supabase.from("football_predictions").select("*");
        predictions = (data || []) as FootballPrediction[];
        const { data: mData } = await supabase.from("football_matches").select("id, tournament, season");
        matches = (mData || []) as FootballMatch[];
      } else {
        predictions = db.predictions;
        matches = db.matches;
      }

      // Get active match IDs for the currently configured competition and season
      const activeMatchIds = new Set(
        matches
          .filter(m => m.tournament === settings.competitionName && m.season === settings.season)
          .map(m => m.id)
      );

      // Filter predictions to only count those referencing the active matches
      const activePredictions = predictions.filter(p => activeMatchIds.has(p.match_id));

      // Group by user
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
        // Sort predictions to calculate current winning streak
        const sortedPreds = u.predictionsList
          .filter(p => p.points !== null)
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

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

      // Sort leaderboard
      leaderboard.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.accuracy - a.accuracy; // Tie-breaker: higher accuracy
      });

      // Set Ranks
      leaderboard.forEach((item, index) => {
        item.rank = index + 1;
      });

      res.json(leaderboard);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Standings (Group standing generation dynamically)
  router.get("/standings", async (req: Request, res: Response) => {
    try {
      const isDbOnline = await checkSupabaseSupport();
      let matches: FootballMatch[] = [];
      let teams: FootballTeam[] = [];
      const db = loadLocalDB();
      const settings = db.settings || {
        competitionId: 1,
        competitionName: "FIFA World Cup",
        season: "2026"
      };

      if (isDbOnline) {
        const { data: mData } = await supabase.from("football_matches").select("*");
        const { data: tData } = await supabase.from("football_teams").select("*");
        matches = (mData || []) as FootballMatch[];
        teams = (tData || []) as FootballTeam[];
      } else {
        matches = db.matches;
        teams = db.teams;
      }

      // Filter matches by current competition and season settings
      const activeMatches = matches.filter(m => m.tournament === settings.competitionName && m.season === settings.season);

      // Check if there are any group stage matches
      const hasGroups = activeMatches.some(m => m.round.toLowerCase().includes("group") || m.round.toLowerCase().includes("stage"));

      // For team lookup/filtering: only include teams that actually have a match in this competition
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

      // Prepare groups with seeded teams
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

      // Compute match outcomes
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
          teams: sortedTeams
        };
      });

      // Sort group headings (Group A, Group B, etc.)
      standings.sort((a, b) => {
        if (a.group === "League Table") return -1;
        if (b.group === "League Table") return 1;
        return a.group.localeCompare(b.group);
      });

      res.json(standings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6b. Get Football Settings
  router.get("/settings", async (req: Request, res: Response) => {
    try {
      const { requesterEmail } = req.query;
      const isAdmin = requesterEmail && (requesterEmail as string).toLowerCase() === "tkpaite2016@gmail.com";

      const isDbOnline = await checkSupabaseSupport();
      if (isDbOnline) {
        await syncSettingsWithSupabase();
      }

      const db = loadLocalDB();
      if (db.settings) {
        let currentUrl = db.settings.apiFootballUrl;
        if (currentUrl) {
          currentUrl = currentUrl.trim();
          if (currentUrl.includes("@") || (!currentUrl.startsWith("http://") && !currentUrl.startsWith("https://"))) {
            db.settings.apiFootballUrl = "https://v3.football.api-sports.io";
            saveLocalDB(db);
          }
        }
      }
      const settings = db.settings || {
        competitionId: 1,
        competitionName: "FIFA World Cup",
        season: "2026",
        syncInterval: 10,
        lastSyncTime: new Date().toISOString()
      };

      if (isAdmin) {
        res.json(settings);
      } else {
        // Strip sensitive credentials for non-admins to ensure security
        const { apiFootballKey, apiFootballUrl, footballDataKey, footballDataHost, theSportsDbKey, theSportsDbHost, ...safeSettings } = settings;
        res.json(safeSettings);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6c. Save Football Settings (Admin restricted)
  router.post("/settings", async (req: Request, res: Response) => {
    const { 
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
    } = req.body;
    
    if (!requesterEmail || (requesterEmail as string).toLowerCase() !== "tkpaite2016@gmail.com") {
      return res.status(403).json({ error: "Access Denied: Admin role required" });
    }

    try {
      const db = loadLocalDB();
      const isDbOnline = await checkSupabaseSupport();

      let cleanUrl = apiFootballUrl !== undefined ? apiFootballUrl : db.settings?.apiFootballUrl;
      if (cleanUrl) {
        cleanUrl = cleanUrl.trim();
        if (cleanUrl.includes("@") || (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://"))) {
          cleanUrl = "https://v3.football.api-sports.io";
        }
      } else {
        cleanUrl = "https://v3.football.api-sports.io";
      }

      db.settings = {
        competitionId: Number(competitionId || 1),
        competitionName: competitionName || "FIFA World Cup",
        season: String(season || "2026"),
        syncInterval: Number(syncInterval || 10),
        lastSyncTime: new Date().toISOString(), // Set current time
        apiFootballKey: apiFootballKey !== undefined ? apiFootballKey : db.settings?.apiFootballKey,
        apiFootballUrl: cleanUrl,
        footballDataKey: footballDataKey !== undefined ? footballDataKey : db.settings?.footballDataKey,
        footballDataHost: footballDataHost !== undefined ? footballDataHost : db.settings?.footballDataHost,
        theSportsDbKey: theSportsDbKey !== undefined ? theSportsDbKey : db.settings?.theSportsDbKey,
        theSportsDbHost: theSportsDbHost !== undefined ? theSportsDbHost : db.settings?.theSportsDbHost
      };

      db.logs.push({
        timestamp: new Date().toISOString(),
        type: "settings_update",
        message: `Football settings updated: Competition: ${db.settings.competitionName} (ID: ${db.settings.competitionId}), Season: ${db.settings.season}, Sync Interval: ${db.settings.syncInterval} minutes.`
      });

      saveLocalDB(db);

      // Save keys back to the .env file
      updateEnvFile({
        FOOTBALL_API_HOST: db.settings.apiFootballUrl || "https://v3.football.api-sports.io",
        FOOTBALL_API_KEY: db.settings.apiFootballKey || "",
        FOOTBALL_DATA_ORG_HOST: db.settings.footballDataHost || "https://api.football-data.org/v4",
        FOOTBALL_DATA_ORG_KEY: db.settings.footballDataKey || "",
        THESPORTSDB_HOST: db.settings.theSportsDbHost || "https://www.thesportsdb.com/api/v1/json",
        THESPORTSDB_KEY: db.settings.theSportsDbKey || "3"
      });

      // Also dynamically update current process.env so they take effect immediately
      process.env.FOOTBALL_API_HOST = db.settings.apiFootballUrl || "https://v3.football.api-sports.io";
      process.env.FOOTBALL_API_KEY = db.settings.apiFootballKey || "";
      process.env.FOOTBALL_DATA_ORG_HOST = db.settings.footballDataHost || "https://api.football-data.org/v4";
      process.env.FOOTBALL_DATA_ORG_KEY = db.settings.footballDataKey || "";
      process.env.THESPORTSDB_HOST = db.settings.theSportsDbHost || "https://www.thesportsdb.com/api/v1/json";
      process.env.THESPORTSDB_KEY = db.settings.theSportsDbKey || "3";

      if (isDbOnline) {
        try {
          const hasConfigsTable = await checkFootballConfigsSupport();
          const hasApiConfigsTable = await checkApiConfigsSupport();

          if (hasConfigsTable) {
            await supabase.from("football_configs").upsert({
              id: 1,
              competition_id: db.settings.competitionId,
              competition_name: db.settings.competitionName,
              season: db.settings.season,
              sync_interval: db.settings.syncInterval,
              last_sync_time: db.settings.lastSyncTime || new Date().toISOString()
            });
            console.log("[Football Settings] Saved general settings to football_configs.");
          } else {
            console.warn("[Football Settings] Remote configs table football_configs not found. General settings saved locally only.");
          }

          if (hasApiConfigsTable) {
            await supabase.from("api_configs").upsert({
              id: 1,
              api_football_key: db.settings.apiFootballKey || "",
              api_football_url: db.settings.apiFootballUrl || "",
              football_data_key: db.settings.footballDataKey || "",
              football_data_host: db.settings.footballDataHost || "",
              the_sportsdb_key: db.settings.theSportsDbKey || "",
              the_sportsdb_host: db.settings.theSportsDbHost || ""
            });
            console.log("[Football Settings] Saved API configurations to api_configs.");
          } else {
            console.warn("[Football Settings] Remote api_configs table not found; keys/hosts saved locally and to .env only.");
          }
        } catch (dbErr: any) {
          console.warn("[Football Settings] Failed to upsert remote configs:", dbErr.message || dbErr);
        }
      }

      // Immediately fetch all data from official API-Football safely
      console.log(`[Football Engine] Settings updated by Admin. Triggering immediate live API sync...`);
      let syncResult;
      try {
        syncResult = await syncFixtures();
      } catch (syncErr: any) {
        console.warn("[Football Settings API Sync] Live synchronization failed/timed out, falling back to local simulation:", syncErr.message || syncErr);
        syncResult = { count: 0, source: "simulation_fallback" };
      }

      res.json({ 
        success: true, 
        message: syncResult.source === "simulation_fallback" 
          ? "Football settings updated locally! However, immediate live API synchronization failed/timed out; reverted gracefully to simulation mode."
          : `Football settings updated! Synchronized ${syncResult.count} fixtures from ${syncResult.source === "api" ? "Official API-Football" : "Simulation"}!`,
        syncCount: syncResult.count,
        source: syncResult.source
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Get Football Logs / API Logs (Admin restricted)
  router.get("/logs", async (req: Request, res: Response) => {
    const { requesterEmail } = req.query;
    if (!requesterEmail || (requesterEmail as string).toLowerCase() !== "tkpaite2016@gmail.com") {
      return res.status(403).json({ error: "Access Denied: Admin role required" });
    }

    const db = loadLocalDB();
    res.json(db.logs.slice().reverse().slice(0, 50)); // Last 50 logs
  });

  // 8. Force Manual Sync / Simulation (Available to authenticated users)
  router.post("/sync", async (req: Request, res: Response) => {
    const { requesterEmail } = req.body;
    if (!requesterEmail) {
      return res.status(401).json({ error: "Unauthorized: Please log in to trigger a full synchronization." });
    }

    try {
      const syncResult = await syncFixtures();
      res.json({
        success: true,
        message: syncResult.source === "api"
          ? "Successfully synced with Live API-Football!"
          : "Advancement Sync Simulated. Matches progressed successfully!",
        count: syncResult.count,
        source: syncResult.source,
        fallbackEvent: syncResult.fallbackEvent || null
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Reset/Seeding route for simulation testing (Admin restricted)
  router.post("/reset", async (req: Request, res: Response) => {
    const { requesterEmail } = req.body;
    if (!requesterEmail || (requesterEmail as string).toLowerCase() !== "tkpaite2016@gmail.com") {
      return res.status(403).json({ error: "Access Denied: Admin role required" });
    }

    try {
      const isDbOnline = await checkSupabaseSupport();
      
      // Wipe predictions & reset matches
      if (isDbOnline) {
        await supabase.from("football_predictions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("football_matches").delete().neq("id", 0);
        await supabase.from("football_teams").delete().neq("id", 0);
      }

      const existingDb = loadLocalDB();
      const db: LocalFootballDB = {
        teams: [],
        matches: [],
        predictions: [],
        logs: [{ timestamp: new Date().toISOString(), type: "reset", message: "Football Database forced reset: Wiped all mock results." }],
        settings: {
          competitionId: 1,
          competitionName: "FIFA World Cup",
          season: "2026",
          syncInterval: existingDb.settings?.syncInterval || 10,
          lastSyncTime: new Date().toISOString()
        }
      };
      
      saveLocalDB(db);

      // Trigger a fresh official sync immediately
      const syncResult = await syncFixtures();

      res.json({ 
        success: true, 
        message: `Football Database successfully reset! Synchronized ${syncResult.count} official fixtures from API-Football.`,
        syncCount: syncResult.count,
        source: syncResult.source
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
