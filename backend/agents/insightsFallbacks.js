/**
 * @fileoverview Default fallback challenges and summary insights
 * used when the LLM insights agent is unavailable.
 */

export const generateFallbackChallenges = (hotspot, rawInput) => {
  const category = hotspot?.category || "other";
  const desc = hotspot?.description || "activity";
  const co2e = hotspot?.co2eKg || 0;
  
  // Calculate realistic savings based on actual emissions
  const primarySavings = parseFloat((co2e * 0.3).toFixed(2)) || 1.5;
  const secondarySavings = parseFloat((co2e * 0.15).toFixed(2)) || 0.8;

  // Determine tone based on severity
  const isLowEmission = co2e < 2.0;

  if (category === "food") {
    if (isLowEmission) {
      return [
        {
          title: "Sustain Your Plant-Based Streak",
          description: `Your recent food choice (${desc}) was already low-emission! Challenge yourself to keep your next two meals completely plant-based.`,
          estimatedCO2SavingsKg: primarySavings,
          difficulty: "medium",
          category: "food",
        },
        {
          title: "Optimize Your Food Waste",
          description: "Since your diet is already carbon-efficient, ensure none of it goes to waste. Plan your portions strictly for your next meal.",
          estimatedCO2SavingsKg: secondarySavings,
          difficulty: "easy",
          category: "food",
        }
      ];
    }
    return [
      {
        title: "Swap High-Emission Protein",
        description: `Your ${desc} contributed heavily to your footprint. Substitute with lentils or a plant-based option in your next meal for major savings.`,
        estimatedCO2SavingsKg: primarySavings,
        difficulty: "easy",
        category: "food",
      },
      {
        title: "Try a Meatless Monday",
        description: "Commit to making one full day a week entirely meat-free to offset the emissions from this meal.",
        estimatedCO2SavingsKg: secondarySavings,
        difficulty: "medium",
        category: "food",
      },
    ];
  }

  if (category === "transport") {
    if (isLowEmission) {
      return [
        {
          title: "Keep Up the Active Transit",
          description: `Your choice of ${desc} is excellent. Can you recruit a friend or family member to join you on your next active commute?`,
          estimatedCO2SavingsKg: primarySavings,
          difficulty: "easy",
          category: "transport",
        },
        {
          title: "Share Your Low-Carbon Route",
          description: "Log or share the zero-emission route you just took to encourage others to avoid driving that segment.",
          estimatedCO2SavingsKg: secondarySavings,
          difficulty: "easy",
          category: "transport",
        }
      ];
    }
    return [
      {
        title: "Go Car-Free This Trip",
        description: `Your ${desc} was your biggest emission source. For your next journey under 5km, leave the car key behind and choose to walk, cycle, or use public transport.`,
        estimatedCO2SavingsKg: primarySavings,
        difficulty: "medium",
        category: "transport",
      },
      {
        title: "Combine Your Car Trips",
        description: "Plan ahead and consolidate multiple short errands into a single trip. Cold engine starts produce disproportionately high emissions.",
        estimatedCO2SavingsKg: secondarySavings,
        difficulty: "easy",
        category: "transport",
      },
    ];
  }

  if (category === "energy") {
    return [
      {
        title: "Hunt Your Standby Power",
        description: `Your ${desc} signals high energy usage. Walk around your home and unplug 3 vampire electronics that consume energy even when idle.`,
        estimatedCO2SavingsKg: primarySavings,
        difficulty: "easy",
        category: "energy",
      },
      {
        title: "Shift Your Thermostat 1°",
        description: "Set your AC 1 degree higher or heater 1 degree lower today. This small shift can save a significant chunk of HVAC energy.",
        estimatedCO2SavingsKg: secondarySavings,
        difficulty: "easy",
        category: "energy",
      },
    ];
  }

  if (category === "waste") {
    return [
      {
        title: "Go Zero-Waste at Meals",
        description: `Your ${desc} added to landfill mass. Avoid all single-use plastics and packaging for your meals today.`,
        estimatedCO2SavingsKg: primarySavings,
        difficulty: "medium",
        category: "waste",
      },
    ];
  }

  return [
    {
      title: "Do a Digital Clean-Up",
      description: `Reflecting on your ${desc}, consider reducing your remote data footprint by deleting 100 old emails.`,
      estimatedCO2SavingsKg: primarySavings,
      difficulty: "easy",
      category: "other",
    },
  ];
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
