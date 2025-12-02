const defaultBots = ['googlebot', 'bingbot', 'duckduckbot', 'yandexbot', 'baiduspider', 'petalbot', 'semrushbot'];
const botPatterns = defaultBots.map((agent) => new RegExp(agent, 'i'));

const searchBotLogger = (req, _res, next) => {
  const userAgent = req.get('user-agent') || '';
  if (botPatterns.some((pattern) => pattern.test(userAgent))) {
    const timestamp = new Date().toISOString();
    console.info(`[crawler] ${timestamp} ${req.method} ${req.originalUrl} :: ${userAgent}`);
  }
  next();
};

export default searchBotLogger;
