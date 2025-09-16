import mongoose, { Connection, Model, Schema } from 'mongoose';
import { getDefaultConnection } from '@/lib/mongoose';

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

let VotingDayModel: Model<VotingDayDoc> | null = null;

export async function getVotingDayModel(): Promise<Model<VotingDayDoc>> {
  if (VotingDayModel) return VotingDayModel;

  const conn: Connection = getDefaultConnection();

  const votingDaySchema = new Schema<VotingDayDoc>({
    day: { type: String, required: true, index: true, unique: true },
    counts: [
      {
        toolId: { type: String, required: true },
        votes: { type: Number, required: true },
      },
    ],
    closedAt: { type: Date, required: true },
    source: { type: String, enum: ['redis-snapshot', 'recovered', 'manual'], default: 'redis-snapshot' },
  }, { timestamps: true });

  VotingDayModel = (conn.models.VotingDay as Model<VotingDayDoc>) || conn.model<VotingDayDoc>('VotingDay', votingDaySchema);
  return VotingDayModel;
}

