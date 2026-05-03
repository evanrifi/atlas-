const mongoose = require('mongoose');

const EconomySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  balance: { type: Number, default: 0 },
  inventory: [{ itemName: String, purchasedAt: Date }]
});

EconomySchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Economy', EconomySchema);
