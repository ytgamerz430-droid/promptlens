import { Router } from 'express';
import { db } from '../db.js';
import { encrypt, decrypt, maskKey, newId } from '../crypto.js';
import { authRequired } from '../middleware/auth.js';
import { err, asyncHandler } from '../utils/http.js';
import { getSettings, getProviderKeyRow, getProviderImpl } from '../services/providers.js';

const router = Router();
router.use(authRequired);

const PROVIDER_NAMES = ['gemini', 'groq', 'mistral', 'openai'];
const DEFAULT_MODELS = {
  gemini: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  groq: process.env.GROQ_MODEL || 'llama-3.2-90b-vision-preview',
  mistral: process.env.MISTRAL_MODEL || 'pixtral-12b-2409',
  openai: process.env.OPENAI_MODEL || 'gpt-4o-mini',
};

function maskedFor(userId, name) {
  const row = getProviderKeyRow(userId, name);
  if (row) {
    try {
      return maskKey(decrypt(row.encrypted));
    } catch {
      return '••••';
    }
  }
  const envKey = process.env[`${name.toUpperCase()}_API_KEY`];
  return envKey ? maskKey(envKey) : null;
}

function settingsToJson(userId) {
  const s = getSettings(userId);
  const providers = {};
  for (const name of PROVIDER_NAMES) {
    const row = getProviderKeyRow(userId, name);
    const envKey = process.env[`${name.toUpperCase()}_API_KEY`];
    providers[name] = {
      configured: !!(row || envKey),
      masked: maskedFor(userId, name),
      model: row?.model || DEFAULT_MODELS[name],
    };
  }
  return {
    defaultPlatform: s.default_platform,
    theme: s.theme,
    defaultProvider: s.default_provider,
    providers,
  };
}

// GET /settings
router.get('/', asyncHandler(async (req, res) => {
  return res.json({ settings: settingsToJson(req.user.id) });
}));

// PUT /settings
router.put('/', asyncHandler(async (req, res) => {
  const { defaultPlatform, theme, defaultProvider, providers } = req.body || {};
  const s = getSettings(req.user.id);

  if (defaultPlatform !== undefined) {
    const exists = db.prepare('SELECT 1 FROM platforms WHERE id = ?').get(String(defaultPlatform));
    if (!exists) return err(res, 422, 'VALIDATION_ERROR', 'Unknown default platform.');
  }
  if (theme !== undefined && !['dark', 'light'].includes(theme)) {
    return err(res, 422, 'VALIDATION_ERROR', 'Theme must be "dark" or "light".');
  }
  if (defaultProvider !== undefined && !getProviderImpl(defaultProvider)) {
    return err(res, 422, 'VALIDATION_ERROR', 'Unknown provider.');
  }

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE user_settings SET default_platform = ?, theme = ?, default_provider = ?, updated_at = ? WHERE user_id = ?'
  ).run(
    defaultPlatform !== undefined ? String(defaultPlatform) : s.default_platform,
    theme !== undefined ? theme : s.theme,
    defaultProvider !== undefined ? defaultProvider : s.default_provider,
    now,
    req.user.id
  );

  if (providers && typeof providers === 'object') {
    for (const name of PROVIDER_NAMES) {
      const cfg = providers[name];
      if (!cfg || typeof cfg !== 'object') continue;
      const existing = getProviderKeyRow(req.user.id, name);
      if (cfg.apiKey !== undefined) {
        const key = String(cfg.apiKey || '');
        if (key === '') {
          // Empty string clears the stored key.
          if (existing) db.prepare('DELETE FROM provider_keys WHERE id = ?').run(existing.id);
        } else {
          const encrypted = encrypt(key);
          const model = cfg.model ? String(cfg.model) : (existing?.model || DEFAULT_MODELS[name]);
          if (existing) {
            db.prepare('UPDATE provider_keys SET encrypted = ?, model = ?, updated_at = ? WHERE id = ?')
              .run(encrypted, model, now, existing.id);
          } else {
            db.prepare(
              'INSERT INTO provider_keys (id, user_id, provider, encrypted, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).run(newId('pk_'), req.user.id, name, encrypted, model, now, now);
          }
        }
      } else if (cfg.model !== undefined && existing) {
        db.prepare('UPDATE provider_keys SET model = ?, updated_at = ? WHERE id = ?')
          .run(String(cfg.model), now, existing.id);
      }
    }
  }

  return res.json({ settings: settingsToJson(req.user.id) });
}));

// POST /settings/providers/:name/test
router.post('/providers/:name/test', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const impl = getProviderImpl(name);
  if (!impl) return err(res, 404, 'NOT_FOUND', 'Unknown provider.');

  const bodyKey = req.body?.apiKey ? String(req.body.apiKey) : null;
  const bodyModel = req.body?.model ? String(req.body.model) : null;

  let apiKey = bodyKey;
  let model = bodyModel || DEFAULT_MODELS[name] || impl.defaultModel || name;
  if (name !== 'mock' && !apiKey) {
    const row = getProviderKeyRow(req.user.id, name);
    if (row) {
      try { apiKey = decrypt(row.encrypted); } catch { apiKey = null; }
      if (!bodyModel && row.model) model = row.model;
    }
    if (!apiKey) apiKey = process.env[`${name.toUpperCase()}_API_KEY`] || null;
    if (!apiKey) {
      return res.json({ ok: false, error: `No API key is configured for ${name}.` });
    }
  }

  const instance = impl.create({ apiKey, model });
  const result = await instance.testConnection();
  if (result.ok) return res.json({ ok: true, model: result.model, latencyMs: result.latencyMs });
  return res.json({ ok: false, error: result.error || 'The provider could not be reached.' });
}));

export default router;
