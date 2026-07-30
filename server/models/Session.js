const mongoose = require('mongoose');

const geoPhotoSchema = new mongoose.Schema({
  filename:   String,
  url:        String,
  driveUrl:   String,
  latitude:   Number,
  longitude:  Number,
  capturedAt: { type: Date, default: Date.now },
  tag:        String,
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
  trainer:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  school:     { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  baseStay:   { type: mongoose.Schema.Types.ObjectId, ref: 'BaseStay' },
  date:       { type: Date, required: true },

  // ── Journey: Base → School ────────────────────────────────────────
  journey: {
    departedAt:      Date,        // left base hotel
    departLatitude:  Number,
    departLongitude: Number,
    departLocation:  String,

    arrivedAt:       Date,        // reached school
    arriveLatitude:  Number,
    arriveLongitude: Number,
    arriveLocation:  String,

    departedSchoolAt:   Date,     // left school (check-out)
    departSchoolLat:    Number,
    departSchoolLon:    Number,

    kmBaseToSchool:  Number,      // one-way haversine distance
    kmRoundTrip:     Number,      // 2× (or GPS tracked)

    status: {
      type: String,
      enum: ['not_started', 'travelling', 'arrived', 'checked_out'],
      default: 'not_started',
    },
  },

  // ── Check-in at school ────────────────────────────────────────────
  checkIn: {
    time:         Date,
    latitude:     Number,
    longitude:    Number,
    locationName: String,
    photo:        geoPhotoSchema,
  },

  // ── Check-out from school ─────────────────────────────────────────
  checkOut: {
    time:         Date,
    latitude:     Number,
    longitude:    Number,
    locationName: String,
  },

  // ── Session photos ────────────────────────────────────────────────
  sessionPhotos: [geoPhotoSchema],

  // ── Students ──────────────────────────────────────────────────────
  students: {
    male:   { type: Number, default: 0 },
    female: { type: Number, default: 0 },
    total:  { type: Number, default: 0 },
    grades: [{ grade: String, count: Number }],
  },

  // ── Baseline assessment ───────────────────────────────────────────
  assessment: {
    submitted:       { type: Boolean, default: false },
    submittedAt:     Date,
    driveUrl:        String,
    pdfFilename:     String,
    pdfUrl:          String,
    templateVersion: Number,
    responses: [{
      question:       String,
      type:           { type: String, enum: ['text', 'mcq'] },
      answer:         String,
      selectedOption: Number,
      selectedLabel:  String,
    }],
  },

  // ── Acknowledgment letter ─────────────────────────────────────────
  acknowledgment: {
    uploaded:    { type: Boolean, default: false },
    photo:       geoPhotoSchema,
    driveUrl:    String,
    pdfDriveUrl: String,
    signedBy:    String,
    designation: String,
    pdfFilename: String,
    pdfUrl:      String,
  },

  // ── Travel & expenses ─────────────────────────────────────────────
  travel: {
    // Base stay reference (hotel where trainer is staying)
    baseStayId:    { type: mongoose.Schema.Types.ObjectId, ref: 'BaseStay' },
    baseLocation:  String,   // hotel name
    baseLatitude:  Number,
    baseLongitude: Number,

    // Calculated distances
    kmBaseToSchool: Number,  // one-way
    kmRoundTrip:    Number,  // total for the day (usually 2×)
    kmTravelled:    Number,  // manually overridden if needed

    transportMode:  { type: String, enum: ['bike', 'car', 'bus', 'train', 'auto', 'other'], default: 'bike' },
    fuelBills:      [geoPhotoSchema],
    fuelAmount:     { type: Number, default: 0 },
    travelNotes:    String,
  },

  // ── Checklist ─────────────────────────────────────────────────────
  checklist: {
    venueConfirmed:          Boolean,
    equipmentTested:         Boolean,
    materialsReady:          Boolean,
    introductionDone:        Boolean,
    baselineAssessmentDone:  Boolean,
    mainContentDelivered:    Boolean,
    activityConducted:       Boolean,
    qnaDone:                 Boolean,
    feedbackCollected:       Boolean,
    acknowledgmentSigned:    Boolean,
    photosUploaded:          Boolean,
    reportFilled:            Boolean,
  },

  // ── Google sync ───────────────────────────────────────────────────
  driveFolder:      String,
  driveFolderUrl:   String,
  sheetsRowUpdated: { type: Boolean, default: false },

  // ── Trainer session metadata ──────────────────────────────────────
  atlLabStatus:               { type: String, enum: ['YES', 'NO', 'NA'], default: 'NA' },
  trainerFeedback:            { type: String },
  teacherTrainingWillingness: { type: String, enum: ['YES', 'NO', 'MAYBE'], default: 'NO' },

  status:     { type: String, enum: ['draft', 'in-progress', 'submitted', 'reviewed'], default: 'draft' },
  submitTime: Date,
  adminNotes: String,
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
