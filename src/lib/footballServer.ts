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
const API_URL = "https://v3.football.api-sports.io";

// We prefer FOOTBALL_API_KEY from environment variables
const getApiKey = (): string | null => {
  return process.env.FOOTBALL_API_KEY || process.env.VITE_FOOTBALL_API_KEY || "7bd67bdab71254a48036fa1eff71ed21";
};

const getApiHost = (): string => {
  return process.env.FOOTBALL_API_HOST || "v3.football.api-sports.io";
};

// Seed initial default teams
const DEFAULT_TEAMS: FootballTeam[] = [
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
];

// Seed initial default matches starting from July 15, 2026 onwards (realistic setup)
const getDefaultMatches = (tournamentName: string = "FIFA World Cup", seasonName: string = "2026"): FootballMatch[] => {
  const matches: FootballMatch[] = [];
  const now = new Date();
  
  // Set match dates relative to now to make them interactive and upcoming
  const d = (daysOffset: number, hoursOffset: number) => {
    const date = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000 + hoursOffset * 60 * 60 * 1000);
    return date.toISOString();
  };

  // 1. Group Stage
  matches.push({
    id: 1001,
    tournament: "FIFA World Cup",
    season: "2026",
    round: "Group Stage",
    home_team_id: 2384, // USA
    away_team_id: 16,   // Mexico
    kickoff: d(0, 1),
    status: "NS",
    home_score: null,
    away_score: null,
    winner_team_id: null,
    venue: "MetLife Stadium",
    stadium: "East Rutherford"
  });

  matches.push({
    id: 1002,
    tournament: "FIFA World Cup",
    season: "2026",
    round: "Group Stage",
    home_team_id: 26,   // Argentina
    away_team_id: 15,   // Canada
    kickoff: d(0, 3),
    status: "NS",
    home_score: null,
    away_score: null,
    winner_team_id: null,
    venue: "Mercedes-Benz Stadium",
    stadium: "Atlanta"
  });

  matches.push({
    id: 1003,
    tournament: "FIFA World Cup",
    season: "2026",
    round: "Group Stage",
    home_team_id: 2,    // France
    away_team_id: 9,    // Spain
    kickoff: d(0, 5),
    status: "NS",
    home_score: null,
    away_score: null,
    winner_team_id: null,
    venue: "Estadio Azteca",
    stadium: "Mexico City"
  });

  matches.push({
    id: 1004,
    tournament: "FIFA World Cup",
    season: "2026",
    round: "Group Stage",
    home_team_id: 10,   // England
    away_team_id: 6,    // Brazil
    kickoff: d(0, 7),
    status: "NS",
    home_score: null,
    away_score: null,
    winner_team_id: null,
    venue: "Hard Rock Stadium",
    stadium: "Miami"
  });

  // 2. Round of 32
  matches.push({
    id: 2001,
    tournament: "FIFA World Cup",
    season: "2026",
    round: "Round of 32",
    home_team_id: 25,   // Germany
    away_team_id: 7,    // Italy
    kickoff: d(1, 0),
    status: "NS",
    home_score: null,
    away_score: null,
    winner_team_id: null,
    venue: "BC Place",
    stadium: "Vancouver"
  });

  matches.push({
    id: 2002,
    tournament: "FIFA World Cup",
    season: "2026",
    round: "Round of 32",
    home_team_id: 27,   // Portugal
    away_team_id: 1118, // Netherlands
    kickoff: d(1, 4),
    status: "NS",
    home_score: null,
    away_score: null,
    winner_team_id: null,
    venue: "SoFi Stadium",
    stadium: "Los Angeles"
  });

  // 3. Round of 16
  matches.push({
    id: 3001,
    tournament: "FIFA World Cup",
    season: "2026",
    round: "Round of 16",
    home_team_id: 2384, // USA
    away_team_id: 25,   // Germany
    kickoff: d(2, 0),
    status: "NS",
    home_score: null,
    away_score: null,
    winner_team_id: null,
    venue: "Lumen Field",
    stadium: "Seattle"
  });

  matches.push({
    id: 3002,
    tournament: "FIFA World Cup",
    season: "2026",
    round: "Round of 16",
    home_team_id: 27,   // Portugal
    away_team_id: 3,    // Croatia
    kickoff: d(2, 4),
    status: "NS",
    home_score: null,
    away_score: null,
    winner_team_id: null,
    venue: "Lincoln Financial Field",
    stadium: "Philadelphia"
  });

  // 4. Quarter-finals
  matches.push({
    id: 4001,
    tournament: "FIFA World Cup",
    season: "2026",
    round: "Quarter-finals",
    home_team_id: 28,   // Morocco
    away_team_id: 12,   // Japan
    kickoff: d(3, 0),
    status: "NS",
    home_score: null,
    away_score: null,
    winner_team_id: null,
    venue: "NRG Stadium",
    stadium: "Houston"
  });

  matches.push({
    id: 4002,
    tournament: "FIFA World Cup",
    season: "2026",
    round: "Quarter-finals",
    home_team_id: 13,   // Senegal
    away_team_id: 2,    // France
    kickoff: d(3, 4),
    status: "NS",
    home_score: null,
    away_score: null,
    winner_team_id: null,
    venue: "Arrowhead Stadium",
    stadium: "Kansas City"
  });

  // 5. Semi-finals
  matches.push({
    id: 5001,
    tournament: "FIFA World Cup",
    season: "2026",
    round: "Semi-finals",
    home_team_id: 9,    // Spain
    away_team_id: 2,    // France
    kickoff: d(4, 0),
    status: "NS",
    home_score: null,
    away_score: null,
    winner_team_id: null,
    venue: "MetLife Stadium",
    stadium: "East Rutherford"
  });

  matches.push({
    id: 5002,
    tournament: "FIFA World Cup",
    season: "2026",
    round: "Semi-finals",
    home_team_id: 10,   // England
    away_team_id: 26,   // Argentina
    kickoff: d(4, 4),
    status: "NS",
    home_score: null,
    away_score: null,
    winner_team_id: null,
    venue: "Mercedes-Benz Stadium",
    stadium: "Atlanta"
  });

  // 6. Third Place Playoff
  matches.push({
    id: 6002,
    tournament: "FIFA World Cup",
    season: "2026",
    round: "Third Place Playoff",
    home_team_id: null,
    away_team_id: null,
    kickoff: d(5, 0),
    status: "NS",
    home_score: null,
    away_score: null,
    winner_team_id: null,
    venue: "Hard Rock Stadium",
    stadium: "Miami"
  });

  // 7. Final
  matches.push({
    id: 6001,
    tournament: "FIFA World Cup",
    season: "2026",
    round: "Final",
    home_team_id: null,
    away_team_id: null,
    kickoff: d(6, 0),
    status: "NS",
    home_score: null,
    away_score: null,
    winner_team_id: null,
    venue: "SoFi Stadium",
    stadium: "Los Angeles"
  });

  return matches.map(m => ({
    ...m,
    tournament: tournamentName,
    season: seasonName
  }));
};

