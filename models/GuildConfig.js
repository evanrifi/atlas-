const mongoose = require('mongoose');

const GuildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  prefix: { type: String, default: '!' },
  modules: {
    antiNuke: { type: Boolean, default: true },
    automod: { type: Boolean, default: true },
    antiLink: { type: Boolean, default: false }
  }
});

module.exports = mongoose.model('GuildConfig', GuildConfigSchema);
