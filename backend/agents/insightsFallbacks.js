/**
 * @fileoverview Default fallback challenges and summary insights
 * used when the LLM insights agent is unavailable.
 */
export const defaultChallenges = {
  food: [
    {
      title: "Try a Meatless Monday",
      description:
        "Based on your recent beef consumption, substitute with lentils or a plant-based option in your next meal for major savings.",
      estimatedCO2SavingsKg: 4.8,
      difficulty: "easy",
      category: "food",
    },
    {
      title: "Swap Beef for Chicken",
      description:
        "Transition your main protein from beef to poultry for your next meal. Chicken has a carbon footprint nearly 4x smaller than beef per serving.",
      estimatedCO2SavingsKg: 3.5,
      difficulty: "easy",
      category: "food",
    },
  ],
  transport: [
    {
      title: "Go Car-Free This Trip",
      description:
        "For your next journey under 5km, leave the car key behind and choose to walk, cycle, or use public transport. You'll save emissions and gain exercise.",
      estimatedCO2SavingsKg: 1.8,
      difficulty: "medium",
      category: "transport",
    },
    {
      title: "Combine Your Car Trips",
      description:
        "Plan ahead and consolidate multiple short errands into a single trip. Cold engine starts produce disproportionately high emissions.",
      estimatedCO2SavingsKg: 0.9,
      difficulty: "easy",
      category: "transport",
    },
  ],
  energy: [
    {
      title: "Hunt Your Standby Power",
      description:
        "Walk around your home and unplug 3 vampire electronics (TV boxes, microwave displays, chargers) that consume energy even when idle.",
      estimatedCO2SavingsKg: 0.6,
      difficulty: "easy",
      category: "energy",
    },
    {
      title: "Shift Your Thermostat 1°",
      description:
        "Set your AC 1 degree higher or heater 1 degree lower today. This small shift can save a significant chunk of HVAC energy over the day.",
      estimatedCO2SavingsKg: 1.2,
      difficulty: "easy",
      category: "energy",
    },
  ],
  waste: [
    {
      title: "Go Zero-Waste at Meals",
      description:
        "Avoid all single-use plastics and packaging for your meals today. Pack food in reusable containers and carry a reusable water bottle.",
      estimatedCO2SavingsKg: 0.4,
      difficulty: "medium",
      category: "waste",
    },
  ],
  other: [
    {
      title: "Do a Digital Clean-Up",
      description:
        "Delete 100 old emails and clear files from your cloud storage trash to reduce remote data center server load and energy use.",
      estimatedCO2SavingsKg: 0.1,
      difficulty: "easy",
      category: "other",
    },
  ],
};

export const defaultSummaryInsights = {
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
