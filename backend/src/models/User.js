import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    displayName: { type: String, trim: true },
    bio: { type: String, trim: true },
    avatarUrl: { type: String, trim: true }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    passwordChangedAt: { type: Date, default: Date.now },
    role: {
      type: String,
      enum: ['user', 'admin', 'super_admin'],
      default: 'user'
    },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    profile: {
      type: profileSchema,
      default: () => ({})
    },
    sessions: {
      type: [
        new mongoose.Schema(
          {
            tokenHash: { type: String, required: true },
            expiresAt: { type: Date, required: true },
            inactivityExpiresAt: { type: Date, default: null },
            lastTouchedAt: { type: Date, default: Date.now },
            createdAt: { type: Date, default: Date.now }
          },
          { _id: false }
        )
      ],
      default: []
    },
    profilePublic: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, deletedAt: 1 });

const User = mongoose.model('User', userSchema);

export default User;
