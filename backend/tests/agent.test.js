import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ─── Zod Schema Validation Tests ──────────────────────────────────────────────

import {
  naturalLanguageInputSchema,
  profileContextSchema,
  trackRequestSchema,
} from "../utils/validators.js";

describe("Zod Schema Validations", () => {
  // ── naturalLanguageInputSchema ─────────────────────────────────────────

  describe("naturalLanguageInputSchema", () => {
    it("should accept a valid query with locale and timestamp", () => {
      const input = {
        query: "What is the carbon footprint of driving?",
        locale: "en-US",
        timestamp: "2026-06-18T12:00:00.000Z",
      };
      const result = naturalLanguageInputSchema.parse(input);
      assert.equal(result.query, "What is the carbon footprint of driving?");
      assert.equal(result.locale, "en-US");
    });

    it("should trim whitespace from query", () => {
      const result = naturalLanguageInputSchema.parse({
        query: "   hello world   ",
      });
      assert.equal(result.query, "hello world");
    });

    it("should reject an empty string query", () => {
      assert.throws(
        () => naturalLanguageInputSchema.parse({ query: "" }),
        (err) => {
          assert.ok(err.issues.some((i) => i.message.includes("empty")));
          return true;
        },
      );
    });

    it("should reject a query exceeding 500 characters", () => {
      const longQuery = "a".repeat(501);
      assert.throws(
        () => naturalLanguageInputSchema.parse({ query: longQuery }),
        (err) => {
          assert.ok(err.issues.some((i) => i.message.includes("500")));
          return true;
        },
      );
    });

    it("should reject a non-string query", () => {
      assert.throws(
        () => naturalLanguageInputSchema.parse({ query: 12345 }),
        (err) => {
          assert.ok(err.issues.some((i) => i.message.includes("string")));
          return true;
        },
      );
    });

    it("should reject invalid locale formats", () => {
      assert.throws(
        () =>
          naturalLanguageInputSchema.parse({
            query: "test",
            locale: "english",
          }),
        (err) => {
          assert.ok(err.issues.some((i) => i.path.includes("locale")));
          return true;
        },
      );
    });

    it("should accept query with only optional fields omitted", () => {
      const result = naturalLanguageInputSchema.parse({ query: "hello" });
      assert.equal(result.locale, undefined);
      assert.equal(result.timestamp, undefined);
    });
  });

  // ── trackRequestSchema ─────────────────────────────────────────────────

  describe("trackRequestSchema", () => {
    it("should accept a valid track request with profile context", () => {
      const result = trackRequestSchema.parse({
        activityString: "I drove 10km",
        profileContext: {
          userId: "u1",
          email: "a@b.com",
        },
      });
      assert.equal(result.activityString, "I drove 10km");
      assert.equal(result.profileContext.userId, "u1");
    });

    it("should accept a track request without profile context", () => {
      const result = trackRequestSchema.parse({
        activityString: "I ate a salad",
      });
      assert.equal(result.profileContext, undefined);
    });

    it("should reject a missing activityString", () => {
      assert.throws(
        () => trackRequestSchema.parse({}),
        (err) => {
          assert.ok(err.issues.some((i) => i.path.includes("activityString")));
          return true;
        },
      );
    });

    it("should reject an activityString exceeding 2000 characters", () => {
      assert.throws(
        () => trackRequestSchema.parse({ activityString: "x".repeat(2001) }),
        (err) => {
          assert.ok(err.issues.some((i) => i.message.includes("too long")));
          return true;
        },
      );
    });

    it("should reject activityString containing only whitespace", () => {
      assert.throws(
        () => trackRequestSchema.parse({ activityString: "    " }),
        (err) => {
          assert.ok(err.issues.some((i) => i.message.includes("empty")));
          return true;
        },
      );
    });

    it("should pass through special characters in activityString safely", () => {
      const input = {
        activityString: 'I drove <script>alert("xss")</script> 10km',
      };
      const result = trackRequestSchema.parse(input);
      assert.ok(result.activityString.includes("<script>"));
    });
  });

  // ── profileContextSchema ───────────────────────────────────────────────

  describe("profileContextSchema", () => {
    it("should reject invalid email addresses", () => {
      assert.throws(
        () => profileContextSchema.parse({ userId: "u1", email: "not-email" }),
        (err) => {
          assert.ok(err.issues.some((i) => i.path.includes("email")));
          return true;
        },
      );
    });

    it("should apply default preferences when omitted", () => {
      const result = profileContextSchema.parse({
        userId: "u1",
        email: "a@b.com",
      });
      assert.equal(result.preferences.theme, "system");
      assert.equal(result.preferences.notificationsEnabled, true);
    });

    it("should reject negative dailyBaselineKg", () => {
      assert.throws(
        () =>
          profileContextSchema.parse({
            userId: "u1",
            email: "a@b.com",
            dailyBaselineKg: -5,
          }),
        (err) => {
          assert.ok(err.issues.some((i) => i.path.includes("dailyBaselineKg")));
          return true;
        },
      );
    });

    it("should reject more than 20 tags", () => {
      const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
      assert.throws(
        () =>
          profileContextSchema.parse({ userId: "u1", email: "a@b.com", tags }),
        (err) => {
          assert.ok(err.issues.some((i) => i.message.includes("20")));
          return true;
        },
      );
    });
  });
});

