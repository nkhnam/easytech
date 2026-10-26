const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { createGenerateAI } = require('./ai');
const { createConsumeQuota } = require('./quota');

initializeApp();
const geminiKey = defineSecret('GEMINI_API_KEY');
const db = getFirestore('easytech-ai');

const consumeQuota = createConsumeQuota(db);

const generate = createGenerateAI({ apiKey: () => geminiKey.value(), consumeQuota });
exports.generateAI = onCall({
  secrets: [geminiKey],
  region: 'us-central1',
  timeoutSeconds: 90,
  memory: '256MiB',
  maxInstances: 3,
}, async request => {
  try {
    return await generate(request);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const knownCodes = new Set(['unauthenticated', 'invalid-argument', 'failed-precondition', 'resource-exhausted', 'unavailable']);
    if (knownCodes.has(error.code)) throw new HttpsError(error.code, error.message);
    throw new HttpsError('internal', 'AI request failed.');
  }
});
