import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: String,
  rank: Number,
  rating: Number,
  solvedCount: Number,
  ratedSolvedCount: Number
}, { _id: false });

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  active: { type: Boolean, default: true },
  finalizedAt: { type: Date, default: null },
  ratingsInitializedAt: { type: Date, default: null },
  results: { type: [resultSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
schema.index({ startDate: 1, endDate: 1 });
export default mongoose.model('Season', schema);
