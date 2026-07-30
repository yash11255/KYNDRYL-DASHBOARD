const mongoose = require('mongoose');

const baseStaySchema = new mongoose.Schema({
  trainer:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  district:      { type: String, required: true },
  hotelName:     { type: String },
  hotelAddress:  { type: String },
  latitude:      { type: Number },
  longitude:     { type: Number },
  locationName:  { type: String },       // reverse-geocoded label
  checkInDate:   { type: Date, required: true },
  checkOutDate:  { type: Date },
  paymentScreenshots: [{
    filename: String,
    url:      String,
    amount:   Number,
    uploadedAt: { type: Date, default: Date.now },
  }],
  totalAmount:   { type: Number, default: 0 },
  notes:         { type: String },
  active:        { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('BaseStay', baseStaySchema);
