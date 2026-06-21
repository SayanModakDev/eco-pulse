import test from "node:test";
import assert from "node:assert";
import {
  healthResponseSchema,
  queryResponseSchema,
  profileResponseSchema,
  trackResponseSchema,
} from "../utils/validators.js";
import { sendValidatedResponse } from "../utils/middleware.js";

test("API Response Schema Validations", async (t) => {
  await t.test("healthResponseSchema should validate correctly", () => {
    const validPayload = {
      status: "UP",
      timestamp: new Date().toISOString(),
      environment: "test",
    };
    assert.doesNotThrow(() => healthResponseSchema.parse(validPayload));

    const invalidPayload = { status: "UP" }; // Missing fields
    assert.throws(() => healthResponseSchema.parse(invalidPayload));
  });

  await t.test("trackResponseSchema should strictly validate structure", () => {
    const validPayload = {
      success: true,
      message: "Success",
      data: {
        activities: [
          {
            category: "food",
            description: "Ate a burger",
            value: 1,
            unit: "meal",
            co2eKg: 5.5,
            emissionFactorUsed: 5.5,
          },
        ],
        microChallenges: [
          {
            id: "food-1",
            title: "Eat less meat",
            description: "Try a vegan meal",
            category: "food",
            potentialSavingKg: 3.0,
            difficulty: "easy",
          },
        ],
        summary: {
          totalCo2eKg: 5.5,
          baselineKg: 15,
          differenceKg: -9.5,
          status: "under_baseline",
          hotspotCategory: "food",
          summaryInsight: "Good job",
        },
        profileContextApplied: false,
      },
    };

    assert.doesNotThrow(() => trackResponseSchema.parse(validPayload));

    const invalidPayload = { ...validPayload, success: "yes" }; // Wrong type
    assert.throws(() => trackResponseSchema.parse(invalidPayload));
  });

  await t.test("sendValidatedResponse should act as an interceptor", () => {
    let responseStatus;
    let responseBody;
    
    const req = { requestId: "test-req-123" };
    const res = {
      status: (code) => {
        responseStatus = code;
        return {
          json: (body) => {
            responseBody = body;
          },
        };
      },
    };

    // 1. Success case
    const validPayload = {
      status: "UP",
      timestamp: new Date().toISOString(),
      environment: "test",
    };

    sendValidatedResponse(req, res, healthResponseSchema, validPayload);
    assert.strictEqual(responseStatus, 200);
    assert.deepStrictEqual(responseBody, validPayload);

    // 2. Failure case (API contract broken)
    const invalidPayload = { status: "UP" }; // missing fields
    sendValidatedResponse(req, res, healthResponseSchema, invalidPayload);
    assert.strictEqual(responseStatus, 500);
    assert.strictEqual(responseBody.status, "error");
    assert.strictEqual(responseBody.message, "Internal Server Error: API contract violation");
    assert.strictEqual(responseBody.requestId, "test-req-123");
  });
});
