import { clearLanguageCache, fetchJudge0Languages } from '../services/judge0Service.js';

export const listLanguages = async (req, res, next) => {
  try {
    const { forceRefresh = false } = req.validated?.query || {};

    if (forceRefresh) {
      clearLanguageCache();
    }

    const languages = await fetchJudge0Languages();
    res.json(languages);
  } catch (error) {
    next(error);
  }
};
