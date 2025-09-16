import mongoose, { Schema, Types, model } from 'mongoose';

const statsSchema = new Schema({
  views: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  votes: { type: Number, default: 0 },
  appearances: { type: Number, default: 0 },
  featuredLists: [{ type: Schema.Types.ObjectId, ref: 'List' }],
}, { _id: false });

const toolSchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  tagline: { type: String },
  description: { type: String, required: true },
  websiteUrl: { type: String, required: true },
  logo: {
    url: { type: String, required: true },
    public_id: { type: String, required: true },
  },
  screenshots: {
    type: [{ url: String, public_id: String }],
    default: [],
  },
  category: String,
  tags: String,
  platforms: [String],
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  stats: { type: statsSchema, default: () => ({}) },
  status: { type: String, enum: ['beta', 'draft', 'upcoming', 'launched', 'suspended'], default: 'draft' },
  launchDate: Date,
  votingDurationHours: { type: Number, default: 24 },
  votingFlushed: { type: Boolean, default: false },
}, { timestamps: true });

export const Tool = mongoose.models.Tool || model('Tool', toolSchema);
