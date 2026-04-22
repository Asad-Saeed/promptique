# Contributing to Promptique

Thanks for your interest. Promptique is intentionally small — vanilla HTML/CSS/JavaScript, no framework, no build step. Please read this before opening a PR.

## Ground rules

1. **No frameworks.** No React, Vue, Tailwind build step, TypeScript build step, or bundlers. Vanilla HTML/CSS/JS only.
2. **No cost.** No paid services, no subscriptions, no paid hosting. Cloudflare Workers + Gemini free tiers are the ceiling.
3. **No user-facing tracking.** Proxy metadata logs (lengths, status, latency — never content) are allowed and documented.
4. **Never commit secrets.** The Gemini API key lives only as a Cloudflare Worker secret. It must not appear in source, commits, `wrangler.toml`, or client bundles.
5. **Honor the spec.** [`docs/prompt-optimization.md`](docs/prompt-optimization.md) is the source of truth for requirements, scope, design, and AI-assistant rules. Changes to locked decisions require discussion in an issue first.

## Dev workflow

```bash
git clone https://github.com/Asad-Saeed/Promptique.git
cd promptique
```

1. **Edit shared client code in `core/`.** Never edit `extension/core.js`, `pwa/core.js`, `extension/styles.css`, or `pwa/styles.css` directly — they are generated.
2. **After editing `core/`**, run:
   ```bash
   ./sync-core.sh
   ```
3. **Run the PWA locally:**
   ```bash
   python3 -m http.server 8000
   # http://localhost:8000/pwa/
   ```
4. **Reload the extension:** `chrome://extensions` → find Promptique → click the reload icon.
5. **Regenerate icons** if you change the icon script:
   ```bash
   python3 scripts/make-icons.py
   ```
6. **Proxy changes** live in `proxy/worker.js`. Test against a dev Worker before merging — see [`proxy/README.md`](proxy/README.md).

## Submitting changes

- **Open an issue first** for any non-trivial change (new feature, UI overhaul, proxy rewrite). For typos, small bug fixes, or docs nits, a PR is fine.
- **One concern per PR.** Don't bundle unrelated changes.
- **Keep diffs small.** If you need to refactor before your change, do it in a separate PR first.
- **Test both surfaces.** If you touch `core/`, verify the change in **both** the extension popup and the PWA.
- **Update the spec** (`docs/prompt-optimization.md`) if your change alters a locked decision, hard constraint, or requirement.
- **Write clear commit messages.** Imperative mood, ~72 chars for the subject line. Example: `Add per-day rate limit cap via KV counter`.

## Out of scope

These are intentionally deferred (see the spec, section 4.2):

- Prompt history / library
- Multi-LLM support (OpenAI, Claude, etc.)
- User accounts, sync, cloud settings
- Analytics or telemetry
- Side-by-side diff view
- Chrome Web Store publishing
- Any monetization or license-key logic

If you want to propose lifting one of these, open an issue with the rationale before coding.

## Bug reports and feature requests

Use the issue templates in the **Issues** tab:
- **Bug report** — include reproduction steps, expected vs actual behavior, and surface (extension / PWA).
- **Feature request** — include the problem you're solving, not just the feature.

## Code style

- 2-space indentation, single quotes in JS, semicolons on.
- Meaningful names; avoid comments that restate the code.
- Don't add error handling for states that can't happen — trust internal callers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
