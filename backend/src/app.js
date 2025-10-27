import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
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

const app = express();
const debugAuth = () => process.env.DEBUG_AUTH === '1';

app.set('trust proxy', 1);
if (debugAuth()) {
  console.log('[auth] trust proxy enabled');
}

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'img-src': ["'self'", 'https:'],
        'style-src': ["'self'", "'unsafe-inline'"]
      }
    }
  })
);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.use(
  '/uploads',
  express.static(path.resolve('uploads'), {
    immutable: true,
    maxAge: '7d'
  })
);
app.use(
  '/api/uploads',
  express.static(path.resolve('uploads'), {
    immutable: true,
    maxAge: '7d'
  })
);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
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
  console.error(err);
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const body = {
    code: err.code || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR'),
    message: err.message || 'Internal Server Error'
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