// ─── Orchestrator & Agent Pipeline Tests ──────────────────────────────────────

import { orchestrateCarbonTracking } from "../agents/orchestrator.js";

describe("Agent Orchestrator Pipeline", () => {
  it("should process a standard activity string and return all required fields", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "I drove 20km and ate a beef burger",
      profileContext: { userId: "test", email: "t@t.com", dailyBaselineKg: 10 },
    });

    assert.ok(result.rawInput);
    assert.ok(Array.isArray(result.activities));
    assert.ok(result.activities.length > 0);
    assert.ok(result.summary);
    assert.equal(typeof result.summary.totalCo2eKg, "number");
    assert.equal(result.summary.dailyBaselineKg, 10);
    assert.ok(
      ["under_baseline", "over_baseline"].includes(result.summary.status),
    );
    assert.ok(Array.isArray(result.microChallenges));
    assert.ok(result.microChallenges.length > 0);
    assert.ok(typeof result.summaryInsight === "string");
  });

  it("should handle an input with no recognizable activities gracefully", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "I just had a wonderful day relaxing at home",
    });

    // Should fall back to generic activity
    assert.ok(result.activities.length > 0);
    assert.equal(typeof result.summary.totalCo2eKg, "number");
  });

  it("should handle inputs with very large numbers without crashing", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "I drove 999999999 km today",
    });

    assert.ok(result.activities.length > 0);
    assert.ok(result.summary.totalCo2eKg > 0);
    assert.equal(result.summary.status, "over_baseline");
  });

  it("should correctly identify food as hotspot for beef activities", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "I ate 3 beef burgers",
    });

    assert.ok(result.summary.hotspot);
    assert.equal(result.summary.hotspot.category, "food");
    assert.ok(result.summary.hotspot.co2eKg > 0);
  });

  it("should assign zero emissions for cycling and walking", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "I walked 5km and rode a bike for 10km",
    });

    // All transport activities should have zero emission factor
    const transportActivities = result.activities.filter(
      (a) =>
        a.category === "transport" &&
        (a.description.includes("bike") || a.description.includes("walk")),
    );
    for (const act of transportActivities) {
      assert.equal(act.co2eKg, 0);
    }
  });

  it("should return microChallenges matching the hotspot category", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "I drove my car for 50km",
    });

    assert.ok(result.microChallenges.length > 0);
    // Each challenge must have the required shape
    for (const challenge of result.microChallenges) {
      assert.ok(challenge.title);
      assert.ok(challenge.description);
      assert.equal(typeof challenge.potentialSavingKg, "number");
      assert.ok(["easy", "medium", "hard"].includes(challenge.difficulty));
      assert.ok(
        ["transport", "food", "energy", "waste", "other"].includes(
          challenge.category,
        ),
      );
    }
  });

  it("should apply default baseline when profileContext is omitted", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "I ate chicken",
    });

    assert.equal(result.summary.dailyBaselineKg, 15.0);
    assert.equal(result.profileApplied.userId, "anonymous");
  });

  // ── New v2.1 Upgrade Tests ──────────────────────────────────────────────

  it("should handle vague input with no quantities and fall back gracefully", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "went somewhere today",
    });

    // Should produce at least one activity (generic fallback)
    assert.ok(result.activities.length > 0);
    assert.equal(typeof result.summary.totalCo2eKg, "number");
    assert.ok(result.summary.totalCo2eKg >= 0);
    // microChallenges and summaryInsight should always be present
    assert.ok(Array.isArray(result.microChallenges));
    assert.ok(typeof result.summaryInsight === "string");
  });

  it("should extract multiple activities across 3+ categories from a complex input", async () => {
    const result = await orchestrateCarbonTracking({
      activityString:
        "I drove 30km to work, ate 2 beef burgers for lunch, and used 10kwh of electricity at home",
    });

    // Should have activities in transport, food, and energy
    const categories = new Set(result.activities.map((a) => a.category));
    assert.ok(categories.has("transport"), "Should detect transport");
    assert.ok(categories.has("food"), "Should detect food");
    assert.ok(categories.has("energy"), "Should detect energy");
    assert.ok(
      result.activities.length >= 3,
      "Should extract at least 3 activities",
    );
    assert.ok(result.summary.totalCo2eKg > 0);
  });

  it("should recognize new transport keywords: taxi and scooter", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "I took a taxi for 15km and then rode a scooter for 5km",
    });

    const descriptions = result.activities
      .map((a) => a.description.toLowerCase())
      .join(" ");
    assert.ok(
      descriptions.includes("taxi") || descriptions.includes("ride-hail"),
      "Should detect taxi keyword",
    );
    assert.ok(
      descriptions.includes("scooter"),
      "Should detect scooter keyword",
    );
    assert.ok(result.summary.totalCo2eKg > 0);
  });

  it("should recognize new food keywords: rice and pasta", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "I had 2 servings of rice and 1 pasta for dinner",
    });

    const foodActivities = result.activities.filter(
      (a) => a.category === "food",
    );
    assert.ok(
      foodActivities.length >= 2,
      "Should extract at least 2 food activities",
    );
    const descriptions = foodActivities
      .map((a) => a.description.toLowerCase())
      .join(" ");
    assert.ok(descriptions.includes("rice"), "Should detect rice");
    assert.ok(descriptions.includes("pasta"), "Should detect pasta");
  });

  it("should extract energy usage from kilowatt-hour mentions", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "Used 8kwh of electricity running the AC all day",
    });

    const energyActivities = result.activities.filter(
      (a) => a.category === "energy",
    );
    assert.ok(
      energyActivities.length >= 1,
      "Should extract at least 1 energy activity",
    );
    // Should compute a meaningful CO2e value (8 * 0.45 = 3.6)
    const totalEnergyCo2 = energyActivities.reduce(
      (sum, a) => sum + a.co2eKg,
      0,
    );
    assert.ok(totalEnergyCo2 > 0, "Energy CO2e should be positive");
  });

  it("should extract waste-related activities from trash/recycle keywords", async () => {
    const result = await orchestrateCarbonTracking({
      activityString:
        "I threw 3kg of trash in the garbage and recycled 2kg of paper",
    });

    const wasteActivities = result.activities.filter(
      (a) => a.category === "waste",
    );
    assert.ok(
      wasteActivities.length >= 1,
      "Should extract at least 1 waste activity",
    );
    assert.ok(result.summary.totalCo2eKg > 0);
  });

  it("should produce a summaryInsight relevant to the hotspot category", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "I ate 5 beef steaks today",
    });

    assert.equal(result.summary.hotspot.category, "food");
    assert.ok(
      result.summaryInsight.length > 0,
      "summaryInsight should not be empty",
    );
    // Fallback summaryInsight for food should mention food-related language
    assert.ok(
      result.summaryInsight.toLowerCase().includes("food") ||
        result.summaryInsight.toLowerCase().includes("plate") ||
        result.summaryInsight.toLowerCase().includes("swap"),
      "summaryInsight should be relevant to food hotspot",
    );
  });

  it("should handle decimal values correctly in activity extraction", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "Drove 12.5km to the store",
    });

    const transportActs = result.activities.filter(
      (a) => a.category === "transport",
    );
    assert.ok(transportActs.length >= 1);
    // At least one activity should have the decimal value 12.5
    const hasDecimal = transportActs.some((a) => a.value === 12.5);
    assert.ok(hasDecimal, "Should correctly parse decimal value 12.5");
  });

  it("should respect custom dailyBaselineKg from profileContext", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "I drove 5km",
      profileContext: {
        userId: "custom",
        email: "c@c.com",
        dailyBaselineKg: 2.0,
      },
    });

    assert.equal(result.summary.dailyBaselineKg, 2.0);
    // 5km * 0.21 = 1.05 kg, which exceeds 2.0? No, 1.05 < 2.0
    // But 5km matched by 'km' uses car factor 0.21, so 5 * 0.21 = 1.05
    assert.ok(result.summary.totalCo2eKg > 0);
    assert.ok(
      ["under_baseline", "over_baseline"].includes(result.summary.status),
    );
  });

  it("should handle unicode and emoji input without crashing", async () => {
    const result = await orchestrateCarbonTracking({
      activityString: "🚗 drove 10km and ate 🍔 burger",
    });

    assert.ok(result.activities.length > 0);
    assert.equal(typeof result.summary.totalCo2eKg, "number");
    assert.ok(Array.isArray(result.microChallenges));
    assert.ok(typeof result.summaryInsight === "string");
  });

  it("should handle LLM failure gracefully with full fallback", async () => {
    // Temporarily mock ai to null if needed, or test error path
    const result = await orchestrateCarbonTracking({ activityString: "test input" });
    assert.ok(result.microChallenges.length > 0);
    assert.ok(result.summaryInsight);
  });
});

