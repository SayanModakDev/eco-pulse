/* eslint-disable no-console */
import { Firestore } from "@google-cloud/firestore";
import { Logging } from "@google-cloud/logging";
import { Storage } from "@google-cloud/storage";

// Retrieve project ID from environment
const projectId = process.env.GOOGLE_CLOUD_PROJECT || "eco-pulse-499818";

let firestore;
let logging;
let storage;

try {
  firestore = new Firestore({ projectId });
} catch (e) {
  console.warn("Firestore initialization failed:", e.message);
}

try {
  logging = new Logging({ projectId });
} catch (e) {
  console.warn("Cloud Logging initialization failed:", e.message);
}

try {
  storage = new Storage({ projectId });
} catch (e) {
  console.warn("Cloud Storage initialization failed:", e.message);
}

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || `${projectId}-logs`;

/**
 * Non-blocking logger to send request/response metrics and logs to GCP services (Firestore, Logging, Storage).
 * @param {string} query The natural language activity input.
 * @param {Object} responseData The full response payload returned to the user.
 * @param {Object} metadata Additional context (e.g. userId, email).
 */
export const logRequestToGCP = (query, responseData, metadata) => {
  // Fire-and-forget: perform these operations asynchronously to keep them non-blocking
  Promise.allSettled([
    // 1. Store in Firestore
    (async () => {
      if (!firestore) return;
      const docRef = firestore.collection("tracking_history").doc();
      await docRef.set({
        query,
        response: responseData,
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
      });
    })(),

    // 2. Write to Cloud Logging
    (async () => {
      if (!logging) return;
      const log = logging.log("eco-pulse-activity-logs");
      const payload = {
        message: "Processed carbon tracking request",
        query,
        responseSize: JSON.stringify(responseData).length,
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
      };
      const entry = log.entry({ resource: { type: "global" } }, payload);
      await log.write(entry);
    })(),

    // 3. Save to Cloud Storage as structured JSON
    (async () => {
      if (!storage) return;
      const bucket = storage.bucket(BUCKET_NAME);
      const filename = `activity-logs/${Date.now()}-${Math.random().toString(36).substring(7)}.json`;
      const file = bucket.file(filename);
      const content = JSON.stringify(
        {
          query,
          response: responseData,
          metadata: metadata || {},
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      );

      try {
        await file.save(content, {
          contentType: "application/json",
          resumable: false,
        });
      } catch (err) {
        // If bucket does not exist, attempt to create it (only once) and retry
        if (err.code === 404) {
          console.log(
            `Bucket ${BUCKET_NAME} not found. Attempting to create it...`,
          );
          await bucket.create({ location: "US" });
          await file.save(content, {
            contentType: "application/json",
            resumable: false,
          });
        } else {
          throw err;
        }
      }
    })(),
  ]).then((results) => {
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const services = ["Firestore", "Cloud Logging", "Cloud Storage"];
        console.error(
          `GCP Integration Error [${services[index]}]:`,
          result.reason.message,
        );
      }
    });
  });
};
