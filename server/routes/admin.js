const router = require('express').Router();
const User = require('../models/User');
const School = require('../models/School');
const Assignment = require('../models/Assignment');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const { auth } = require('../middleware/auth');
const { createDriveFolder, getOrCreateTrainerSheet } = require('../config/googleApis');

// Allow super_admin, manager, team_lead with varying scope
const managerAccess = (req, res, next) => {
  if (!['super_admin', 'manager', 'team_lead'].includes(req.user.role))
    return res.status(403).json({ message: 'Access denied' });
  next();
};

router.use(auth, managerAccess);

/* ────────────────────────────── STATS ──────────────────────────────── */
router.get('/stats', async (req, res) => {
  try {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);

    const [trainers, schools, sessionsTotal, sessionsMonth, studentsAgg, unreadAudit] = await Promise.all([
      User.countDocuments({ role: 'trainer', active: true }),
      School.countDocuments({ active: true }),
      Session.countDocuments({ status: 'submitted' }),
      Session.countDocuments({ status: 'submitted', createdAt: { $gte: monthStart } }),
      Session.aggregate([{ $group: { _id: null, total: { $sum: '$students.total' } } }]),
      AuditLog.countDocuments({ notifiedTo: req.user._id, read: false }),
    ]);

    const recentSessions = await Session.find({ status: 'submitted' })
      .sort({ createdAt: -1 }).limit(5)
      .populate('trainer', 'name').populate('school', 'name district');

    res.json({
      trainers, schools, sessionsTotal, sessionsMonth,
      totalStudents: studentsAgg[0]?.total || 0,
      recentSessions, unreadAudit,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ────────────────────────── HIERARCHY ───────────────────────────────── */

// Get full org tree
router.get('/hierarchy', async (req, res) => {
  try {
    const all = await User.find({ active: true, role: { $ne: 'super_admin' } })
      .select('-password').sort({ role: 1, name: 1 });
    res.json(all);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get people under a manager/TL
router.get('/hierarchy/:userId/team', async (req, res) => {
  try {
    const target = await User.findById(req.params.userId).select('-password');
    if (!target) return res.status(404).json({ message: 'User not found' });
    const query = target.role === 'manager'
      ? { managerId: target._id }
      : { teamLeadId: target._id };
    const team = await User.find({ ...query, active: true }).select('-password');
    res.json(team);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ────────────────────────── USERS / TRAINERS ────────────────────────── */
router.get('/trainers', async (req, res) => {
  try {
    const { district, team, role, managerId, teamLeadId } = req.query;
    const filter = { role: role || 'trainer', active: true };
    if (district) filter.district = district;
    if (team) filter.team = team;
    if (managerId) filter.managerId = managerId;
    if (teamLeadId) filter.teamLeadId = teamLeadId;
    const trainers = await User.find(filter).select('-password')
      .populate('managerId', 'name email').populate('teamLeadId', 'name email')
      .sort({ district: 1, name: 1 });
    res.json(trainers);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/members', async (req, res) => {
  try {
    const members = await User.find({ active: true })
      .select('-password').populate('managerId', 'name').populate('teamLeadId', 'name')
      .sort({ role: 1, name: 1 });
    res.json(members);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/trainers', async (req, res) => {
  try {
    const { name, email, password, phone, district, employeeId, role, managerId, teamLeadId, team } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already registered' });
    const user = new User({ name, email, password, phone, district, employeeId, role: role || 'trainer', managerId, teamLeadId, team });
    await user.save();

    // Auto-provision this trainer's Drive root folder + Sheets tab immediately —
    // school subfolders (Acknowledgment Letter / Baseline Assessment / Photographs)
    // still get created lazily per-school on their first session, since we don't
    // know which schools they'll visit yet.
    if (['trainer', 'reviewer'].includes(user.role)) {
      try {
        const safeName = (name || 'Trainer').replace(/[^a-zA-Z0-9 ]/g, '').trim();
        const folder = await createDriveFolder(safeName, process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID);
        if (folder?.id) {
          user.driveFolderId  = folder.id;
          user.driveFolderUrl = folder.webViewLink;
          await user.save();
        }
      } catch (driveErr) {
        console.warn('Drive folder creation failed (non-fatal):', driveErr.message);
      }

      try {
        if (process.env.GOOGLE_SHEETS_ID) await getOrCreateTrainerSheet(process.env.GOOGLE_SHEETS_ID, name);
      } catch (sheetErr) {
        console.warn('Sheets tab creation failed (non-fatal):', sheetErr.message);
      }
    }

    res.status(201).json(user.toSafeObject());
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/trainers/:id', async (req, res) => {
  try {
    const { name, phone, district, employeeId, active, role, managerId, teamLeadId, team } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, phone, district, employeeId, active, role, managerId, teamLeadId, team },
      { new: true }
    ).select('-password').populate('managerId', 'name').populate('teamLeadId', 'name');
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* Provision Drive folder for an existing trainer who doesn't have one yet */
router.post('/trainers/:id/provision-drive', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Not found' });
    if (user.driveFolderId) return res.json({ message: 'Already provisioned', driveFolderUrl: user.driveFolderUrl });

    const safeName = (user.name || 'Trainer').replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const folder = await createDriveFolder(safeName, process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID);
    if (!folder?.id) return res.status(500).json({ message: 'Drive folder creation failed' });

    user.driveFolderId  = folder.id;
    user.driveFolderUrl = `https://drive.google.com/drive/folders/${folder.id}`;
    await user.save();
    res.json({ message: 'Drive folder created', driveFolderId: folder.id, driveFolderUrl: user.driveFolderUrl });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/trainers/:id/reset-password', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Not found' });
    user.password = req.body.password;
    await user.save();
    res.json({ message: 'Password reset' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ──────────────────────────── SCHOOLS ───────────────────────────────── */
router.get('/schools', async (req, res) => {
  try {
    const { district } = req.query;
    const filter = { active: true };
    if (district) filter.district = district;
    res.json(await School.find(filter).sort({ district: 1, name: 1 }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/schools', async (req, res) => {
  try {
    const school = new School(req.body);
    await school.save();
    res.status(201).json(school);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/schools/:id', async (req, res) => {
  try {
    const old = await School.findById(req.params.id);
    const school = await School.findByIdAndUpdate(req.params.id, req.body, { new: true });

    // Audit log if a trainer made the change
    if (req.user.role === 'trainer') {
      const changes = {};
      ['spokeContactName','spokeContactPhone','address','googleMapsLink'].forEach(f => {
        if (req.body[f] !== undefined && String(old[f]) !== String(req.body[f]))
          changes[f] = { old: old[f], new: req.body[f] };
      });
      if (Object.keys(changes).length) {
        // find managers to notify
        const managers = await User.find({ role: { $in: ['manager', 'super_admin'] } }).select('_id');
        await AuditLog.create({
          actor: req.user._id, actorName: req.user.name, actorRole: req.user.role,
          action: 'edit_school', entityType: 'School', entityId: school._id, entityName: school.name,
          changes, notifiedTo: managers.map(m => m._id),
        });
      }
    }
    res.json(school);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/schools/:id', async (req, res) => {
  try {
    await School.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ message: 'School deactivated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ──────────────────────────── ASSIGNMENTS ───────────────────────────── */
router.get('/assignments', async (req, res) => {
  try {
    const { trainerId, from, to, status, district } = req.query;
    const filter = {};
    if (trainerId) filter.trainer = trainerId;
    if (status) filter.status = status;
    if (district) {
      const trainerIds = await User.find({ district, role: 'trainer' }).distinct('_id');
      filter.trainer = { $in: trainerIds };
    }
    if (from || to) { filter.date = {}; if (from) filter.date.$gte = new Date(from); if (to) filter.date.$lte = new Date(to); }
    const assignments = await Assignment.find(filter)
      .populate('trainer', 'name phone district team')
      .populate('school', 'name district block address googleMapsLink spokeContactName spokeContactPhone spokeWhatsAppLink')
      .sort({ date: 1 });
    res.json(assignments);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/assignments', async (req, res) => {
  try {
    const a = await (new Assignment(req.body)).save();
    const p = await a.populate([
      { path: 'trainer', select: 'name phone district team' },
      { path: 'school',  select: 'name district spokeContactName spokeContactPhone spokeWhatsAppLink' },
    ]);
    res.status(201).json(p);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/assignments/:id', async (req, res) => {
  try {
    const a = await Assignment.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('trainer', 'name phone').populate('school', 'name district');
    res.json(a);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/assignments/:id', async (req, res) => {
  try { await Assignment.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

/* ──────────────────────────── SESSIONS ──────────────────────────────── */
router.get('/sessions', async (req, res) => {
  try {
    const { trainerId, schoolId, status, from, to, district } = req.query;
    const filter = {};
    if (trainerId) filter.trainer = trainerId;
    if (schoolId) filter.school = schoolId;
    if (status) filter.status = status;
    if (district) {
      const ids = await User.find({ district, role: 'trainer' }).distinct('_id');
      filter.trainer = { $in: ids };
    }
    if (from || to) { filter.date = {}; if (from) filter.date.$gte = new Date(from); if (to) filter.date.$lte = new Date(to); }
    const sessions = await Session.find(filter)
      .populate('trainer', 'name phone district team')
      .populate('school', 'name district block')
      .sort({ date: -1 });
    res.json(sessions);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/sessions/:id', async (req, res) => {
  try {
    const s = await Session.findById(req.params.id)
      .populate('trainer', 'name phone district')
      .populate('school', 'name district block address googleMapsLink principalName spokeContactName spokeContactPhone spokeWhatsAppLink');
    if (!s) return res.status(404).json({ message: 'Not found' });
    res.json(s);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/sessions/:id/review', async (req, res) => {
  try {
    const s = await Session.findByIdAndUpdate(req.params.id, { status: 'reviewed', adminNotes: req.body.notes }, { new: true });
    res.json(s);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ──────────────────────── DISTRICT SUMMARY ──────────────────────────── */
router.get('/districts', async (req, res) => {
  try {
    const districts = await User.distinct('district', { role: 'trainer', active: true });
    const summary = await Promise.all(districts.filter(Boolean).map(async (d) => {
      const trainerIds = await User.find({ district: d, role: 'trainer' }).distinct('_id');
      const sessions = await Session.countDocuments({ trainer: { $in: trainerIds }, status: 'submitted' });
      const trainers = trainerIds.length;
      return { district: d, trainers, sessions };
    }));
    res.json(summary.sort((a, b) => a.district.localeCompare(b.district)));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
