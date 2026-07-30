const router = require('express').Router();
const BaseStay = require('../models/BaseStay');
const { auth } = require('../middleware/auth');

router.use(auth);

// Get my base stays
router.get('/mine', async (req, res) => {
  try {
    const stays = await BaseStay.find({ trainer: req.user._id, active: true }).sort({ checkInDate: -1 });
    res.json(stays);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get base stays for a district (admin/manager)
router.get('/district/:district', async (req, res) => {
  try {
    const stays = await BaseStay.find({ district: req.params.district, active: true })
      .populate('trainer', 'name phone employeeId').sort({ checkInDate: -1 });
    res.json(stays);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get single stay
router.get('/:id', async (req, res) => {
  try {
    const stay = await BaseStay.findById(req.params.id).populate('trainer', 'name phone');
    if (!stay) return res.status(404).json({ message: 'Not found' });
    res.json(stay);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create base stay
router.post('/', async (req, res) => {
  try {
    const stay = new BaseStay({ ...req.body, trainer: req.user._id });
    await stay.save();
    res.status(201).json(stay);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Update base stay
router.put('/:id', async (req, res) => {
  try {
    const stay = await BaseStay.findOneAndUpdate(
      { _id: req.params.id, trainer: req.user._id },
      req.body,
      { new: true }
    );
    if (!stay) return res.status(404).json({ message: 'Not found or not yours' });
    res.json(stay);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Add payment screenshot to a stay
router.post('/:id/payment', async (req, res) => {
  try {
    const { filename, url, amount } = req.body;
    const stay = await BaseStay.findOneAndUpdate(
      { _id: req.params.id, trainer: req.user._id },
      {
        $push: { paymentScreenshots: { filename, url, amount: Number(amount) || 0 } },
        $inc:  { totalAmount: Number(amount) || 0 },
      },
      { new: true }
    );
    if (!stay) return res.status(404).json({ message: 'Not found' });
    res.json(stay);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete (deactivate)
router.delete('/:id', async (req, res) => {
  try {
    await BaseStay.findOneAndUpdate({ _id: req.params.id, trainer: req.user._id }, { active: false });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
