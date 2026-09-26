import { httpError } from '../utils/http.js';

/**
 * Common interface every provider implements:
 *   create({ apiKey, model }) -> {
 *     generateVision({ imageBuffer, mimeType, systemPrompt, userPrompt, maxTokens, extra? })
 *       -> { text, model, usage? },
 *     testConnection() -> { ok, latencyMs, model?, error? }
 *   }
 */

export function withTimeout(timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

export async function postJson(url, { headers = {}, body, timeoutMs = 60000 }) {
  const { signal, done } = withTimeout(timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, text };
  } catch (e) {
    if (e && e.name === 'AbortError') {
      throw httpError(502, 'PROVIDER_ERROR', 'The AI provider timed out after 60 seconds. Please try again.');
    }
    throw httpError(502, 'PROVIDER_ERROR', 'Could not reach the AI provider. Please try again.');
  } finally {
    done();
  }
}

/** Pull a human-readable message out of a provider error payload. */
export function providerErrorMessage(label, status, data) {
  const detail =
    data?.error?.message ||
    data?.message ||
    (typeof data === 'string' ? data.slice(0, 200) : null);
  if (status === 401 || status === 403) {
    return `${label} rejected the API key. Please check the key in Settings and try again.`;
  }
  if (status === 429) {
    return `${label} is rate-limiting requests right now. Please wait a moment and try again.`;
  }
  return detail
    ? `${label} returned an error: ${String(detail).slice(0, 300)}`
    : `${label} returned an unexpected error (status ${status}).`;
}

/** Factory for OpenAI-compatible /chat/completions vision endpoints. */
export function openAiCompatible({ label, baseUrl }) {
  return {
    create({ apiKey, model }) {
      const m = model;
      async function generateVision({ imageBuffer, mimeType, systemPrompt, userPrompt, maxTokens = 2048 }) {
        const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
        const { ok, status, data } = await postJson(`${baseUrl}/chat/completions`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          body: {
            model: m,
            max_tokens: maxTokens,
            temperature: 0.7,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: `${systemPrompt}\n\n${userPrompt}` },
                  { type: 'image_url', image_url: { url: dataUrl } },
                ],
              },
            ],
          },
        });
        if (!ok) throw httpError(502, 'PROVIDER_ERROR', providerErrorMessage(label, status, data));
        const text = data?.choices?.[0]?.message?.content;
        if (!text || typeof text !== 'string') {
          throw httpError(502, 'PROVIDER_ERROR', `${label} returned an empty response.`);
        }
        return { text, model: m, usage: data?.usage };
      }

      async function testConnection() {
        const started = Date.now();
        try {
          await generateVision({
            imageBuffer: TINY_PNG,
            mimeType: 'image/png',
            systemPrompt: 'You are a helpful assistant.',
            userPrompt: 'Reply with the single word "ok".',
            maxTokens: 16,
          });
          return { ok: true, latencyMs: Date.now() - started, model: m };
        } catch (e) {
          return { ok: false, latencyMs: Date.now() - started, model: m, error: e.message };
        }
      }

      return { generateVision, testConnection };
    },
  };
}

/** 1x1 transparent PNG used for provider connection checks. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
