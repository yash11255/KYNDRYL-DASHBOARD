const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({ filename: String, url: String }, { _id: false });

const billSchema = new mongoose.Schema({
  name:         { type: String },
  amount:       { type: Number, default: 0 },
  mealType:     { type: String },              // Breakfast | Lunch | Dinner | Snack | Other
  billPhoto:    photoSchema,                   // photo of the physical bill / receipt
  paymentProof: photoSchema,                   // screenshot of payment / UPI receipt
  attachment:   photoSchema,                   // backward-compat alias for billPhoto
  time:         { type: Date, default: Date.now },
  remarks:      { type: String },
}, { _id: true });

const dailyExpenseSchema = new mongoose.Schema({
  trainer:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  baseStay: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseStay' },
  date:     { type: Date, required: true },
  district: { type: String },

  // Unified food array (was: food.breakfast / food.lunch / food.dinner)
  food: [billSchema],

  // Local conveyance (auto, bus, cab) — fuel comes from Session.travel
  transportation: [billSchema],

  // Totals (recomputed on save)
  totalFood:           { type: Number, default: 0 },
  totalTransportation: { type: Number, default: 0 },
  grandTotal:          { type: Number, default: 0 },
}, { timestamps: true });

dailyExpenseSchema.pre('save', function (next) {
  const sum = (arr) => (arr || []).reduce((s, b) => s + (b.amount || 0), 0);
  this.totalFood           = sum(this.food);
  this.totalTransportation = sum(this.transportation);
  this.grandTotal          = this.totalFood + this.totalTransportation;
  next();
});

module.exports = mongoose.model('DailyExpense', dailyExpenseSchema);
