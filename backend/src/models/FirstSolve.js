import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
  acceptedAt: { type: Date, required: true },
  problemId: Number,
  problemTitle: String,
  difficultySnapshot: { type: mongoose.Schema.Types.Mixed, default: undefined }
}, { timestamps: true });
schema.index({ user: 1, problem: 1 }, { unique: true });
schema.index({ problem: 1, user: 1 });
schema.index({ acceptedAt: 1, user: 1 });
export default mongoose.model('FirstSolve', schema);
