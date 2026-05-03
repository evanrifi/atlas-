const mongoose = require('mongoose');

const AltTrackerSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  ipHash: { type: String, required: true },
  fingerprint: { type: String, required: true },
  banned: { type: Boolean, default: false }
});

module.exports = mongoose.model('AltTracker', AltTrackerSchema);
