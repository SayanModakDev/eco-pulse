import { GoogleGenAI } from "@google/genai";
import { EXTRACTION_AGENT_PROMPT, INSIGHTS_AGENT_PROMPT } from "./prompts.js";
import { emissionFactorCache, resultCache } from "../utils/cache.js";
import {
  extractNumbers,
  extractTransportActivities,
  extractFoodActivities,
  extractEnergyActivities,
  extractWasteActivities,
  deduplicateActivities,
} from "./extractors.js";
import { processActivity } from "./calculationHelpers.js";
import {
  defaultChallenges,
  defaultSummaryInsights,
} from "./insightsFallbacks.js";
import { EMISSION_FACTORS } from "../utils/constants.js";
import { sanitizePromptInput } from "../utils/validators.js";
import { logger } from "../utils/logger.js";

/**
 * @fileoverview Multi-Agent Orchestration Layer
 * Sequences the 3 core agents (Extraction, Calculation, Insights)
 * and leverages local memory caching for efficiency.
 */

/**
 * Centralized dev-only logger. Keeps no-console rule clean and scoped.
 */
// Replaced by external logger.js

/** Initialize the Google Gen AI client if API key is available. */
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

/**
 * Gemini Structured Output response schema shared by the Extraction Agent.
 * @type {Object}
 */
const EXTRACTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    activities: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          category: {
            type: "STRING",
            enum: ["transport", "food", "energy", "waste", "other"],
          },
          value: { type: "NUMBER" },
          unit: { type: "STRING" },
          description: { type: "STRING" },
        },
        required: ["category", "value", "unit", "description"],
      },
    },
  },
  required: ["activities"],
};

/**
 * Gemini Structured Output response schema shared by the Insights Agent.
 * @type {Object}
 */
const INSIGHTS_SCHEMA = {
  type: "OBJECT",
  properties: {
    microChallenges: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          estimatedCO2SavingsKg: { type: "NUMBER" },
          difficulty: {
            type: "STRING",
            enum: ["easy", "medium", "hard"],
          },
          category: {
            type: "STRING",
            enum: ["transport", "food", "energy", "waste", "other"],
          },
        },
        required: [
          "title",
          "description",
          "estimatedCO2SavingsKg",
          "difficulty",
          "category",
        ],
      },
    },
    summaryInsight: { type: "STRING" },
  },
  required: ["microChallenges", "summaryInsight"],
};

/**
 * Agent 1: Extraction Agent
 * Parses the natural language activity string using Gemini Structured Outputs
 * with low temperature for deterministic extraction, or falls back to an
 * enhanced keyword extractor.
 *
 * @param {string} activityString - The raw user input describing their activities.
 * @returns {Promise<Array<{category: string, value: number, unit: string, description: string}>>}
 */
