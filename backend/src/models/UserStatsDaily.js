import mongoose from 'mongoose';

const userStatsDailySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    submitCount: { type: Number, default: 0, min: 0 },
    acCount: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true, collection: 'user_stats_daily' }
);

userStatsDailySchema.index({ user: 1, date: 1 }, { unique: true });

const UserStatsDaily = mongoose.model('UserStatsDaily', userStatsDailySchema);

export default UserStatsDaily;
