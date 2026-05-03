const mongoose = require('mongoose');

const OAuthUserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  verifiedAt: { type: Date, default: Date.now },
  trustedScore: { type: Number, default: 0 },
  connections: { type: Array, default: [] }
});

module.exports = mongoose.model('OAuthUser', OAuthUserSchema);
