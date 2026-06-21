/**
 * @fileoverview Centralized logging utility.
 * Enforces zero-console rules while providing standardized output.
 * Uses process.stdout/stderr to avoid ESLint no-console warnings without needing overrides.
 */

const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  info: (msg) => {
    if (isDev) {
      process.stdout.write(`[INFO] ${msg}\n`);
    }
  },
  error: (msg) => {
    process.stderr.write(`[ERROR] ${msg}\n`);
  },
  warn: (msg) => {
    if (isDev) {
      process.stderr.write(`[WARN] ${msg}\n`);
    }
  }
};
