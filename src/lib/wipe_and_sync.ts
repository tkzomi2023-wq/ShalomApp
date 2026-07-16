/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from "./supabase";
import { syncFixtures } from "./footballServer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const FOOTBALL_DB_FILE = path.join(process.cwd(), "football_db.json");

async function runMigration() {
  console.log("=========================================");
  console.log("⚽ FIFA World Cup 2026 Database Cleanup & Fresh Sync ⚽");
  console.log("=========================================");

  try {
    // 1. Wipe out Supabase database records (if connected)
    console.log("[1/4] Checking Supabase connection and wiping mock results...");
    let isSupabaseOnline = false;
    try {
      // Test select to see if tables exist and are reachable
      const { data, error } = await supabase.from("football_matches").select("id").limit(1);
      if (!error) {
        isSupabaseOnline = true;
        console.log("Supabase connection: ONLINE. Wiping existing records to clear mock results...");

        // Wipe predictions first due to foreign keys
        const { error: predErr } = await supabase
          .from("football_predictions")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (predErr) {
          console.warn("Notice: Predictions table wipe returned an status/error:", predErr.message);
        } else {
          console.log("✓ Successfully wiped football_predictions");
        }

        // Wipe matches next
        const { error: matchErr } = await supabase
          .from("football_matches")
          .delete()
          .neq("id", 0);
        if (matchErr) {
          console.warn("Notice: Matches table wipe returned an status/error:", matchErr.message);
        } else {
          console.log("✓ Successfully wiped football_matches");
        }

        // Wipe teams last
        const { error: teamErr } = await supabase
          .from("football_teams")
          .delete()
          .neq("id", 0);
        if (teamErr) {
          console.warn("Notice: Teams table wipe returned an status/error:", teamErr.message);
        } else {
          console.log("✓ Successfully wiped football_teams");
        }
      } else {
        console.warn("Supabase tables check returned error or doesn't exist:", error.message);
      }
    } catch (dbErr: any) {
      console.warn("Supabase wipe failed (operating in offline/local fallback):", dbErr.message || dbErr);
    }

    // 2. Wipe Local file cache (football_db.json)
    console.log("[2/4] Resetting local cache file (football_db.json)...");
    let currentDb: any = { teams: [], matches: [], predictions: [], logs: [] };
    if (fs.existsSync(FOOTBALL_DB_FILE)) {
      try {
        currentDb = JSON.parse(fs.readFileSync(FOOTBALL_DB_FILE, "utf-8"));
      } catch (e) {
        console.warn("Failed to parse football_db.json, creating a fresh structure.");
      }
    }

    // Completely wipe mock matches, teams, and predictions
    currentDb.matches = [];
    currentDb.teams = [];
    currentDb.predictions = [];
    
    // Set official settings
    currentDb.settings = {
      competitionId: 1,
      competitionName: "FIFA World Cup",
      season: "2026",
      syncInterval: 10,
      lastSyncTime: new Date(0).toISOString()
    };

    currentDb.logs.push({
      timestamp: new Date().toISOString(),
      type: "reset",
      message: "Football Database forced reset: Wiped all hardcoded mock fixture data."
    });

    fs.writeFileSync(FOOTBALL_DB_FILE, JSON.stringify(currentDb, null, 2), "utf-8");
    console.log("✓ Successfully wiped and reset football_db.json local cache.");

    // 3. Trigger Fresh Official API-Football Sync
    console.log("[3/4] Triggering fresh official FIFA World Cup 2026 synchronization from API-Football...");
    const syncResult = await syncFixtures();

    console.log("=========================================");
    console.log("🏆 Sync Execution Completed Successfully! 🏆");
    console.log(`Source utilized: ${syncResult.source.toUpperCase()}`);
    console.log(`Fixtures synchronized: ${syncResult.count}`);
    console.log("=========================================");

    // Exit successfully
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Migration and synchronization failed with error:", err.message || err);
    process.exit(1);
  }
}

runMigration();
