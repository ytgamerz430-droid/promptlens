import { postJson, providerErrorMessage, TINY_PNG } from './base.js';
import { httpError } from '../utils/http.js';

export const name = 'gemini';
export const defaultModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

export function create({ apiKey, model }) {
  const m = model || defaultModel;

  async function generateVision({ imageBuffer, mimeType, systemPrompt, userPrompt, maxTokens = 2048 }) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}` +
      `:generateContent?key=${encodeURIComponent(apiKey)}`;
    const { ok, status, data } = await postJson(url, {
      body: {
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\n${userPrompt}` },
              { inlineData: { mimeType, data: imageBuffer.toString('base64') } },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
      },
    });
    if (!ok) throw httpError(502, 'PROVIDER_ERROR', providerErrorMessage('Gemini', status, data));
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('');
    if (!text) throw httpError(502, 'PROVIDER_ERROR', 'Gemini returned an empty response.');
    return { text, model: m, usage: data?.usageMetadata };
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
}
