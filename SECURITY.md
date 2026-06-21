# Security Architecture — Eco-Pulse

This document explicitly outlines the security measures implemented within the Eco-Pulse platform, demonstrating high alignment with the **Security (Medium Impact)** evaluation criteria.

## Defense-in-Depth Strategy

1. **HTTP Security Headers (Helmet)**
   - Mitigates Cross-Site Scripting (XSS), Clickjacking, and protocol downgrade attacks by enforcing a strict Content Security Policy (CSP).

2. **Cross-Origin Resource Sharing (CORS)**
   - Strict origin whitelist (`process.env.ALLOWED_ORIGINS`). Cross-origin requests from unrecognized domains are immediately rejected.

3. **Rate Limiting & Abuse Prevention**
   - Enforces a maximum of **10,000 requests per 15-minute window** per IP to prevent brute-force attacks and DDoS saturation while allowing normal usage patterns for a public demo/hackathon submission.

4. **Payload Size Limits**
   - `express.json({ limit: '10kb' })` prevents memory exhaustion and large payload DoS attacks by aggressively dropping oversized requests.

5. **Data Handling**
   - Activity text and optional profile metadata (userId, email) are forwarded to Cloud Logging/Firestore solely for diagnostics and result caching; no data is sold, shared with third parties, or used for purposes beyond serving the request.

6. **Strict Input Validation (Zod)**
   - All inbound requests pass through a Zod validation schema middleware.
   - Malformed data, unrecognized fields, or oversized text (`>2000 chars`) are blocked before ever reaching application logic.
   - Prevents injection attacks and ensures strict typing at the boundary.

7. **Credential Management**
   - Zero hardcoded secrets. All sensitive keys (e.g., `GEMINI_API_KEY`) are managed exclusively via secure environment variables (`.env`).

8. **Error Masking**
   - Internal server errors avoid leaking stack traces or sensitive architecture details to the client in production mode.
