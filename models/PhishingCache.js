const mongoose = require('mongoose');

const PhishingCacheSchema = new mongoose.Schema({
  domain: { type: String, required: true, unique: true },
  isMalicious: { type: Boolean, required: true },
  expiresAt: { type: Date, default: () => Date.now() + 7 * 24 * 60 * 60 * 1000 } // 1 week
});

PhishingCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PhishingCache', PhishingCacheSchema);
