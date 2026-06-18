import express from 'express';
import { trackRequestSchema } from '../utils/validators.js';
import { orchestrateCarbonTracking } from '../agents/orchestrator.js';

const router = express.Router();

// Validation Middleware Helper
const validateRequestBody = (schema) => {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error); // Forward Zod validation error to global error handler
    }
  };
};

/**
 * POST /api/track
 * Accepts: { activityString, profileContext }
 * Returns: Consolidated carbon analysis, comparisons, and micro-challenges.
 */
router.post('/track', validateRequestBody(trackRequestSchema), async (req, res, next) => {
  try {
    const { activityString, profileContext } = req.body;

    // Run the multi-agent orchestration pipeline
    const result = await orchestrateCarbonTracking({
      activityString,
      profileContext,
    });

    res.status(200).json({
      success: true,
      message: 'Carbon analysis completed successfully',
      data: result,
    });
  } catch (error) {
    next(error); // Forward unexpected errors to the global error handler
  }
});

export default router;
