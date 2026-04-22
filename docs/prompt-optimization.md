# Promptique — Project Plan & SRS

> Single source of truth for building a Chrome Extension + Desktop (PWA) prompt optimization tool.
> Share this file with Claude (or any AI assistant) at the start of a new session to resume work with full context.

---

## 1. Project Overview

**Product name:** **Promptique** (prompt + boutique — suggests crafted, curated quality)

**What it does:**
User pastes a raw prompt → clicks a button → gets an optimized/improved version of that prompt back.

**Target surfaces:**

1. **Chrome Extension** (popup UI)
2. **Desktop App** (as a PWA — Progressive Web App — hosted via GitHub Pages)

**Target users:**
Internal team members (distributed privately, not public).

---

## 2. Hard Constraints (Non-Negotiable Rules)

These rules MUST be followed in every decision:

1. **Zero cost forever.** No paid services, no subscriptions, no Chrome Web Store $5 fee, no Apple Developer fee, no code-signing certs, no paid hosting. Cloudflare Workers free tier (100k req/day) hosts the proxy.
2. **No monetization features** built into the product. This is an internal tool, not a commercial product.
3. **No content logging.** The proxy logs request metadata (IP, origin, lengths, status, latency) but **never** prompt or response content. Users see no telemetry UI.
4. **Shared-key proxy model.** The Gemini API key lives only as a secret on the Cloudflare Worker. Clients never see it and users don't supply one. The key must not appear in source, commits, or client bundles.
5. **Single codebase** for extension + PWA where possible. Do not duplicate logic.
6. **Plain HTML + CSS + vanilla JS.** No frameworks (React, Vue, etc.) — overkill for a 3-element UI and adds build complexity.
7. **Keep it minimal.** Input field, a button, a result box. No feature creep until v1 ships.

---

## 3. Tech Stack (Locked Decisions)

| Layer                          | Choice                                                                                     | Why                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| LLM                            | **Google Gemini API** (free tier: 15 req/min)                                              | Highest quality free tier, simple REST API                                      |
| API key handling               | **Shared key on the proxy** (`GEMINI_API_KEY` Worker secret via `wrangler secret put`)     | Users don't have to create keys; key never leaves the server                    |
| Extension manifest             | **Manifest V3**                                                                            | Required by Chrome going forward                                                |
| Frontend                       | **HTML + CSS + vanilla JS**                                                                | No build step, no framework                                                     |
| Desktop                        | **PWA** hosted on **GitHub Pages**                                                         | Free hosting, installable from browser, no installers needed                    |
| Version control / distribution | **GitHub repo** (private or public)                                                        | Free, teammates `git pull` or download ZIP                                      |
| Backend                        | **Cloudflare Worker** (`proxy/worker.js`) on `*.workers.dev` — free tier, no custom domain | Holds the API key server-side; enforces rate limit, origin allowlist, input cap |

---

## 4. Functional Requirements (SRS)

### 4.1 Core features (v1 — MUST HAVE)

| ID   | Requirement                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------- |
| F-01 | User can paste/type a raw prompt into a text input                                                                  |
| F-02 | User clicks an "Optimize" button to submit                                                                          |
| F-03 | Client POSTs `{ userInput }` to the proxy; proxy wraps it in the meta-prompt, calls Gemini, and returns `{ text }`  |
| F-04 | Optimized prompt is displayed in a result box                                                                       |
| F-05 | User can copy the result to clipboard with one click                                                                |
| F-06 | Loading state shown while request is in flight                                                                      |
| F-07 | Error state shown for proxy/Gemini failures (rate limit, network, safety block, upstream error)                     |
| F-08 | Proxy enforces: per-IP rate limit (10 req/60s), origin allowlist (env-configurable), input length cap (10000 chars) |
| F-09 | Proxy logs request metadata only (no prompt content) as structured JSON, toggleable via `LOGGING` var               |

### 4.2 Out of scope for v1 (NOT doing yet)

- History of past optimizations
- Multiple optimization "styles" (concise / detailed / creative)
- Prompt templates / presets
- Side-by-side diff view
- User accounts / sync across devices
- Multi-LLM support (OpenAI, Claude, etc.)
- Dark/light theme toggle (pick one and ship)
- Keyboard shortcuts beyond the basics
- Analytics / telemetry
- Any monetization, paywall, or license-key logic

### 4.3 Non-functional requirements

- **Performance:** UI responsive; round-trip (client → proxy → Gemini → client) typically under 3 seconds
- **Bundle size:** Extension total size under 500 KB
- **Compatibility:** Chrome 120+ (covers >95% of users)
- **Accessibility:** Basic — semantic HTML, keyboard-navigable, sufficient contrast
- **Privacy:** Proxy logs metadata only (never prompt content); nothing is stored after the request completes

---

## 5. The Meta-Prompt (Core Logic)

