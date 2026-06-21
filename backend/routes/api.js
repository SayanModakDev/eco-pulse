import express from "express";
import { validateRequestBody, sendValidatedResponse } from "../utils/middleware.js";
import { trackRequestSchema, trackResponseSchema, sanitizePromptInput } from "../utils/validators.js";
import { orchestrateCarbonTracking } from "../agents/orchestrator.js";
import { logRequestToGCP } from "../utils/gcp.js";

const router = express.Router();

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

      const result = await orchestrateCarbonTracking({
        activityString,
        profileContext,
      });

      // Non-blocking logging to GCP
      logRequestToGCP(
        sanitizePromptInput(activityString).slice(0, 150),
        result,
        profileContext
      );

      const payload = {
        success: true,
        message: "Carbon analysis completed successfully",
        data: result,
      };

      return sendValidatedResponse(req, res, trackResponseSchema, payload);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
