/**
 * Determines the correct emission factor for a specific activity description.
 * @param {string} category - The category of the activity (e.g. 'transport', 'food').
 * @param {string} descLower - The lowercase description of the activity.
 * @param {Object} EMISSION_FACTORS - The mapping of categories to emission factor rates.
 * @returns {number} The appropriate emission factor multiplier.
 */
export function determineCategoryFactor(category, descLower, EMISSION_FACTORS) {
  if (category === "transport") {
    if (
      descLower.includes("bike") ||
      descLower.includes("bicycle") ||
      descLower.includes("walk") ||
      descLower.includes("cycle")
    ) {
      return EMISSION_FACTORS.transport.bike;
    } else if (descLower.includes("bus")) {
      return EMISSION_FACTORS.transport.bus;
    } else if (
      descLower.includes("train") ||
      descLower.includes("metro") ||
      descLower.includes("subway")
    ) {
      return EMISSION_FACTORS.transport.train;
    } else if (
      descLower.includes("flight") ||
      descLower.includes("fly") ||
      descLower.includes("flew") ||
      descLower.includes("plane")
    ) {
      return EMISSION_FACTORS.transport.flight;
    } else if (
      descLower.includes("motorbike") ||
      descLower.includes("motorcycle")
    ) {
      return EMISSION_FACTORS.transport.motorbike;
    } else if (descLower.includes("scooter")) {
      return EMISSION_FACTORS.transport.scooter;
    } else if (
      descLower.includes("taxi") ||
      descLower.includes("cab") ||
      descLower.includes("uber") ||
      descLower.includes("lyft") ||
      descLower.includes("ride-hail")
    ) {
      return EMISSION_FACTORS.transport.taxi;
    } else if (
      descLower.includes("car") ||
      descLower.includes("drive") ||
      descLower.includes("driving") ||
      descLower.includes("drove") ||
      descLower.includes("vehicle")
    ) {
      return EMISSION_FACTORS.transport.car;
    }
  } else if (category === "food") {
    if (
      descLower.includes("beef") ||
      descLower.includes("burger") ||
      descLower.includes("steak")
    ) {
      return EMISSION_FACTORS.food.beef;
    } else if (descLower.includes("lamb")) {
      return EMISSION_FACTORS.food.beef; // lamb ≈ beef range
    } else if (descLower.includes("chicken") || descLower.includes("poultry")) {
      return EMISSION_FACTORS.food.chicken;
    } else if (descLower.includes("pork")) {
      return EMISSION_FACTORS.food.pork;
    } else if (descLower.includes("fish") || descLower.includes("seafood")) {
      return EMISSION_FACTORS.food.fish;
    } else if (descLower.includes("cheese")) {
      return EMISSION_FACTORS.food.cheese;
    } else if (descLower.includes("milk") || descLower.includes("dairy")) {
      return EMISSION_FACTORS.food.milk;
    } else if (descLower.includes("rice")) {
      return EMISSION_FACTORS.food.rice;
    } else if (descLower.includes("pasta")) {
      return EMISSION_FACTORS.food.pasta;
    } else if (
      descLower.includes("salad") ||
      descLower.includes("vegetable") ||
      descLower.includes("vegan") ||
      descLower.includes("vegetarian")
    ) {
      return EMISSION_FACTORS.food.vegetable;
    }
  } else if (category === "energy") {
    if (descLower.includes("electricity") || descLower.includes("kwh")) {
      return EMISSION_FACTORS.energy.electricity;
    } else if (descLower.includes("gas")) {
      return EMISSION_FACTORS.energy.gas;
    } else if (descLower.includes("heating")) {
      return EMISSION_FACTORS.energy.heating;
    }
  } else if (category === "waste") {
    if (descLower.includes("recycle") || descLower.includes("recycling")) {
      return EMISSION_FACTORS.waste.recycle;
    } else if (descLower.includes("compost")) {
      return EMISSION_FACTORS.waste.compost;
    } else if (
      descLower.includes("landfill") ||
      descLower.includes("trash") ||
      descLower.includes("garbage")
    ) {
      return EMISSION_FACTORS.waste.landfill;
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
