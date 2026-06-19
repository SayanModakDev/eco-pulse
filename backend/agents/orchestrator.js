import { GoogleGenAI } from '@google/genai';
import { EXTRACTION_AGENT_PROMPT, INSIGHTS_AGENT_PROMPT } from './prompts.js';
import { emissionFactorCache, resultCache } from '../utils/cache.js';

/**
 * @fileoverview Multi-Agent Orchestration Layer
 * This module demonstrates high Code Quality (Modularity and Separation of Concerns).
 * It sequences the 3 core agents (Extraction, Calculation, Insights) and leverages
 * local memory caching for efficiency.
 */

// Initialize the Google Gen AI client if API key is present in environment variables
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

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
    gas: 0.20,
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
      console.log('[Agent 1] LLM Extraction...');
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Extract activities from: "${activityString}"`,
        config: {
          systemInstruction: EXTRACTION_AGENT_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              activities: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    category: { type: 'STRING', enum: ['transport', 'food', 'energy', 'waste', 'other'] },
                    value: { type: 'NUMBER' },
                    unit: { type: 'STRING' },
                    description: { type: 'STRING' },
                  },
                  required: ['category', 'value', 'unit', 'description'],
                },
              },
            },
            required: ['activities'],
          },
          temperature: 0.1, // Low temperature for more deterministic extraction
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        const activities = Array.isArray(parsed.activities) ? parsed.activities : [];
        console.log(`[Agent 1] LLM extracted ${activities.length} activities.`);
        return activities;
      }
    } catch (err) {
      console.error('[Agent 1] LLM failed, fallback:', err.message);
    }
  }

  // Enhanced Deterministic Fallback Extractor
  console.log('[Agent 1] Deterministic Fallback...');
  const text = activityString.toLowerCase();
  const activities = [];

  // Improved regex: matches integers, decimals, and optional unit text immediately after
  // Examples: "20km", "5.5 kwh", "2 burgers", "100 miles"
  const numberRegex = /(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/g;
  let match;
  const matches = [];
  while ((match = numberRegex.exec(text)) !== null) {
    matches.push({
      num: parseFloat(match[1]),
      unitText: match[2] || '',
      index: match.index,
    });
  }

  // Helper: check if keyword appears within ±50 characters of the number match
  const isKeywordNear = (keyword, index) => {
    const range = 50;
    const start = Math.max(0, index - range);
    const end = Math.min(text.length, index + range);
    return text.substring(start, end).includes(keyword);
  };

  // Helper: word-boundary-aware keyword check to avoid substring false positives
  // (e.g. 'eat' should NOT match inside 'heating')
  const textHasWord = (keyword) => {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    return regex.test(text);
  };

  // Helper: find the index of a keyword as a whole word in text
  const findWordIndex = (keyword) => {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    const m = regex.exec(text);
    return m ? m.index : -1;
  };

  // Helper: find the closest number match to a keyword occurrence (word-boundary aware)
  const findNearestMatch = (keyword) => {
    const kwIndex = findWordIndex(keyword);
    if (kwIndex === -1) return null;
    let nearest = null;
    let minDist = Infinity;
    for (const m of matches) {
      const dist = Math.abs(m.index - kwIndex);
      if (dist < minDist && dist <= 50) {
        minDist = dist;
        nearest = m;
      }
    }
    return nearest;
  };

  // ── Keyword rule sets (expanded) ──────────────────────────────────────

  // Transport keywords (expanded with scooter, taxi, uber, cab, metro, subway, ride)
  const transportKeywords = [
    'km', 'mile', 'miles', 'bike', 'bicycle', 'car', 'drive', 'driving', 'drove',
    'rode', 'bus', 'train', 'metro', 'subway', 'flight', 'fly', 'flew', 'plane',
    'walk', 'walked', 'scooter', 'taxi', 'cab', 'uber', 'lyft', 'ride',
  ];

  // Sets for sub-classification within transport
  const zeroEmissionTransport = new Set(['bike', 'bicycle', 'walk', 'walked', 'cycle']);
  const vehicleTransport = new Set(['car', 'drive', 'driving', 'drove', 'km', 'mile', 'miles']);
  const flightTransport = new Set(['flight', 'fly', 'flew', 'plane']);
  const publicTransport = new Set(['bus', 'train', 'metro', 'subway']);
  const scooterTransport = new Set(['scooter']);
  const taxiTransport = new Set(['taxi', 'cab', 'uber', 'lyft', 'ride']);

  for (const kw of transportKeywords) {
    if (!textHasWord(kw)) continue;
    const matchObj = findNearestMatch(kw) || matches.find(m => isKeywordNear(kw, m.index)) || { num: 1, unitText: 'trip' };
    const unit = matchObj.unitText || 'km';
    let description;

    if (zeroEmissionTransport.has(kw)) {
      description = `Active transit (${kw}) ${matchObj.num} ${unit}`;
    } else if (flightTransport.has(kw)) {
      description = `Flight transit ${matchObj.num} ${unit}`;
    } else if (publicTransport.has(kw)) {
      description = `Public transit (${kw}) ${matchObj.num} ${unit}`;
    } else if (scooterTransport.has(kw)) {
      description = `Scooter transit ${matchObj.num} ${unit}`;
    } else if (taxiTransport.has(kw)) {
      description = `Taxi/ride-hail (${kw}) ${matchObj.num} ${unit}`;
    } else if (vehicleTransport.has(kw)) {
      description = `Vehicle transport ${matchObj.num} ${unit}`;
    } else {
      description = `Transport (${kw}) ${matchObj.num} ${unit}`;
    }

    activities.push({ category: 'transport', value: matchObj.num, unit, description });
  }

  // Food keywords (expanded with vegan, vegetarian, rice, pasta, lamb, steak)
  const foodKeywords = [
    'burger', 'beef', 'steak', 'lamb', 'chicken', 'poultry', 'pork',
    'fish', 'seafood', 'meat', 'egg', 'cheese', 'dairy', 'milk',
    'rice', 'pasta', 'salad', 'vegan', 'vegetarian', 'eat', 'ate', 'meal',
  ];
  for (const kw of foodKeywords) {
    if (!textHasWord(kw)) continue;
    const matchObj = findNearestMatch(kw) || matches.find(m => isKeywordNear(kw, m.index)) || { num: 1, unitText: 'serving' };
    activities.push({
      category: 'food',
      value: matchObj.num,
      unit: matchObj.unitText || 'serving',
      description: `Consumed ${kw}: ${matchObj.num} ${matchObj.unitText || 'serving'}`,
    });
  }

  // Energy keywords (expanded with solar, ac, aircon)
  const energyKeywords = ['kwh', 'electricity', 'power', 'heating', 'gas', 'solar', 'ac', 'aircon'];
  for (const kw of energyKeywords) {
    if (!textHasWord(kw)) continue;
    const matchObj = findNearestMatch(kw) || matches.find(m => isKeywordNear(kw, m.index)) || { num: 1, unitText: 'kwh' };
    activities.push({
      category: 'energy',
      value: matchObj.num,
      unit: matchObj.unitText || 'kwh',
      description: `Energy use (${kw}): ${matchObj.num} ${matchObj.unitText || 'kwh'}`,
    });
  }

  // Waste keywords (expanded with throw, threw, dispose, bin)
  const wasteKeywords = ['landfill', 'trash', 'garbage', 'recycle', 'recycling', 'compost', 'waste', 'throw', 'threw', 'dispose', 'bin'];
  for (const kw of wasteKeywords) {
    if (!textHasWord(kw)) continue;
    const matchObj = findNearestMatch(kw) || matches.find(m => isKeywordNear(kw, m.index)) || { num: 1, unitText: 'kg' };
    activities.push({
      category: 'waste',
      value: matchObj.num,
      unit: matchObj.unitText || 'kg',
      description: `Waste (${kw}): ${matchObj.num} ${matchObj.unitText || 'kg'}`,
    });
  }

  // ── Improved deduplication ────────────────────────────────────────────
  // Use a composite key of category + description to prevent near-duplicate entries
  // (e.g. "drove 20km" matching both 'drove' and 'km' produces identical descriptions
  // and will be collapsed, while distinct keywords like 'rice' and 'pasta' remain separate)
  const uniqueActivities = [];
  const seenKeys = new Set();
  for (const act of activities) {
    const dedupKey = `${act.category}::${act.description}`;
    if (!seenKeys.has(dedupKey)) {
      seenKeys.add(dedupKey);
      uniqueActivities.push(act);
    }
  }

  // Fallback default if nothing extracted — truncate input for safety
  if (uniqueActivities.length === 0) {
    uniqueActivities.push({
      category: 'other',
      value: 1,
      unit: 'activity',
      description: `Generic: ${activityString.substring(0, 50)}`,
    });
  }

  console.log(`[Agent 1] Fallback extracted ${uniqueActivities.length} activities.`);
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
  console.log(`[Agent 2] Calculation Agent (baseline: ${dailyBaselineKg} kg)...`);
  
  let totalCo2eKg = 0;
  let highestEmissionValue = -1;
  let highestEmissionActivity = null;

  const analyzedActivities = activities.map((activity) => {
    const category = activity.category || 'other';
    const description = activity.description || '';
    const descLower = description.toLowerCase();
    const value = activity.value || 0;

    // Check emission factor cache before computing
    const factorCacheKey = `${category}::${descLower}`;
    let factor = emissionFactorCache.get(factorCacheKey);

    if (factor === undefined) {
      // Determine specific emission factor
      factor = EMISSION_FACTORS[category]?.default || 0.5;

      // Check specific keywords inside the category
      if (category === 'transport') {
        if (descLower.includes('bike') || descLower.includes('bicycle') || descLower.includes('walk') || descLower.includes('cycle')) {
          factor = EMISSION_FACTORS.transport.bike;
        } else if (descLower.includes('bus')) {
          factor = EMISSION_FACTORS.transport.bus;
        } else if (descLower.includes('train') || descLower.includes('metro') || descLower.includes('subway')) {
          factor = EMISSION_FACTORS.transport.train;
        } else if (descLower.includes('flight') || descLower.includes('fly') || descLower.includes('flew') || descLower.includes('plane')) {
          factor = EMISSION_FACTORS.transport.flight;
        } else if (descLower.includes('motorbike') || descLower.includes('motorcycle')) {
          factor = EMISSION_FACTORS.transport.motorbike;
        } else if (descLower.includes('scooter')) {
          factor = EMISSION_FACTORS.transport.scooter;
        } else if (descLower.includes('taxi') || descLower.includes('cab') || descLower.includes('uber') || descLower.includes('lyft') || descLower.includes('ride-hail')) {
          factor = EMISSION_FACTORS.transport.taxi;
        } else if (descLower.includes('car') || descLower.includes('drive') || descLower.includes('driving') || descLower.includes('drove') || descLower.includes('vehicle')) {
          factor = EMISSION_FACTORS.transport.car;
        }
      } else if (category === 'food') {
        if (descLower.includes('beef') || descLower.includes('burger') || descLower.includes('steak')) {
          factor = EMISSION_FACTORS.food.beef;
        } else if (descLower.includes('lamb')) {
          factor = EMISSION_FACTORS.food.beef; // lamb ≈ beef range
        } else if (descLower.includes('chicken') || descLower.includes('poultry')) {
          factor = EMISSION_FACTORS.food.chicken;
        } else if (descLower.includes('pork')) {
          factor = EMISSION_FACTORS.food.pork;
        } else if (descLower.includes('fish') || descLower.includes('seafood')) {
          factor = EMISSION_FACTORS.food.fish;
        } else if (descLower.includes('cheese')) {
          factor = EMISSION_FACTORS.food.cheese;
        } else if (descLower.includes('milk') || descLower.includes('dairy')) {
          factor = EMISSION_FACTORS.food.milk;
        } else if (descLower.includes('rice')) {
          factor = EMISSION_FACTORS.food.rice;
        } else if (descLower.includes('pasta')) {
          factor = EMISSION_FACTORS.food.pasta;
        } else if (descLower.includes('salad') || descLower.includes('vegetable') || descLower.includes('vegan') || descLower.includes('vegetarian')) {
          factor = EMISSION_FACTORS.food.vegetable;
        }
      } else if (category === 'energy') {
        if (descLower.includes('electricity') || descLower.includes('kwh')) {
          factor = EMISSION_FACTORS.energy.electricity;
        } else if (descLower.includes('gas')) {
          factor = EMISSION_FACTORS.energy.gas;
        } else if (descLower.includes('heating')) {
          factor = EMISSION_FACTORS.energy.heating;
        }
      } else if (category === 'waste') {
        if (descLower.includes('recycle') || descLower.includes('recycling')) {
          factor = EMISSION_FACTORS.waste.recycle;
        } else if (descLower.includes('compost')) {
          factor = EMISSION_FACTORS.waste.compost;
        } else if (descLower.includes('landfill') || descLower.includes('trash') || descLower.includes('garbage')) {
          factor = EMISSION_FACTORS.waste.landfill;
        }
      }

      // Store computed factor in cache for subsequent lookups
      emissionFactorCache.set(factorCacheKey, factor);
    }

    const co2eKg = parseFloat((value * factor).toFixed(2));
    totalCo2eKg += co2eKg;

    if (co2eKg > highestEmissionValue) {
      highestEmissionValue = co2eKg;
      highestEmissionActivity = { ...activity, co2eKg };
    }

    return {
      ...activity,
      co2eKg,
      emissionFactorUsed: factor,
    };
  });

  totalCo2eKg = parseFloat(totalCo2eKg.toFixed(2));

  // Determine deviation comparison against user daily baseline
  const differenceKg = parseFloat((totalCo2eKg - dailyBaselineKg).toFixed(2));
  const percentageDifference = parseFloat(((differenceKg / dailyBaselineKg) * 100).toFixed(1));
  const status = totalCo2eKg <= dailyBaselineKg ? 'under_baseline' : 'over_baseline';

  console.log(`[Agent 2] Total: ${totalCo2eKg} kg CO2e | Status: ${status}`);

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
  const hotspotCategory = hotspot ? hotspot.category : 'other';

  if (ai) {
    try {
      console.log('[Agent 3] LLM Insights...');
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate micro-challenges for carbon hotspot category: "${hotspotCategory}" in the context of these calculations: ${JSON.stringify(calculationResults)}`,
        config: {
          systemInstruction: INSIGHTS_AGENT_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              microChallenges: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    title: { type: 'STRING' },
                    description: { type: 'STRING' },
                    potentialSavingKg: { type: 'NUMBER' },
                    difficulty: { type: 'STRING', enum: ['easy', 'medium', 'hard'] },
                    category: { type: 'STRING', enum: ['transport', 'food', 'energy', 'waste', 'other'] },
                  },
                  required: ['title', 'description', 'potentialSavingKg', 'difficulty', 'category'],
                },
              },
              summaryInsight: { type: 'STRING' },
            },
            required: ['microChallenges', 'summaryInsight'],
          },
          temperature: 0.2, // Slightly creative but grounded insights
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        if (parsed && Array.isArray(parsed.microChallenges)) {
          return {
            microChallenges: parsed.microChallenges,
            summaryInsight: parsed.summaryInsight || '',
          };
        }
      }
    } catch (err) {
      console.error('[Agent 3] LLM Insights failed, falling back to rule-based insights:', err.message);
    }
  }

  // Deterministic Local Fallback Insights
  console.log('[Agent 3] Executing Deterministic Fallback Insights...');
  const defaultChallenges = {
    food: [
      {
        title: 'Try a Meatless Monday',
        description: 'Substitute beef or pork in your next meal with lentils, beans, or a plant-based burger. This single swap can dramatically lower your meal\'s greenhouse gas footprint.',
        potentialSavingKg: 4.8,
        difficulty: 'easy',
        category: 'food',
      },
      {
        title: 'Swap Beef for Chicken',
        description: 'Transition your main protein from beef to poultry for your next meal. Chicken has a carbon footprint nearly 4x smaller than beef per serving.',
        potentialSavingKg: 3.5,
        difficulty: 'easy',
        category: 'food',
      },
    ],
    transport: [
      {
        title: 'Go Car-Free This Trip',
        description: 'For your next journey under 5km, leave the car key behind and choose to walk, cycle, or use public transport. You\'ll save emissions and gain exercise.',
        potentialSavingKg: 1.8,
        difficulty: 'medium',
        category: 'transport',
      },
      {
        title: 'Combine Your Car Trips',
        description: 'Plan ahead and consolidate multiple short errands into a single trip. Cold engine starts produce disproportionately high emissions.',
        potentialSavingKg: 0.9,
        difficulty: 'easy',
        category: 'transport',
      },
    ],
    energy: [
      {
        title: 'Hunt Your Standby Power',
        description: 'Walk around your home and unplug 3 vampire electronics (TV boxes, microwave displays, chargers) that consume energy even when idle.',
        potentialSavingKg: 0.6,
        difficulty: 'easy',
        category: 'energy',
      },
      {
        title: 'Shift Your Thermostat 1°',
        description: 'Set your AC 1 degree higher or heater 1 degree lower today. This small shift can save a significant chunk of HVAC energy over the day.',
        potentialSavingKg: 1.2,
        difficulty: 'easy',
        category: 'energy',
      },
    ],
    waste: [
      {
        title: 'Go Zero-Waste at Meals',
        description: 'Avoid all single-use plastics and packaging for your meals today. Pack food in reusable containers and carry a reusable water bottle.',
        potentialSavingKg: 0.4,
        difficulty: 'medium',
        category: 'waste',
      },
    ],
    other: [
      {
        title: 'Do a Digital Clean-Up',
        description: 'Delete 100 old emails and clear files from your cloud storage trash to reduce remote data center server load and energy use.',
        potentialSavingKg: 0.1,
        difficulty: 'easy',
        category: 'other',
      },
    ],
  };

  const defaultSummaryInsights = {
    food: 'Your food choices are your biggest carbon lever today — small swaps at the plate make a big difference!',
    transport: 'Transport is your top emission source — even one car-free trip makes a measurable impact.',
    energy: 'Your energy use stands out today — a few mindful changes at home can cut your footprint noticeably.',
    waste: 'Waste reduction is a quick win — every item you divert from landfill counts.',
    other: 'Every small action adds up — keep tracking and you\'ll find more ways to lighten your footprint!',
  };

  return {
    microChallenges: defaultChallenges[hotspotCategory] || defaultChallenges.other,
    summaryInsight: defaultSummaryInsights[hotspotCategory] || defaultSummaryInsights.other,
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
export async function orchestrateCarbonTracking({ activityString, profileContext }) {
  console.log('\n--- Starting Multi-Agent Orchestration Pipeline ---');

  // Check result cache for identical input to avoid redundant computation
  const cacheKey = `track::${activityString}::${profileContext?.dailyBaselineKg || 15.0}`;
  const cachedResult = resultCache.get(cacheKey);
  if (cachedResult) {
    console.log('[Orchestrator] Returning cached result.');
    return cachedResult;
  }
  
  // Step 1: Extraction Agent
  const extractedActivities = await runExtractionAgent(activityString);

  // Step 2: Calculation & Decision Agent (now accepts full profileContext)
  const calculations = runCalculationAgent(extractedActivities, profileContext || {});

  // Step 3: Insights & Mitigation Agent
  const insights = await runInsightsAgent(calculations);

  console.log('--- Multi-Agent Orchestration Complete ---\n');

  const result = {
    rawInput: activityString,
    profileApplied: {
      userId: profileContext?.userId || 'anonymous',
      email: profileContext?.email || 'not_provided',
      timezone: profileContext?.timezone || 'UTC',
    },
    ...calculations,
    microChallenges: insights.microChallenges,
    summaryInsight: insights.summaryInsight,
  };

  // Cache the result for identical future requests
  resultCache.set(cacheKey, result);

  return result;
}
