import User from '../models/User.js';

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  username: user.username,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  profile: user.profile ?? {},
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

export const listUsers = async (req, res, next) => {
  try {
    const { search, role, isActive, limit = 50 } = req.validated?.query || {};

    const filters = {};

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
      .select('username email role isActive profile createdAt updatedAt');

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
    const { isActive } = req.validated?.body || req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    user.isActive = isActive;
    if (!isActive) {
      user.sessions = [];
    }

    await user.save();

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
};
