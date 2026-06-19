import {
  TRANSPORT_KEYWORDS,
  ZERO_EMISSION_TRANSPORT,
  VEHICLE_TRANSPORT,
  FLIGHT_TRANSPORT,
  PUBLIC_TRANSPORT,
  SCOOTER_TRANSPORT,
  TAXI_TRANSPORT,
  FOOD_KEYWORDS,
  ENERGY_KEYWORDS,
  WASTE_KEYWORDS,
} from "../utils/constants.js";

/**
 * Extracts all numbers and optional following text (units) from a string.
 * @param {string} text - The input string to parse.
 * @returns {Array<{num: number, unitText: string, index: number}>} An array of matched number objects.
 */
export function extractNumbers(text) {
  const numberRegex = /(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/g;
  let match;
  const matches = [];
  while ((match = numberRegex.exec(text)) !== null) {
    matches.push({
      num: parseFloat(match[1]),
      unitText: match[2] || "",
      index: match.index,
    });
  }
  return matches;
}

/**
 * Checks if a keyword appears within a ±50 character range of a given index.
 * @param {string} text - The input text.
 * @param {string} keyword - The keyword to search for.
 * @param {number} index - The anchor index.
 * @returns {boolean} True if keyword is near the index.
 */
export function isKeywordNear(text, keyword, index) {
  const range = 50;
  const start = Math.max(0, index - range);
  const end = Math.min(text.length, index + range);
  return text.substring(start, end).includes(keyword);
}

/**
 * Checks if a string contains a word exactly (using word boundaries).
 * @param {string} text - The input text.
 * @param {string} keyword - The word to match.
 * @returns {boolean} True if the word is found.
 */
export function textHasWord(text, keyword) {
  const regex = new RegExp(
    `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
  );
  return regex.test(text);
}

/**
 * Finds the exact index of a whole word in text.
 * @param {string} text - The input text.
 * @param {string} keyword - The word to find.
 * @returns {number} The index of the word, or -1 if not found.
 */
export function findWordIndex(text, keyword) {
  const regex = new RegExp(
    `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
  );
  const m = regex.exec(text);
  return m ? m.index : -1;
}

/**
 * Finds the nearest number match to a given keyword occurrence.
 * @param {string} text - The input text.
 * @param {Array<{index: number}>} matches - List of number matches.
 * @param {string} keyword - The keyword to associate with the number.
 * @returns {Object|null} The nearest match object or null.
 */
export function findNearestMatch(text, matches, keyword) {
  const kwIndex = findWordIndex(text, keyword);
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
}

/**
 * Analyzes text using a deterministic fallback strategy to extract carbon-relevant activities.
 * @param {string} activityString - Natural language string describing activities.
 * @returns {Array<{category: string, value: number, unit: string, description: string}>} Array of extracted activities.
 */
export function extractActivitiesFallback(activityString) {
  const text = activityString.toLowerCase();
  const activities = [];
  const matches = extractNumbers(text);

  // Transport keywords
  for (const kw of TRANSPORT_KEYWORDS) {
    if (!textHasWord(text, kw)) continue;
    const matchObj = findNearestMatch(text, matches, kw) ||
      matches.find((m) => isKeywordNear(text, kw, m.index)) || {
        num: 1,
        unitText: "trip",
      };
    const unit = matchObj.unitText || "km";
    let description;

    if (ZERO_EMISSION_TRANSPORT.has(kw))
      description = `Active transit (${kw}) ${matchObj.num} ${unit}`;
    else if (FLIGHT_TRANSPORT.has(kw))
      description = `Flight transit ${matchObj.num} ${unit}`;
    else if (PUBLIC_TRANSPORT.has(kw))
      description = `Public transit (${kw}) ${matchObj.num} ${unit}`;
    else if (SCOOTER_TRANSPORT.has(kw))
      description = `Scooter transit ${matchObj.num} ${unit}`;
    else if (TAXI_TRANSPORT.has(kw))
      description = `Taxi/ride-hail (${kw}) ${matchObj.num} ${unit}`;
    else if (VEHICLE_TRANSPORT.has(kw))
      description = `Vehicle transport ${matchObj.num} ${unit}`;
    else description = `Transport (${kw}) ${matchObj.num} ${unit}`;

    activities.push({
      category: "transport",
      value: matchObj.num,
      unit,
      description,
    });
  }

  // Food keywords
  for (const kw of FOOD_KEYWORDS) {
    if (!textHasWord(text, kw)) continue;
    const matchObj = findNearestMatch(text, matches, kw) ||
      matches.find((m) => isKeywordNear(text, kw, m.index)) || {
        num: 1,
        unitText: "serving",
      };
    activities.push({
      category: "food",
      value: matchObj.num,
      unit: matchObj.unitText || "serving",
      description: `Consumed ${kw}: ${matchObj.num} ${matchObj.unitText || "serving"}`,
    });
  }

  // Energy keywords
  for (const kw of ENERGY_KEYWORDS) {
    if (!textHasWord(text, kw)) continue;
    const matchObj = findNearestMatch(text, matches, kw) ||
      matches.find((m) => isKeywordNear(text, kw, m.index)) || {
        num: 1,
        unitText: "kwh",
      };
    activities.push({
      category: "energy",
      value: matchObj.num,
      unit: matchObj.unitText || "kwh",
      description: `Energy use (${kw}): ${matchObj.num} ${matchObj.unitText || "kwh"}`,
    });
  }

  // Waste keywords
  for (const kw of WASTE_KEYWORDS) {
    if (!textHasWord(text, kw)) continue;
    const matchObj = findNearestMatch(text, matches, kw) ||
      matches.find((m) => isKeywordNear(text, kw, m.index)) || {
        num: 1,
        unitText: "kg",
      };
    activities.push({
      category: "waste",
      value: matchObj.num,
      unit: matchObj.unitText || "kg",
      description: `Waste (${kw}): ${matchObj.num} ${matchObj.unitText || "kg"}`,
    });
  }

  // Improved deduplication
  const uniqueActivities = [];
  const seenKeys = new Set();
  for (const act of activities) {
    const dedupKey = `${act.category}::${act.description}`;
    if (!seenKeys.has(dedupKey)) {
      seenKeys.add(dedupKey);
      uniqueActivities.push(act);
    }
  }

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
