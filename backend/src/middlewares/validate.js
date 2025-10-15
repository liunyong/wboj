import { ZodError } from 'zod';

const buildErrorDetails = (error) =>
  error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message
  }));

const debugAuth = () => process.env.DEBUG_AUTH === '1';

export const validate = ({ body, query, params }) => (req, res, next) => {
  try {
    const validated = {};

    if (body) {
      validated.body = body.parse(req.body);
    }

    if (query) {
      validated.query = query.parse(req.query);
    }

    if (params) {
      validated.params = params.parse(req.params);
    }

    req.validated = { ...(req.validated || {}), ...validated };
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const details = buildErrorDetails(error);
      if (debugAuth() && req.originalUrl?.startsWith('/api/auth')) {
        console.warn('[auth] validation failed', {
          route: req.originalUrl,
          details
        });
      }
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details
      });
      return;
    }

    next(error);
  }
};

export default validate;
