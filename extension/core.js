// Promptique client. Default path = proxy. With saved user key = direct to Gemini.

import { getUserKey } from "./userKey.js";

export const PROXY_URL = "https://promptique-proxy.asadsaeed-dev.workers.dev";

const MAX_INPUT_CHARS = 10000;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Mirror of META_PROMPT in proxy/worker.js — keep in sync.
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

export class PromptiqueError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "PromptiqueError";
    this.code = code;
  }
}

// Errors a user can work around by supplying their own Gemini key.
export const RECOVERABLE_ERROR_CODES = new Set([
  "RATE_LIMIT",
  "PROXY_ERROR",
  "BAD_RESPONSE",
  "EMPTY_RESPONSE",
]);

export function isRecoverableError(err) {
  return (
    err instanceof PromptiqueError && RECOVERABLE_ERROR_CODES.has(err.code)
  );
}

let consecutiveRecoverableErrors = 0;

export function getConsecutiveRecoverableErrors() {
  return consecutiveRecoverableErrors;
}

export function resetRecoverableErrorCounter() {
  consecutiveRecoverableErrors = 0;
}

function recordResultForCounter(err) {
  if (err === null) {
    consecutiveRecoverableErrors = 0;
    return;
  }
  if (isRecoverableError(err)) {
    consecutiveRecoverableErrors += 1;
  }
}

function validateInput(userInput) {
  const trimmed = (userInput ?? "").trim();
  if (!trimmed) {
    throw new PromptiqueError("Prompt is empty.", "EMPTY_INPUT");
  }
  if (trimmed.length > MAX_INPUT_CHARS) {
    throw new PromptiqueError(
      `Prompt is too long (max ${MAX_INPUT_CHARS} characters).`,
      "TOO_LONG",
    );
  }
  return trimmed;
}

export async function optimizePrompt(userInput) {
  const trimmed = validateInput(userInput);
  const userKey = await getUserKey();

  try {
    const text = userKey
      ? await callGeminiDirect(trimmed, userKey)
      : await callProxy(trimmed);
    recordResultForCounter(null);
    return text;
  } catch (err) {
    recordResultForCounter(err);
    throw err;
  }
}

// Force the direct-to-Gemini path with an explicit key.
export async function optimizePromptDirect(userInput, userKey) {
  const trimmed = validateInput(userInput);
  if (!userKey) {
    throw new PromptiqueError(
      "No personal Gemini key provided.",
      "INVALID_USER_KEY",
    );
  }
  return callGeminiDirect(trimmed, userKey);
}

async function callProxy(trimmed) {
  let response;
  try {
    response = await fetch(`${PROXY_URL}/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userInput: trimmed }),
    });
  } catch {
    throw new PromptiqueError(
      "Network error — check your connection.",
      "NETWORK",
    );
  }

  if (response.status === 429) {
    throw new PromptiqueError(
      "Rate limit reached — wait a minute and try again.",
      "RATE_LIMIT",
    );
  }
  if (response.status === 413) {
    throw new PromptiqueError(
      `Prompt is too long (max ${MAX_INPUT_CHARS} characters).`,
      "TOO_LONG",
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new PromptiqueError("Invalid response from server.", "BAD_RESPONSE");
  }

  if (!response.ok) {
    if (data?.code === "SAFETY_BLOCKED") {
      throw new PromptiqueError(
        "Gemini blocked this prompt for safety reasons.",
        "SAFETY_BLOCKED",
      );
    }
    if (data?.code === "EMPTY_RESPONSE") {
      throw new PromptiqueError(
        "Gemini returned an empty response.",
        "EMPTY_RESPONSE",
      );
    }
    const msg = data?.error || `Something went wrong (${response.status}).`;
    throw new PromptiqueError(msg, "PROXY_ERROR");
  }

  const text = typeof data?.text === "string" ? data.text : "";
  if (!text) {
    throw new PromptiqueError(
      "Server returned an empty response.",
      "EMPTY_RESPONSE",
    );
  }
  return text;
}

async function callGeminiDirect(trimmed, userKey) {
  const body = {
    contents: [
      { parts: [{ text: META_PROMPT.replace("{USER_INPUT}", () => trimmed) }] },
    ],
    generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
  };

  let response;
  try {
    response = await fetch(
      `${GEMINI_ENDPOINT}?key=${encodeURIComponent(userKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  } catch {
    throw new PromptiqueError(
      "Network error — check your connection.",
      "NETWORK",
    );
  }

  if (
    response.status === 400 ||
    response.status === 401 ||
    response.status === 403
  ) {
    throw new PromptiqueError(
      "Your Gemini key was rejected. Check the key and try again.",
      "INVALID_USER_KEY",
    );
  }
  if (response.status === 429) {
    throw new PromptiqueError(
      "Gemini rate limit reached — wait a minute and try again.",
      "RATE_LIMIT",
    );
  }
  if (response.status === 503) {
    throw new PromptiqueError(
      "Gemini is temporarily overloaded — try again in a moment.",
      "BAD_RESPONSE",
    );
  }
  if (!response.ok) {
    throw new PromptiqueError(
      `Gemini error (${response.status}).`,
      "PROXY_ERROR",
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new PromptiqueError("Invalid response from Gemini.", "BAD_RESPONSE");
  }

  const candidate = data?.candidates?.[0];
  if (candidate?.finishReason === "SAFETY") {
    throw new PromptiqueError(
      "Gemini blocked this prompt for safety reasons.",
      "SAFETY_BLOCKED",
    );
  }

  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) {
    throw new PromptiqueError(
      "Gemini returned an empty response.",
      "EMPTY_RESPONSE",
    );
  }
  return text.trim();
}