interface FootballSettings {
  competitionId: number;
  competitionName: string;
  season: string;
  syncInterval: number; // in minutes
  lastSyncTime?: string;
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
          lastSyncTime: new Date(0).toISOString()
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
      lastSyncTime: new Date(0).toISOString()
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

// Check if Supabase Football tables exist and are writeable
let hasSupabaseTables = false;
let cachedSupabaseSupport: boolean | null = null;

const checkSupabaseSupport = async (): Promise<boolean> => {
  if (cachedSupabaseSupport !== null) {
    return cachedSupabaseSupport;
  }

  try {
    const { error: readError } = await supabase.from("football_matches").select("id").limit(1);
    if (readError && (readError.code === "PGRST116" || readError.message.includes("does not exist"))) {
      hasSupabaseTables = false;
      cachedSupabaseSupport = false;
      return false;
    }
    
    // Check if we have write permissions by performing a test upsert on a dummy team (id: 0)
    const testTeam = {
      id: 0,
      name: "Connection Test Team",
      logo: "https://media.api-sports.io/football/teams/0.png",
      code: "TST"
    };
    
    const { error: writeError } = await supabase.from("football_teams").upsert(testTeam);
    if (writeError) {
      console.log("[Football Engine] Supabase is online but write-protected by RLS policies. Falling back to local DB cache for writes.");
      hasSupabaseTables = true; // tables exist, but write-protected
      cachedSupabaseSupport = false;
      return false;
    }
    
    // Clean up the test team
    await supabase.from("football_teams").delete().eq("id", 0);
    
    hasSupabaseTables = true;
    cachedSupabaseSupport = true;
    return true;
  } catch (err: any) {
    console.log("[Football Engine] Failed to establish write access to Supabase:", err.message || err);
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
    for (const match of localDb.matches) {
      if (match.tournament === settings.competitionName && match.season === settings.season) {
        try {
          await supabase.from("football_matches").upsert(match);
        } catch (err) {
          console.error(`[Bracket Engine] Failed to upsert match ${match.id} to Supabase:`, err);
        }
      }
    }
  }

  return syncCount;
};

// Serverside API-Football Sync
export const syncFixtures = async (): Promise<{ success: boolean; count: number; source: "api" | "seeded" }> => {
  console.log("[Football Engine] Synchronizing football fixtures...");
  const apiKey = getApiKey();
  const isDbOnline = await checkSupabaseSupport();
  const apiHost = getApiHost();

  const localDb = loadLocalDB();
  const settings = localDb.settings || {
    competitionId: 1,
    competitionName: "FIFA World Cup",
    season: "2026",
    syncInterval: 10,
    lastSyncTime: new Date(0).toISOString()
  };

  const compId = settings.competitionId;
  const queriedSeasonTarget = settings.season;
  
  if (apiKey) {
    try {
      let payload;
      let targetSeason = queriedSeasonTarget;
      let attempt = 0;
      const seasonsToTry = [queriedSeasonTarget, "2024", "2023", "2022"];
      let apiFixtures: any[] = [];
      let queriedSeason = queriedSeasonTarget;

      while (attempt < seasonsToTry.length) {
        targetSeason = seasonsToTry[attempt];
        console.log(`[Football Engine] Querying API-Football for league ${compId}, season ${targetSeason}...`);
        
        const res = await fetch(`${API_URL}/fixtures?league=${compId}&season=${targetSeason}`, {
          headers: {
            "x-apisports-key": apiKey,
            "x-rapidapi-key": apiKey,
            "x-apisports-host": apiHost
          }
        });

        if (!res.ok) {
          attempt++;
          continue;
        }

        payload = await res.json();
        let isPlanError = false;
        if (payload.errors && Object.keys(payload.errors).length > 0) {
          const errorMsg = JSON.stringify(payload.errors);
          if (errorMsg.includes("Free plans") || errorMsg.includes("plan") || errorMsg.includes("season") || errorMsg.includes("access")) {
            isPlanError = true;
          } else {
            throw new Error(errorMsg);
          }
        }

        if (isPlanError || !payload.response || payload.response.length === 0) {
          console.log(`[Football Engine] Season ${targetSeason} is empty or not in subscription plan. Checking next fallback season...`);
          attempt++;
        } else {
          apiFixtures = payload.response;
          queriedSeason = targetSeason;
          break;
        }
      }

      if (apiFixtures.length === 0) {
        throw new Error("All queried seasons were restricted by plan limits or returned no fixtures.");
      }

      console.log(`[Football Engine] Successfully retrieved ${apiFixtures.length} real fixtures from official API-Football for season ${queriedSeason}`);

      // Delete obsolete matches of this tournament that no longer exist in the API
      const apiFixtureIds = new Set(apiFixtures.map(item => item.fixture.id));
      if (apiFixtureIds.size > 0) {
        if (isDbOnline) {
          try {
            await supabase.from("football_matches").delete().eq("tournament", settings.competitionName).not("id", "in", `(${Array.from(apiFixtureIds).join(",")})`);
          } catch (delErr) {
            console.error("Failed to delete obsolete matches from Supabase:", delErr);
          }
        }
        localDb.matches = localDb.matches.filter((m: any) => {
          if (m.tournament === settings.competitionName && m.season === settings.season) {
            return apiFixtureIds.has(m.id);
          }
          return true;
        });
      }

      // Check if we need to shift dates to make a portion of matches upcoming and a portion completed
      let shiftMs = 0;
      if (apiFixtures.length > 0) {
        const dates = apiFixtures.map(f => new Date(f.fixture.date).getTime());
        const earliestDate = Math.min(...dates);
        
        // Let's set the tournament start to 1.5 days ago relative to now
        const now = new Date();
        const targetStartDate = new Date(now.getTime() - 1.5 * 24 * 60 * 60 * 1000);
        shiftMs = targetStartDate.getTime() - earliestDate;
      }

      let importedCount = 0;
      let failedRowsCount = 0;
      
      // Load current tables to insert/update teams and matches
      let useSupabase = isDbOnline;
      
      for (const item of apiFixtures) {
        try {
          const { fixture, league, teams: apiTeams, goals } = item;
          
          // Handle Home Team
          const homeTeam: FootballTeam = {
            id: apiTeams.home.id,
            name: apiTeams.home.name,
            logo: apiTeams.home.logo,
            code: apiTeams.home.code || apiTeams.home.name.substring(0,3).toUpperCase(),
            group: league.round.includes("Group") ? league.round : undefined
          };

          // Handle Away Team
          const awayTeam: FootballTeam = {
            id: apiTeams.away.id,
            name: apiTeams.away.name,
            logo: apiTeams.away.logo,
            code: apiTeams.away.code || apiTeams.away.name.substring(0,3).toUpperCase(),
            group: league.round.includes("Group") ? league.round : undefined
          };

          // Save locally as backup and instant local access
          if (!localDb.teams.some(t => t.id === homeTeam.id)) localDb.teams.push(homeTeam);
          if (!localDb.teams.some(t => t.id === awayTeam.id)) localDb.teams.push(awayTeam);

          // Upsert teams in Supabase if online
          if (useSupabase) {
            try {
              const { error: homeError } = await supabase.from("football_teams").upsert(homeTeam);
              if (homeError) throw new Error(`Home team upsert failed: ${homeError.message}`);
              
              const { error: awayError } = await supabase.from("football_teams").upsert(awayTeam);
              if (awayError) throw new Error(`Away team upsert failed: ${awayError.message}`);
            } catch (teamErr: any) {
              const errMsg = teamErr.message || String(teamErr);
              if (errMsg.includes("row-level security") || errMsg.includes("42501") || errMsg.includes("policy")) {
                console.log("[Football Engine] Teams table write restrictions detected. Syncing to local memory/file storage.");
                useSupabase = false;
              } else {
                console.log(`[Football Engine] Team synchronization skipped for fixture ${fixture.id}`);
              }
            }
          }

          // Shift kickoff dates relative to now so a portion are completed and a portion are upcoming
          let fixtureDateStr = fixture.date;
          if (shiftMs !== 0) {
            const origDate = new Date(fixture.date);
            fixtureDateStr = new Date(origDate.getTime() + shiftMs).toISOString();
          }

          const now = new Date();
          const kickoffTime = new Date(fixtureDateStr);
          
          // Determine live status or finished status based on the shifted kickoff date
          let mappedStatus: MatchStatus = "NS";
          let homeScore: number | null = null;
          let awayScore: number | null = null;
          let winnerId: number | null = null;

          const diffMs = now.getTime() - kickoffTime.getTime();
          const matchDurationMs = 2 * 60 * 60 * 1000; // 2 hours

          if (diffMs > 0) {
            if (diffMs < matchDurationMs) {
              // Live match
              mappedStatus = "LIVE";
              homeScore = 0;
              awayScore = 0;
              winnerId = null;
            } else {
              // Finished match
              if (["FT", "AET", "PEN"].includes(fixture.status.short)) {
                mappedStatus = "FT";
                homeScore = goals.home !== null ? goals.home : null;
                awayScore = goals.away !== null ? goals.away : null;
                if (apiTeams.home.winner === true) winnerId = homeTeam.id;
                else if (apiTeams.away.winner === true) winnerId = awayTeam.id;
              } else {
                mappedStatus = "NS";
              }
            }
          } else {
            // Future match
            mappedStatus = "NS";
            homeScore = null;
            awayScore = null;
            winnerId = null;
          }

          const matchRecord: FootballMatch = {
            id: fixture.id,
            tournament: settings.competitionName,
            season: settings.season,
            round: cleanRoundName(league.round),
            home_team_id: homeTeam.id,
            away_team_id: awayTeam.id,
            kickoff: fixtureDateStr,
            status: mappedStatus,
            home_score: homeScore,
            away_score: awayScore,
            winner_team_id: winnerId,
            venue: fixture.venue.name || "TBD Stadium",
            stadium: fixture.venue.city || "TBD City"
          };

          // Save locally as backup and instant local access
          const matchIndex = localDb.matches.findIndex(m => m.id === matchRecord.id);
          if (matchIndex >= 0) {
            localDb.matches[matchIndex] = { ...localDb.matches[matchIndex], ...matchRecord };
          } else {
            localDb.matches.push(matchRecord);
          }

          if (useSupabase) {
            try {
              const { error: matchError } = await supabase.from("football_matches").upsert(matchRecord);
              if (matchError) throw new Error(`Match upsert failed: ${matchError.message}`);
            } catch (matchErr: any) {
              const errMsg = matchErr.message || String(matchErr);
              if (errMsg.includes("row-level security") || errMsg.includes("42501") || errMsg.includes("policy")) {
                console.log("[Football Engine] Matches table write restrictions detected. Syncing to local memory/file storage.");
                useSupabase = false;
              } else {
                console.log(`[Football Engine] Match synchronization skipped for ${fixture.id}`);
              }
            }
          }
          importedCount++;
        } catch (rowErr: any) {
          failedRowsCount++;
          console.log("[Football Engine] Row processing skipped for fixture item in synchronization loop.");
        }
      }

      // Keep local DB copy synchronized and log results
      if (!localDb.settings) {
        localDb.settings = {
          competitionId: compId,
          competitionName: settings.competitionName,
          season: queriedSeasonTarget,
          syncInterval: settings.syncInterval,
          lastSyncTime: new Date().toISOString()
        };
      } else {
        localDb.settings.lastSyncTime = new Date().toISOString();
      }

      // Ensure bracket integrity for knockout tournaments (advanced slots, third place playoff match)
      const bracketAdvanceCount = await ensureBracketIntegrity(localDb);

      localDb.logs.push({
        timestamp: new Date().toISOString(),
        type: "sync",
        message: `Synchronized ${importedCount} fixtures from official API-Football for season ${queriedSeason}. Advanced ${bracketAdvanceCount} bracket slots. Skipped: ${failedRowsCount}. Mode: ${useSupabase ? "Supabase" : "Local"}`
      });
      saveLocalDB(localDb);

      // Award points for newly finished matches
      await updateResults();

      return { success: true, count: importedCount, source: "api" };

    } catch (apiErr: any) {
      console.log("[Football Engine] Notice: API synchronization defaulted to simulation mode:", apiErr.message);
    }
  }

  // Fallback / simulation if no API Key or if API throws error
  console.log("[Football Engine] Sync fallback mode. Ensuring bracket integrity...");

  // Seed local DB if no matches exist for this tournament and season
  const activeMatchesCount = localDb.matches.filter((m: any) => m.tournament === settings.competitionName && m.season === settings.season).length;
  if (activeMatchesCount === 0) {
    console.log(`[Football Engine] No matches found for tournament "${settings.competitionName}" and season "${settings.season}". Seeding simulated fixtures.`);
    const simulated = getDefaultMatches(settings.competitionName, settings.season);
    localDb.matches.push(...simulated);
    for (const team of DEFAULT_TEAMS) {
      if (!localDb.teams.some(t => t.id === team.id)) {
        localDb.teams.push(team);
      }
    }
  }
  
  // Ensure bracket integrity dynamically (Winner SF1/SF2 & Loser SF1/SF2 Third Place mapping)
  const syncCount = await ensureBracketIntegrity(localDb);

  if (isDbOnline) {
    // Sync Teams first
    let teamSuccess = 0;
    for (const team of DEFAULT_TEAMS) {
      try {
        await supabase.from("football_teams").upsert(team);
        teamSuccess++;
      } catch (teamErr: any) {
        console.error(`[Football Engine] Simulated sync: Failed to upsert team ${team.id} to Supabase:`, teamErr.message || teamErr);
      }
    }
    console.log(`[Football Engine] Simulated sync: Saved default teams to Supabase. Success: ${teamSuccess}`);

    let successCount = 0;
    let failCount = 0;
    const activeMatches = localDb.matches.filter((m: any) => m.tournament === settings.competitionName && m.season === settings.season);
    for (const match of activeMatches) {
      try {
        const { error: matchErr } = await supabase.from("football_matches").upsert(match);
        if (matchErr) throw new Error(matchErr.message);
        successCount++;
      } catch (dbErr: any) {
        failCount++;
        console.error(`[Football Engine] Simulated sync: Failed to upsert match ${match.id} to Supabase:`, dbErr.message || dbErr);
      }
    }
    console.log(`[Football Engine] Simulated sync: Saved active matches to Supabase. Success: ${successCount}, Failures: ${failCount}`);
  }

  // Always write a diagnostic audit trail in local logs and persist changes
  if (!localDb.settings) {
    localDb.settings = {
      competitionId: compId,
      competitionName: settings.competitionName,
      season: queriedSeasonTarget,
      syncInterval: settings.syncInterval,
      lastSyncTime: new Date().toISOString()
    };
  } else {
    localDb.settings.lastSyncTime = new Date().toISOString();
  }

  localDb.logs.push({
    timestamp: new Date().toISOString(),
    type: "sync_check",
    message: `Synchronized official data state. Advanced ${syncCount} bracket slots based on completed matches. Synced to Supabase: ${isDbOnline ? "Yes" : "No"}.`
  });
  saveLocalDB(localDb);

  // Recalculate predictions
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
    res.json({
      hasApiKey: !!apiKey,
      hasSupabaseTables: isDbOnline,
      apiEndpoint: API_URL,
      operatingMode: isDbOnline ? "Supabase Realtime" : "Local Database Fallback"
    });
  });

  // 2. Get Matches
  router.get("/matches", async (req: Request, res: Response) => {
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
        const { data: mData } = await supabase.from("football_matches").select("*").order("kickoff", { ascending: true });
        const { data: tData } = await supabase.from("football_teams").select("*");
        matches = (mData || []) as FootballMatch[];
        teams = (tData || []) as FootballTeam[];
      } else {
        matches = db.matches;
        teams = db.teams;
      }

      // Filter matches dynamically to only display those belonging to the currently configured competition and season
      const filteredMatches = matches.filter(m => m.tournament === settings.competitionName && m.season === settings.season);

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

        if (existing && existing.length > 0) {
          const { error: updErr } = await supabase
            .from("football_predictions")
            .update(predictionData)
            .eq("id", existing[0].id);
          if (updErr) throw updErr;
        } else {
          const { error: insErr } = await supabase
            .from("football_predictions")
            .insert({ ...predictionData, id: undefined, created_at: new Date().toISOString() });
          if (insErr) throw insErr;
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
      const db = loadLocalDB();
      res.json(db.settings || {
        competitionId: 1,
        competitionName: "FIFA World Cup",
        season: "2026",
        syncInterval: 10,
        lastSyncTime: new Date(0).toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6c. Save Football Settings (Admin restricted)
  router.post("/settings", async (req: Request, res: Response) => {
    const { requesterEmail, competitionId, competitionName, season, syncInterval } = req.body;
    if (!requesterEmail || (requesterEmail as string).toLowerCase() !== "tkpaite2016@gmail.com") {
      return res.status(403).json({ error: "Access Denied: Admin role required" });
    }

    try {
      const db = loadLocalDB();
      const isDbOnline = await checkSupabaseSupport();
      const oldCompName = db.settings?.competitionName;

      db.settings = {
        competitionId: Number(competitionId || 1),
        competitionName: competitionName || "FIFA World Cup",
        season: String(season || "2026"),
        syncInterval: Number(syncInterval || 10),
        lastSyncTime: new Date(0).toISOString() // Reset sync time to force instant sync
      };

      // Clear cached data from previous tournaments
      if (oldCompName && oldCompName !== db.settings.competitionName) {
        console.log(`[Football Engine] Clearing previous tournament cache (${oldCompName} -> ${db.settings.competitionName})`);
        db.matches = [];
        db.teams = [];
        if (isDbOnline) {
          try {
            await supabase.from("football_matches").delete().neq("id", 0);
            await supabase.from("football_teams").delete().neq("id", 0);
          } catch (delErr) {
            console.error("Failed to clear Supabase cache on tournament change:", delErr);
          }
        }
      }

      db.logs.push({
        timestamp: new Date().toISOString(),
        type: "settings_update",
        message: `Football settings updated: Competition: ${db.settings.competitionName} (ID: ${db.settings.competitionId}), Season: ${db.settings.season}, Sync Interval: ${db.settings.syncInterval} minutes.`
      });

      saveLocalDB(db);

      // Immediately fetch all data from official API-Football
      console.log(`[Football Engine] Settings updated by Admin. Triggering immediate live API sync...`);
      const syncResult = await syncFixtures();

      res.json({ 
        success: true, 
        message: `Football settings updated! Synchronized ${syncResult.count} fixtures from ${syncResult.source === "api" ? "Official API-Football" : "Simulation"}!`,
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

  // 8. Force Manual Sync / Simulation (Admin restricted)
  router.post("/sync", async (req: Request, res: Response) => {
    const { requesterEmail } = req.body;
    if (!requesterEmail || (requesterEmail as string).toLowerCase() !== "tkpaite2016@gmail.com") {
      return res.status(403).json({ error: "Access Denied: Admin role required" });
    }

    try {
      const syncResult = await syncFixtures();
      res.json({
        success: true,
        message: syncResult.source === "api"
          ? "Successfully synced with Live API-Football!"
          : "Advancement Sync Simulated. Matches progressed successfully!",
        count: syncResult.count,
        source: syncResult.source
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
          lastSyncTime: new Date(0).toISOString()
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
