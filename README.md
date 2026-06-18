# Eco-Pulse | Virtual: PromptWars Hack2Skill [Submission] Challenge 3: Carbon Footprint Awareness Platform

An intelligent, context-aware carbon footprint management system built specifically as an official submission for **Virtual: PromptWars Hack2Skill [Submission] Challenge 3**. The platform provides a zero-friction interface for individuals to seamlessly **Track** daily activities, comprehensively **Understand** their personal environmental impact, and actively **Reduce** their emissions through hyper-personalized, context-driven mitigation challenges.

---

## 🌐 Live Deployment

* **Frontend Application UI:** [https://eco-pulse-883291931823.us-central1.run.app](https://eco-pulse-883291931823.us-central1.run.app)
* **Backend Agent API Engine:** [https://eco-pulse-backend-883291931823.us-central1.run.app](https://eco-pulse-backend-883291931823.us-central1.run.app)
* **Public GitHub Repository:** [https://github.com/SayanModakDev/eco-pulse](https://github.com/SayanModakDev/eco-pulse)

---

## 🚀 Core Architecture & Multi-Agent Logic

The application splits computational responsibilities between an accessible, highly performant client-side UI and an intelligent, secure server-side orchestration layer. 

```text
User Input (Natural Language) ──► [Zod Validation Layer] ──► [Extraction Agent]
                                                                     │
[Actionable Insights UI] ◄── [Mitigation Agent] ◄── [Calculation Agent] ◄┘
```

---

## Alignment with Rubric Metrics

### Code Quality — Modularity & Separation of Concerns

The codebase enforces clean ES6+ module boundaries with zero circular dependencies:

```
backend/
├── server.js              # Express entry point — middleware composition only
├── routes/api.js          # Route handlers — validation + orchestrator invocation
├── agents/
│   ├── orchestrator.js    # Multi-agent pipeline coordination
│   └── prompts.js         # Isolated system prompt definitions
├── utils/
│   ├── validators.js      # Zod schemas — all input contracts in one file
│   └── cache.js           # Generic MemoryCache class + singleton instances
└── tests/
    └── agent.test.js      # 33 unit tests across 7 suites

frontend/
└── src/
    ├── app/page.tsx        # Dashboard state orchestration
    └── components/
        ├── ActionTracker.tsx  # Input form component
        └── InsightGrid.tsx    # Challenge card grid component
```

Each layer has a single responsibility: `server.js` composes middleware, `api.js` maps routes, `orchestrator.js` sequences agents, and `validators.js` defines data contracts. No business logic leaks between layers.

### Security — Defense in Depth

| Layer | Mechanism | Purpose |
|---|---|---|
| HTTP Headers | `helmet` | Sets `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, and 11+ other security headers automatically |
| CORS | Origin whitelist via `process.env.ALLOWED_ORIGINS` | Blocks unauthorized cross-origin requests; falls back to localhost origins in development |
| Rate Limiting | `express-rate-limit` — 100 requests per 15 minutes per IP | Prevents brute-force abuse and DDoS saturation |
| Body Limits | `express.json({ limit: '10kb' })` | Blocks oversized payload attacks |
| Input Validation | `zod` schemas on every inbound request | Rejects malformed, missing, or out-of-range data before it enters any processing pipeline |
| Secrets | `process.env` exclusively | Zero hardcoded credentials; `GEMINI_API_KEY`, `ALLOWED_ORIGINS`, `PORT` are all environment-sourced |

### Efficiency — Lightweight Runtime Footprint

- **7 production dependencies** in the backend (`express`, `cors`, `helmet`, `express-rate-limit`, `zod`, `dotenv`, `@google/genai`) — no bloat frameworks.
- **In-memory LRU cache** (`utils/cache.js`) eliminates redundant emission factor computations and deduplicates identical orchestration requests with TTL-based expiry.
- **Agent 2 (Calculation) is fully deterministic** — no LLM call required for emission factor mapping, ensuring sub-millisecond computation per activity.
- **Repository size is well under 10 MB** excluding `node_modules`.

### Testing — Core Coverage

33 unit tests across 7 suites using Node's **native test runner** (`node:test`) — zero additional test framework dependencies:

| Suite | Tests | What It Validates |
|---|---|---|
| `naturalLanguageInputSchema` | 7 | Empty strings, oversized queries, type coercion, locale regex, whitespace trimming |
| `trackRequestSchema` | 6 | Missing fields, length overflow, whitespace-only inputs, XSS character pass-through |
| `profileContextSchema` | 4 | Invalid emails, negative baselines, tag array limits, default preference injection |
| `Agent Orchestrator Pipeline` | 7 | End-to-end flow, unrecognizable input fallback, extreme numbers, zero-emission activities, hotspot detection, challenge shape compliance, default baseline |
| `MemoryCache Utility` | 8 | TTL expiry, LRU eviction, CRUD operations, stats reporting |
| `emissionFactorCache singleton` | 1 | Instance type and TTL configuration |

Run the full suite (Backend + Frontend tests):
```bash
npm run test
```

### Accessibility — WCAG-Compliant Design

The frontend enforces strict accessibility standards throughout:

- **Semantic HTML**: Every section uses appropriate landmark elements (`<header>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`) — no generic `<div>` soup.
- **ARIA Live Regions**: An invisible `aria-live="polite"` status element announces tracking results and error states to screen readers in real time.
- **ARIA Labels**: All interactive elements carry explicit `aria-label`, `aria-describedby`, `aria-invalid`, and `aria-pressed` attributes.
- **Keyboard Navigation**: Every button and form control is fully operable via keyboard with visible `focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none` focus indicators.
- **Color Contrast**: Dark-mode-first palette uses high-contrast text (`slate-100` on `slate-950`) exceeding WCAG AA 4.5:1 ratio requirements.
- **Screen Reader Hints**: Hidden helper text (`sr-only`) provides contextual guidance for form inputs and character counts.

---

## Setup & Local Execution

### Prerequisites

- **Node.js** ≥ 20.x
- **npm** ≥ 10.x

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/eco-pulse.git
cd eco-pulse
```

### 2. Install Dependencies

```bash
# Backend dependencies
npm run install-backend

# Frontend dependencies
npm run install-frontend
```

### 3. Configure Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
PORT=5000
NODE_ENV=development
GEMINI_API_KEY=your_gemini_api_key_here    # Optional — fallback agents work without it
ALLOWED_ORIGINS=http://localhost:3000
```

> **Note**: The multi-agent pipeline operates fully without a Gemini API key using deterministic rule-based fallback agents. Setting `GEMINI_API_KEY` enables AI-powered extraction and insight generation.

### 4. Run the Application

Open two terminal windows:

```bash
# Terminal 1 — Start the backend API server (port 5000)
npm run dev-backend

# Terminal 2 — Start the frontend dashboard (port 3000)
npm run dev-frontend
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Tests

```bash
cd backend && npm test
```

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
