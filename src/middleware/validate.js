const { z } = require('zod');

/**
 * Middleware factory to validate request data against a Zod schema.
 * @param {object} schemas - Object containing zod schemas for body, query, and/or params.
 * @returns {Function} Express middleware function.
 */
const validate = (schemas) => async (req, res, next) => {
  try {
    if (schemas.body) {
      req.body = await schemas.body.parseAsync(req.body);
    }
    if (schemas.query) {
      req.query = await schemas.query.parseAsync(req.query);
    }
    if (schemas.params) {
      req.params = await schemas.params.parseAsync(req.params);
    }
    return next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errList = error.errors || error.issues || [{ path: ['unknown'], message: error.message }];
      const errorMessage = errList.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
      
      // If AJAX request, return JSON
      if (req.headers['accept']?.includes('application/json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(400).json({ success: false, error: errorMessage, details: error.errors });
      }
      
      // Otherwise return status 400 with message or redirect back with flash (if implemented)
      // Since no flash is implemented, we'll send a 400 error page or message
      return res.status(400).send(`Validation Error: ${errorMessage}`);
    }
    return next(error);
  }
};

module.exports = validate;
