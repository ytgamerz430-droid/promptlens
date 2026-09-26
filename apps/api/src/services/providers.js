import { db } from '../db.js';
import { decrypt } from '../crypto.js';
import { httpError } from '../utils/http.js';
import * as gemini from '../providers/gemini.js';
import * as groq from '../providers/groq.js';
import * as mistral from '../providers/mistral.js';
import * as openai from '../providers/openai.js';
import * as mock from '../providers/mock.js';

const registry = { gemini, groq, mistral, openai, mock };

/** Test hooks can register stub providers. */
export function registerProvider(name, impl) {
  registry[name] = impl;
}

/** Get the provider implementation module by name (or null). */
export function getProviderImpl(name) {
  return registry[name] || null;
}

export function providerNames() {
  return Object.keys(registry);
}

export function getProviderKeyRow(userId, provider) {
  return db.prepare('SELECT * FROM provider_keys WHERE user_id = ? AND provider = ?').get(userId, provider) || null;
}

export function getSettings(userId) {
  let row = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
  if (!row) {
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO user_settings (user_id, default_platform, theme, default_provider, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, 'adobe_stock', 'dark', process.env.DEFAULT_PROVIDER || 'mock', now);
    row = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
  }
  return row;
}

/**
 * Resolve which provider (and whose key) a generation should use.
 * Returns { name, impl, apiKey, model, cost, byokUsed }.
 * Throws 501 PROVIDER_NOT_CONFIGURED when no key is available and the
 * provider is not the mock dev provider.
 */
export function resolveProvider(userId, byokRequested = false) {
  const settings = getSettings(userId);
  const name = settings.default_provider || process.env.DEFAULT_PROVIDER || 'mock';
  const impl = registry[name];
  if (!impl) {
    throw httpError(422, 'VALIDATION_ERROR', `Unknown provider "${name}".`);
  }

  if (name === 'mock') {
    return { name, impl, apiKey: null, model: 'mock', cost: 0, byokUsed: false };
  }

  const keyRow = getProviderKeyRow(userId, name);
  const envName = name.toUpperCase();
  const apiKey = keyRow ? decrypt(keyRow.encrypted) : (process.env[`${envName}_API_KEY`] || null);
  if (!apiKey) {
    throw httpError(501, 'PROVIDER_NOT_CONFIGURED',
      `No API key is configured for ${name}. Add your own key in Settings, or ask the administrator to configure a server key.`);
  }
  const byokUsed = !!(byokRequested && keyRow);
  const model = keyRow?.model || process.env[`${envName}_MODEL`] || impl.defaultModel;
  return { name, impl, apiKey, model, cost: byokUsed ? 0 : 1, byokUsed };
}

/** Build a runnable provider instance from a resolution. */
export function instantiate(resolved) {
  return resolved.impl.create({ apiKey: resolved.apiKey, model: resolved.model });
}