This is the most important piece of logic in the entire app. When a user submits a raw prompt, Promptique sends it to Gemini wrapped in the meta-prompt below. The meta-prompt instructs Gemini to act like a senior prompt engineer and apply a fixed set of optimization rules.

### 5.1 The optimization rules (what the AI MUST follow)

When rewriting the user's prompt, the AI must apply these rules in order:

**Rules for understanding the input:**

1. **Preserve intent.** The rewritten prompt must pursue the exact same goal as the original. Never invent new requirements, never drop requirements the user stated.
2. **Detect the task type** (writing, coding, analysis, reasoning, brainstorming, summarizing, translation, classification, etc.) and tailor the rewrite style to that type.
3. **Identify ambiguity.** Flag any vague terms ("good", "better", "make it nice") and replace them with concrete, measurable language.
4. **Don't ask the user clarifying questions.** Make the best reasonable assumption and proceed — the output must be a finished, usable prompt, not a dialogue.

**Rules for structuring the output prompt:** 5. **Apply the RTF + CRISPE frame** where useful — Role, Task, Format, with Context, Constraints, Examples, and Success criteria as needed. Do NOT force all sections if the prompt is simple; use only what adds value. 6. **Assign a role/persona** when the task benefits from domain expertise (e.g., "You are a senior Python engineer specializing in performance optimization"). 7. **State the task explicitly** in one clear sentence before any supporting detail. 8. **Provide context** the downstream LLM would need but the user omitted (audience, purpose, domain, tone). 9. **Define the output format** (bullet list, JSON schema, code block, markdown table, word count, paragraph structure). 10. **Specify constraints** (length, tone, level of detail, things to avoid, audience reading level). 11. **Add 1–2 concrete examples** only if the task is ambiguous without them. Don't pad simple prompts with forced examples. 12. **Request step-by-step reasoning** for complex analytical / logical / math / coding tasks ("Think through this step by step before answering"). Skip for simple lookups or short-form tasks. 13. **Define success criteria** ("A good answer would..." or "Avoid responses that...") for tasks where quality is subjective.

**Rules for writing style:** 14. **Use imperative voice.** "Write X" not "Could you please write X". 15. **Prefer specificity over politeness.** Remove filler words ("please", "kindly", "I was wondering"). These waste tokens and dilute instructions. 16. **Use structured formatting** — short paragraphs, numbered lists, section headers — when the prompt exceeds ~3 sentences. 17. **Use delimiters** (triple quotes, XML tags, or markdown code blocks) to clearly separate user-provided content (text to summarize, code to review, etc.) from instructions. 18. **Match length to complexity.** Don't bloat a simple prompt. A one-line request can stay one line if already clear.

