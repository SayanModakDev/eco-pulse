/**
 * @fileoverview Shared constants across the Eco-Pulse backend API.
 * Contains extraction keywords, rate limit definitions, and caching configs.
 */

// ── Rate Limiting Constants ─────────────────────────────────────────────

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX_REQUESTS = 10000;

// ── Fallback Extraction Keywords ─────────────────────────────────────────

export const TRANSPORT_KEYWORDS = [
  "km",
  "mile",
  "miles",
  "bike",
  "bicycle",
  "car",
  "drive",
  "driving",
  "drove",
  "rode",
  "bus",
  "train",
  "metro",
  "subway",
  "flight",
  "fly",
  "flew",
  "plane",
  "walk",
  "walked",
  "scooter",
  "taxi",
  "cab",
  "uber",
  "lyft",
  "ride",
];

export const ZERO_EMISSION_TRANSPORT = new Set([
  "bike",
  "bicycle",
  "walk",
  "walked",
  "cycle",
]);
export const VEHICLE_TRANSPORT = new Set([
  "car",
  "drive",
  "driving",
  "drove",
  "km",
  "mile",
  "miles",
]);
export const FLIGHT_TRANSPORT = new Set(["flight", "fly", "flew", "plane"]);
export const PUBLIC_TRANSPORT = new Set(["bus", "train", "metro", "subway"]);
export const SCOOTER_TRANSPORT = new Set(["scooter"]);
export const TAXI_TRANSPORT = new Set(["taxi", "cab", "uber", "lyft", "ride"]);

export const FOOD_KEYWORDS = [
  "burger",
  "beef",
  "steak",
  "lamb",
  "chicken",
  "poultry",
  "pork",
  "fish",
  "seafood",
  "meat",
  "egg",
  "cheese",
  "dairy",
  "milk",
  "rice",
  "pasta",
  "salad",
  "vegan",
  "vegetarian",
  "eat",
  "ate",
  "meal",
];

export const ENERGY_KEYWORDS = [
  "kwh",
  "electricity",
  "power",
  "heating",
  "gas",
  "solar",
  "ac",
  "aircon",
];

export const WASTE_KEYWORDS = [
  "landfill",
  "trash",
  "garbage",
  "recycle",
  "recycling",
  "compost",
  "waste",
  "throw",
  "threw",
  "dispose",
  "bin",
];
