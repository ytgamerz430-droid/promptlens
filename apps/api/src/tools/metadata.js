import { httpError } from '../utils/http.js';
import { buildMetadataPrompt, buildMetadataCorrection } from './prompts.js';

/** Extract the first JSON object from model text (tolerates code fences / prose). */
export function extractJson(text) {
  if (!text || typeof text !== 'string') {
    throw httpError(502, 'PROVIDER_ERROR', 'The AI provider returned an empty response.');
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw httpError(502, 'PROVIDER_ERROR', 'The AI provider did not return valid metadata JSON.');
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw httpError(502, 'PROVIDER_ERROR', 'The AI provider did not return valid metadata JSON.');
  }
}

/**
 * Validate a metadata output against platform limits.
 * Returns { errors, warnings }. Errors block acceptance; warnings are advisory.
 */
export function validateMetadata(output, limits) {
  const errors = [];
  const warnings = [];

  if (!output || typeof output !== 'object') {
    return { errors: ['The response was not a JSON object.'], warnings };
  }

  const { title, keywords, description } = output;

  if (typeof title !== 'string' || !title.trim()) {
    errors.push('The title is missing or empty.');
  } else {
    const len = title.trim().length;
    if (limits.titleMin != null && len < limits.titleMin) {
      errors.push(`The title is ${len} characters; it must be at least ${limits.titleMin}.`);
    }
    if (limits.titleMax != null && len > limits.titleMax) {
      errors.push(`The title is ${len} characters; it must be at most ${limits.titleMax}.`);
    }
  }

  if (!Array.isArray(keywords) || keywords.length === 0) {
    errors.push('The keyword list is missing or empty.');
  } else {
    const clean = keywords.filter((k) => typeof k === 'string' && k.trim());
    if (clean.length !== keywords.length) errors.push('Some keywords are empty.');
    if (limits.keywordMin != null && clean.length < limits.keywordMin) {
      errors.push(`Only ${clean.length} keywords were provided; at least ${limits.keywordMin} are required.`);
    }
    if (limits.keywordMax != null && clean.length > limits.keywordMax) {
      errors.push(`${clean.length} keywords were provided; at most ${limits.keywordMax} are allowed.`);
    }
    if (limits.keywordType === 'single' && clean.some((k) => k.trim().includes(' '))) {
      warnings.push('Some keywords contain spaces although single-word keywords were requested.');
    }
    if (limits.keywordType === 'phrase' && clean.every((k) => !k.trim().includes(' '))) {
      warnings.push('All keywords are single words although keyword phrases were requested.');
    }
  }

  if (typeof description !== 'string' || !description.trim()) {
    errors.push('The description is missing or empty.');
  } else if (description.length > 1000) {
    warnings.push('The description is unusually long and may be truncated by some marketplaces.');
  }

  return { errors, warnings };
}

function normalize(output) {
  return {
    title: String(output.title).trim(),
    keywords: output.keywords.map((k) => String(k).trim()).filter(Boolean),
    description: String(output.description).trim(),
  };
}

/**
 * Run the metadata tool: generate, validate, and perform ONE automatic retry
 * with a correction prompt when the first draft violates the limits.
 *
 * @param {object} args
 * @param {(p:{systemPrompt,userPrompt,maxTokens,extra}) => Promise<string>} args.vision
 *   vision callback returning raw model text.
 * @param {object} args.platform platform row {id,name,notes,...}
 * @param {object} args.limits effective limits {titleMin,titleMax,keywordMin,keywordMax,keywordType}
 * @param {object} args.input raw job input (customPrompt, customKeywords)
 * @returns {{ output: {title,keywords,description,platform}, warnings: string[] }}
 */
export async function generateMetadata({ vision, platform, limits, input }) {
  const first = buildMetadataPrompt({
    platform,
    limits,
    customPrompt: input.customPrompt,
    customKeywords: input.customKeywords,
  });

  let text = await vision({ ...first, maxTokens: 2048, extra: { tool: 'metadata', limits } });
  let parsed = extractJson(text);
  let { errors, warnings } = validateMetadata(parsed, limits);

  if (errors.length > 0) {
    // One automatic retry with a correction prompt.
    const correction = buildMetadataCorrection(errors);
    text = await vision({
      systemPrompt: first.systemPrompt,
      userPrompt: correction,
      maxTokens: 2048,
      extra: { tool: 'metadata', limits, retry: true },
    });
    parsed = extractJson(text);
    const second = validateMetadata(parsed, limits);
    errors = second.errors;
    warnings = [...warnings, ...second.warnings];
  }

  if (errors.length > 0) {
    // Best effort: still return the draft, but flag what is off.
    warnings = [...warnings, ...errors.map((e) => `Still unresolved after retry: ${e}`)];
  }

  return {
    output: { ...normalize(parsed), platform: platform.id },
    warnings,
  };
}
