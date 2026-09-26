import { httpError } from './http.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

export function validateRegister({ name, email, password }) {
  if (typeof name !== 'string' || name.trim().length < 2) {
    throw httpError(422, 'VALIDATION_ERROR', 'Please enter your name (at least 2 characters).');
  }
  if (!isEmail(email)) {
    throw httpError(422, 'VALIDATION_ERROR', 'Please enter a valid email address.');
  }
  if (typeof password !== 'string' || password.length < 8) {
    throw httpError(422, 'VALIDATION_ERROR', 'Password must be at least 8 characters long.');
  }
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw httpError(422, 'VALIDATION_ERROR', 'Password must be at least 8 characters long.');
  }
}

const TOOLS = ['prompt', 'metadata', 'deep', 'ip-risk', 'tracker-search', 'tracker-contributor'];
const PLATFORMS = ['adobe_stock', 'shutterstock', 'vecteezy', 'depositphotos', '123rf', 'dreamstime', 'general'];
const KEYWORD_TYPES = ['mixed', 'single', 'phrase'];

export function validateTool(tool) {
  if (!TOOLS.includes(tool)) {
    throw httpError(422, 'VALIDATION_ERROR', `Unknown tool "${tool}".`);
  }
  return tool;
}

export function validateJobInput(tool, input) {
  validateTool(tool);
  if (!input || typeof input !== 'object') {
    throw httpError(422, 'VALIDATION_ERROR', 'A JSON "input" object is required.');
  }
  const out = { ...input };
  if (tool === 'prompt') {
    requireUploadId(input);
    if (input.outputStyle !== undefined && input.outputStyle !== 'art_prompt') {
      throw httpError(422, 'VALIDATION_ERROR', 'Unsupported outputStyle.');
    }
    out.outputStyle = input.outputStyle || 'art_prompt';
    out.ipSafe = !!input.ipSafe;
    out.iconMode = !!input.iconMode;
  } else if (tool === 'metadata') {
    requireUploadId(input);
    const platform = input.platform || 'adobe_stock';
    if (!PLATFORMS.includes(platform)) throw httpError(422, 'VALIDATION_ERROR', 'Unknown platform.');
    out.platform = platform;
    for (const k of ['titleMin', 'titleMax', 'keywordMin', 'keywordMax']) {
      if (input[k] !== undefined && input[k] !== null) {
        const n = Number(input[k]);
        if (!Number.isInteger(n) || n < 0 || n > 1000) {
          throw httpError(422, 'VALIDATION_ERROR', `"${k}" must be a non-negative integer.`);
        }
        out[k] = n;
      }
    }
    if (input.keywordType !== undefined) {
      if (!KEYWORD_TYPES.includes(input.keywordType)) {
        throw httpError(422, 'VALIDATION_ERROR', 'Unknown keywordType.');
      }
      out.keywordType = input.keywordType;
    }
    if (input.customPrompt !== undefined && typeof input.customPrompt !== 'string') {
      throw httpError(422, 'VALIDATION_ERROR', 'customPrompt must be a string.');
    }
    if (input.customKeywords !== undefined && typeof input.customKeywords !== 'string') {
      throw httpError(422, 'VALIDATION_ERROR', 'customKeywords must be a string.');
    }
  } else if (tool === 'deep' || tool === 'ip-risk') {
    requireUploadId(input);
  } else if (tool === 'tracker-search') {
    if (typeof input.q !== 'string' || !input.q.trim()) {
      throw httpError(422, 'VALIDATION_ERROR', 'A search query "q" is required.');
    }
    out.q = input.q.trim().slice(0, 200);
    out.limit = clampInt(input.limit, 1, 100, 20);
    out.offset = clampInt(input.offset, 0, 10000, 0);
  } else if (tool === 'tracker-contributor') {
    if (typeof input.creatorId !== 'string' || !input.creatorId.trim()) {
      throw httpError(422, 'VALIDATION_ERROR', 'A "creatorId" is required.');
    }
    out.creatorId = input.creatorId.trim().slice(0, 100);
    out.limit = clampInt(input.limit, 1, 100, 20);
    out.offset = clampInt(input.offset, 0, 10000, 0);
  }
  out.byok = !!input.byok;
  return out;
}

function requireUploadId(input) {
  if (typeof input.uploadId !== 'string' || !input.uploadId) {
    throw httpError(422, 'VALIDATION_ERROR', 'An "uploadId" is required.');
  }
}

function clampInt(value, min, max, fallback) {
  if (value === undefined || value === null) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
