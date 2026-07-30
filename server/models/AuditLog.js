const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  actor:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorName:  { type: String },
  actorRole:  { type: String },
  action:     { type: String, required: true },   // 'edit_school', 'edit_session', 'add_note', etc.
  entityType: { type: String },                   // 'School', 'Session', 'Assignment'
  entityId:   { type: mongoose.Schema.Types.ObjectId },
  entityName: { type: String },
  changes:    { type: mongoose.Schema.Types.Mixed },  // { field: { old, new } }
  notifiedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  read:       { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditSchema);
