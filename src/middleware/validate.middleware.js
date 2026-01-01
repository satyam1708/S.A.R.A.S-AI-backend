import { z } from 'zod';
import logger from '../lib/logger.js';

export const validate = (schema) => (req, res, next) => {
  try {
    // 1. Parse and Transform
    // This allows Zod to strip empty strings or convert numbers
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    // 2. Assign cleaned data back to request
    // This is critical for the "empty string -> undefined" transformation to reach the controller
    req.body = parsed.body;
    req.query = parsed.query;
    req.params = parsed.params;

    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      // 3. Robust Error Mapping
      // Uses error.errors (standard Zod) but falls back gracefully
      const errors = error.errors || []; 
      
      const details = errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));

      return res.status(400).json({
        error: "Validation Failed",
        details: details
      });
    }
    
    logger.error(`Validation Middleware Crash: ${error.message}`);
    return res.status(500).json({ error: "Internal Validation Error" });
  }
};