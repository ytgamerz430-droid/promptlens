import { test } from 'node:test';
import assert from 'node:assert/strict';

const validate = await import('../src/utils/validate.js');
const { extractJson, validateMetadata, generateMetadata } = await import('../src/tools/metadata.js');

test('register validation rejects bad input', () => {
  assert.throws(() => validate.validateRegister({ name: 'a', email: 'x@y.zz', password: '12345678' }),
    (e) => e.code === 'VALIDATION_ERROR');
  assert.throws(() => validate.validateRegister({ name: 'Ann', email: 'not-an-email', password: '12345678' }),
    (e) => e.code === 'VALIDATION_ERROR');
  assert.throws(() => validate.validateRegister({ name: 'Ann', email: 'a@b.cc', password: 'short' }),
    (e) => e.code === 'VALIDATION_ERROR');
  assert.doesNotThrow(() => validate.validateRegister({ name: 'Ann', email: 'a@b.cc', password: 'longenough' }));
});

test('job input validation', () => {
  assert.throws(() => validate.validateJobInput('nope', {}), (e) => e.code === 'VALIDATION_ERROR');
  assert.throws(() => validate.validateJobInput('prompt', {}), (e) => e.code === 'VALIDATION_ERROR');
  assert.throws(() => validate.validateJobInput('metadata', { uploadId: 'up_1', platform: 'nope' }),
    (e) => e.code === 'VALIDATION_ERROR');
  const ok = validate.validateJobInput('metadata', { uploadId: 'up_1' });
  assert.equal(ok.platform, 'adobe_stock');
  assert.equal(ok.byok, false);
  assert.throws(() => validate.validateJobInput('tracker-search', { q: '  ' }),
    (e) => e.code === 'VALIDATION_ERROR');
});

test('extractJson tolerates code fences and prose', () => {
  const obj = extractJson('Here you go:\n```json\n{"title":"t","keywords":["a"],"description":"d"}\n```');
  assert.deepEqual(obj, { title: 't', keywords: ['a'], description: 'd' });
  assert.throws(() => extractJson('no json here'), (e) => e.code === 'PROVIDER_ERROR');
});

test('validateMetadata flags limit violations', () => {
  const limits = { titleMin: 20, titleMax: 70, keywordMin: 30, keywordMax: 50, keywordType: 'mixed' };
  const bad = { title: 'short', keywords: ['one', 'two'], description: 'd' };
  const { errors } = validateMetadata(bad, limits);
  assert.ok(errors.length >= 2, `expected errors, got ${JSON.stringify(errors)}`);

  const good = {
    title: 'A properly long descriptive title for testing',
    keywords: Array.from({ length: 30 }, (_, i) => `keyword ${i + 1}`),
    description: 'A fine description.',
  };
  const res = validateMetadata(good, limits);
  assert.deepEqual(res.errors, []);
});

test('generateMetadata retries once on invalid output, then succeeds', async () => {
  const limits = { titleMin: 20, titleMax: 70, keywordMin: 5, keywordMax: 50, keywordType: 'mixed' };
  const platform = { id: 'adobe_stock', name: 'Adobe Stock', notes: '' };
  let calls = 0;
  const vision = async () => {
    calls += 1;
    if (calls === 1) {
      return JSON.stringify({ title: 'x', keywords: ['a'], description: 'd' }); // invalid
    }
    return JSON.stringify({
      title: 'A corrected title that is definitely long enough here',
      keywords: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
      description: 'Corrected description.',
    });
  };
  const { output, warnings } = await generateMetadata({
    vision, platform, limits, input: {},
  });
  assert.equal(calls, 2, 'expected exactly one retry');
  assert.equal(output.platform, 'adobe_stock');
  assert.equal(output.keywords.length, 5);
  assert.ok(Array.isArray(warnings));
});

test('generateMetadata returns best-effort output with warnings when retry still invalid', async () => {
  const limits = { titleMin: 20, titleMax: 70, keywordMin: 5, keywordMax: 50, keywordType: 'mixed' };
  const platform = { id: 'general', name: 'General', notes: '' };
  const vision = async () => JSON.stringify({ title: 'x', keywords: ['a'], description: 'd' });
  const { output, warnings } = await generateMetadata({ vision, platform, limits, input: {} });
  assert.equal(output.title, 'x');
  assert.ok(warnings.length > 0, 'expected warnings describing unresolved violations');
});
