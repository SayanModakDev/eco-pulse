import { z } from 'zod';

/**
 * Schema to validate user natural language inputs.
 * Ensures the payload contains a clean query string and optional language/locale context.
 * Protects the system from giant payloads, empty inputs, or malformed queries.
 */
export const naturalLanguageInputSchema = z.object({
  query: z
    .string({
      required_error: 'Query string is required',
      invalid_type_error: 'Query must be a string',
    })
    .trim()
    .min(1, { message: 'Query cannot be empty' })
    .max(1000, { message: 'Query must be under 1000 characters to prevent overflow' }),
  
  locale: z
    .string()
    .trim()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, { message: 'Invalid locale format (e.g., "en" or "en-US")' })
    .optional(),
    
  timestamp: z
    .string()
    .datetime({ message: 'Timestamp must be a valid ISO 8601 string' })
    .optional(),
});

/**
 * Schema to validate user profile context.
 * Standardizes the shape of user metadata, preferences, and identification data.
 */
export const profileContextSchema = z.object({
  userId: z
    .string({
      required_error: 'userId is required',
    })
    .trim()
    .min(1, { message: 'userId cannot be empty' })
    .max(128, { message: 'userId is too long' }),

  email: z
    .string({
      required_error: 'Email is required',
    })
    .trim()
    .email({ message: 'Invalid email address' }),

  timezone: z
    .string()
    .trim()
    .min(1, { message: 'Timezone cannot be empty' })
    .optional(),

  preferences: z
    .object({
      theme: z.enum(['light', 'dark', 'system']).default('system'),
      notificationsEnabled: z.boolean().default(true),
      languagePreference: z.string().trim().max(10).optional(),
    })
    .default({}),

  tags: z
    .array(z.string().trim().max(50))
    .max(20, { message: 'Cannot specify more than 20 tags' })
    .optional(),
});
