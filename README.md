# Promptique — Prompt Optimization Tool

A production-grade, zero-cost prompt optimizer available as a **Chrome Extension** and a **Desktop PWA** — paste a raw prompt, get an engineered version back. Shared API key via a secure Cloudflare Worker proxy (no key setup for end users), metadata-only logging, and a handcrafted Ink & Paper UI.

Built with vanilla HTML/CSS/JavaScript, Cloudflare Workers, Google Gemini 2.5 Flash, Manifest V3, PWA standards, and Google Fonts (Fraunces, Inter, JetBrains Mono).

## Tech Stack

| Category | Technologies |
|---|---|
| **Frontend** | Vanilla HTML, CSS, JavaScript (ES modules) — no framework, no build step |
| **Chrome Extension** | Manifest V3, Action API, host permissions |
| **Desktop App** | Progressive Web App (Service Worker, Web App Manifest, installable) |
| **Backend / Proxy** | Cloudflare Workers (Edge runtime), native Rate Limiting binding |
| **LLM** | Google Gemini 2.5 Flash (free tier) |
| **Prompt Engineering** | Custom meta-prompt built on RTF + CRISPE + CLEAR frameworks |
| **Typography** | Fraunces (wordmark), Inter (UI), JetBrains Mono (prompt text) |
| **Design System** | Ink & Paper theme — warm off-white surfaces, near-black ink accents |
| **Icons** | Python + Pillow generator script (Ink & Paper serif monogram) |
| **Hosting** | Cloudflare Workers (proxy) + Cloudflare Pages / GitHub Pages (PWA) |
| **Distribution** | GitHub Releases (extension ZIP), chrome://extensions Load Unpacked |

## Key Features

- One-click prompt optimization with `Cmd/Ctrl+Enter` keyboard shortcut
- Zero end-user setup — no API key to create, no signup, no account
- Shared Gemini key held server-side as a Cloudflare Worker secret (never shipped in client bundles)
- Cloudflare Worker proxy with per-IP rate limiting (10 req / 60s), origin allowlist, and 10,000-character input cap
- Metadata-only request logging (timestamp, IP, origin, input/output length, status, latency) — prompt and response content are never logged
- Friendly error surfacing for rate limits, upstream overload, safety blocks, network issues
- Chrome Extension popup (Manifest V3) with rounded-corner boutique UI
- Installable Desktop PWA with service worker for offline shell
- Copy-to-clipboard with subtle confirmation flash
- Internally scrollable result box with pinned copy button and fixed-height optimize button
- Clear-and-reset button appears alongside Optimize once a result is rendered
- Single source of truth in `core/` synced into both surfaces via `sync-core.sh`
- WCAG AA contrast, semantic HTML, `aria-live` result region, keyboard-reachable controls
- Responsive PWA layout with a single 640px breakpoint
- Ink & Paper design language — one accent color, one shadow, minimal icon set, no gradients or emojis
- Programmatically generated PNG icons (16 / 32 / 48 / 128 for extension, 192 / 512 for PWA) via a Python + Pillow script
- Runs entirely on free tiers — Cloudflare Workers (100k req/day) + Gemini free tier (15 req/min)

## Getting Started

### Prerequisites

- A Cloudflare account (free)
- A Google AI Studio account for a Gemini API key (free) — https://aistudio.google.com/apikey
- Chrome 120+ for the extension and the PWA install flow
- Python 3 (optional — only needed to regenerate icons)

### Clone the Repository

```bash
git clone https://github.com/Asad-Saeed/Promptique.git
cd promptique
```

### Deploy the Proxy (Cloudflare Worker)

The proxy holds the Gemini API key server-side and wraps the user's input in the meta-prompt. Full deploy + ops reference is in [`docs/prompt-optimization.md`](docs/prompt-optimization.md#15-operations--deployment) (section 15). Quick path (CLI):

```bash
npm install -g wrangler
wrangler login
cd proxy
wrangler secret put GEMINI_API_KEY        # paste your Gemini key when prompted
wrangler deploy
```

Or deploy via the Cloudflare dashboard → **Workers & Pages** → **Create Worker**, paste `proxy/worker.js`, add the `GEMINI_API_KEY` secret, set `ALLOWED_ORIGINS` + `LOGGING` env vars, and add a Rate Limiter binding (`RATE_LIMITER`, namespace `1001`, limit `10`, period `60`).

### Wire the Proxy URL Into the Client

