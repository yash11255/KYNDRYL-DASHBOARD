const router = require('express').Router();
const AssessmentTemplate = require('../models/AssessmentTemplate');
const { auth } = require('../middleware/auth');

const ADMIN_ROLES = ['super_admin', 'manager', 'team_lead'];

/* GET / — return active template (no auth required for trainers) */
router.get('/', auth, async (req, res) => {
  try {
    const template = await AssessmentTemplate.findOne({ isActive: true })
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ version: -1 });
    if (!template) return res.json(null);
    res.json(template);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* GET /all — admin only — list all versions */
router.get('/all', auth, async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role))
      return res.status(403).json({ message: 'Admin only' });
    const templates = await AssessmentTemplate.find()
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ version: -1 });
    res.json(templates);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* PUT / — admin only — replace questions, increment version, mark active */
router.put('/', auth, async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role))
      return res.status(403).json({ message: 'Admin only' });

    const { questions } = req.body;
    if (!Array.isArray(questions))
      return res.status(400).json({ message: 'questions must be an array' });

    // Deactivate all existing templates
    await AssessmentTemplate.updateMany({}, { isActive: false });

    // Find latest version number
    const latest = await AssessmentTemplate.findOne().sort({ version: -1 });
    const nextVersion = latest ? latest.version + 1 : 1;

    const template = await AssessmentTemplate.create({
      questions: questions.map((q, i) => ({
        order: q.order ?? i + 1,
        type: q.type,
        question: q.question,
        options: q.options || [],
        isRequired: q.isRequired || false,
      })),
      version: nextVersion,
      isActive: true,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    const populated = await template.populate([
      { path: 'createdBy', select: 'name' },
      { path: 'updatedBy', select: 'name' },
    ]);
    res.json(populated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
