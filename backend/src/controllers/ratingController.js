import { randomUUID } from 'node:crypto';
import Season from '../models/Season.js';
import SeasonWriteLock from '../models/SeasonWriteLock.js';
import {
  currentSeasonFilter, publicSeason, getRatingProfile, rankingRows,
  finalizeEndedSeasons, reconcileRatingSubmissions
} from '../services/ratingService.js';

export const getMyRating = async (req, res, next) => {
  try { res.json(await getRatingProfile(req.user.id)); } catch (error) { next(error); }
};

export const listSeasons = async (_req, res, next) => {
  try {
    await reconcileRatingSubmissions();
    await finalizeEndedSeasons();
    const seasons = await Season.find().select('-results').sort({ startDate: -1 }).lean();
    res.json({ items: seasons.map((season) => publicSeason(season)) });
  } catch (error) { next(error); }
};

export const createSeason = async (req, res, next) => {
  const owner = randomUUID();
  let locked = false;
  try {
    // Serialize schedule edits across API instances on standalone MongoDB.
    try {
      locked = Boolean(await SeasonWriteLock.findOneAndUpdate({ _id: 'calendar', expiresAt: { $lte: new Date() } }, {
        $set: { owner, expiresAt: new Date(Date.now() + 30000) }
      }, { upsert: true, new: true }));
    } catch (error) { if (error.code !== 11000) throw error; }
    if (!locked) return res.status(409).json({ message: 'Another season is being created. Please retry.' });
    const payload = req.validated.body;
    const overlaps = await Season.exists({ startDate: { $lt: new Date(payload.endDate) }, endDate: { $gt: new Date(payload.startDate) } });
    if (overlaps) return res.status(409).json({ code: 'SEASON_OVERLAP', message: 'Season dates must not overlap an existing season.' });
    const season = await Season.create({ ...payload, createdBy: req.user.id });
    // Initialization remains pending in MongoDB until complete, including if the
    // API process exits after creating the season. The worker can recover it.
    try { await finalizeEndedSeasons(); } catch (error) {
      console.error('Season initialization deferred to worker', { seasonId: season.id, message: error.message });
    }
    res.status(201).json(publicSeason(await Season.findById(season._id).lean()));
  } catch (error) { next(error); } finally {
    if (locked) await SeasonWriteLock.deleteOne({ _id: 'calendar', owner });
  }
};

export const getLeaderboard = async (req, res, next) => {
  try {
    await reconcileRatingSubmissions();
    await finalizeEndedSeasons();
    const { scope, seasonId, page, limit } = req.validated.query;
    const season = scope === 'season'
      ? await Season.findOne(seasonId ? { _id: seasonId } : currentSeasonFilter()).lean()
      : null;
    if (scope === 'season' && !season) {
      if (seasonId) return res.status(404).json({ message: 'Season not found' });
      return res.json({ items: [], season: null, page, total: 0, totalPages: 1 });
    }
    const rows = season?.finalizedAt ? season.results.map((row) => ({ ...row, user: String(row.user) }))
      : await rankingRows(season ? String(season._id) : 'overall');
    res.json({
      items: rows.slice((page - 1) * limit, page * limit), season: publicSeason(season),
      page, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limit))
    });
  } catch (error) { next(error); }
};
