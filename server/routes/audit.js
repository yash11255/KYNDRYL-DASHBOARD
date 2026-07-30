const router = require('express').Router();
const AuditLog = require('../models/AuditLog');
const { auth, adminOnly } = require('../middleware/auth');

router.use(auth);

/* Log a change (called internally from other routes too, exported as helper) */
router.post('/', async (req, res) => {
  try {
    const log = new AuditLog({
      actor: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      ...req.body,
    });
    await log.save();
    res.status(201).json(log);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* My recent actions */
router.get('/mine', async (req, res) => {
  try {
    const logs = await AuditLog.find({ actor: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json(logs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* All logs (admin/manager) */
router.get('/', async (req, res) => {
  try {
    if (!['super_admin', 'manager', 'team_lead'].includes(req.user.role))
      return res.status(403).json({ message: 'Access denied' });
    const { actorId, entityType, from, to } = req.query;
    const filter = {};
    if (actorId) filter.actor = actorId;
    if (entityType) filter.entityType = entityType;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }
    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(200)
      .populate('actor', 'name role');
    res.json(logs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* Unread count for manager */
router.get('/unread-count', async (req, res) => {
  try {
    const count = await AuditLog.countDocuments({ notifiedTo: req.user._id, read: false });
    res.json({ count });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* Mark all read */
router.put('/mark-read', async (req, res) => {
  try {
    await AuditLog.updateMany({ notifiedTo: req.user._id, read: false }, { read: true });
    res.json({ message: 'Marked as read' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
