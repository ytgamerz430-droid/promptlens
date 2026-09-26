import { openAiCompatible } from './base.js';

export const name = 'groq';
export const defaultModel = process.env.GROQ_MODEL || 'llama-3.2-90b-vision-preview';

const impl = openAiCompatible({ label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' });
export const create = ({ apiKey, model }) => impl.create({ apiKey, model: model || defaultModel });
