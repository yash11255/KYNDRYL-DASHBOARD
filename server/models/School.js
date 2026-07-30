const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  district:       { type: String, required: true },
  block:          { type: String },
  address:        { type: String },
  googleMapsLink: { type: String },
  latitude:       { type: Number },
  longitude:      { type: Number },

  // Principal / school head
  principalName:  { type: String },
  principalPhone: { type: String },

  // Spoke contact (field liaison)
  spokeContactName:  { type: String },
  spokeContactPhone: { type: String },
  // WhatsApp deep-link — auto-generated from spokeContactPhone on save
  spokeWhatsAppLink: { type: String },
  spokeNotes:        { type: String },

  totalStudents: { type: Number },
  active:        { type: Boolean, default: true },
}, { timestamps: true });

// Auto-build the wa.me link whenever phone changes
schoolSchema.pre('save', function (next) {
  if (this.spokeContactPhone) {
    const digits = this.spokeContactPhone.replace(/\D/g, '');
    const num = digits.startsWith('91') ? digits : `91${digits}`;
    this.spokeWhatsAppLink = `https://wa.me/${num}`;
  }
  next();
});

module.exports = mongoose.model('School', schoolSchema);
