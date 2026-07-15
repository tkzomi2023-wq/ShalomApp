/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MatchStatus =
  | 'NS'   // Not Started
  | 'LIVE' // Live / In Progress
  | 'HT'   // Halftime
  | 'ET'   // Extra Time
  | 'PEN'  // Penalty Shootout
  | 'FT'   // Finished
  | 'CANC' // Cancelled
  | 'PST'  // Postponed;

export interface FootballTeam {
  id: number;
  name: string;
  logo: string;
  code?: string;
  group?: string;
}

export interface FootballMatch {
  id: number; // API Fixture ID
  tournament: string;
  season: string;
  round: string;
  home_team_id: number;
  away_team_id: number;
  kickoff: string; // ISO date string
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  winner_team_id: number | null;
  venue: string;
  stadium: string;
  // Extracted fields for UI convenience
  homeTeam?: FootballTeam;
  awayTeam?: FootballTeam;
}

export interface FootballPrediction {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  match_id: number;
  predicted_team_id: number; // Team ID predicted to win (or -1 for draw)
  points: number | null;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  user_name: string;
  user_email: string;
  avatar?: string;
  points: number;
  correct_predictions: number;
  total_predictions: number;
  accuracy: number; // Percentage
  streak: number; // Current winning streak
}

export interface FootballStats {
  totalPredictions: number;
  correctPredictions: number;
  averageAccuracy: number;
  mostPredictedTeam: {
    team: FootballTeam;
    count: number;
  } | null;
  highestScoringMatch: {
    match: FootballMatch;
    totalGoals: number;
  } | null;
}

export interface StandingsGroup {
  group: string;
  teams: {
    team: FootballTeam;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    points: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
  }[];
}
