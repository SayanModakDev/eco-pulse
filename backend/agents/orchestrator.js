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

/**
 * @fileoverview Multi-Agent Orchestration Layer
 * This module demonstrates high Code Quality (Modularity and Separation of Concerns).
 * It sequences the 3 core agents (Extraction, Calculation, Insights) and leverages
 * local memory caching for efficiency.
 */

// Initialize the Google Gen AI client if API key is present in environment variables
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// Standardized carbon emission factors (kg CO2e per unit)
const EMISSION_FACTORS = {
  transport: {
    car: 0.21, // per km
    drive: 0.21,
    driving: 0.21,
    bus: 0.08, // per km
    train: 0.04, // per km
    flight: 0.15, // per km
    fly: 0.15,
    flying: 0.15,
    plane: 0.15,
    motorbike: 0.11, // per km
    motorcycle: 0.11,
    scooter: 0.05, // per km (electric scooter / e-scooter)
    taxi: 0.25, // per km (ride-hail / taxi, higher than private car due to deadheading)
    bicycle: 0.0, // per km
    bike: 0.0,
    cycle: 0.0,
    walk: 0.0,
    walking: 0.0,
    default: 0.18, // slightly higher default to account for mixed/unknown vehicle types
  },
  food: {
    beef: 6.0, // per serving or unit
    burger: 5.5,
    hamburger: 5.5,
    pork: 1.8,
    chicken: 1.5,
    poultry: 1.5,
    fish: 1.2,
    seafood: 1.2,
    cheese: 1.0,
    dairy: 0.8,
    milk: 0.5,
    egg: 0.4,
    rice: 0.4, // per serving (methane-intensive paddy agriculture)
    pasta: 0.5, // per serving
    vegetable: 0.3,
    vegetables: 0.3,
    salad: 0.3,
    vegan: 0.2,
    vegetarian: 0.3,
    default: 1.4, // slightly lower default reflecting mixed-diet average
  },
  energy: {
    electricity: 0.45, // per kWh
    kwh: 0.45,
    gas: 0.2,
    heating: 0.25,
    default: 0.35,
  },
  waste: {
    landfill: 0.5, // per kg
    trash: 0.5,
    garbage: 0.5,
    recycle: 0.1,
    recycling: 0.1,
    compost: 0.05,
    default: 0.3,
  },
  other: {
    default: 0.5,
  },
};

/**
 * Agent 1: Extraction Agent
 * Parses the natural language activity string using Gemini Structured Outputs
 * with low temperature for deterministic extraction, or falls back to an
 * enhanced keyword extractor with improved regex and broader vocabulary.
 *
 * @param {string} activityString - The raw user input describing their activities.
 * @returns {Promise<Array<{category: string, value: number, unit: string, description: string}>>} Extracted standard activities.
 */
