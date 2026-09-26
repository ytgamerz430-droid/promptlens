/**
 * Prompt templates for the generation tools.
 * All wording here is original; nothing is lifted from any third-party product.
 */

export function buildArtPrompt({ outputStyle = 'art_prompt', ipSafe = false, iconMode = false }) {
  const system =
    'You are an expert visual describer who turns photographs into rich, ready-to-use ' +
    'prompts for AI image generators. Write in vivid, concrete language: name visible ' +
    'subjects, composition, lighting, color, mood, and style. Avoid vague filler. ' +
    'Respond with the prompt text only — no preamble, no explanations, no quotation marks around it.';

  const extras = [];
  if (ipSafe) extras.push('Avoid naming real people, brands, logos, or trademarked characters; describe them generically instead.');
  if (iconMode) extras.push('Describe the image as a clean, minimal vector-style app icon: flat shapes, simple palette, centered subject.');
  if (outputStyle === 'art_prompt') extras.push('Keep it a single flowing paragraph suitable for Midjourney, DALL-E, or Stable Diffusion.');

  return {
    systemPrompt: system,
    userPrompt: ['Describe this image as a detailed AI image-generation prompt.', ...extras].join('\n'),
  };
}

export function buildMetadataPrompt({ platform, limits, customPrompt, customKeywords }) {
  const { titleMin, titleMax, keywordMin, keywordMax, keywordType } = limits;
  const rules = [];
  if (titleMin != null) rules.push(`at least ${titleMin} characters long`);
  if (titleMax != null) rules.push(`at most ${titleMax} characters long`);
  const titleRule = rules.length
    ? `The title must be ${rules.join(' and ')}.`
    : 'The title should be a concise, descriptive sentence.';
  const kwRule = (keywordMin != null || keywordMax != null)
    ? `Provide ${keywordMin != null ? `at least ${keywordMin}` : ''}${keywordMin != null && keywordMax != null ? ' and ' : ''}${keywordMax != null ? `at most ${keywordMax}` : ''} keywords.`
    : 'Provide a balanced set of relevant keywords.';
  const typeRule = keywordType === 'single'
    ? 'Use single-word keywords only.'
    : keywordType === 'phrase'
      ? 'Use short multi-word keyword phrases.'
      : 'Mix single-word and short-phrase keywords.';

  const system =
    'You are a stock-photography metadata specialist. Given an image, you write a ' +
    'marketplace-ready title, keyword set, and description that help buyers find it. ' +
    'Be specific and factual about what is visible; never invent details. ' +
    'Respond with ONLY a JSON object — no markdown, no commentary — in exactly this shape: ' +
    '{"title": string, "keywords": string[], "description": string}.';

  const user = [
    `Marketplace: ${platform.name}. ${platform.notes || ''}`,
    titleRule,
    kwRule,
    typeRule,
    'The description should be 1–3 sentences summarizing the image for a buyer.',
    customKeywords ? `Consider including these user-supplied keywords where relevant: ${customKeywords}` : null,
    customPrompt ? `Additional instructions: ${customPrompt}` : null,
  ].filter(Boolean).join('\n');

  return { systemPrompt: system, userPrompt: user };
}

export function buildMetadataCorrection(errors) {
  return (
    'Your previous response did not meet the requirements. Fix these problems:\n' +
    errors.map((e) => `- ${e}`).join('\n') +
    '\nReturn ONLY the corrected JSON object in the exact shape {"title": string, "keywords": string[], "description": string}.'
  );
}

export function buildDeepPrompt() {
  const system =
    'You are a meticulous visual analyst. Break an image down into its core visual ' +
    'components with precise, factual observations. ' +
    'Respond with ONLY a JSON object — no markdown, no commentary — in exactly this shape: ' +
    '{"components": [{"name": string, "detail": string}], "summary": string}. ' +
    'Include exactly these 10 components in order: Subject, Composition, Lighting, ' +
    'Color palette, Style, Mood, Background, Texture, Perspective, Details.';
  return {
    systemPrompt: system,
    userPrompt: 'Analyze this image and return the structured breakdown as specified.',
  };
}

export function buildIpRiskPrompt() {
  const system =
    'You are an intellectual-property risk reviewer for stock imagery. Look for ' +
    'recognizable trademarks, logos, branded products, famous characters, celebrity ' +
    'likenesses, distinctive architecture, or artwork that could require a release. ' +
    'Respond with ONLY a JSON object — no markdown, no commentary — in exactly this shape: ' +
    '{"risk": "low"|"medium"|"high", "findings": string[], "summary": string}. ' +
    'Be conservative: flag anything uncertain as at least medium risk.';
  return {
    systemPrompt: system,
    userPrompt: 'Assess this image for IP and trademark risk and return the structured assessment as specified.',
  };
}
