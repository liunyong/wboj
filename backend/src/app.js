import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';

import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import languageRoutes from './routes/languageRoutes.js';
import problemRoutes from './routes/problemRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';
import userRoutes from './routes/userRoutes.js';
import judgeRoutes from './routes/judgeRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import problemUpdateRoutes from './routes/problemUpdateRoutes.js';
import adminUserRoutes from './routes/adminUserRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import seoHeaders from './middlewares/seoHeaders.js';
import searchBotLogger from './middlewares/searchBotLogger.js';
import { serveSitemap } from './controllers/sitemapController.js';
import { env, parseTrustProxy } from './config/env.js';

const app = express();
const debugAuth = () => process.env.DEBUG_AUTH === '1';

const parseOrigin = (value) => {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch (_error) {
    return value;
  }
};

const frontendOrigin = parseOrigin(env.frontendOrigins[0]) || 'http://localhost:5173';
const judgeOrigin = parseOrigin(process.env.JUDGE0_URL);
const connectSources = ["'self'", frontendOrigin].filter(Boolean);
if (judgeOrigin) {
  connectSources.push(judgeOrigin);
}
const imgSources = ["'self'", 'https:', 'data:', 'blob:'];
const styleSources = ["'self'", "'unsafe-inline'"];
if (frontendOrigin) {
  styleSources.push(frontendOrigin);
}
const scriptSources = ["'self'"];

app.set('trust proxy', parseTrustProxy());
if (debugAuth()) {
  console.log('[auth] trust proxy enabled');
}

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'img-src': imgSources,
        'style-src': styleSources,
        'script-src': scriptSources,
        'connect-src': connectSources,
        'font-src': ["'self'", 'https:', 'data:'],
        'frame-ancestors': ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.frontendOrigins.map(parseOrigin).includes(parseOrigin(origin))) {
        return callback(null, true);
      }
      const error = new Error('Origin is not allowed');
      error.status = 403;
      error.code = 'CORS_ORIGIN_DENIED';
      return callback(error);
    },
    credentials: true
  })
);
app.use((req, res, next) => {
  const incoming = req.get('x-request-id');
  req.id = incoming && /^[A-Za-z0-9._-]{1,128}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
if (env.nodeEnv !== 'test') {
  morgan.token('request-id', (req) => req.id);
  app.use(morgan(':method :url :status :response-time ms request_id=:request-id'));
}
app.use(searchBotLogger);
app.use(seoHeaders);

const uploadStaticOptions = {
  immutable: true,
  maxAge: '7d',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('X-Robots-Tag', 'noindex');
  }
};

app.use('/uploads', express.static(path.resolve('uploads'), uploadStaticOptions));
app.use('/api/uploads', express.static(path.resolve('uploads'), uploadStaticOptions));

app.get('/api/health', (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ok' : 'degraded',
    checks: { database: databaseReady ? 'up' : 'down' }
  });
});
app.get('/api/live', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/sitemap.xml', serveSitemap);

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/problem-updates', problemUpdateRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/languages', languageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/judge', judgeRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/uploads', uploadRoutes);

app.use((err, req, res, next) => {
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  if (status >= 500) {
    console.error('Request failed', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status,
      code: err.code,
      message: err.message
    });
  }
  const body = {
    code: err.code || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR'),
    message:
      status >= 500 && env.isProduction
        ? 'Internal Server Error'
        : err.message || 'Internal Server Error'
  };
  if (err.details) {
    body.details = err.details;
  }
  res.status(status).json(body);
});

app.use((req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Not Found' });
});

export default app;
