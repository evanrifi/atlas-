const mongoose = require('mongoose');

const SecretChannelSchema = new mongoose.Schema({
  channelId: { type: String, required: true },
  guildId: { type: String, required: true },
  deleteAt: { type: Date, required: true }
});

module.exports = mongoose.model('SecretChannel', SecretChannelSchema);
