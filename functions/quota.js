function createConsumeQuota(db, now = Date.now) {
  return async uid => {
    const ref = db.collection('_aiRateLimits').doc(uid);
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const previous = snapshot.data();
      const timestamp = now();
      const active = previous && timestamp - previous.startedAt < 3600000;
      const count = active ? previous.count : 0;
      if (count >= 20) throw Object.assign(new Error('AI request limit reached. Try again later.'), { code: 'resource-exhausted' });
      transaction.set(ref, { startedAt: active ? previous.startedAt : timestamp, count: count + 1 });
    });
  };
}

module.exports = { createConsumeQuota };