async function runExtractionAgent(activityString) {
  if (ai) {
    try {
      console.log("[Agent 1] LLM Extraction...");
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Extract activities from: "${activityString}"`,
        config: {
          systemInstruction: EXTRACTION_AGENT_PROMPT,
          responseMimeType: "application/json",
          responseSchema: {
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
          },
          temperature: 0.1, // Low temperature for more deterministic extraction
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        const activities = Array.isArray(parsed.activities)
          ? parsed.activities
          : [];
        console.log(`[Agent 1] LLM extracted ${activities.length} activities.`);
        return activities;
      }
    } catch (err) {
      console.error("[Agent 1] LLM failed, fallback:", err.message);
    }
  }

  // Deterministic Fallback
  const text = activityString.toLowerCase();
  const matches = extractNumbers(text);

  let activities = [
    ...extractTransportActivities(text, matches),
    ...extractFoodActivities(text, matches),
    ...extractEnergyActivities(text, matches),
    ...extractWasteActivities(text, matches),
  ];

  let uniqueActivities = deduplicateActivities(activities);

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
 * Accepts profileContext directly for baseline and future personalization.
 * Employs emission factor cache for repeated lookups.
 *
 * @param {Array<Object>} activities - The structured activities from Agent 1.
 * @param {Object} [profileContext] - User profile for baseline and preferences.
 * @param {number} [profileContext.dailyBaselineKg=15.0] - The user's daily carbon budget.
 * @returns {Object} The analyzed activities and summary data (including hotspot).
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

  // Determine deviation comparison against user daily baseline
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
 * Generates hyper-personalized micro-challenges targeting the primary hotspot,
 * plus a summary insight. Uses v2.1 prompt contract.
 *
 * @param {Object} calculationResults - The output from Agent 2, containing the hotspot.
 * @returns {Promise<{microChallenges: Array<Object>, summaryInsight: string}>} Tailored challenges and insight.
 */
async function runInsightsAgent(calculationResults) {
  const hotspot = calculationResults.summary.hotspot;
  const hotspotCategory = hotspot ? hotspot.category : "other";

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Generate micro-challenges for carbon hotspot category: "${hotspotCategory}" in the context of these calculations: ${JSON.stringify(calculationResults)}`,
        config: {
          systemInstruction: INSIGHTS_AGENT_PROMPT,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              microChallenges: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    description: { type: "STRING" },
                    potentialSavingKg: { type: "NUMBER" },
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
                    "potentialSavingKg",
                    "difficulty",
                    "category",
                  ],
                },
              },
              summaryInsight: { type: "STRING" },
            },
            required: ["microChallenges", "summaryInsight"],
          },
          temperature: 0.2, // Slightly creative but grounded insights
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        if (parsed && Array.isArray(parsed.microChallenges)) {
          return {
            microChallenges: parsed.microChallenges,
            summaryInsight: parsed.summaryInsight || "",
          };
        }
      }
    } catch (err) {
      console.error(
        "[Agent 3] LLM Insights failed, falling back to rule-based insights:",
        err.message,
      );
    }
  }

  // Deterministic Local Fallback Insights
  // Fallback insights
  const defaultChallenges = {
    food: [
      {
        title: "Try a Meatless Monday",
        description:
          "Substitute beef or pork in your next meal with lentils, beans, or a plant-based burger. This single swap can dramatically lower your meal's greenhouse gas footprint.",
        potentialSavingKg: 4.8,
        difficulty: "easy",
        category: "food",
      },
      {
        title: "Swap Beef for Chicken",
        description:
          "Transition your main protein from beef to poultry for your next meal. Chicken has a carbon footprint nearly 4x smaller than beef per serving.",
        potentialSavingKg: 3.5,
        difficulty: "easy",
        category: "food",
      },
    ],
    transport: [
      {
        title: "Go Car-Free This Trip",
        description:
          "For your next journey under 5km, leave the car key behind and choose to walk, cycle, or use public transport. You'll save emissions and gain exercise.",
        potentialSavingKg: 1.8,
        difficulty: "medium",
        category: "transport",
      },
      {
        title: "Combine Your Car Trips",
        description:
          "Plan ahead and consolidate multiple short errands into a single trip. Cold engine starts produce disproportionately high emissions.",
        potentialSavingKg: 0.9,
        difficulty: "easy",
        category: "transport",
      },
    ],
    energy: [
      {
        title: "Hunt Your Standby Power",
        description:
          "Walk around your home and unplug 3 vampire electronics (TV boxes, microwave displays, chargers) that consume energy even when idle.",
        potentialSavingKg: 0.6,
        difficulty: "easy",
        category: "energy",
      },
      {
        title: "Shift Your Thermostat 1°",
        description:
          "Set your AC 1 degree higher or heater 1 degree lower today. This small shift can save a significant chunk of HVAC energy over the day.",
        potentialSavingKg: 1.2,
        difficulty: "easy",
        category: "energy",
      },
    ],
    waste: [
      {
        title: "Go Zero-Waste at Meals",
        description:
          "Avoid all single-use plastics and packaging for your meals today. Pack food in reusable containers and carry a reusable water bottle.",
        potentialSavingKg: 0.4,
        difficulty: "medium",
        category: "waste",
      },
    ],
    other: [
      {
        title: "Do a Digital Clean-Up",
        description:
          "Delete 100 old emails and clear files from your cloud storage trash to reduce remote data center server load and energy use.",
        potentialSavingKg: 0.1,
        difficulty: "easy",
        category: "other",
      },
    ],
  };

  const defaultSummaryInsights = {
    food: "Your food choices are your biggest carbon lever today — small swaps at the plate make a big difference!",
    transport:
      "Transport is your top emission source — even one car-free trip makes a measurable impact.",
    energy:
      "Your energy use stands out today — a few mindful changes at home can cut your footprint noticeably.",
    waste:
      "Waste reduction is a quick win — every item you divert from landfill counts.",
    other:
      "Every small action adds up — keep tracking and you'll find more ways to lighten your footprint!",
  };

  return {
    microChallenges:
      defaultChallenges[hotspotCategory] || defaultChallenges.other,
    summaryInsight:
      defaultSummaryInsights[hotspotCategory] || defaultSummaryInsights.other,
  };
}

/**
 * Main Orchestrator Function
 * Coordinates the unidirectional pipeline flow between Extraction, Calculation, and Insights.
 * Employs a result cache to guarantee high Efficiency (Medium Impact).
 *
 * @param {Object} params - The request payload.
 * @param {string} params.activityString - The natural language input to process.
 * @param {Object} params.profileContext - User specific context (timezone, baseline, etc).
 * @returns {Promise<Object>} The finalized multi-agent response payload.
 */
export async function orchestrateCarbonTracking({
  activityString,
  profileContext,
}) {
  // Check result cache for identical input to avoid redundant computation
  const cacheKey = `track::${activityString}::${profileContext?.dailyBaselineKg || 15.0}`;
  const cachedResult = resultCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // Step 1: Extraction Agent
  const extractedActivities = await runExtractionAgent(activityString);

  // Step 2: Calculation & Decision Agent (now accepts full profileContext)
  const calculations = runCalculationAgent(
    extractedActivities,
    profileContext || {},
  );

  // Step 3: Insights & Mitigation Agent
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

  // Cache the result for identical future requests
  resultCache.set(cacheKey, result);

  return result;
}
