import Submission from '../models/Submission.js';

// 유저 랭킹 집계 — 기존 제출/문제 데이터만 읽음
//
// 흐름:
//  1) (유저, 문제)별로 묶어 최고 score와 제출 횟수(tries)를 구함 (기간 내 제출만)
//  2) 문제 총 배점(= 테스트케이스 points 합)을 붙임
//  3) 획득 점수 = best/100 × 총 배점 → 난이도 반영
//  4) 유저별 합산: 총점 / 푼 문제(solved) / 도전 문제(challenges) / 제출 수(submissions)
//  5) 활성 유저만, 총점 내림차순
export const getRanking = async ({ limit = 100, from, to } = {}) => {
  const submittedAtMatch = {};
  if (from) {
    submittedAtMatch.$gte = from;
  }
  if (to) {
    submittedAtMatch.$lte = to;
  }

  const match = { deletedAt: null };
  if (Object.keys(submittedAtMatch).length > 0) {
    match.submittedAt = submittedAtMatch;
  }

  const rows = await Submission.aggregate([
    { $match: match },
    {
      $group: {
        _id: { user: '$user', problem: '$problem' },
        bestScore: { $max: '$score' },
        tries: { $sum: 1 } // 이 문제에 대한 제출 횟수
      }
    },
    {
      $lookup: {
        from: 'problems',
        localField: '_id.problem',
        foreignField: '_id',
        as: 'problem'
      }
    },
    { $unwind: '$problem' },
    {
      $addFields: {
        problemTotal: { $sum: '$problem.testCases.points' } // 문제 총 배점
      }
    },
    {
      $addFields: {
        earned: { $multiply: [{ $divide: ['$bestScore', 100] }, '$problemTotal'] }
      }
    },
    {
      $group: {
        _id: '$_id.user',
        totalPoints: { $sum: '$earned' },
        solved: { $sum: { $cond: [{ $gte: ['$bestScore', 100] }, 1, 0] } }, // 만점 문제 수
        challenges: { $sum: 1 }, // 도전한(제출한) 서로 다른 문제 수
        submissions: { $sum: '$tries' } // 전체 제출 수
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    { $match: { 'user.deletedAt': null, 'user.isActive': true } },
    {
      $project: {
        _id: 0,
        username: '$user.username',
        // 표시 이름 — displayName 없으면 username
        name: { $ifNull: ['$user.profile.displayName', '$user.username'] },
        avatarUrl: '$user.profile.avatarUrl',
        role: '$user.role',
        totalPoints: { $round: ['$totalPoints', 2] },
        solved: 1,
        challenges: 1,
        submissions: 1
      }
    },
    { $sort: { totalPoints: -1, solved: -1, username: 1 } },
    { $limit: Math.max(1, Math.min(Number(limit) || 100, 500)) }
  ]);

  // 동점이면 같은 순위
  let rank = 0;
  let previousPoints = null;
  return rows.map((row, index) => {
    if (previousPoints === null || row.totalPoints !== previousPoints) {
      rank = index + 1;
      previousPoints = row.totalPoints;
    }
    return { rank, ...row };
  });
};

export default { getRanking };
