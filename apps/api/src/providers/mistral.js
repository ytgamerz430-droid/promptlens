import { openAiCompatible } from './base.js';

export const name = 'mistral';
export const defaultModel = process.env.MISTRAL_MODEL || 'pixtral-12b-2409';

const impl = openAiCompatible({ label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1' });
export const create = ({ apiKey, model }) => impl.create({ apiKey, model: model || defaultModel });
