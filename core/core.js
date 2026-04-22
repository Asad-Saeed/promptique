// Promptique client — POSTs { userInput } to the proxy Worker.
// The proxy owns the Gemini API key and the meta-prompt.
// Loaded as an ES module by the extension popup and the PWA.

export const PROXY_URL = 'https://promptique-proxy.asadsaeed-dev.workers.dev';

const MAX_INPUT_CHARS = 10000;

export class PromptiqueError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'PromptiqueError';
    this.code = code;
  }
}

export async function optimizePrompt(userInput) {
  const trimmed = (userInput ?? '').trim();

  if (!trimmed) {
    throw new PromptiqueError('Prompt is empty.', 'EMPTY_INPUT');
  }
  if (trimmed.length > MAX_INPUT_CHARS) {
    throw new PromptiqueError(`Prompt is too long (max ${MAX_INPUT_CHARS} characters).`, 'TOO_LONG');
  }

  let response;
  try {
    response = await fetch(`${PROXY_URL}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput: trimmed }),
    });
  } catch {
    throw new PromptiqueError('Network error — check your connection.', 'NETWORK');
  }

  if (response.status === 429) {
    throw new PromptiqueError('Rate limit reached — wait a minute and try again.', 'RATE_LIMIT');
  }
  if (response.status === 413) {
    throw new PromptiqueError(`Prompt is too long (max ${MAX_INPUT_CHARS} characters).`, 'TOO_LONG');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new PromptiqueError('Invalid response from server.', 'BAD_RESPONSE');
  }

  if (!response.ok) {
    if (data?.code === 'SAFETY_BLOCKED') {
      throw new PromptiqueError('Gemini blocked this prompt for safety reasons.', 'SAFETY_BLOCKED');
    }
    const msg = data?.error || `Something went wrong (${response.status}).`;
    throw new PromptiqueError(msg, 'PROXY_ERROR');
  }

  const text = typeof data?.text === 'string' ? data.text : '';
  if (!text) {
    throw new PromptiqueError('Server returned an empty response.', 'EMPTY_RESPONSE');
  }
  return text;
}
