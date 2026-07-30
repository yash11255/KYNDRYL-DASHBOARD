const router = require('express').Router();
const DailyExpense = require('../models/DailyExpense');
const Session = require('../models/Session');
const { auth } = require('../middleware/auth');

router.use(auth);

const getOrCreate = async (trainerId, date, district) => {
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);
  let rec = await DailyExpense.findOne({ trainer: trainerId, date: { $gte: dayStart, $lte: dayEnd } });
  if (!rec) {
    rec = new DailyExpense({ trainer: trainerId, date: dayStart, district: district || '', food: [], transportation: [] });
    await rec.save();
  } else if (!Array.isArray(rec.food)) {
    // Migrate old {breakfast,lunch,dinner} object to flat array
    const old = rec.food || {};
    rec.food = [...(old.breakfast || []), ...(old.lunch || []), ...(old.dinner || [])];
    await rec.save();
  }
  return rec;
};

/* ── My expenses ── */
router.get('/mine', async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { trainer: req.user._id };
    if (from || to) { filter.date = {}; if (from) filter.date.$gte = new Date(from); if (to) filter.date.$lte = new Date(to); }
    res.json(await DailyExpense.find(filter).sort({ date: -1 }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── Single day (get or create) ── */
router.get('/day/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const rec  = await getOrCreate(req.user._id, date, req.user.district);

    // Attach fuel bills from sessions that day
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);
    const sessions = await Session.find({ trainer: req.user._id, date: { $gte: dayStart, $lte: dayEnd } }).populate('school', 'name');
    const fuelBills = sessions.flatMap(s =>
      (s.travel?.fuelBills || []).map(f => ({ ...f, sessionId: s._id, schoolName: s.school?.name, totalFuelAmount: s.travel?.fuelAmount || 0 }))
    );
    const totalFuel = sessions.reduce((sum, s) => sum + (s.travel?.fuelAmount || 0), 0);

    const foodArr = Array.isArray(rec.food) ? rec.food : [];
    const totalFood = foodArr.reduce((s, b) => s + (b.amount || 0), 0);
    res.json({ ...rec.toObject(), food: foodArr, totalFood, fuelBills, totalFuel });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── Add a bill ── */
// category: 'food' | 'transportation'
router.post('/day/:date/bill', async (req, res) => {
  try {
    const { category, name, amount, mealType, billPhoto, paymentProof, attachment, time, remarks } = req.body;
    if (!['food', 'transportation'].includes(category))
      return res.status(400).json({ message: 'Invalid category — use food or transportation' });

    const rec  = await getOrCreate(req.user._id, new Date(req.params.date), req.user.district);
    const bill = {
      name, amount: Number(amount) || 0, remarks,
      mealType: category === 'food' ? mealType : undefined,
      billPhoto:    billPhoto    || attachment || undefined,
      paymentProof: paymentProof || undefined,
      attachment:   billPhoto    || attachment || undefined,  // backward-compat
      time: time ? new Date(time) : new Date(),
    };

    if (category === 'transportation') rec.transportation.push(bill);
    else rec.food.push(bill);

    await rec.save();
    res.json(rec);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── Remove a bill ── */
router.delete('/day/:date/bill/:category/:billId', async (req, res) => {
  try {
    const { category, billId } = req.params;
    const date  = new Date(req.params.date);
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);
    const rec   = await DailyExpense.findOne({ trainer: req.user._id, date: { $gte: start, $lte: end } });
    if (!rec) return res.status(404).json({ message: 'Not found' });

    if (category === 'transportation') rec.transportation = rec.transportation.filter(b => b._id.toString() !== billId);
    else rec.food = rec.food.filter(b => b._id.toString() !== billId);

    await rec.save();
    res.json(rec);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── Summary (manager view) ── */
router.get('/summary/:trainerId', async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { trainer: req.params.trainerId };
    if (from) filter.date = { $gte: new Date(from) };
    if (to)   filter.date = { ...filter.date, $lte: new Date(to) };
    const records = await DailyExpense.find(filter).sort({ date: 1 });
    const totalFood      = records.reduce((s, r) => s + r.totalFood, 0);
    const totalTransport = records.reduce((s, r) => s + r.totalTransportation, 0);
    res.json({ records, totalFood, totalTransport, grandTotal: totalFood + totalTransport });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
