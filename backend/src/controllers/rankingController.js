import { getRanking } from '../services/rankingService.js';

const parseDateParam = (value) => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const listRanking = async (req, res, next) => {
  try {
    const limit = Number.parseInt(req.query.limit ?? '100', 10);
    const from = parseDateParam(req.query.from);
    // 종료일은 하루 끝까지 포함되도록 다음날 00:00 직전까지로 처리
    const to = parseDateParam(req.query.to);
    if (to) {
      to.setHours(23, 59, 59, 999);
    }
    const items = await getRanking({ limit, from, to });
    res.json({ items });
  } catch (error) {
    next(error);
  }
};

export default { listRanking };
