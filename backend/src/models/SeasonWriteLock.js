import mongoose from 'mongoose';

export default mongoose.model('SeasonWriteLock', new mongoose.Schema({
  _id: String, owner: String, expiresAt: Date
}));
