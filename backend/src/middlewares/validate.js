import { ZodError } from 'zod';

const buildErrorResponse = (error) =>
  error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message
  }));

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
      res.status(400).json({
        message: 'Validation failed',
        errors: buildErrorResponse(error)
      });
      return;
    }

    next(error);
  }
};

export default validate;
