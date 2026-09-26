import { openAiCompatible } from './base.js';

export const name = 'openai';
export const defaultModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const impl = openAiCompatible({ label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' });
export const create = ({ apiKey, model }) => impl.create({ apiKey, model: model || defaultModel });
