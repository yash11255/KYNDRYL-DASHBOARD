const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  trainer:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  school:   { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  date:     { type: Date, required: true },
  topic:    { type: String, default: 'AI Pathshala' },
  expectedStudents: { type: Number },
  notes:    { type: String },
  status:   { type: String, enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'], default: 'scheduled' },

  // Optional reviewer / support trainer assigned to observe this session
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Assignment', assignmentSchema);
