import { z } from 'zod';

/**
 * Middleware factory that validates the request against a Zod schema.
 * * @param {z.ZodSchema} schema - The Zod schema to validate against
 * @returns {Function} Express middleware
 */
export const validate = (schema) => (req, res, next) => {
  try {
    // Validate body, query, and params together
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Return a structured error format
      return res.status(400).json({
        error: "Validation Failed",
        details: error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      });
    }
    
    // Fallback for unexpected errors during validation
    return res.status(500).json({ error: "Internal Validation Error" });
  }
};