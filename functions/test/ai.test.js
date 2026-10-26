const test = require('node:test');
const assert = require('node:assert/strict');
const { createGenerateAI } = require('../ai');

function setup() {
  const calls = [];
  const quotas = [];
  const handler = createGenerateAI({
    apiKey: () => 'server-test-key',
    consumeQuota: async uid => quotas.push(uid),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Advice' }] } }] }) };
    },
  });
  return { handler, calls, quotas };
}

test('unsigned requests cannot consume quota or call Gemini', async () => {
  const { handler, calls, quotas } = setup();
  await assert.rejects(handler({ data: { prompt: 'Advice' } }), error => error.code === 'unauthenticated');
  assert.equal(calls.length, 0);
  assert.equal(quotas.length, 0);
});

test('invalid input does not call Gemini', async () => {
  const { handler, calls, quotas } = setup();
  for (const data of [null, [], {}, { prompt: 1 }, { prompt: ' ' }, { prompt: 'x'.repeat(32001) }, { prompt: 'Advice', image: 'invalid' }]) {
    await assert.rejects(handler({ auth: { uid: 'user-1' }, data }), error => error.code === 'invalid-argument');
  }
  assert.equal(calls.length, 0);
  assert.equal(quotas.length, 0);
});

test('signed image request uses server credential and bounded generation', async () => {
  const { handler, calls, quotas } = setup();
  const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64');
  const result = await handler({ auth: { uid: 'user-1' }, data: { prompt: 'Verify task', image } });
  assert.equal(result.candidates[0].content.parts[0].text, 'Advice');
  assert.deepEqual(quotas, ['user-1']);
  assert.equal(calls[0].options.headers['x-goog-api-key'], 'server-test-key');
  assert.equal(calls[0].url.includes('server-test-key'), false);
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body.contents[0].parts[1], { inline_data: { mime_type: 'image/jpeg', data: image } });
  assert.equal(body.generationConfig.maxOutputTokens, 4096);
});

test('quota rejection prevents provider invocation', async () => {
  let called = false;
  const handler = createGenerateAI({ apiKey: () => 'server-test-key', consumeQuota: async () => { throw Object.assign(new Error('Quota'), { code: 'resource-exhausted' }); }, fetchImpl: async () => { called = true; } });
  await assert.rejects(handler({ auth: { uid: 'user-1' }, data: { prompt: 'Advice' } }), error => error.code === 'resource-exhausted');
  assert.equal(called, false);
});

test('provider errors do not disclose credentials', async () => {
  const handler = createGenerateAI({ apiKey: () => 'server-test-key', consumeQuota: async () => {}, fetchImpl: async () => { throw new Error('server-test-key'); } });
  await assert.rejects(handler({ auth: { uid: 'user-1' }, data: { prompt: 'Advice' } }), error => error.code === 'unavailable' && !error.message.includes('server-test-key'));
});
