import mongoose from 'mongoose';
import User from '../models/User.js';
import Submission from '../models/Submission.js';
import Problem from '../models/Problem.js';
import Announcement from '../models/Announcement.js';
import UserStatsDaily from '../models/UserStatsDaily.js';
import { getRatingProfile } from '../services/ratingService.js';
import FirstSolve from '../models/FirstSolve.js';
import RatingProfile from '../models/RatingProfile.js';
import Season from '../models/Season.js';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  username: user.username,
  email: user.email,
  emailVerified: user.emailVerified ?? false,
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
    const { search, role, isActive, page = 1, limit = 25 } = req.validated?.query || {};

    const filters = { deletedAt: null };

    if (search) {
      const searchRegex = new RegExp(escapeRegExp(search.trim()), 'i');
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

    const [users, total] = await Promise.all([
      User.find(filters)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(
          'username email emailVerified role isActive deletedAt profile profilePublic createdAt updatedAt'
        ),
      User.countDocuments(filters)
    ]);

    res.json({
      items: users.map(sanitizeUser),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    });
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

export const deleteUsersPermanently = async (req, res, next) => {
  try {
    const ids = req.validated?.body?.ids ?? [req.validated?.params?.id || req.params.id];
    if (ids.includes(req.user.id)) {
      return res.status(400).json({
        code: 'CANNOT_DELETE_SELF',
        message: 'You cannot delete your own account while signed in'
      });
    }

    const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
    const users = await User.find({ _id: { $in: objectIds } }).select('_id');
    if (!users.length) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'No users found' });
    }
    const existingIds = users.map((user) => user._id);
    const affectedProblemIds = await Submission.distinct('problem', {
      user: { $in: existingIds }
    });

    await Promise.all([
      Submission.deleteMany({ user: { $in: existingIds } }),
      UserStatsDaily.deleteMany({ user: { $in: existingIds } }),
      FirstSolve.deleteMany({ user: { $in: existingIds } }),
      RatingProfile.deleteMany({ user: { $in: existingIds } }),
      Season.updateMany({ 'results.user': { $in: existingIds } }, {
        $set: { 'results.$[result].user': null, 'results.$[result].username': 'Deleted user' }
      }, { arrayFilters: [{ 'result.user': { $in: existingIds } }] }),
      Problem.updateMany({ author: { $in: existingIds } }, { $unset: { author: 1 } }),
      Announcement.updateMany({ author: { $in: existingIds } }, { $unset: { author: 1 } })
    ]);
    await User.deleteMany({ _id: { $in: existingIds } });

    await Promise.all(
      affectedProblemIds.filter(Boolean).map(async (problemId) => {
        const filter = { problem: problemId, deletedAt: null, finishedAt: { $ne: null } };
        const [submissionCount, acceptedSubmissionCount] = await Promise.all([
          Submission.countDocuments(filter),
          Submission.countDocuments({ ...filter, verdict: 'AC' })
        ]);
        await Problem.updateOne(
          { _id: problemId },
          { $set: { submissionCount, acceptedSubmissionCount } },
          { timestamps: false }
        );
      })
    );

    const deletedIds = existingIds.map(String);
    const payload = {
      deletedCount: deletedIds.length,
      deletedIds,
      notFoundIds: ids.filter((id) => !deletedIds.includes(id))
    };
    if (req.params.id) {
      return res.status(204).send();
    }
    return res.json(payload);
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
      attempted: normalizedAttempted,
      ratings: await getRatingProfile(userId)
    });
  } catch (error) {
    next(error);
  }
};
