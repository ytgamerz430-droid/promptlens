import { httpError } from '../utils/http.js';
import { withTimeout } from '../providers/base.js';

const API_KEY = process.env.ADOBE_STOCK_API_KEY || null;

function requireKey() {
  if (!API_KEY) {
    throw httpError(501, 'PROVIDER_NOT_CONFIGURED',
      'The stock tracker is not configured yet. Set ADOBE_STOCK_API_KEY to enable it.');
  }
}

async function adobeGet(path, params) {
  requireKey();
  const url = new URL(`https://stock.adobe.io/Rest/Media/1${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const { signal, done } = withTimeout(30000);
  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': API_KEY, 'x-product': 'PromptLensClone/1.0' },
      signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw httpError(502, 'PROVIDER_ERROR',
        `The stock provider returned status ${res.status}. Please try again later.`);
    }
    return data || {};
  } finally {
    done();
  }
}

function mapAssets(data) {
  const files = Array.isArray(data?.files) ? data.files : [];
  return {
    assets: files.map((f) => ({
      id: String(f.id),
      title: f.title || 'Untitled',
      thumbnail: f.thumbnail_240_url || f.thumbnail_url || null,
    })),
    total: typeof data?.nb_results === 'number' ? data.nb_results : files.length,
  };
}

/** Search stock assets by keyword query. */
export async function searchAssets({ q, limit = 20, offset = 0 }) {
  const data = await adobeGet('/Search/Files', {
    locale: 'en-US',
    'search_parameters[words]': q,
    'search_parameters[limit]': limit,
    'search_parameters[offset]': offset,
  });
  return mapAssets(data);
}

/** List assets from a contributor. */
export async function contributorAssets({ creatorId, limit = 20, offset = 0 }) {
  const data = await adobeGet('/Search/Files', {
    locale: 'en-US',
    'search_parameters[creator_id]': creatorId,
    'search_parameters[limit]': limit,
    'search_parameters[offset]': offset,
  });
  return mapAssets(data);
}
