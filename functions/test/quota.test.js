const test = require('node:test');
const assert = require('node:assert/strict');
const { createConsumeQuota } = require('../quota');

test('twentieth call succeeds, twenty-first is rejected, and expiry starts a new window', async () => {
  const documents = new Map();
  let time = 1000;
  const db = {
    collection: name => {
      assert.equal(name, '_aiRateLimits');
      return { doc: uid => uid };
    },
    runTransaction: async callback => callback({
      get: async ref => ({ data: () => documents.get(ref) }),
      set: (ref, value) => documents.set(ref, value),
    }),
  };
  const consume = createConsumeQuota(db, () => time);
  for (let i = 0; i < 20; i++) await consume('user-1');
  assert.deepEqual(documents.get('user-1'), { startedAt: 1000, count: 20 });
  await assert.rejects(consume('user-1'), error => error.code === 'resource-exhausted');
  await consume('user-2');
  assert.deepEqual(documents.get('user-2'), { startedAt: 1000, count: 1 });
  time = 3601000;
  await consume('user-1');
  assert.deepEqual(documents.get('user-1'), { startedAt: 3601000, count: 1 });
});
