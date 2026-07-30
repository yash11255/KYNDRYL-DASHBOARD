const mongoose = require('mongoose');

// Filled by a reviewer/support trainer who observes the session
const sessionReviewSchema = new mongoose.Schema({
  session:    { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
  trainer:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // trainer being reviewed
  reviewer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // person who reviewed

  visitedAt:  { type: Date, default: Date.now },
  gpsLat:     { type: Number },
  gpsLon:     { type: Number },

  // Scored criteria (1–5 each)
  scores: {
    punctuality:         { type: Number, min: 1, max: 5 },
    contentKnowledge:    { type: Number, min: 1, max: 5 },
    deliveryClarity:     { type: Number, min: 1, max: 5 },
    studentEngagement:   { type: Number, min: 1, max: 5 },
    classroomManagement: { type: Number, min: 1, max: 5 },
    materialsReady:      { type: Number, min: 1, max: 5 },
    overallImpression:   { type: Number, min: 1, max: 5 },
  },

  // Checklist
  checklist: {
    trainerWasPresent:       Boolean,
    studentsWereEngaged:     Boolean,
    materialsAvailable:      Boolean,
    schoolCooperative:       Boolean,
    safeEnvironment:         Boolean,
  },

  strengths:       { type: String },
  areasToImprove:  { type: String },
  additionalNotes: { type: String },

  photos: [{ filename: String, url: String, capturedAt: Date }],

  overallRating:  { type: Number, min: 1, max: 5 },
  submitted:      { type: Boolean, default: false },
  submittedAt:    { type: Date },
}, { timestamps: true });

// Computed avg on read
sessionReviewSchema.virtual('averageScore').get(function () {
  const s = this.scores;
  if (!s) return null;
  const vals = Object.values(s).filter(Boolean);
  return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
});
sessionReviewSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('SessionReview', sessionReviewSchema);
