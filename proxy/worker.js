// Cloudflare Worker: Promptique Gemini proxy.
// Holds the Gemini API key server-side so the extension + PWA don't ship it.
// Deploy with `wrangler deploy` after setting the GEMINI_API_KEY secret.

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_INPUT_CHARS = 10000;

const META_PROMPT = `You are a world-class prompt engineer. Your job is to rewrite the user's raw prompt into an optimized version that will produce higher-quality output from a large language model.

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

OPTIMIZED PROMPT:`;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = buildCors(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({ ok: true }, 200, cors);
    }
    if (url.pathname !== "/optimize") {
      return json({ error: "Not found" }, 404, cors);
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }
    if (!isOriginAllowed(origin, env)) {
      log(env, { event: "origin_blocked", origin });
      return json({ error: "Origin not allowed" }, 403, cors);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";

    if (env.RATE_LIMITER) {
      try {
        const { success } = await env.RATE_LIMITER.limit({ key: ip });
        if (!success) {
          log(env, { event: "rate_limited", ip });
          return json(
            { error: "Rate limit reached — wait a minute." },
            429,
            cors,
          );
        }
      } catch (err) {
        log(env, { event: "rate_limiter_error", message: String(err) });
      }
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, cors);
    }

    const userInput =
      typeof body?.userInput === "string" ? body.userInput.trim() : "";
    if (!userInput) {
      return json({ error: "userInput is required" }, 400, cors);
    }
    if (userInput.length > MAX_INPUT_CHARS) {
      return json(
        { error: `Input exceeds ${MAX_INPUT_CHARS} characters.` },
        413,
        cors,
      );
    }
    if (!env.GEMINI_API_KEY) {
      log(env, { event: "missing_secret" });
      return json(
        { error: "Server misconfigured: missing API key." },
        500,
        cors,
      );
    }

    const geminiBody = {
      contents: [
        {
          parts: [
            { text: META_PROMPT.replace("{USER_INPUT}", () => userInput) },
          ],
        },
      ],
      generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
    };

    const started = Date.now();
    let upstream;
    try {
      upstream = await fetch(
        `${GEMINI_ENDPOINT}?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiBody),
        },
      );
    } catch (err) {
      log(env, { event: "upstream_network_error", ip, message: String(err) });
      return json({ error: "Upstream network error." }, 502, cors);
    }

    const latencyMs = Date.now() - started;

    if (upstream.status === 429) {
      log(env, { event: "upstream_rate_limit", ip, latencyMs });
      return json(
        { error: "Gemini rate limit reached — try again in a moment." },
        429,
        cors,
      );
    }
    if (upstream.status === 503) {
      log(env, { event: "upstream_overloaded", ip, latencyMs });
      return json(
        { error: "Gemini is temporarily overloaded — try again in a moment." },
        503,
        cors,
      );
    }
    if (!upstream.ok) {
      log(env, {
        event: "upstream_error",
        ip,
        status: upstream.status,
        latencyMs,
      });
      return json({ error: `Upstream error (${upstream.status}).` }, 502, cors);
    }

    let data;
    try {
      data = await upstream.json();
    } catch {
      log(env, { event: "upstream_bad_json", ip, latencyMs });
      return json({ error: "Invalid response from upstream." }, 502, cors);
    }

    const candidate = data?.candidates?.[0];
    if (candidate?.finishReason === "SAFETY") {
      log(env, { event: "safety_blocked", ip, latencyMs });
      return json(
        {
          error: "Gemini blocked this prompt for safety reasons.",
          code: "SAFETY_BLOCKED",
        },
        400,
        cors,
      );
    }

    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      log(env, { event: "empty_response", ip, latencyMs });
      return json(
        { error: "Gemini returned an empty response.", code: "EMPTY_RESPONSE" },
        502,
        cors,
      );
    }

    log(env, {
      event: "ok",
      ip,
      origin,
      inputLen: userInput.length,
      outputLen: text.length,
      latencyMs,
    });

    return json({ text: text.trim() }, 200, cors);
  },
};

function parseAllowlist(env) {
  const raw = (env.ALLOWED_ORIGINS || "*").trim();
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin, env) {
  const list = parseAllowlist(env);
  if (list.includes("*")) return true;
  if (!origin) return false;
  return list.includes(origin);
}

function buildCors(origin, env) {
  const list = parseAllowlist(env);
  const permissive = list.includes("*");
  const allow = permissive
    ? "*"
    : origin && list.includes(origin)
      ? origin
      : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...extraHeaders, "Content-Type": "application/json" },
  });
}

function log(env, payload) {
  if (env.LOGGING === "off") return;
  console.log(JSON.stringify({ t: new Date().toISOString(), ...payload }));
}
