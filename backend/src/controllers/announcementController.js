import Announcement from '../models/Announcement.js';

const sanitizeAnnouncement = (announcement) => ({
  id: announcement._id.toString(),
  title: announcement.title,
  body: announcement.body,
  pinned: Boolean(announcement.pinned),
  author: announcement.author?._id
    ? {
        id: announcement.author._id.toString(),
        username: announcement.author.username
      }
    : announcement.author
    ? {
        id: announcement.author.toString(),
        username: null
      }
    : null,
  createdAt: announcement.createdAt,
  updatedAt: announcement.updatedAt
});

export const listAnnouncements = async (req, res, next) => {
  try {
    const { limit = 20, pinnedFirst = true } = req.validated?.query || {};

    const query = Announcement.find()
      .populate('author', 'username')
      .limit(limit);

    if (pinnedFirst) {
      query.sort({ pinned: -1, createdAt: -1 });
    } else {
      query.sort({ createdAt: -1 });
    }

    const items = await query.lean({ virtuals: false });

    res.json({ items: items.map(sanitizeAnnouncement) });
  } catch (error) {
    next(error);
  }
};

export const createAnnouncement = async (req, res, next) => {
  try {
    const { title, body, pinned = false } = req.validated?.body || req.body;

    const announcement = await Announcement.create({
      title,
      body,
      pinned,
      author: req.user.id
    });

    await announcement.populate('author', 'username');

    res.status(201).json({ announcement: sanitizeAnnouncement(announcement) });
  } catch (error) {
    next(error);
  }
};

export const updateAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.validated?.params || req.params;
    const updates = req.validated?.body || req.body || {};

    const announcement = await Announcement.findById(id).populate('author', 'username');
    if (!announcement) {
      return res
        .status(404)
        .json({ code: 'ANNOUNCEMENT_NOT_FOUND', message: 'Announcement not found' });
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'title')) {
      announcement.title = updates.title;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'body')) {
      announcement.body = updates.body;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'pinned')) {
      announcement.pinned = Boolean(updates.pinned);
    }

    await announcement.save();

    res.json({ announcement: sanitizeAnnouncement(announcement) });
  } catch (error) {
    next(error);
  }
};

export const deleteAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.validated?.params || req.params;
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res
        .status(404)
        .json({ code: 'ANNOUNCEMENT_NOT_FOUND', message: 'Announcement not found' });
    }

    await announcement.deleteOne();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
