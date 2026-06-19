/* eslint-disable max-len */
/**
 * End-to-end structured output verification for the Eco-Pulse orchestrator.
 * Validates JSON schema compliance, field types, value ranges, and challenge quality.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { orchestrateCarbonTracking } from "../agents/orchestrator.js";

// ─── Test Scenarios ───────────────────────────────────────────────────────────
const scenarios = [
  {
    name: "Standard commute + food",
    input: "Drove 25km to work and ate a beef burger for lunch",
    expectedCategories: ["transport", "food"],
    expectedHotspotCategory: "food",
  },
  {
    name: "Multi-category day",
    input:
      "Took a taxi 10km, ate 2 chicken meals, used 6kwh electricity, and threw 1kg trash",
    expectedCategories: ["transport", "food", "energy", "waste"],
    expectedHotspotCategory: null, // don't assert — just verify it's valid
  },
  {
    name: "Zero-emission commute",
    input: "I walked 3km to the office and rode my bike 8km home",
    expectedCategories: ["transport"],
    expectedHotspotCategory: "transport",
    expectZeroOrLow: true,
  },
  {
    name: "Heavy meat diet",
    input: "I ate 3 beef steaks and 2 burgers today",
    expectedCategories: ["food"],
    expectedHotspotCategory: "food",
  },
  {
    name: "Energy-heavy day",
    input: "Used 20kwh of electricity running the heating all day",
    expectedCategories: ["energy"],
    expectedHotspotCategory: "energy",
  },
  {
    name: "New keywords: scooter + rice + pasta",
    input: "Rode a scooter 12km, had rice and pasta for dinner",
    expectedCategories: ["transport", "food"],
    expectedHotspotCategory: null,
  },
  {
    name: "Vague / ambiguous input",
    input: "Had a pretty normal day nothing special",
    expectedCategories: null, // generic fallback
    expectedHotspotCategory: null,
  },
  {
    name: "Emoji-rich input",
    input: "🚗 drove 10km and ate 🍔 burger",
    expectedCategories: ["transport", "food"],
    expectedHotspotCategory: null,
  },
];

// ─── Schema Validators ───────────────────────────────────────────────────────

function assertActivityShape(activity, label) {
  assert.ok(activity.category, `${label}: missing category`);
  assert.ok(
    ["transport", "food", "energy", "waste", "other"].includes(
      activity.category,
    ),
    `${label}: invalid category "${activity.category}"`,
  );
  assert.equal(
    typeof activity.value,
    "number",
    `${label}: value must be number`,
  );
  assert.ok(activity.value >= 0, `${label}: value must be non-negative`);
  assert.ok(
    typeof activity.unit === "string" && activity.unit.length > 0,
    `${label}: unit must be non-empty string`,
  );
  assert.ok(
    typeof activity.description === "string" && activity.description.length > 0,
    `${label}: description must be non-empty string`,
  );
  assert.equal(
    typeof activity.co2eKg,
    "number",
    `${label}: co2eKg must be number`,
  );
  assert.ok(activity.co2eKg >= 0, `${label}: co2eKg must be non-negative`);
  assert.equal(
    typeof activity.emissionFactorUsed,
    "number",
    `${label}: emissionFactorUsed must be number`,
  );
  assert.ok(
    activity.emissionFactorUsed >= 0,
    `${label}: emissionFactorUsed must be non-negative`,
  );
}

function assertSummaryShape(summary, label) {
  assert.equal(
    typeof summary.totalCo2eKg,
    "number",
    `${label}: totalCo2eKg must be number`,
  );
  assert.ok(
    summary.totalCo2eKg >= 0,
    `${label}: totalCo2eKg must be non-negative`,
  );
  assert.equal(
    typeof summary.dailyBaselineKg,
    "number",
    `${label}: dailyBaselineKg must be number`,
  );
  assert.ok(
    summary.dailyBaselineKg > 0,
    `${label}: dailyBaselineKg must be positive`,
  );
  assert.equal(
    typeof summary.differenceKg,
    "number",
    `${label}: differenceKg must be number`,
  );
  assert.equal(
    typeof summary.percentageDifference,
    "number",
    `${label}: percentageDifference must be number`,
  );
  assert.ok(
    ["under_baseline", "over_baseline"].includes(summary.status),
    `${label}: invalid status "${summary.status}"`,
  );
  // Hotspot should be either null or a valid activity
  if (summary.hotspot) {
    assert.ok(summary.hotspot.category, `${label}: hotspot missing category`);
    assert.equal(
      typeof summary.hotspot.co2eKg,
      "number",
      `${label}: hotspot co2eKg must be number`,
    );
  }
}

function assertChallengeShape(challenge, index, label) {
  const tag = `${label} challenge[${index}]`;
  assert.ok(
    typeof challenge.title === "string" && challenge.title.length > 0,
    `${tag}: title must be non-empty string`,
  );
  assert.ok(
    typeof challenge.description === "string" &&
      challenge.description.length > 0,
    `${tag}: description must be non-empty`,
  );
  assert.equal(
    typeof challenge.potentialSavingKg,
    "number",
    `${tag}: potentialSavingKg must be number`,
  );
  assert.ok(
    challenge.potentialSavingKg > 0,
    `${tag}: potentialSavingKg must be positive`,
  );
  assert.ok(
    ["easy", "medium", "hard"].includes(challenge.difficulty),
    `${tag}: invalid difficulty "${challenge.difficulty}"`,
  );
  assert.ok(
    ["transport", "food", "energy", "waste", "other"].includes(
      challenge.category,
    ),
    `${tag}: invalid category "${challenge.category}"`,
  );
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("Structured Output Schema Verification", () => {
  for (const scenario of scenarios) {
    it(`[Schema] ${scenario.name}`, async () => {
      const result = await orchestrateCarbonTracking({
        activityString: scenario.input,
        profileContext: {
          userId: "verify",
          email: "v@v.com",
          dailyBaselineKg: 15.0,
        },
      });

      const label = scenario.name;

      // Top-level fields
      assert.ok(
        typeof result.rawInput === "string",
        `${label}: rawInput must be string`,
      );
      assert.equal(
        result.rawInput,
        scenario.input,
        `${label}: rawInput must match input`,
      );
      assert.ok(result.profileApplied, `${label}: profileApplied must exist`);
      assert.equal(
        result.profileApplied.userId,
        "verify",
        `${label}: userId must match`,
      );

      // Activities array
      assert.ok(
        Array.isArray(result.activities),
        `${label}: activities must be array`,
      );
      assert.ok(
        result.activities.length > 0,
        `${label}: activities must not be empty`,
      );
      for (let i = 0; i < result.activities.length; i++) {
        assertActivityShape(result.activities[i], `${label} activity[${i}]`);
      }

      // Summary
      assert.ok(result.summary, `${label}: summary must exist`);
      assertSummaryShape(result.summary, label);

      // microChallenges
      assert.ok(
        Array.isArray(result.microChallenges),
        `${label}: microChallenges must be array`,
      );
      assert.ok(
        result.microChallenges.length > 0,
        `${label}: microChallenges must not be empty`,
      );
      for (let i = 0; i < result.microChallenges.length; i++) {
        assertChallengeShape(result.microChallenges[i], i, label);
      }

      // summaryInsight
      assert.ok(
        typeof result.summaryInsight === "string",
        `${label}: summaryInsight must be string`,
      );
      assert.ok(
        result.summaryInsight.length > 10,
        `${label}: summaryInsight must be a meaningful sentence`,
      );

      // Verify expected categories were detected
      if (scenario.expectedCategories) {
        const detectedCategories = new Set(
          result.activities.map((a) => a.category),
        );
        for (const expected of scenario.expectedCategories) {
          assert.ok(
            detectedCategories.has(expected),
            `${label}: expected category "${expected}" not detected`,
          );
        }
      }

      // Verify hotspot category if specified
      if (scenario.expectedHotspotCategory) {
        assert.equal(
          result.summary.hotspot?.category,
          scenario.expectedHotspotCategory,
          `${label}: hotspot should be "${scenario.expectedHotspotCategory}"`,
        );
      }
    });
  }
});

describe("Challenge Quality Assessment", () => {
  it("food hotspot → challenges should target food reduction", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "I ate 4 beef burgers and 2 steaks",
    });

    assert.equal(result.summary.hotspot.category, "food");
    for (const ch of result.microChallenges) {
      assert.equal(
        ch.category,
        "food",
        "All challenges for food hotspot should be food category",
      );
      assert.ok(
        ch.potentialSavingKg >= 0.1,
        "Saving should be at least 0.1 kg",
      );
      assert.ok(ch.title.length >= 4, "Title should be at least 4 characters");
      assert.ok(
        ch.description.length >= 20,
        "Description should be at least 20 characters",
      );
    }
  });

  it("transport hotspot → challenges should target transport reduction", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "I drove my car 80km today",
    });

    assert.equal(result.summary.hotspot.category, "transport");
    for (const ch of result.microChallenges) {
      assert.equal(
        ch.category,
        "transport",
        "All challenges for transport hotspot should be transport category",
      );
      assert.ok(
        ch.potentialSavingKg >= 0.1,
        "Saving should be at least 0.1 kg",
      );
    }
  });

  it("energy hotspot → challenges should target energy reduction", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "Used 50kwh of electricity today",
    });

    assert.equal(result.summary.hotspot.category, "energy");
    for (const ch of result.microChallenges) {
      assert.equal(
        ch.category,
        "energy",
        "All challenges for energy hotspot should be energy category",
      );
    }
  });

  it("challenges should have distinct titles (no duplicates)", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "Drove 30km, ate 3 burgers, used 10kwh, threw 2kg trash",
    });

    const titles = result.microChallenges.map((ch) => ch.title);
    const uniqueTitles = new Set(titles);
    assert.equal(
      titles.length,
      uniqueTitles.size,
      "Challenge titles must be unique",
    );
  });

  it("potentialSavingKg values should be realistic (< 50 kg per challenge)", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "I drove 100km and ate 5 beef burgers",
    });

    for (const ch of result.microChallenges) {
      assert.ok(ch.potentialSavingKg > 0, "Saving must be positive");
      assert.ok(
        ch.potentialSavingKg < 50,
        `Saving ${ch.potentialSavingKg} kg is unrealistically high`,
      );
    }
  });

  it("summaryInsight should be coherent and related to the hotspot", async () => {
    const testCases = [
      {
        input: "I ate 5 beef steaks",
        hotspot: "food",
        keywords: ["food", "plate", "swap", "difference"],
      },
      {
        input: "Drove 100km in my car",
        hotspot: "transport",
        keywords: ["transport", "car-free", "trip", "impact"],
      },
      {
        input: "Used 30kwh electricity",
        hotspot: "energy",
        keywords: ["energy", "home", "footprint", "changes"],
      },
    ];

    for (const tc of testCases) {
      const result = await orchestrateCarbonTracking({
        activityString: tc.input,
      });
      assert.equal(result.summary.hotspot.category, tc.hotspot);
      const insight = result.summaryInsight.toLowerCase();
      const hasRelevantKeyword = tc.keywords.some((kw) => insight.includes(kw));
      assert.ok(
        hasRelevantKeyword,
        `summaryInsight for ${tc.hotspot} hotspot should contain one of [${tc.keywords.join(", ")}], got: "${result.summaryInsight}"`,
      );
    }
  });

  it("CO2e math should be consistent (totalCo2eKg = sum of activity co2eKg)", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "Drove 20km, ate 2 chicken meals, used 5kwh",
    });

    const summedCo2e = result.activities.reduce((sum, a) => sum + a.co2eKg, 0);
    const rounded = parseFloat(summedCo2e.toFixed(2));
    assert.equal(
      result.summary.totalCo2eKg,
      rounded,
      `totalCo2eKg (${result.summary.totalCo2eKg}) should equal sum of activities (${rounded})`,
    );
  });
});
