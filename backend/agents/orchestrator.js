import { GoogleGenAI } from '@google/genai';
import { EXTRACTION_AGENT_PROMPT, INSIGHTS_AGENT_PROMPT } from './prompts.js';
import { emissionFactorCache, resultCache } from '../utils/cache.js';

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
    bicycle: 0.0, // per km
    bike: 0.0,
    cycle: 0.0,
    walk: 0.0,
    walking: 0.0,
    default: 0.15,
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
    vegetable: 0.3,
    vegetables: 0.3,
    salad: 0.3,
    vegan: 0.2,
    vegetarian: 0.3,
    default: 1.5,
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
 * Parses the natural language activity string using Gemini Structured Outputs,
 * or falls back to keyword extraction if the API key is not configured.
 */
async function runExtractionAgent(activityString) {
  if (ai) {
    try {
      console.log('[Agent 1] Executing LLM Extraction Agent...');
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
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        if (parsed && Array.isArray(parsed.activities)) {
          return parsed.activities;
        }
      }
    } catch (err) {
      console.error('[Agent 1] LLM Extraction failed, falling back to deterministic extraction:', err.message);
    }
  }

  // Deterministic Local Fallback Extractor
  console.log('[Agent 1] Executing Deterministic Fallback Extractor...');
  const text = activityString.toLowerCase();
  const activities = [];

  // Match numbers and distance/units
  // Example: "rode a bike for 5km", "drove 20km", "5 kwh of electricity", "ate 2 burgers"
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

  // Helper to check if keyword is near the number
  const isKeywordNear = (keyword, index) => {
    const range = 40; // look 40 characters before or after
    const start = Math.max(0, index - range);
    const end = Math.min(text.length, index + range);
    return text.substring(start, end).includes(keyword);
  };

  // Rule 1: Transport
  const transportKeywords = ['km', 'mile', 'miles', 'bike', 'car', 'drive', 'driving', 'rode', 'bus', 'train', 'flight', 'fly', 'walk'];
  transportKeywords.forEach(kw => {
    if (text.includes(kw)) {
      const matchObj = matches.find(m => isKeywordNear(kw, m.index)) || { num: 1, unitText: 'trip' };
      // Check specific categories
      let categoryType = 'transport';
      let unit = matchObj.unitText || 'km';
      if (kw === 'bike' || kw === 'bicycle' || kw === 'walk') {
        activities.push({
          category: categoryType,
          value: matchObj.num,
          unit,
          description: `Active transit (${kw}) of ${matchObj.num} ${unit}`,
        });
      } else if (kw === 'car' || kw === 'drive' || kw === 'driving' || kw === 'km' || kw === 'miles') {
        activities.push({
          category: categoryType,
          value: matchObj.num,
          unit,
          description: `Vehicle transport of ${matchObj.num} ${unit}`,
        });
      } else if (kw === 'flight' || kw === 'fly' || kw === 'plane') {
        activities.push({
          category: categoryType,
          value: matchObj.num,
          unit,
          description: `Flight transit of ${matchObj.num} ${unit}`,
        });
      } else if (kw === 'bus' || kw === 'train') {
        activities.push({
          category: categoryType,
          value: matchObj.num,
          unit,
          description: `Public transit (${kw}) of ${matchObj.num} ${unit}`,
        });
      }
    }
  });

  // Rule 2: Food
  const foodKeywords = ['burger', 'beef', 'chicken', 'pork', 'fish', 'meat', 'egg', 'cheese', 'salad', 'eat', 'ate', 'meal'];
  foodKeywords.forEach(kw => {
    if (text.includes(kw)) {
      const matchObj = matches.find(m => isKeywordNear(kw, m.index)) || { num: 1, unitText: 'serving' };
      activities.push({
        category: 'food',
        value: matchObj.num,
        unit: matchObj.unitText || 'serving',
        description: `Consumed food (${kw}): ${matchObj.num} ${matchObj.unitText || 'serving'}`,
      });
    }
  });

  // Rule 3: Energy
  const energyKeywords = ['kwh', 'electricity', 'power', 'heating', 'gas'];
  energyKeywords.forEach(kw => {
    if (text.includes(kw)) {
      const matchObj = matches.find(m => isKeywordNear(kw, m.index)) || { num: 1, unitText: 'kwh' };
      activities.push({
        category: 'energy',
        value: matchObj.num,
        unit: matchObj.unitText || 'kwh',
        description: `Energy consumption (${kw}): ${matchObj.num} ${matchObj.unitText || 'kwh'}`,
      });
    }
  });

  // Deduplicate matched fallback items to avoid duplicate categories for the same text span
  const uniqueActivities = [];
  const seenDescriptions = new Set();
  for (const act of activities) {
    if (!seenDescriptions.has(act.description)) {
      seenDescriptions.add(act.description);
      uniqueActivities.push(act);
    }
  }

  // Fallback default if nothing extracted
  if (uniqueActivities.length === 0) {
    uniqueActivities.push({
      category: 'other',
      value: 1,
      unit: 'activity',
      description: `Logged generic activity: "${activityString}"`,
    });
  }

  return uniqueActivities;
}

/**
 * Agent 2: Calculation & Decision Agent
 * Deterministically maps extracted data points to standardized CO2e factors.
 * Compares computed values against user historical context/baseline.
 */
