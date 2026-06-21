import express from "express";
import crypto from "crypto";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import {
  naturalLanguageInputSchema,
  profileContextSchema,
  rootResponseSchema,
  healthResponseSchema,
  queryResponseSchema,
  profileResponseSchema,
} from "./utils/validators.js";
import { validateRequestBody, sendValidatedResponse } from "./utils/middleware.js";
import {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
} from "./utils/constants.js";
import apiRouter from "./routes/api.js";

// Load environment variables
dotenv.config();

/**
 * @fileoverview Main Express entry point for the Eco-Pulse API.
 * Manages middleware composition, rate limiting, and route mapping.
 */
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

const log = {
  info: (msg) => NODE_ENV === "development" && console.log(msg),
  error: (msg, err) => NODE_ENV === "development" && console.error(msg, err),
};

const app = express();
// Trust reverse proxy (e.g. Cloud Run, Load Balancer)
app.set("trust proxy", 1);

// 1. Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind
        imgSrc: ["'self'", "data:"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }),
);

// 2. CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://eco-pulse-883291931823.us-central1.run.app",
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(
        new Error("Blocked by CORS policy: Origin not allowed"),
        false,
      );
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// 3. Request Tracing
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  next();
});

// 4. Request Parsers — limit body size to mitigate DoS
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// 5. Rate Limiting
const globalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message:
      "Too many requests from this IP, please try again after 15 minutes",
  },
});
app.use(globalLimiter);

// 6. Routes

app.get("/", (req, res) => {
  const payload = {
    message: "Welcome to the Eco-Pulse API Server",
    version: "1.0.0",
    alignment: ["Track", "Understand", "Reduce", "Carbon Footprint Awareness"],
    endpoints: {
      health: "GET /health",
      query: "POST /api/query",
      profile: "POST /api/profile",
      track: "POST /api/track",
    },
  };
  return sendValidatedResponse(req, res, rootResponseSchema, payload);
});

app.use("/api", apiRouter);

app.get("/health", (req, res) => {
  const payload = {
    status: "UP",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  };
  return sendValidatedResponse(req, res, healthResponseSchema, payload);
});

app.post(
  "/api/query",
  validateRequestBody(naturalLanguageInputSchema),
  (req, res) => {
    const { query, locale, timestamp } = req.body;
    const payload = {
      success: true,
      message: "Query validation successful",
      data: {
        query,
        locale: locale || "not provided",
        processedAt: timestamp || new Date().toISOString(),
      },
    };
    return sendValidatedResponse(req, res, queryResponseSchema, payload);
  },
);

app.post(
  "/api/profile",
  validateRequestBody(profileContextSchema),
  (req, res) => {
    const { userId, email, timezone, preferences, tags } = req.body;
    const payload = {
      success: true,
      message: "Profile context validation successful",
      data: {
        userId,
        email,
        timezone: timezone || "UTC",
        preferences,
        tags: tags || [],
      },
    };
    return sendValidatedResponse(req, res, profileResponseSchema, payload);
  },
);

app.use("*", (req, res) => {
  res.status(404).json({
    status: 404,
    message: "Resource not found",
    requestId: req.requestId,
  });
});

// 7. Global Error-Handling Middleware
app.use((err, req, res, next) => {
  if (err.name === "ZodError" || err.issues) {
    const fieldErrors = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return res.status(400).json({
      status: "fail",
      message: "Validation failed",
      errors: fieldErrors,
      requestId: req.requestId,
    });
  }

  if (err.message && err.message.includes("CORS policy")) {
    return res.status(403).json({
      status: "fail",
      message: err.message,
      requestId: req.requestId,
    });
  }

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      status: "fail",
      message: "Malformed JSON request body",
      requestId: req.requestId,
    });
  }

  log.error(`[Error] [${req.requestId}] [${new Date().toISOString()}]:`, err);

  res.status(err.status || 500).json({
    status: "error",
    message: NODE_ENV === "development" ? err.message : "Internal server error",
    requestId: req.requestId,
    ...(NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Start the server
const server = app.listen(PORT, () => {
  log.info(`Server running in ${NODE_ENV} mode on port ${PORT}`);
});

// 8. Graceful Shutdown
const gracefulShutdown = (signal) => {
  log.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => {
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