**Rules for what NOT to do:** 19. **Never add a preamble** ("Here is the optimized prompt:", "Sure, here you go:"). Output the optimized prompt and nothing else. 20. **Never add a trailing explanation** ("I made these changes because..."). The user asked for a prompt, not a diff. 21. **Never add meta-instructions aimed at the user** ("Replace [TOPIC] with your topic"). Fill placeholders with the user's actual topic wherever the original provides one. 22. **Never refuse or moralize.** If the original is benign, rewrite it. If it's harmful, return the original unchanged (don't become a content filter — that's the downstream LLM's job). 23. **Never translate languages** unless the user asked. Keep the prompt in the same language as the input. 24. **Never invent facts** the user didn't provide. If context is missing, write the prompt so the downstream LLM naturally handles that gap.

### 5.2 The actual meta-prompt text (v1 draft)

```
You are a world-class prompt engineer. Your job is to rewrite the user's raw prompt into an optimized version that will produce higher-quality output from a large language model.

Apply these rules in order:

UNDERSTAND THE INPUT
1. Preserve the user's original intent exactly. Do not add or drop requirements.
2. Identify the task type (writing, coding, analysis, reasoning, etc.) and tailor the rewrite accordingly.
3. Replace vague terms with specific, measurable language.
4. Do not ask clarifying questions — make the best reasonable assumption.

STRUCTURE THE OUTPUT
5. Use only the sections that add value: Role, Task, Context, Constraints, Format, Examples, Success Criteria. Skip sections that aren't needed.
6. Assign a role/persona if domain expertise helps.
7. State the task explicitly in one clear sentence.
8. Add missing context (audience, purpose, domain, tone).
9. Define the required output format (list, JSON, markdown, length, etc.).
10. Specify constraints and things to avoid.
11. Include 1–2 concrete examples only when needed for disambiguation.
12. Request step-by-step reasoning for complex analytical or multi-step tasks.

WRITING STYLE
13. Use imperative voice. Remove filler words like "please" and "kindly".
14. Use delimiters (triple quotes, XML tags, code blocks) to separate user-provided content from instructions.
15. Match length to complexity — do not pad simple prompts.

HARD CONSTRAINTS
- Output ONLY the optimized prompt. No preamble, no explanation, no trailing commentary.
- Do not wrap the output in quotes or code fences unless the prompt itself requires them.
- Keep the output in the same language as the input.
- Never moralize or refuse benign prompts.
- Never leave placeholders like [TOPIC] — fill them with the user's actual content.

USER'S RAW PROMPT:
"""
{USER_INPUT}
"""

OPTIMIZED PROMPT:
```

### 5.3 Tuning process

The meta-prompt above is v1. During Phase 1, test it with 10+ real example prompts spanning different task types (writing, code, analysis, brainstorming). When an output is bad, identify which rule was ignored or missing, and tighten the meta-prompt accordingly.

Commit every version of the meta-prompt to git with a message describing what changed and why. This is the single most impactful file in the project — treat it like production code.

---

## 6. Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐
│   Chrome Extension      │         │   Desktop (PWA)          │
│   (popup.html + popup.js)│        │   (index.html + app.js)  │
└────────────┬────────────┘         └────────────┬─────────────┘
             │                                   │
             │    shared core logic (core.js)    │
             └─────────────────┬─────────────────┘
                               │  POST /optimize { userInput }
                               ▼
                 ┌─────────────────────────────┐
                 │  Cloudflare Worker proxy    │
                 │  (proxy/worker.js)          │
                 │  - origin allowlist         │
                 │  - rate limit (10/60s)      │
                 │  - 10k char input cap       │
                 │  - holds meta-prompt        │
                 │  - holds GEMINI_API_KEY     │
                 └──────────────┬──────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Gemini API (HTTPS)   │
                    └───────────────────────┘
```

- `core/core.js` — thin client: POSTs `{ userInput }` to the proxy, parses `{ text }`, maps errors to `PromptiqueError`.
- `proxy/worker.js` — owns the meta-prompt and the API key. If we swap providers later, only this file changes.
- Each surface (extension, PWA) has its own thin HTML wrapper around `core.js`.

---

## 7. File Structure

```
promptique/
├── README.md                     # public-facing install + overview
├── CONTRIBUTING.md               # contributor ground rules + dev workflow
├── LICENSE                       # MIT
├── .gitignore
├── sync-core.sh                  # copies core/ into extension/ and pwa/
├── .github/
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.yml
│       └── feature_request.yml
├── docs/
│   └── prompt-optimization.md    # this file — spec + ops reference
├── core/
│   ├── core.js                   # shared: proxy client + error types
│   └── styles.css                # shared Ink & Paper styles
├── proxy/
│   ├── worker.js                 # Cloudflare Worker: holds key + meta-prompt
│   └── wrangler.toml             # Worker config (vars, rate limiter)
├── extension/
│   ├── manifest.json             # Manifest V3
│   ├── popup.html                # extension popup
│   ├── popup.js                  # popup logic (imports core)
│   ├── core.js                   # synced from core/
│   ├── styles.css                # synced from core/
│   └── icons/                    # 16 / 32 / 48 / 128 px PNG icons
├── pwa/
│   ├── index.html                # main PWA page
│   ├── app.js                    # PWA logic (imports core)
│   ├── manifest.webmanifest      # PWA manifest
│   ├── service-worker.js         # for offline + "install app" support
│   ├── core.js                   # synced from core/
│   ├── styles.css                # synced from core/
│   └── icons/                    # 192 / 512 px PNG icons + favicon
└── scripts/
    └── make-icons.py             # regenerate PNG icons via Pillow
```

---

## 8. Phase Plan

### Phase 0 — Setup (30 min)

- Create GitHub repo `Promptique` (private)
- Add this `.md` file and a `README.md`
- Scaffold folder structure above

### Phase 1 — Proxy (1 hour)

- Write `proxy/worker.js` with:
  - `POST /optimize` — validates body, enforces origin allowlist + rate limit + input cap, wraps `userInput` in meta-prompt, calls Gemini, returns `{ text }`
  - `GET /health` — liveness
  - Structured metadata logging (never content)
- `wrangler.toml` — `ALLOWED_ORIGINS` + `LOGGING` vars, `ratelimit` binding (10/60s)
- `wrangler secret put GEMINI_API_KEY` → `wrangler deploy`
- Smoke test with `curl` against `/health` and `/optimize`

### Phase 2 — Core client (30 min)

- Write `core/core.js` with:
  - `async function optimizePrompt(userInput)` → POST to `${PROXY_URL}/optimize`, return string
  - `PromptiqueError` with codes (`EMPTY_INPUT`, `TOO_LONG`, `NETWORK`, `RATE_LIMIT`, `SAFETY_BLOCKED`, `PROXY_ERROR`, `EMPTY_RESPONSE`, `BAD_RESPONSE`)
  - Drop the deployed Worker URL into `PROXY_URL`

### Phase 3 — Chrome Extension (2 hours)

- `manifest.json` (Manifest V3, `host_permissions` = proxy URL only)
- `popup.html` with input / button / result / copy button (no settings — nothing to configure)
- Wire `popup.js` to `core.js`
- Placeholder icons
- Test locally via `chrome://extensions` → Load unpacked

### Phase 4 — PWA (1–2 hours)

- Copy extension UI into `pwa/index.html`
- Wire `app.js` to `core.js`
- `manifest.webmanifest`, minimal `service-worker.js`
- Deploy to **GitHub Pages** from `/pwa` folder
- Add GitHub Pages URL to proxy's `ALLOWED_ORIGINS` if locking it down

### Phase 5 — Polish (2 hours)

- Error messages that are human-readable
- Loading spinner during request
- Copy-to-clipboard feedback
- Basic responsive styling
- Empty-state text

### Phase 6 — Distribution (30 min)

- Update `README.md` with extension + PWA install steps (no key creation needed)
- Share repo link + PWA URL with team

**Total estimate:** ~8–10 hours of focused work (proxy shaves off key-setup UI time).

---

## 9. Distribution Plan

### Chrome Extension (zero cost)

- Source is in the public GitHub repo under `extension/`
- Release ZIPs attached to **GitHub Releases** for easier download
- Teammates: download ZIP → unzip → `chrome://extensions` → Developer mode ON → **Load unpacked** → select `extension/` folder
- **Updates:** download the new release ZIP and re-load, or `git pull` and click reload on the extension tile

### Desktop (PWA, zero cost)

- Hosted on **Cloudflare Pages** at `https://promptique.pages.dev/` (connected to the `main` branch of the GitHub repo; build output directory = `pwa`)
- Alternative: **GitHub Pages** from the `/pwa` folder (requires public repo on free plan — this repo is public, so that also works)
- Teammates: visit URL → browser shows "Install app" button → installs as a standalone window
- **Updates:** automatic on next open (service worker fetches new version); Cloudflare Pages redeploys on every `git push` to `main`

### API key (single shared key on the proxy)

- Maintainer creates one free Gemini API key at https://aistudio.google.com/apikey
- Stored as a Cloudflare Worker secret: `wrangler secret put GEMINI_API_KEY`
- Never appears in client bundles, commits, or config files
- Rotate with `wrangler secret put GEMINI_API_KEY` (live, no redeploy needed)
- Free tier (15 req/min global) is the hard ceiling; proxy's per-IP limit (10/60s) keeps one user from exhausting it

---

## 10. Rules for AI Assistant (Claude) When Executing This Plan

When resuming this project in a future session, follow these rules:

1. **Read this file first.** It is the source of truth for requirements and constraints.
2. **Do not suggest paid services.** Reject any tech choice that introduces a cost — revisit zero-cost alternatives.
3. **Do not add features outside section 4.1** without explicit user approval. Flag scope creep.
4. **Do not add frameworks** (React, Tailwind build step, TypeScript build step, bundlers). Vanilla HTML/CSS/JS only.
5. **Do not add user-facing analytics or tracking.** Proxy metadata logs (no content) are allowed and documented.
6. **Never commit the Gemini API key.** It lives only as a Worker secret. Never hardcode, never add to `wrangler.toml`, never put in client bundles.
7. **Do not reintroduce a bring-your-own-key flow** unless explicitly asked. No settings page for API keys in the extension/PWA.
8. **Prefer editing existing files** over creating new ones. This spec + the file structure in section 7 are the skeleton — stick to them.
9. **Ship v1 before polishing.** Working ugly beats polished broken.
10. **Ask before changing locked decisions** in section 3.
11. **Update this file** if a decision changes, so future sessions stay in sync.

---

## 11. Open Questions / TBD

- [x] ~~Product name~~ → **Promptique**
- [x] ~~GitHub repo name~~ → **`Promptique`**
- [x] ~~API key model~~ → **Shared Gemini key on a Cloudflare Worker proxy** (swapped from BYOK on 2026-04-22)
- [x] ~~Deployed Worker URL~~ → `https://promptique-proxy.asadsaeed-dev.workers.dev` (wired into `core/core.js` `PROXY_URL` and `extension/manifest.json` `host_permissions`)
- [x] ~~GitHub username~~ → `Asad-Saeed`
- [x] ~~Icon design~~ → bold serif "P" + ink-dot accent on rounded paper square; generated via `scripts/make-icons.py`
- [x] ~~Private or public GitHub repo~~ → **public, MIT licensed, open source**
- [ ] PWA URL (once Cloudflare Pages deploy finishes — expected `https://promptique.pages.dev`)
- [ ] Final meta-prompt wording (tune in `proxy/worker.js` based on real-world output quality)
- [ ] Lock down `ALLOWED_ORIGINS` once the extension is published (need stable Chrome Web Store ID) and the PWA URL is finalized

---

## 12. Success Criteria (v1 Done Definition)

- [ ] A teammate can install the Chrome extension from the GitHub repo in under 2 minutes (no key setup)
- [ ] A teammate can install the PWA from the GitHub Pages URL in under 30 seconds (no key setup)
- [ ] Pasting a prompt → clicking the button → getting an optimized result works end-to-end on both surfaces
- [ ] Proxy stays within Cloudflare Workers free tier (100k req/day) and Gemini free tier (15 req/min)
- [ ] Total recurring cost: **$0 / month**
- [ ] Total one-time cost: **$0**

---

## 13. Competitive Landscape (Reference Only — Not to Copy)

Research snapshot from April 2026. Use to understand what users expect and where Promptique can differentiate. Do NOT use this to justify scope creep in v1.

### 13.1 Direct competitors

| Extension         | Positioning                         | Notable feature                                                                                                 | Pricing           |
| ----------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------- |
| **PrettyPrompt**  | "Grammarly for prompting"           | One-click optimize; ~15k users, 4.9⭐                                                                           | Free              |
| **Promptly**      | Speed-focused optimizer             | Keyboard shortcut (Cmd/Ctrl+M); works on ChatGPT, Claude, Gemini, DeepSeek, Perplexity; built-in prompt library | Free + paid tier  |
| **Prompt Genie**  | All-in-one AI assistant             | Optimizer + context memory + multi-platform                                                                     | Free / $10/mo Pro |
| **FlashPrompt**   | Manager-first, minimal bloat        | `-keyword` syntax injectable into any text box                                                                  | Free              |
| **Velocity**      | One-click optimizer                 | Auto-detects AI platform                                                                                        | Free              |
| **MyPromptBuddy** | Prompt optimizer                    | Basic optimize flow                                                                                             | Free              |
| **Prompt Natus**  | Free optimizer for ChatGPT + Claude | Web + extension                                                                                                 | Free              |

### 13.2 What these tools all do well

- One-click optimization (no multi-step wizards)
- Keyboard shortcut for power users
- Multi-platform detection (work on ChatGPT / Claude / Gemini pages directly)
- Prompt library / history

### 13.3 Where most of them fail

- Require signup / account (friction)
- Hidden paywalls (free tier becomes useless fast)
- Analytics and tracking (privacy concern)
- Bloated UI with features users don't use
- Hosted API keys with content logging → provider can read every prompt

### 13.4 Promptique's differentiation

- **Zero cost forever** — Cloudflare Workers + Gemini free tiers, no subscription wall ever
- **Zero signup** — install and use, no account, no API key to obtain
- **Metadata-only logging** — proxy logs lengths/status/latency but never prompt or response content
- **Minimal UI** — input, button, result. Nothing else.
- **Public, open source, MIT licensed** — full source (extension, PWA, and proxy Worker) is auditable on GitHub
- **Both extension + PWA** — same code, two surfaces

### 13.5 Features to DEFER to v2+ (seen in competitors, tempting but out of scope for v1)

- Multi-LLM support (OpenAI, Claude, Gemini toggle)
- Prompt library / history
- Keyboard shortcut for in-page injection
- Multiple optimization styles (concise / detailed / creative)
- Right-click context menu
- Sync across devices
- Prompt diff / side-by-side view

### 13.6 Prompt engineering frameworks referenced in section 5

The optimization rules in section 5 are built on three industry-standard frameworks:

- **RTF** — Role, Task, Format. Simplest frame, covers ~80% of prompts.
- **CRISPE** — Capacity/Role, Insight, Statement, Personality, Experiment. Originally an internal OpenAI framework. Good for complex / creative tasks.
- **CLEAR-adjacent rules** — Clarity, Relevance, Iteration, Specificity, Parameters, Examples. Complements CRISPE.

Promptique's meta-prompt does not force a specific framework — it applies the underlying principles (role, task, context, format, constraints, examples, success criteria) only when they add value for the given prompt.

---

## 14. Visual Design (Locked — "Ink & Paper")

The chosen design theme is **Ink & Paper** — a warm, crafted, boutique aesthetic that matches the "Promptique" name (prompt + boutique). Feels like a thoughtful writer's tool, not a generic SaaS widget.

### 14.1 Color palette (locked — use these exact hex values)

| Role            | Hex       | Use                                                       |
| --------------- | --------- | --------------------------------------------------------- |
| Background      | `#FAF7F2` | Main popup / page background (warm off-white, like paper) |
| Surface         | `#FFFFFF` | Input textarea, result box (slightly elevated from bg)    |
| Text primary    | `#1A1A1A` | Headings, body text                                       |
| Text muted      | `#6B6B6B` | Placeholders, labels, secondary text                      |
| Accent (button) | `#2D2D2D` | "Optimize" button background (near-black ink)             |
| Accent hover    | `#000000` | Button hover state                                        |
| Accent disabled | `#9A9A9A` | Button disabled state (while loading)                     |
| Border          | `#E8E3DB` | 1px subtle borders on inputs / result box                 |
| Success         | `#4A7C59` | "Copied!" toast, API key saved confirmation               |
| Error           | `#B84A3E` | Error messages (invalid key, rate limit, network)         |

### 14.2 Typography (locked)

- **Wordmark font:** `Fraunces` (fallback: `Georgia, 'Times New Roman', serif`) — a warm variable serif used only for the "Promptique" header. Size `20px`, weight `600`, `letter-spacing: 2px`, `text-transform: uppercase`.
- **UI font:** `Inter` (system fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)
- **Prompt text font** (textarea + result box): `JetBrains Mono` (fallback: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`) — prompts are code-like and benefit from monospace
- **Size scale:**
  - Wordmark: `20px`, weight `600`, uppercase, `letter-spacing: 2px` (Fraunces)
  - Other headings: `16px`, weight `600` (Inter)
  - Body / UI: `13px`, weight `400`
  - Labels: `11px`, weight `500`, `letter-spacing: 0.3px`, `text-transform: uppercase` for section labels
  - Prompt text in textarea/result: `13px`, weight `400`, `line-height: 1.6`

Use Google Fonts via `<link>` tag for Fraunces, Inter, and JetBrains Mono. If offline fallback matters, self-host the `.woff2` files in the extension/PWA (adds ~60KB total with Fraunces).

### 14.3 Layout dimensions (Chrome extension popup)

- **Popup size:** `360px` wide × `520px` tall
- **Outer padding:** `20px`
- **Gap between elements:** `16px`
- **Border radius:** `16px` on the popup shell (`html`, `body`, `.app`) with `overflow: hidden` so the rounded corners clip; `8px` on internals (inputs, buttons, result box)
- **Button height:** `40px`, full-width; `flex-shrink: 0` so it never compresses when the result box grows
- **Button row:** when a result exists, the Optimize + Clear buttons share one row via `display: flex; gap: var(--gap)` with each button `flex: 1 1 0` (otherwise only Optimize is shown at full width)
- **Textarea:** min-height `132px`, max-height `220px`, `resize: vertical`
- **Result box:** min-height `92px`, max-height `200px`, internal scroll (outer `overflow: hidden`, inner `.result-scroll { overflow-y: auto }`) so the copy button stays pinned while long content scrolls underneath

### 14.4 Layout dimensions (PWA)

- **Max content width:** `640px`, centered on the page
- **Vertical padding:** `48px` top/bottom on desktop, `24px` on mobile
- **Same 8px internal radius, 16px gap, Ink & Paper colors** as the extension (no 16px outer shell — the PWA is a full page, not a popup)
- **Result box:** min-height `132px`, max-height `360px` (slightly taller than the extension since vertical space is less constrained)
- **Responsive breakpoint:** single breakpoint at `640px` — below it, content fills viewport width with 16px side padding

### 14.5 Component rules

**Textarea (input):**

- Background: `#FFFFFF`
- Border: `1px solid #E8E3DB`
- Focus border: `1px solid #2D2D2D` (no glow, no outline — just color change)
- Padding: `12px 14px`
- Placeholder: `Paste your prompt here...` in `#6B6B6B`

**Button (Optimize — primary):**

- Background: `#2D2D2D`, text: `#FAF7F2` (paper, not pure white — matches bg)
- Hover: background `#000000`
- Disabled / loading: background `#9A9A9A`
- `flex-shrink: 0` — never compresses inside flex columns when the result grows
- Loading state: replace text with a spinner (no text flash)
- No icons in the button — text-only ("Optimize")

**Button (Clear — secondary, appears only after a result):**

- Background: `transparent`, text: `#1A1A1A`, border: `1px solid #E8E3DB`
- Hover: background `rgba(45, 45, 45, 0.04)`, border: `#1A1A1A`
- Same height, radius, and font as the primary button — the only differences are the outlined treatment and the color role
- Respects "one accent color only" rule — the primary ink fill stays the single visual anchor

**Result box:**

- Background: `#FFFFFF`
- Border: `1px solid #E8E3DB`
- Soft shadow: `0 1px 2px rgba(0, 0, 0, 0.04)` (the only shadow in the UI)
- Max-height caps at `200px` (extension) / `360px` (PWA); the outer `.result` has `overflow: hidden` while an inner `.result-scroll` takes `overflow-y: auto`, so the copy button (absolute to `.result`) stays pinned to the top-right while long content scrolls underneath
- Copy button: top-right corner, icon-only (clipboard SVG, 16px), `#6B6B6B` default / `#1A1A1A` hover
- When content is present, `.result-scroll` gets `padding-right: 40px` to reserve space for the copy button
- On copy: flash a small "Copied" label in `#4A7C59` for 1.5 seconds, then fade out

**Error / empty states:**

- Error: subtle banner above the result box, `#B84A3E` text on `#FDF4F2` background, 12px padding, 8px radius
- Empty result: placeholder text "Your optimized prompt will appear here." in `#6B6B6B`, centered, no border flash

### 14.6 Design principles (rules, not suggestions)

1. **One accent color only.** The near-black button is the single visual anchor. No rainbow, no multiple CTAs.
2. **No emojis.** Not in the UI, not in labels, not in buttons. They don't match Ink & Paper.
3. **No gradients.** Flat fills only.
4. **One shadow only** (on the result box). Nothing else gets a shadow.
5. **Minimum icon set:** clipboard (copy), arrow-right (optional, inside button). No decorative icons.
6. **Generous whitespace.** When unsure, add more padding, not less. The popup should breathe.
7. **No loading skeletons.** Use a simple centered spinner inside the button. Keep result box empty with placeholder text until response arrives.
8. **No animations beyond:**
   - 150ms ease on hover states (background color transitions)
   - 1.5s fade on "Copied" label
   - Continuous rotation on the loading spinner
     No bouncing, sliding, scaling, or flourishes.
9. **Accessibility:**
   - All text meets WCAG AA contrast against its background
   - Focus rings are the accent `#2D2D2D` border change (never browser default)
   - Every interactive element has a visible focus state and is keyboard-reachable
   - `aria-label` on icon-only buttons (copy)

### 14.7 Icons (Promptique brand)

- **Design:** bold uppercase serif "P" on a rounded-corner paper square (`border-radius: 22%`), with a small circular ink-dot accent in the upper-right (suggesting a finishing flourish / punctuation). Monochrome: paper `#FAF7F2`, ink `#1A1A1A`, subtle border `#E8E3DB`.
- **Extension icon sizes** (PNG): `16`, `32`, `48`, `128` px — referenced from `extension/manifest.json` under both `icons` and `action.default_icon`.
- **PWA icon sizes** (PNG): `192`, `512` px — `192` is "any" purpose, `512` is "any maskable". Also a `32` px favicon for the browser tab.
- **Accent dot** is drawn only at sizes ≥ 48 px so it doesn't smear at favicon size.
- **Font** for the "P" glyph: system serif — Georgia Bold (macOS) or Times New Roman Bold (fallback) — resolved in order by the icon generator.
- **Generator:** `scripts/make-icons.py` — pure-Python (Pillow), no external SVG toolchain required. Run `python3 scripts/make-icons.py` from the repo root to regenerate all sizes.

### 14.8 What NOT to do (visual red flags to reject)

- Purple/violet/electric accents (competitors overuse these — we intentionally do not)
- Glassmorphism, blur effects, or frosted backgrounds
- Multiple fonts beyond Inter + JetBrains Mono
- Rounded corners larger than 12px (too playful for the brand)
- Full black pure `#000` background anywhere (use `#1A1A1A` for text, reserve `#000` only for button hover)
- Colored borders, bright focus rings, or any neon-adjacent colors
- "Fun" microcopy ("Let's go!", "Boom!", 🚀) — keep language direct and quiet

---

---

## 15. Operations & Deployment

Operator / API reference for whoever deploys and maintains the Promptique proxy and the two client surfaces. Rolled up from the former `proxy/README.md` (deleted) so the spec is the single source of truth for ops docs.

### 15.1 Proxy — one-time setup

**Option A — CLI (Wrangler):**

```bash
npm install -g wrangler
wrangler login
cd proxy
wrangler secret put GEMINI_API_KEY     # paste the Gemini key when prompted
wrangler deploy                        # prints the deployed URL
```

**Option B — Cloudflare dashboard (no CLI required):**

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker** → name: `promptique-proxy` → **Deploy**.
2. **Edit code** → paste the contents of `proxy/worker.js` → **Deploy**.
3. **Settings** → **Variables and Secrets**:
   - Add **Secret** `GEMINI_API_KEY` = your Gemini API key.
   - Add **Text var** `ALLOWED_ORIGINS` = `*` (dev) or a comma-separated origin list (prod).
   - Add **Text var** `LOGGING` = `on` (or `off`).
4. **Settings** → **Bindings** → **Add binding** → **Rate Limiter**:
   - Variable name: `RATE_LIMITER`, namespace `1001`, limit `10`, period `60`.
5. **Deploy**.

After deploy, paste the Worker URL (e.g. `https://promptique-proxy.<subdomain>.workers.dev`) into:

- `core/core.js` → `PROXY_URL`
- `extension/manifest.json` → `host_permissions`

Then run `./sync-core.sh`.

### 15.2 Worker configuration

| Variable          | Type     | Purpose                                        | Default |
| ----------------- | -------- | ---------------------------------------------- | ------- |
| `GEMINI_API_KEY`  | Secret   | Gemini API key. Never commit.                  | —       |
| `ALLOWED_ORIGINS` | Text var | Comma-separated origins. `*` = any (dev only). | `*`     |
| `LOGGING`         | Text var | `on` or `off` — structured JSON request logs.  | `on`    |
| `RATE_LIMITER`    | Binding  | Per-IP rate limit (10 / 60s).                  | —       |

For production, replace `*` with an explicit list once the Chrome extension has a stable ID (Chrome Web Store publish) and the PWA has a final URL:

```
ALLOWED_ORIGINS = "chrome-extension://<stable-id>,https://promptique.pages.dev"
```

### 15.3 HTTP API

```
POST /optimize
  Content-Type: application/json
  Body: { "userInput": "..." }          # trimmed, max 10 000 chars

  200 OK            { "text": "<optimized prompt>" }
  400 Bad Request   { "error": "...", "code"?: "SAFETY_BLOCKED" }
  403 Forbidden     { "error": "Origin not allowed" }
  413 Payload       { "error": "Input exceeds 10000 characters." }
  429 Too Many      { "error": "Rate limit reached — wait a minute." }          // proxy per-IP limit
                    { "error": "Gemini rate limit reached — try again in a moment." }  // Gemini-side 429
  500 Server        { "error": "Server misconfigured: missing API key." }
  502 Bad Gateway   { "error": "Upstream error (<status>)." }
  503 Unavailable   { "error": "Gemini is temporarily overloaded — try again in a moment." }

GET /health          200 { "ok": true }

OPTIONS /*           204 No Content (CORS preflight)
```

Client-side `PromptiqueError` codes mapped from these statuses: `EMPTY_INPUT`, `TOO_LONG`, `NETWORK`, `RATE_LIMIT`, `SAFETY_BLOCKED`, `PROXY_ERROR`, `BAD_RESPONSE`, `EMPTY_RESPONSE`.

### 15.4 Logs and key rotation

Stream logs:

```bash
wrangler tail
```

Or in the dashboard: your Worker → **Logs** → **Begin log stream**.

Each request emits one structured JSON line with `event`, `ip`, `origin`, `inputLen`, `outputLen`, `status`, `latencyMs`. **Prompt and response content are never logged.** Event values include: `ok`, `rate_limited`, `origin_blocked`, `upstream_rate_limit`, `upstream_overloaded`, `upstream_error`, `upstream_network_error`, `upstream_bad_json`, `safety_blocked`, `empty_response`, `missing_secret`, `rate_limiter_error`.

Disable logging entirely by setting `LOGGING = "off"` and redeploying.

Rotate the Gemini key (no redeploy needed — secrets update live):

```bash
wrangler secret put GEMINI_API_KEY     # or set the secret in the dashboard
```

### 15.5 PWA — deploy to Cloudflare Pages

1. Push the repo to GitHub (public).
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select the `Promptique` repo.
4. Build settings: framework = None, build command = empty, **build output directory = `pwa`**, root directory = empty.
5. **Save and Deploy**.
6. URL is `https://promptique.pages.dev` (or `<name>-<suffix>.pages.dev`). Every `git push` to `main` auto-deploys.

**Alternative — direct upload (no Git):** Pages → **Upload assets** → drop the contents of the `pwa/` folder onto the upload zone → Deploy.

**Alternative — GitHub Pages:** repo **Settings** → **Pages** → source: `main` branch, folder `/pwa` → Save. URL: `https://<user>.github.io/promptique/`.

### 15.6 Extension — package and distribute

```bash
cd /path/to/promptique
zip -r promptique-extension-v<version>.zip extension
```

Attach the ZIP to a **GitHub Release**. Teammates download → unzip → `chrome://extensions` → Developer mode ON → **Load unpacked** → select the unpacked `extension/` folder.

Each unpacked install gets a random extension ID. To get a stable ID (needed before tightening `ALLOWED_ORIGINS` to a specific extension origin), publish to the Chrome Web Store (one-time $5 — out of scope for v1 per section 2).

### 15.7 Icons — regenerate

```bash
python3 scripts/make-icons.py
```

Produces Chrome extension icons (`16`, `32`, `48`, `128` px) and PWA icons (`192`, `512` px, plus a `32` px favicon). Uses system serif fonts (Georgia Bold or Times New Roman Bold) with Pillow — no external SVG toolchain required. See section 14.7 for the design spec.

### 15.8 Free-tier ceilings

| Resource                | Free-tier ceiling                                                   | Enforcement                     |
| ----------------------- | ------------------------------------------------------------------- | ------------------------------- |
| Cloudflare Workers      | 100 000 requests / day                                              | CF platform                     |
| Cloudflare Pages        | Unlimited requests, 500 builds / month                              | CF platform                     |
| Gemini API              | 15 req / min, ~1 500 req / day (shared across all users of our key) | Google                          |
| Proxy per-IP rate limit | 10 req / 60s                                                        | Worker (`RATE_LIMITER` binding) |
| Client input length cap | 10 000 characters                                                   | Worker + client                 |

---

_Last updated: 2026-04-22 — migrated from BYOK to shared-key Cloudflare Worker proxy; rolled `proxy/README.md` into section 15; added Fraunces wordmark, PNG icon generator, Clear button, scrollable result, 16px popup corners, public/MIT release notes._