Update the deployed Worker URL in two places:

- `core/core.js` → `PROXY_URL`
- `extension/manifest.json` → `host_permissions`

Then run:

```bash
./sync-core.sh
```

### Install the Chrome Extension (Local Dev)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** → select the `extension/` folder

### Run the Desktop PWA Locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/pwa/` in Chrome, then click the install icon in the address bar to install as a standalone desktop app.

### Deploy the PWA (Cloudflare Pages)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Select this repo → build output directory: `pwa`
3. Deploy — URL looks like `https://promptique.pages.dev`

### Regenerate Icons (Optional)

```bash
python3 scripts/make-icons.py
```

## Project Structure

```
promptique/
├── core/
│   ├── core.js                    # Proxy client + PromptiqueError (single source of truth)
│   └── styles.css                 # Ink & Paper shared styles
├── extension/
│   ├── manifest.json              # Manifest V3
│   ├── popup.html                 # Extension popup shell
│   ├── popup.js                   # Popup logic (imports core)
│   ├── core.js                    # Synced from core/
│   ├── styles.css                 # Synced from core/
│   └── icons/                     # 16 / 32 / 48 / 128 px PNG icons
├── pwa/
│   ├── index.html                 # PWA shell
│   ├── app.js                     # PWA logic (imports core)
│   ├── manifest.webmanifest       # PWA manifest
│   ├── service-worker.js          # Offline shell + install support
│   ├── core.js                    # Synced from core/
│   ├── styles.css                 # Synced from core/
│   └── icons/                     # 192 / 512 px PNG icons + favicon
├── proxy/
│   ├── worker.js                  # Cloudflare Worker — holds Gemini key + meta-prompt
│   └── wrangler.toml              # Worker config (vars, rate limiter binding)
├── scripts/
│   └── make-icons.py              # Regenerate PNG icons via Pillow
├── docs/
│   └── prompt-optimization.md     # Full SRS, design spec, and AI-assistant rules
├── sync-core.sh                   # Copy core/ into extension/ and pwa/
└── README.md                      # This file
```

## Available Scripts

| Command | Description |
|---|---|
| `./sync-core.sh` | Propagate `core/core.js` and `core/styles.css` into `extension/` and `pwa/` |
| `python3 scripts/make-icons.py` | Regenerate Chrome extension + PWA PNG icons |
| `python3 -m http.server 8000` | Serve the PWA locally at `http://localhost:8000/pwa/` |
| `wrangler deploy` | Deploy the proxy Worker from the `proxy/` directory |
| `wrangler secret put GEMINI_API_KEY` | Set or rotate the Gemini API key secret on the Worker |
| `wrangler tail` | Stream structured request logs from the deployed Worker |

## Architecture

```
┌─────────────────────────┐      ┌──────────────────────────┐
│   Chrome Extension      │      │   Desktop (PWA)          │
│   (popup.html + popup.js)│     │   (index.html + app.js)  │
└────────────┬────────────┘      └────────────┬─────────────┘
             │                                │
             │    shared core logic (core.js) │
             └──────────────┬─────────────────┘
                            │  POST /optimize { userInput }
                            ▼
              ┌─────────────────────────────┐
              │  Cloudflare Worker proxy    │
              │  - origin allowlist         │
              │  - rate limit (10 / 60s)    │
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

Full requirements, design decisions, and AI-assistant working rules live in [`docs/prompt-optimization.md`](docs/prompt-optimization.md).

## Privacy

- No accounts, no signup, no client-side telemetry.
- The Worker proxy logs request **metadata only** (timestamp, IP, origin, input/output length, HTTP status, latency). Prompt and response content are never logged.
- To disable logging entirely, set `LOGGING = "off"` on the Worker and redeploy.
- The Gemini API key lives only as a Cloudflare Worker secret — never in source, commits, or client bundles.

## Developed By

**Asad Saeed** — Full Stack & MERN Stack Developer

[![GitHub](https://img.shields.io/badge/GitHub-Asad--Saeed-181717?logo=github)](https://github.com/Asad-Saeed)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-asad--saeed--dev-0A66C2?logo=linkedin)](https://linkedin.com/in/asad-saeed-dev)
[![Portfolio](https://img.shields.io/badge/Portfolio-asad--saeed.vercel.app-000?logo=vercel)](https://asad-saeed.vercel.app)

- **Email:** asadsaeed.dev@gmail.com
- **Phone:** +92 301 7631644

## License

MIT
