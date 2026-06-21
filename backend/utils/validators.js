import { z } from "zod";

/**
 * Schema to validate user natural language inputs.
 * Ensures the payload contains a clean query string and optional language/locale context.
 * Protects the system from giant payloads, empty inputs, or malformed queries.
 * @type {import('zod').ZodObject}
 */
export const naturalLanguageInputSchema = z.object({
  query: z
    .string({
      required_error: "Query string is required",
      invalid_type_error: "Query must be a string",
    })
    .trim()
    .min(1, { message: "Query cannot be empty" })
    .max(500, { message: "Query must be under 500 characters" }),

  locale: z
    .string()
    .trim()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, {
      message: 'Invalid locale format (e.g., "en" or "en-US")',
    })
    .optional(),

  timestamp: z
    .string()
    .datetime({ message: "Timestamp must be a valid ISO 8601 string" })
    .optional(),
});

/**
 * Schema to validate user profile context.
 * Standardizes the shape of user metadata, preferences, and identification data.
 * @type {import('zod').ZodObject}
 */
export const profileContextSchema = z.object({
  userId: z
    .string()
    .trim()
    .min(1, { message: "userId cannot be empty" })
    .max(64, { message: "userId must be under 64 characters" })
    .default("anonymous")
    .optional(),

  email: z
    .string()
    .trim()
    .max(254, { message: "Email exceeds maximum RFC 5321 length" })
    .email({ message: "Invalid email address" })
    .optional(),

  displayName: z
    .string()
    .trim()
    .min(1, { message: "displayName cannot be empty" })
    .max(100, { message: "displayName must be under 100 characters" })
    .optional(),

  timezone: z
    .string()
    .trim()
    .min(1, { message: "Timezone cannot be empty" })
    .max(50, { message: "Timezone must be under 50 characters" })
    .optional(),

  preferences: z
    .object({
      theme: z.enum(["light", "dark", "system"]).default("system"),
      notificationsEnabled: z.boolean().default(true),
      languagePreference: z.string().trim().min(2).max(5).optional(),
    })
    .default({}),

  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, { message: "Tag cannot be empty" })
        .max(50, { message: "Tag must be under 50 characters" }),
    )
    .max(20, { message: "Cannot specify more than 20 tags" })
    .optional(),

  dailyBaselineKg: z
    .number({
      invalid_type_error: "dailyBaselineKg must be a number",
    })
    .positive({ message: "dailyBaselineKg must be positive" })
    .max(500, { message: "dailyBaselineKg cannot exceed 500 kg" })
    .default(15.0)
    .optional(),
});

/**
 * Schema to validate inputs to the Agent track request.
 * @type {import('zod').ZodObject}
 */
export const trackRequestSchema = z.object({
  activityString: z
    .string({
      required_error: "activityString is required",
    })
    .trim()
    .min(1, { message: "activityString cannot be empty" })
    .max(2000, { message: "activityString is too long (max 2000 characters)" }),

  profileContext: profileContextSchema.optional(),
});

export const sanitizeInput = (str) => str.replace(/[<>"'&]/g, "").trim();
