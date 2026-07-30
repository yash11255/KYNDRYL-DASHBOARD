const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true },
  password:   { type: String, required: true },
  // reviewer = goes to sessions to observe & review trainers (no sessions of their own)
  // team_lead is optional — trainer may report directly to manager
  role: {
    type: String,
    enum: ['super_admin', 'manager', 'team_lead', 'trainer', 'reviewer'],
    default: 'trainer',
  },
  phone:      { type: String },
  employeeId: { type: String },
  district:   { type: String },
  team:       { type: String },           // "Team A", "Team B", or district name

  // Hierarchy
  managerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },   // trainer/TL → manager
  teamLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },   // trainer → TL

  active: { type: Boolean, default: true },

  // Google Drive — auto-created when trainer is onboarded
  driveFolderId:      { type: String },
  driveFolderUrl:     { type: String },
  driveAlFolderId:    { type: String }, // Acknowledgment Letters subfolder
  driveBaFolderId:    { type: String }, // Baseline Assessments subfolder
  drivePhotosFolderId:{ type: String }, // Photos subfolder (school-wise inside)
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});
userSchema.methods.comparePassword = function (p) { return bcrypt.compare(p, this.password); };
userSchema.methods.toSafeObject = function () { const o = this.toObject(); delete o.password; return o; };

module.exports = mongoose.model('User', userSchema);
