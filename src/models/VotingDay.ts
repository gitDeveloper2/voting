// This file is deprecated - the Voting API now uses native MongoDB driver with launches collection
// Vote data is now stored in the launches collection managed by src/lib/launches.ts

export interface VotingDayToolCounts {
  toolId: string;
  votes: number;
}

export interface VotingDayDoc {
  day: string; // YYYY-MM-DD
  counts: Array<{ toolId: string; votes: number }>;
  closedAt: Date;
  source: 'redis-snapshot' | 'recovered' | 'manual';
}

export async function getVotingDayModel() {
  throw new Error('VotingDay model deprecated. Vote data is now stored in launches collection via src/lib/launches.ts');
}
