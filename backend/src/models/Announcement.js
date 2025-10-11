import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pinned: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

announcementSchema.index({ pinned: -1, createdAt: -1 });
announcementSchema.index({ createdAt: -1 });

const Announcement = mongoose.model('Announcement', announcementSchema);

export default Announcement;
