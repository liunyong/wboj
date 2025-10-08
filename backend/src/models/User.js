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
      enum: ['admin', 'user'],
      default: 'user'
    },
    isActive: { type: Boolean, default: true },
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
            createdAt: { type: Date, default: Date.now }
          },
          { _id: false }
        )
      ],
      default: []
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);

export default User;