function runCalculationAgent(activities, dailyBaselineKg = 15.0) {
  console.log('[Agent 2] Executing Calculation & Decision Agent...');
  
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
        } else if (descLower.includes('train')) {
          factor = EMISSION_FACTORS.transport.train;
        } else if (descLower.includes('flight') || descLower.includes('fly') || descLower.includes('plane')) {
          factor = EMISSION_FACTORS.transport.flight;
        } else if (descLower.includes('motorbike') || descLower.includes('motorcycle')) {
          factor = EMISSION_FACTORS.transport.motorbike;
        } else if (descLower.includes('car') || descLower.includes('drive') || descLower.includes('driving')) {
          factor = EMISSION_FACTORS.transport.car;
        }
      } else if (category === 'food') {
        if (descLower.includes('beef') || descLower.includes('burger')) {
          factor = EMISSION_FACTORS.food.beef;
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
        } else if (descLower.includes('salad') || descLower.includes('vegetable') || descLower.includes('vegan') || descLower.includes('vegetarian')) {
          factor = EMISSION_FACTORS.food.vegetable;
        }
      } else if (category === 'energy') {
        if (descLower.includes('electricity') || descLower.includes('kwh')) {
          factor = EMISSION_FACTORS.energy.electricity;
        } else if (descLower.includes('gas')) {
          factor = EMISSION_FACTORS.energy.gas;
        }
      } else if (category === 'waste') {
        if (descLower.includes('recycle')) {
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
 * Generates personalized micro-challenges to mitigate the highest emission vector.
 * Utilizes Gemini Structured Outputs, or falls back to rule-based challenges.
 */
async function runInsightsAgent(calculationResults) {
  const hotspot = calculationResults.summary.hotspot;
  const hotspotCategory = hotspot ? hotspot.category : 'other';

  if (ai) {
    try {
      console.log('[Agent 3] Executing LLM Insights Agent...');
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate challenges for carbon hotspot category: "${hotspotCategory}" in the context of these calculations: ${JSON.stringify(calculationResults)}`,
        config: {
          systemInstruction: INSIGHTS_AGENT_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              challenges: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    title: { type: 'STRING' },
                    description: { type: 'STRING' },
                    potentialSavingKg: { type: 'NUMBER' },
                    difficulty: { type: 'STRING', enum: ['easy', 'medium', 'hard'] },
                  },
                  required: ['title', 'description', 'potentialSavingKg', 'difficulty'],
                },
              },
            },
            required: ['challenges'],
          },
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        if (parsed && Array.isArray(parsed.challenges)) {
          return parsed.challenges;
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
        title: 'Meatless Monday Swap',
        description: 'Substitute beef or pork in your next meal with lentils, beans, or a plant-based burger to dramatically lower high greenhouse gas emissions.',
        potentialSavingKg: 4.8,
        difficulty: 'easy',
      },
      {
        title: 'Swap Beef for Chicken',
        description: 'Transition your main meat choice from beef to poultry (chicken or turkey) for your next meal. Chicken has a carbon footprint nearly 4 times smaller than beef.',
        potentialSavingKg: 3.5,
        difficulty: 'easy',
      },
    ],
    transport: [
      {
        title: 'Eco Transit Commute',
        description: 'For your next journey under 5 kilometers, leave the car key behind and choose to walk, cycle, or use public transport.',
        potentialSavingKg: 1.8,
        difficulty: 'medium',
      },
      {
        title: 'Combine Car Trips',
        description: 'Plan ahead and consolidate multiple short errands into a single trip to prevent cold engine emission surges.',
        potentialSavingKg: 0.9,
        difficulty: 'easy',
      },
    ],
    energy: [
      {
        title: 'Standby Power Hunt',
        description: 'Walk around your home and unplug 3 vampire electronics (like TV boxes, microwave displays, chargers) that consume energy even when idle.',
        potentialSavingKg: 0.6,
        difficulty: 'easy',
      },
      {
        title: 'Eco Thermostat Shift',
        description: 'Set your air conditioner 1 degree higher or heater 1 degree lower today to save a significant chunk of HVAC energy.',
        potentialSavingKg: 1.2,
        difficulty: 'easy',
      },
    ],
    waste: [
      {
        title: 'Zero Waste Meals',
        description: 'Avoid all single-use plastics and packaging for your meals today. Pack food in reusable containers.',
        potentialSavingKg: 0.4,
        difficulty: 'medium',
      },
    ],
    other: [
      {
        title: 'Digital Clean-up',
        description: 'Delete 100 old emails and clear files from your cloud storage trash to reduce remote data center server load.',
        potentialSavingKg: 0.1,
        difficulty: 'easy',
      },
    ],
  };

  return defaultChallenges[hotspotCategory] || defaultChallenges.other;
}

/**
 * Main Orchestrator Function
 * Coordinates pipeline flow between Extraction, Calculation, and Insights.
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
  
  const dailyBaselineKg = profileContext?.dailyBaselineKg || 15.0;

  // Step 1: Extraction Agent
  const extractedActivities = await runExtractionAgent(activityString);

  // Step 2: Calculation & Decision Agent
  const calculations = runCalculationAgent(extractedActivities, dailyBaselineKg);

  // Step 3: Insights & Mitigation Agent
  const challenges = await runInsightsAgent(calculations);

  console.log('--- Multi-Agent Orchestration Complete ---\n');

  const result = {
    rawInput: activityString,
    profileApplied: {
      userId: profileContext?.userId || 'anonymous',
      email: profileContext?.email || 'not_provided',
      timezone: profileContext?.timezone || 'UTC',
    },
    ...calculations,
    challenges,
  };

  // Cache the result for identical future requests
  resultCache.set(cacheKey, result);

  return result;
}
