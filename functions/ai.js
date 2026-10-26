function failure(code, message) {
  return Object.assign(new Error(message), { code });
}

function createGenerateAI({ apiKey, consumeQuota, fetchImpl = fetch }) {
  return async request => {
    if (!request.auth?.uid) throw failure('unauthenticated', 'Sign in to use AI.');
    const data = request.data;
    const prompt = data?.prompt;
    if (!data || Array.isArray(data) || typeof prompt !== 'string' || !prompt.trim() || prompt.length > 32000) {
      throw failure('invalid-argument', 'A prompt of 1 to 32000 characters is required.');
    }
    const parts = [{ text: prompt }];
    if (data.image !== undefined) {
      const image = data.image;
      if (typeof image !== 'string' || image.length > 5600000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image) || image.length % 4 !== 0) {
        throw failure('invalid-argument', 'A JPEG, PNG or WebP image up to 4 MB is required.');
      }
      const bytes = Buffer.from(image, 'base64');
      let mimeType;
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mimeType = 'image/jpeg';
      if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mimeType = 'image/png';
      if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') mimeType = 'image/webp';
      if (bytes.length > 4 * 1024 * 1024 || !mimeType) {
        throw failure('invalid-argument', 'A JPEG, PNG or WebP image up to 4 MB is required.');
      }
      parts.push({ inline_data: { mime_type: mimeType, data: image } });
    }
    const serverKey = apiKey();
    if (!serverKey) throw failure('failed-precondition', 'AI service is not configured.');
    await consumeQuota(request.auth.uid);
    try {
      const response = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': serverKey },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } } }),
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error('Provider failure');
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
      if (!text) throw new Error('Empty response');
      return { candidates: [{ content: { parts: [{ text }] } }] };
    } catch {
      throw failure('unavailable', 'AI service unavailable. Please try again later.');
    }
  };
}

module.exports = { createGenerateAI };
