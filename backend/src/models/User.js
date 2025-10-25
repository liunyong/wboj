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
    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, default: null },
    emailVerificationExpires: { type: Date, default: null },
    emailVerificationSentAt: { type: Date, default: null },
    passwordResetTokenHash: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },
    passwordResetSentAt: { type: Date, default: null },
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
userSchema.index({ emailVerificationTokenHash: 1 }, { sparse: true });
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

const User = mongoose.model('User', userSchema);

export default User;
