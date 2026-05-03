const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true },
  ownerId: { type: String, required: true },
  channelId: { type: String, required: true },
  department: { type: String, enum: ['Support', 'Billing', 'Report'] },
  status: { type: String, default: 'open' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ticket', TicketSchema);
