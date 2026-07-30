const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  order:      { type: Number, required: true },
  type:       { type: String, enum: ['text', 'mcq'], required: true },
  question:   { type: String, required: true },
  options:    [String],
  isRequired: { type: Boolean, default: false },
}, { _id: false });

const assessmentTemplateSchema = new mongoose.Schema({
  questions:  [questionSchema],
  version:    { type: Number, default: 1 },
  isActive:   { type: Boolean, default: true },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('AssessmentTemplate', assessmentTemplateSchema);