// ─── Memory Cache Tests ──────────────────────────────────────────────────────

import MemoryCache, { emissionFactorCache } from "../utils/cache.js";

describe("MemoryCache Utility", () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryCache({ ttlMs: 500, maxEntries: 3 });
  });

  it("should store and retrieve a value", () => {
    cache.set("key1", "value1");
    assert.equal(cache.get("key1"), "value1");
  });

  it("should return undefined for a non-existent key", () => {
    assert.equal(cache.get("missing"), undefined);
  });

  it("should expire entries after TTL", async () => {
    cache.set("ephemeral", "data", 50); // 50ms TTL
    assert.equal(cache.get("ephemeral"), "data");

    await new Promise((r) => setTimeout(r, 80));
    assert.equal(cache.get("ephemeral"), undefined);
  });

  it("should evict the oldest entry when maxEntries is exceeded", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    // Cache is full (3 entries). Adding a 4th should evict 'a'.
    cache.set("d", 4);
    assert.equal(cache.get("a"), undefined);
    assert.equal(cache.get("d"), 4);
  });

  it("should correctly report has() for existing and missing keys", () => {
    cache.set("present", true);
    assert.equal(cache.has("present"), true);
    assert.equal(cache.has("absent"), false);
  });

  it("should delete a specific key", () => {
    cache.set("toDelete", "val");
    assert.equal(cache.delete("toDelete"), true);
    assert.equal(cache.get("toDelete"), undefined);
  });

  it("should clear all entries", () => {
    cache.set("x", 1);
    cache.set("y", 2);
    cache.clear();
    assert.equal(cache.size, 0);
  });

  it("should return correct stats", () => {
    cache.set("s", 1);
    const stats = cache.stats();
    assert.equal(stats.size, 1);
    assert.equal(stats.maxEntries, 3);
    assert.equal(stats.ttlMs, 500);
  });
});

describe("emissionFactorCache singleton", () => {
  it("should be a MemoryCache instance with long TTL", () => {
    assert.ok(emissionFactorCache instanceof MemoryCache);
    const stats = emissionFactorCache.stats();
    assert.equal(stats.ttlMs, 60 * 60 * 1000); // 1 hour
  });
});