async function runExtractionAgent(activityString) {
  const safeActivity = sanitizePromptInput(activityString);
  if (ai) {
    try {
      logger.info("[Agent 1] LLM Extraction...");
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Extract activities from: "${safeActivity}"`,
        config: {
          systemInstruction: EXTRACTION_AGENT_PROMPT,
          responseMimeType: "application/json",
          responseSchema: EXTRACTION_SCHEMA,
          temperature: 0.1,
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        return Array.isArray(parsed.activities) ? parsed.activities : [];
      }
    } catch (err) {
      logger.error(`[Agent 1] LLM failed: ${err.message}`);
    }
  }

  // Deterministic Fallback
  const text = activityString.toLowerCase();
  const matches = extractNumbers(text);

  const activities = [
    ...extractTransportActivities(text, matches),
    ...extractFoodActivities(text, matches),
    ...extractEnergyActivities(text, matches),
    ...extractWasteActivities(text, matches),
  ];

  const uniqueActivities = deduplicateActivities(activities);

  if (uniqueActivities.length === 0) {
    uniqueActivities.push({
      category: "other",
      value: 1,
      unit: "activity",
      description: `Generic: ${activityString.substring(0, 50)}`,
    });
  }

  return uniqueActivities;
}

/**
 * Agent 2: Calculation & Decision Agent
 * Deterministically maps extracted data points to standardized CO2e factors.
 * Employs emission factor cache for repeated lookups.
 *
 * @param {Array<Object>} activities - The structured activities from Agent 1.
 * @param {Object} [profileContext] - User profile for baseline and preferences.
 * @returns {Object} The analyzed activities and summary data.
 */
function runCalculationAgent(activities, profileContext = {}) {
  const dailyBaselineKg = profileContext.dailyBaselineKg || 15.0;

  let totalCo2eKg = 0;
  let highestEmissionValue = -1;
  let highestEmissionActivity = null;

  const analyzedActivities = activities.map((activity) => {
    const analyzed = processActivity(
      activity,
      EMISSION_FACTORS,
      emissionFactorCache,
    );

    totalCo2eKg += analyzed.co2eKg;

    if (analyzed.co2eKg > highestEmissionValue) {
      highestEmissionValue = analyzed.co2eKg;
      highestEmissionActivity = analyzed;
    }

    return analyzed;
  });

  totalCo2eKg = parseFloat(totalCo2eKg.toFixed(2));

  const differenceKg = parseFloat((totalCo2eKg - dailyBaselineKg).toFixed(2));
  const percentageDifference = parseFloat(
    ((differenceKg / dailyBaselineKg) * 100).toFixed(1),
  );
  const status =
    totalCo2eKg <= dailyBaselineKg ? "under_baseline" : "over_baseline";

  return {
    activities: analyzedActivities,
    summary: {
      totalCo2eKg,
      dailyBaselineKg,
      differenceKg,
      percentageDifference,
      status,
      hotspot: highestEmissionActivity,
    },
  };
}

/**
 * Agent 3: Insights & Mitigation Agent
 * Generates hyper-personalized micro-challenges targeting the primary hotspot.
 *
 * @param {Object} calculationResults - The output from Agent 2.
 * @returns {Promise<{microChallenges: Array<Object>, summaryInsight: string}>}
 */
async function runInsightsAgent(calculationResults) {
  const hotspot = calculationResults.summary.hotspot;
  const hotspotCategory = hotspot ? hotspot.category : "other";

  if (ai) {
    try {
      const calcJson = JSON.stringify(calculationResults);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          `Generate micro-challenges for carbon hotspot `,
          `category: "${hotspotCategory}" `,
          `in the context of: ${calcJson}`,
        ].join(""),
        config: {
          systemInstruction: INSIGHTS_AGENT_PROMPT,
          responseMimeType: "application/json",
          responseSchema: INSIGHTS_SCHEMA,
          temperature: 0.2,
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        if (parsed && Array.isArray(parsed.microChallenges)) {
          const challengesWithProjections = parsed.microChallenges.map((mc, idx) => {
            const savings = mc.estimatedCO2SavingsKg || mc.potentialSavingKg || 0;
            return {
              id: `llm-challenge-${idx}`,
              title: mc.title,
              description: mc.description,
              category: mc.category,
              difficulty: mc.difficulty,
              estimatedCO2SavingsKg: savings,
              projections: {
                weekly: parseFloat((savings * 7).toFixed(2)),
                monthly: parseFloat((savings * 30).toFixed(2)),
                annual: parseFloat((savings * 365).toFixed(2)),
              },
            };
          });

          return {
            microChallenges: challengesWithProjections,
            summaryInsight: parsed.summaryInsight || "",
          };
        }
      }
    } catch (err) {
      logger.error(`[Agent 3] LLM failed: ${err.message}`);
    }
  }

  // Deterministic fallback from insightsFallbacks.js
  const fallbackList = defaultChallenges[hotspotCategory] || defaultChallenges.other;
  const challengesWithProjections = fallbackList.map((mc, idx) => {
    const savings = mc.estimatedCO2SavingsKg || mc.potentialSavingKg || 0;
    return {
      id: `fallback-challenge-${idx}`,
      ...mc,
      estimatedCO2SavingsKg: savings,
      projections: {
        weekly: parseFloat((savings * 7).toFixed(2)),
        monthly: parseFloat((savings * 30).toFixed(2)),
        annual: parseFloat((savings * 365).toFixed(2)),
      },
    };
  });

  return {
    microChallenges: challengesWithProjections,
    summaryInsight:
      defaultSummaryInsights[hotspotCategory] || defaultSummaryInsights.other,
  };
}

/**
 * Main Orchestrator Function
 * Coordinates the unidirectional pipeline:
 *   Extraction → Calculation → Insights
 * Employs a result cache to avoid redundant computation.
 *
 * @param {Object} params - The request payload.
 * @param {string} params.activityString - The natural language input.
 * @param {Object} [params.profileContext] - User-specific context.
 * @returns {Promise<Object>} The finalized multi-agent response payload.
 */
export async function orchestrateCarbonTracking({
  activityString,
  profileContext,
}) {
  const baseline = profileContext?.dailyBaselineKg || 15.0;
  const sanitized = activityString.trim().slice(0, 500).replace(/\s+/g, ' ');
  const cacheKey = `track::${sanitized.substring(0, 120)}::${baseline}`;
  const cachedResult = resultCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const extractedActivities = await runExtractionAgent(activityString);
  const calculations = runCalculationAgent(
    extractedActivities,
    profileContext || {},
  );
  const insights = await runInsightsAgent(calculations);

  const result = {
    rawInput: activityString,
    profileApplied: {
      userId: profileContext?.userId || "anonymous",
      email: profileContext?.email || "not_provided",
      timezone: profileContext?.timezone || "UTC",
    },
    ...calculations,
    microChallenges: insights.microChallenges,
    summaryInsight: insights.summaryInsight,
  };

  resultCache.set(cacheKey, result);

  return result;
}
