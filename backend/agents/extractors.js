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

export function isKeywordNear(text, keyword, index) {
  const range = 50;
  const start = Math.max(0, index - range);
  const end = Math.min(text.length, index + range);
  return text.substring(start, end).includes(keyword);
}

const wordRegexCache = new Map();

function getWordRegex(keyword) {
  let regex = wordRegexCache.get(keyword);
  if (!regex) {
    regex = new RegExp(
      `\\b${keyword.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`,
    );
    wordRegexCache.set(keyword, regex);
  }
  return regex;
}

export function textHasWord(text, keyword) {
  return getWordRegex(keyword).test(text);
}

export function findWordIndex(text, keyword) {
  const m = getWordRegex(keyword).exec(text);
  return m ? m.index : -1;
}

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

export function extractTransportActivities(text, matches) {
  const activities = [];
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
  return activities;
}

export function extractFoodActivities(text, matches) {
  const activities = [];
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
  return activities;
}

export function extractEnergyActivities(text, matches) {
  const activities = [];
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
  return activities;
}

export function extractWasteActivities(text, matches) {
  const activities = [];
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
  return activities;
}

export function deduplicateActivities(activities) {
  const uniqueActivities = [];
  const seenKeys = new Set();
  for (const act of activities) {
    const dedupKey = `${act.category}::${act.description}`;
    if (!seenKeys.has(dedupKey)) {
      seenKeys.add(dedupKey);
      uniqueActivities.push(act);
    }
  }
  return uniqueActivities;
}
