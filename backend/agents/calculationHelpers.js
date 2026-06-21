/**
 * @fileoverview Emission factor resolution and activity CO2e calculation helpers.
 * Uses a lookup-table pattern instead of long if/else chains for maintainability.
 */

/**
 * Keyword-to-factor mapping tables for each category.
 * Each entry maps a keyword substring to the corresponding emission factor key.
 * Order matters: first match wins.
 * @type {Record<string, Array<{keywords: string[], factor: string}>>}
 */
const CATEGORY_KEYWORD_MAP = Object.freeze({
  transport: Object.freeze([
    Object.freeze({ keywords: Object.freeze(["bike", "bicycle", "walk", "cycle"]), factor: "bike" }),
    Object.freeze({ keywords: Object.freeze(["bus"]), factor: "bus" }),
    Object.freeze({ keywords: Object.freeze(["train", "metro", "subway"]), factor: "train" }),
    Object.freeze({ keywords: Object.freeze(["flight", "fly", "flew", "plane"]), factor: "flight" }),
    Object.freeze({ keywords: Object.freeze(["motorbike", "motorcycle"]), factor: "motorbike" }),
    Object.freeze({ keywords: Object.freeze(["scooter"]), factor: "scooter" }),
    Object.freeze({ keywords: Object.freeze(["taxi", "cab", "uber", "lyft", "ride-hail"]), factor: "taxi" }),
    Object.freeze({
      keywords: Object.freeze(["car", "drive", "driving", "drove", "vehicle"]),
      factor: "car",
    }),
  ]),
  food: Object.freeze([
    Object.freeze({ keywords: Object.freeze(["beef", "burger", "steak"]), factor: "beef" }),
    Object.freeze({ keywords: Object.freeze(["lamb"]), factor: "beef" }),
    Object.freeze({ keywords: Object.freeze(["chicken", "poultry"]), factor: "chicken" }),
    Object.freeze({ keywords: Object.freeze(["pork"]), factor: "pork" }),
    Object.freeze({ keywords: Object.freeze(["fish", "seafood"]), factor: "fish" }),
    Object.freeze({ keywords: Object.freeze(["cheese"]), factor: "cheese" }),
    Object.freeze({ keywords: Object.freeze(["milk", "dairy"]), factor: "milk" }),
    Object.freeze({ keywords: Object.freeze(["rice"]), factor: "rice" }),
    Object.freeze({ keywords: Object.freeze(["pasta"]), factor: "pasta" }),
    Object.freeze({
      keywords: Object.freeze(["salad", "vegetable", "vegan", "vegetarian"]),
      factor: "vegetable",
    }),
  ]),
  energy: Object.freeze([
    Object.freeze({ keywords: Object.freeze(["electricity", "kwh"]), factor: "electricity" }),
    Object.freeze({ keywords: Object.freeze(["gas"]), factor: "gas" }),
    Object.freeze({ keywords: Object.freeze(["heating"]), factor: "heating" }),
  ]),
  waste: Object.freeze([
    Object.freeze({ keywords: Object.freeze(["recycle", "recycling"]), factor: "recycle" }),
    Object.freeze({ keywords: Object.freeze(["compost"]), factor: "compost" }),
    Object.freeze({ keywords: Object.freeze(["landfill", "trash", "garbage"]), factor: "landfill" }),
  ]),
});

/**
 * Determines the correct emission factor for a specific activity description
 * using a declarative lookup-table pattern.
 * @param {string} category - The category of the activity (e.g. 'transport', 'food').
 * @param {string} descLower - The lowercase description of the activity.
 * @param {Object} EMISSION_FACTORS - The mapping of categories to emission factor rates.
 * @returns {number} The appropriate emission factor multiplier.
 */
export function determineCategoryFactor(category, descLower, EMISSION_FACTORS) {
  const mappings = CATEGORY_KEYWORD_MAP[category];

  if (mappings) {
    for (const mapping of mappings) {
      if (mapping.keywords.some((kw) => descLower.includes(kw))) {
        return EMISSION_FACTORS[category][mapping.factor];
      }
    }
  }

  return EMISSION_FACTORS[category]?.default || 0.5;
}

/**
 * Processes an extracted activity by finding its emission factor and computing CO2e.
 * @param {Object} activity - The raw extracted activity.
 * @param {Object} EMISSION_FACTORS - Global emission factor map.
 * @param {Object} emissionFactorCache - Cache instance for memoized lookups.
 * @returns {Object} The processed activity enriched with CO2e footprint.
 */
export function processActivity(
  activity,
  EMISSION_FACTORS,
  emissionFactorCache,
) {
  const category = activity.category || "other";
  const description = activity.description || "";
  const descLower = description.toLowerCase();
  const value = activity.value || 0;

  const factorCacheKey = `${category}::${descLower}`;
  let factor = emissionFactorCache.get(factorCacheKey);

  if (factor === undefined) {
    factor = determineCategoryFactor(category, descLower, EMISSION_FACTORS);
    emissionFactorCache.set(factorCacheKey, factor);
  }

  const co2eKg = parseFloat((value * factor).toFixed(2));

  return {
    ...activity,
    co2eKg,
    emissionFactorUsed: factor,
  };
}
