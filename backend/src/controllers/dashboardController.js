import mongoose from 'mongoose';
import Submission from '../models/Submission.js';
import UserStatsDaily from '../models/UserStatsDaily.js';
import Problem from '../models/Problem.js';

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

export const getProgress = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const normalizeProblemId = (raw) => {
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return raw;
      }
      if (typeof raw === 'string' && raw.trim()) {
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    const [progress] =
      (await Submission.aggregate([
        {
          $match: {
            user: userId,
            deletedAt: null
          }
        },
        {
          $facet: {
            solved: [
              { $match: { verdict: 'AC' } },
              { $sort: { submittedAt: -1, createdAt: -1 } },
              {
                $group: {
                  _id: '$problem',
                  problemId: { $first: '$problemId' },
                  problemTitle: { $first: '$problemTitle' },
                  lastSubmissionAt: {
                    $first: {
                      $ifNull: ['$finishedAt', { $ifNull: ['$submittedAt', '$createdAt'] }]
                    }
                  }
                }
              },
              {
                $lookup: {
                  from: Problem.collection.name,
                  let: { problemRef: '$_id', legacyId: '$problemId' },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $or: [
                            { $eq: ['$_id', '$$problemRef'] },
                            {
                              $and: [
                                { $ne: ['$$legacyId', null] },
                                { $eq: ['$problemId', '$$legacyId'] }
                              ]
                            }
                          ]
                        }
                      }
                    },
                    { $project: { slug: 1, title: 1, problemId: 1 } }
                  ],
                  as: 'problemDoc'
                }
              },
              {
                $addFields: {
                  problemDoc: { $first: '$problemDoc' }
                }
              },
              {
                $project: {
                  problemObjectId: '$_id',
                  problemId: {
                    $ifNull: ['$problemDoc.problemId', '$problemId']
                  },
                  title: {
                    $ifNull: ['$problemDoc.title', '$problemTitle']
                  },
                  slug: '$problemDoc.slug'
                }
              },
              {
                $addFields: {
                  title: {
                    $cond: {
                      if: {
                        $and: [{ $ne: ['$title', null] }, { $ne: ['$title', ''] }]
                      },
                      then: '$title',
                      else: {
                        $concat: ['Problem #', { $toString: '$problemId' }]
                      }
                    }
                  }
                }
              },
              { $sort: { problemId: 1 } }
            ],
            attempted: [
              { $match: { verdict: { $ne: 'AC' } } },
              { $sort: { submittedAt: -1, createdAt: -1 } },
              {
                $group: {
                  _id: '$problem',
                  problemId: { $first: '$problemId' },
                  problemTitle: { $first: '$problemTitle' },
                  lastSubmissionAt: {
                    $first: {
                      $ifNull: ['$finishedAt', { $ifNull: ['$submittedAt', '$createdAt'] }]
                    }
                  },
                  latestVerdict: { $first: '$verdict' },
                  latestStatus: { $first: '$status' }
                }
              },
              {
                $lookup: {
                  from: Problem.collection.name,
                  let: { problemRef: '$_id', legacyId: '$problemId' },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $or: [
                            { $eq: ['$_id', '$$problemRef'] },
                            {
                              $and: [
                                { $ne: ['$$legacyId', null] },
                                { $eq: ['$problemId', '$$legacyId'] }
                              ]
                            }
                          ]
                        }
                      }
                    },
                    { $project: { slug: 1, title: 1, problemId: 1 } }
                  ],
                  as: 'problemDoc'
                }
              },
              {
                $addFields: {
                  problemDoc: { $first: '$problemDoc' }
                }
              },
              {
                $project: {
                  problemObjectId: '$_id',
                  problemId: {
                    $ifNull: ['$problemDoc.problemId', '$problemId']
                  },
                  title: {
                    $ifNull: ['$problemDoc.title', '$problemTitle']
                  },
                  slug: '$problemDoc.slug',
                  latestVerdict: '$latestVerdict',
                  latestStatus: '$latestStatus'
                }
              },
              {
                $addFields: {
                  title: {
                    $cond: {
                      if: {
                        $and: [{ $ne: ['$title', null] }, { $ne: ['$title', ''] }]
                      },
                      then: '$title',
                      else: {
                        $concat: ['Problem #', { $toString: '$problemId' }]
                      }
                    }
                  }
                }
              },
              { $sort: { problemId: 1 } }
            ]
          }
        },
        {
          $set: {
            solvedIds: {
              $setUnion: [
                {
                  $map: {
                    input: '$solved',
                    as: 'entry',
                    in: '$$entry.problemId'
                  }
                },
                []
              ]
            }
          }
        },
        {
          $set: {
            solved: {
              $filter: {
                input: '$solved',
                as: 'entry',
                cond: {
                  $and: [
                    { $ne: ['$$entry.problemId', null] },
                    { $ne: ['$$entry.problemId', undefined] }
                  ]
                }
              }
            },
            attempted: {
              $filter: {
                input: '$attempted',
                as: 'entry',
                cond: {
                  $and: [
                    { $ne: ['$$entry.problemId', null] },
                    { $ne: ['$$entry.problemId', undefined] },
                    { $not: { $in: ['$$entry.problemId', '$solvedIds'] } }
                  ]
                }
              }
            }
          }
        },
        {
          $project: {
            solved: {
              problemObjectId: 0
            },
            attempted: {
              problemObjectId: 0
            }
          }
        }
      ])) ?? [];

    const solved = Array.isArray(progress?.solved)
      ? progress.solved.map((entry) => ({
          problemId: normalizeProblemId(entry.problemId),
          title: entry.title,
          slug: entry.slug ?? null
        }))
      : [];

    const attempted = Array.isArray(progress?.attempted)
      ? progress.attempted.map((entry) => ({
          problemId: normalizeProblemId(entry.problemId),
          title: entry.title,
          slug: entry.slug ?? null,
          latestVerdict: entry.latestVerdict ?? null,
          latestStatus: entry.latestStatus ?? null
        }))
      : [];

    const uniqueSolved = solved.filter(
      (entry) => Number.isFinite(entry.problemId) && entry.problemId !== null
    );
    const uniqueAttempted = attempted.filter(
      (entry) =>
        Number.isFinite(entry.problemId) &&
        entry.problemId !== null &&
        !uniqueSolved.some((solvedEntry) => solvedEntry.problemId === entry.problemId)
    );

    uniqueSolved.sort((a, b) => a.problemId - b.problemId);
    uniqueAttempted.sort((a, b) => a.problemId - b.problemId);

    res.json({
      solved: uniqueSolved,
      attempted: uniqueAttempted
    });
  } catch (error) {
    next(error);
  }
};
