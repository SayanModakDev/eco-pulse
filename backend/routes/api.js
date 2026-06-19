import express from "express";
import { trackRequestSchema } from "../utils/validators.js";
import { orchestrateCarbonTracking } from "../agents/orchestrator.js";
import { logRequestToGCP } from "../utils/gcp.js";

const router = express.Router();

import { validateRequestBody } from "../utils/middleware.js";

/**
 * POST /api/track
 * Accepts: { activityString, profileContext }
 * Returns: Consolidated carbon analysis, comparisons, and micro-challenges.
 */
router.post(
  "/track",
  validateRequestBody(trackRequestSchema),
  async (req, res, next) => {
    try {
      const { activityString, profileContext } = req.body;

      // Run the multi-agent orchestration pipeline
      const result = await orchestrateCarbonTracking({
        activityString,
        profileContext,
      });

      // Fire off non-blocking logging to GCP Firestore, Cloud Logging, and Cloud Storage
      logRequestToGCP(activityString, result, profileContext);

      res.status(200).json({
        success: true,
        message: "Carbon analysis completed successfully",
        data: result,
      });
    } catch (error) {
      next(error); // Forward unexpected errors to the global error handler
    }
  },
);

export default router;
