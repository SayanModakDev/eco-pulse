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

// ── Emission Factors ──────────────────────────────────────────────────────

export const EMISSION_FACTORS = {
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
