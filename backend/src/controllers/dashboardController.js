import mongoose from 'mongoose';
import Submission from '../models/Submission.js';
import UserStatsDaily from '../models/UserStatsDaily.js';

const createDateRange = (year) => {
  const numericYear = Number.parseInt(year, 10);
  if (!Number.isFinite(numericYear) || numericYear < 1970) {
    const now = new Date();
    return {
      year: now.getUTCFullYear(),
      start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
      end: new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1))
    };
  }
  return {
    year: numericYear,
    start: new Date(Date.UTC(numericYear, 0, 1)),
    end: new Date(Date.UTC(numericYear + 1, 0, 1))
  };
};

export const getSummary = async (req, res, next) => {
  try {
    const { year, start, end } = createDateRange(req.query?.year);
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const results = await Submission.aggregate([
      {
        $match: {
          user: userId,
          submittedAt: { $gte: start, $lt: end },
          deletedAt: null
        }
      },
      {
        $group: {
          _id: '$verdict',
          count: { $sum: 1 }
        }
      }
    ]);

    const summary = {
      year,
      totalSubmissions: 0,
      totalAC: 0,
      totalWA: 0,
      totalTLE: 0,
      totalRTE: 0,
      totalCE: 0,
      totalMLE: 0,
      totalPE: 0,
      totalIE: 0
    };

    results.forEach((entry) => {
      const verdict = entry?._id;
      const count = entry?.count ?? 0;
      summary.totalSubmissions += count;
      if (summary[`total${verdict}`] !== undefined) {
        summary[`total${verdict}`] += count;
      }
    });

    res.json(summary);
  } catch (error) {
    next(error);
  }
};

export const getHeatmap = async (req, res, next) => {
  try {
    const { year, start, end } = createDateRange(req.query?.year);
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const stats = await UserStatsDaily.find({
      user: userId,
      date: {
        $gte: `${year}-01-01`,
        $lte: `${year}-12-31`
      }
    })
      .sort({ date: 1 })
      .lean();

    if (stats.length) {
      return res.json({
        year,
        items: stats.map((entry) => ({
          date: entry.date,
          submitCount: entry.submitCount ?? 0,
          acCount: entry.acCount ?? 0
        }))
      });
    }

    const results = await Submission.aggregate([
      {
        $match: {
          user: userId,
          submittedAt: { $gte: start, $lt: end },
          deletedAt: null
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' }
          },
          submitCount: { $sum: 1 },
          acCount: {
            $sum: {
              $cond: [{ $eq: ['$verdict', 'AC'] }, 1, 0]
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      year,
      items: results.map((entry) => ({
        date: entry._id,
        submitCount: entry.submitCount,
        acCount: entry.acCount
      }))
    });
  } catch (error) {
    next(error);
  }
};
