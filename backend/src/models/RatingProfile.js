import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scope: { type: String, required: true },
  rating: { type: Number, default: 0 },
  solvedCount: { type: Number, default: 0 },
  ratedSolvedCount: { type: Number, default: 0 },
  anchors: { type: [mongoose.Schema.Types.Mixed], default: [] },
  history: { type: [new mongoose.Schema({ at: Date, rating: Number, reason: String }, { _id: false })], default: [] },
  revision: { type: Number, default: 0 }
}, { timestamps: true });
schema.index({ user: 1, scope: 1 }, { unique: true });
schema.index({ scope: 1, rating: -1, ratedSolvedCount: -1, user: 1 });
export default mongoose.model('RatingProfile', schema);
