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
const CATEGORY_KEYWORD_MAP = {
  transport: [
    { keywords: ["bike", "bicycle", "walk", "cycle"], factor: "bike" },
    { keywords: ["bus"], factor: "bus" },
    { keywords: ["train", "metro", "subway"], factor: "train" },
    { keywords: ["flight", "fly", "flew", "plane"], factor: "flight" },
    { keywords: ["motorbike", "motorcycle"], factor: "motorbike" },
    { keywords: ["scooter"], factor: "scooter" },
    { keywords: ["taxi", "cab", "uber", "lyft", "ride-hail"], factor: "taxi" },
    {
      keywords: ["car", "drive", "driving", "drove", "vehicle"],
      factor: "car",
    },
  ],
  food: [
    { keywords: ["beef", "burger", "steak"], factor: "beef" },
    { keywords: ["lamb"], factor: "beef" },
    { keywords: ["chicken", "poultry"], factor: "chicken" },
    { keywords: ["pork"], factor: "pork" },
    { keywords: ["fish", "seafood"], factor: "fish" },
    { keywords: ["cheese"], factor: "cheese" },
    { keywords: ["milk", "dairy"], factor: "milk" },
    { keywords: ["rice"], factor: "rice" },
    { keywords: ["pasta"], factor: "pasta" },
    {
      keywords: ["salad", "vegetable", "vegan", "vegetarian"],
      factor: "vegetable",
    },
  ],
  energy: [
    { keywords: ["electricity", "kwh"], factor: "electricity" },
    { keywords: ["gas"], factor: "gas" },
    { keywords: ["heating"], factor: "heating" },
  ],
  waste: [
    { keywords: ["recycle", "recycling"], factor: "recycle" },
    { keywords: ["compost"], factor: "compost" },
    { keywords: ["landfill", "trash", "garbage"], factor: "landfill" },
  ],
};

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
