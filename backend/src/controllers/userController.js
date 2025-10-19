import mongoose from 'mongoose';
import User from '../models/User.js';
import Submission from '../models/Submission.js';

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  username: user.username,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  deletedAt: user.deletedAt ?? null,
  profile: user.profile ?? {},
  profilePublic: user.profilePublic ?? false,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

export const listUsers = async (req, res, next) => {
  try {
    const { search, role, isActive, limit = 50 } = req.validated?.query || {};

    const filters = { deletedAt: null };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filters.$or = [
        { username: searchRegex },
        { email: searchRegex },
        { 'profile.displayName': searchRegex }
      ];
    }

    if (role) {
      filters.role = role;
    }

    if (typeof isActive === 'boolean') {
      filters.isActive = isActive;
    }

    const users = await User.find(filters)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('username email role isActive deletedAt profile profilePublic createdAt updatedAt');

    res.json({ items: users.map(sanitizeUser) });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.validated?.params || req.params;
    const { role } = req.validated?.body || req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    if (user.deletedAt) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    user.role = role;
    await user.save();

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.validated?.params || req.params;
    const { isActive } = req.validated?.body || {};
    const nextStatus = typeof isActive === 'boolean' ? isActive : false;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    if (user.deletedAt) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    user.isActive = nextStatus;
    if (!nextStatus) {
      user.sessions = [];
    }

    await user.save();

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};

export const deleteUserKeepSubmissions = async (req, res, next) => {
  try {
    const { id } = req.validated?.params || req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    if (user.deletedAt) {
      return res.status(204).send();
    }

    const userId = user._id;

    try {
      await Submission.updateMany(
        {
          user: userId,
          $or: [{ userName: { $exists: false } }, { userName: null }, { userName: '' }]
        },
        { $set: { userName: user.username } }
      );
    } catch (submissionError) {
      console.error('Failed to backfill submission usernames before user deletion', submissionError);
    }

    user.deletedAt = new Date();
    user.isActive = false;
    user.sessions = [];
    await user.save();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const updateProfileVisibility = async (req, res, next) => {
  try {
    const { profilePublic } = req.validated?.body || req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    if (user.deletedAt) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    user.profilePublic = Boolean(profilePublic);
    await user.save();

    res.json({ profilePublic: user.profilePublic });
  } catch (error) {
    next(error);
  }
};

export const getUserDashboard = async (req, res, next) => {
  try {
    const { username } = req.validated?.params || req.params;
    const normalizedUsername = username.trim();

    const user = await User.findOne({ username: normalizedUsername, deletedAt: null });
    if (!user) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const viewerId = req.user?.id;
    const isSelf = viewerId === user._id.toString();
    const isAdmin = ['admin', 'super_admin'].includes(req.user?.role);

    if (!user.profilePublic && !isSelf && !isAdmin) {
      return res.status(403).json({ code: 'PROFILE_PRIVATE', message: 'Profile is private' });
    }

    const userId = new mongoose.Types.ObjectId(user._id);

    const solved = await Submission.aggregate([
      {
        $match: {
          user: userId,
          verdict: 'AC',
          deletedAt: null
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$problemId',
          submissionId: { $first: '$_id' },
          problemTitle: { $first: '$problemTitle' },
          acceptedAt: {
            $first: {
              $ifNull: ['$finishedAt', { $ifNull: ['$createdAt', '$submittedAt'] }]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          problemId: '$_id',
          problemTitle: '$problemTitle',
          latestAcceptedSubmissionId: '$submissionId',
          acceptedAt: '$acceptedAt'
        }
      },
      { $sort: { acceptedAt: -1 } }
    ]);

    const solvedProblemIds = new Set(
      solved
        .map((entry) => entry.problemId)
        .filter((value) => typeof value === 'number' && Number.isFinite(value))
    );

    const attemptedRaw = await Submission.aggregate([
      {
        $match: {
          user: userId,
          verdict: { $ne: 'AC' },
          deletedAt: null
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$problemId',
          problemTitle: { $first: '$problemTitle' },
          lastTriedAt: {
            $first: {
              $ifNull: ['$finishedAt', { $ifNull: ['$createdAt', '$submittedAt'] }]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          problemId: '$_id',
          problemTitle: '$problemTitle',
          lastTriedAt: '$lastTriedAt'
        }
      },
      { $sort: { lastTriedAt: -1 } }
    ]);

    const attempted = attemptedRaw.filter((entry) => {
      if (entry.problemId === null || entry.problemId === undefined) {
        return false;
      }
      if (solvedProblemIds.has(entry.problemId)) {
        return false;
      }
      return true;
    });

    const normalizedSolved = solved.map((entry) => ({
      problemId: entry.problemId,
      problemTitle: entry.problemTitle ?? `Problem #${entry.problemId}`,
      latestAcceptedSubmissionId: entry.latestAcceptedSubmissionId?.toString(),
      acceptedAt: entry.acceptedAt
    }));

    const normalizedAttempted = attempted.map((entry) => ({
      problemId: entry.problemId,
      problemTitle: entry.problemTitle ?? `Problem #${entry.problemId}`,
      lastTriedAt: entry.lastTriedAt
    }));

    res.json({
      user: {
        id: user._id.toString(),
        username: user.username,
        profilePublic: user.profilePublic ?? false
      },
      solved: normalizedSolved,
      attempted: normalizedAttempted
    });
  } catch (error) {
    next(error);
  }
};
