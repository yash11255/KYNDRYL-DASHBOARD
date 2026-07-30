require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const School = require('./models/School');
const Assignment = require('./models/Assignment');
const Session = require('./models/Session');

const ASSESSMENT_RESPONSES = [
  { question: 'Have you heard about Artificial Intelligence (AI)?', answer: 'Yes' },
  { question: 'In your own words, what do you think AI is?', answer: 'AI is when computers can think and learn like humans' },
  { question: 'Do you use a smartphone regularly?', answer: 'Yes, daily' },
  { question: 'Which of these tools have you used?', answer: 'YouTube, Google Maps' },
  { question: 'What do you think AI is mainly used for?', answer: 'Healthcare & Education' },
  { question: 'Are you aware of online safety / cybersecurity?', answer: 'Somewhat aware' },
  { question: 'Have you ever made a digital payment?', answer: 'Tried once or twice' },
  { question: 'How comfortable are you with using computers or tablets?', answer: 'Somewhat comfortable' },
  { question: 'Have you ever tried coding or programming?', answer: 'No' },
  { question: 'What career are you interested in?', answer: 'Engineering or Technology' },
  { question: 'What do you expect to learn from today\'s AI Pathshala session?', answer: 'How AI works and how it can help us in future' },
  { question: 'Do you think AI will affect your future career?', answer: 'Yes, positively' },
];

const FULL_CHECKLIST = {
  venueConfirmed: true,
  equipmentTested: true,
  materialsReady: true,
  introductionDone: true,
  baselineAssessmentDone: true,
  mainContentDelivered: true,
  activityConducted: true,
  qnaDone: true,
  feedbackCollected: true,
  acknowledgmentSigned: true,
  photosUploaded: true,
  reportFilled: true,
};

const PARTIAL_CHECKLIST = {
  venueConfirmed: true,
  equipmentTested: true,
  materialsReady: true,
  introductionDone: true,
  baselineAssessmentDone: true,
  mainContentDelivered: true,
  activityConducted: false,
  qnaDone: true,
  feedbackCollected: false,
  acknowledgmentSigned: true,
  photosUploaded: true,
  reportFilled: false,
};

const fakePhoto = (tag, lat, lon) => ({
  filename: `${tag}-${Date.now()}.jpg`,
  url: `http://localhost:5001/uploads/placeholder-${tag}.jpg`,
  latitude: lat,
  longitude: lon,
  capturedAt: new Date(),
  tag,
});

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas\n');

  const priya = await User.findOne({ email: 'priya@bharatcares.in' });
  if (!priya) { console.error('Priya not found — run seed.js first'); process.exit(1); }

  const schools = await School.find({ active: true });
  if (schools.length < 2) { console.error('Need at least 2 schools — run seed.js first'); process.exit(1); }

  const [sanganer, kishangarh, phulera] = schools;

  // Clean existing sessions/assignments for Priya
  await Assignment.deleteMany({ trainer: priya._id });
  await Session.deleteMany({ trainer: priya._id });
  console.log('Cleared old data for Priya\n');

  const today = new Date();
  const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); d.setHours(10, 0, 0, 0); return d; };
  const daysFromNow = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); d.setHours(10, 0, 0, 0); return d; };

  // ── Assignment 1: Completed session 8 days ago at Sanganer ──────────────
  const a1 = await Assignment.create({ trainer: priya._id, school: sanganer._id, date: daysAgo(8), topic: 'AI Pathshala — Module 1: What is AI?', expectedStudents: 60, status: 'completed' });
  const s1 = await Session.create({
    assignment: a1._id, trainer: priya._id, school: sanganer._id, date: daysAgo(8), status: 'submitted',
    checkIn: { time: new Date(daysAgo(8).setHours(9, 45, 0)), latitude: 26.7921, longitude: 75.8124, locationName: 'Sanganer, Jaipur', photo: fakePhoto('checkin', 26.7921, 75.8124) },
    sessionPhotos: [
      fakePhoto('session', 26.7921, 75.8124),
      fakePhoto('session', 26.7922, 75.8125),
      fakePhoto('session', 26.7920, 75.8123),
    ],
    students: { male: 32, female: 28, total: 60, grades: [{ grade: 'Class 9', count: 30 }, { grade: 'Class 10', count: 30 }] },
    assessment: { submitted: true, submittedAt: daysAgo(8), responses: ASSESSMENT_RESPONSES },
    acknowledgment: { uploaded: true, photo: fakePhoto('acknowledgment', 26.7921, 75.8124), signedBy: 'Mr. Ashok Verma', designation: 'Principal' },
    travel: { baseLocation: 'Hotel Rajputana, Jaipur', baseLatitude: 26.9124, baseLongitude: 75.7873, kmTravelled: 18.4, transportMode: 'bike', fuelBills: [fakePhoto('fuel', 26.9124, 75.7873)], fuelAmount: 120, travelNotes: 'Smooth ride, found school easily' },
    checklist: FULL_CHECKLIST,
    submitTime: daysAgo(8),
    sheetsRowUpdated: false,
  });
  console.log(`✅ Session 1 (Submitted): Sanganer — 60 students, ${daysAgo(8).toDateString()}`);

  // ── Assignment 2: Completed session 5 days ago at Kishangarh ─────────────
  const a2 = await Assignment.create({ trainer: priya._id, school: kishangarh._id, date: daysAgo(5), topic: 'AI Pathshala — Module 2: AI in Daily Life', expectedStudents: 45, status: 'completed' });
  const s2 = await Session.create({
    assignment: a2._id, trainer: priya._id, school: kishangarh._id, date: daysAgo(5), status: 'submitted',
    checkIn: { time: new Date(daysAgo(5).setHours(10, 10, 0)), latitude: 26.5988, longitude: 74.8611, locationName: 'Kishangarh, Ajmer', photo: fakePhoto('checkin', 26.5988, 74.8611) },
    sessionPhotos: [
      fakePhoto('session', 26.5988, 74.8611),
      fakePhoto('session', 26.5989, 74.8612),
    ],
    students: { male: 18, female: 27, total: 45, grades: [{ grade: 'Class 8', count: 20 }, { grade: 'Class 9', count: 25 }] },
    assessment: { submitted: true, submittedAt: daysAgo(5), responses: ASSESSMENT_RESPONSES },
    acknowledgment: { uploaded: true, photo: fakePhoto('acknowledgment', 26.5988, 74.8611), signedBy: 'Mrs. Sunita Joshi', designation: 'Principal' },
    travel: { baseLocation: 'Dharamshala Guest House, Kishangarh', baseLatitude: 26.6010, baseLongitude: 74.8620, kmTravelled: 72.3, transportMode: 'bike', fuelBills: [fakePhoto('fuel', 26.6010, 74.8620), fakePhoto('fuel', 26.6010, 74.8620)], fuelAmount: 380, travelNotes: 'Long ride from Jaipur base. Road construction near bypass slowed down.' },
    checklist: FULL_CHECKLIST,
    submitTime: daysAgo(5),
    sheetsRowUpdated: false,
  });
  console.log(`✅ Session 2 (Submitted): Kishangarh — 45 students, ${daysAgo(5).toDateString()}`);

  // ── Assignment 3: In-progress session 2 days ago at Phulera (partially filled) ──
  const a3 = await Assignment.create({ trainer: priya._id, school: phulera._id, date: daysAgo(2), topic: 'AI Pathshala — Module 3: Digital Safety', expectedStudents: 70, status: 'scheduled' });
  const s3 = await Session.create({
    assignment: a3._id, trainer: priya._id, school: phulera._id, date: daysAgo(2), status: 'in-progress',
    checkIn: { time: new Date(daysAgo(2).setHours(10, 30, 0)), latitude: 27.0261, longitude: 75.2436, locationName: 'Phulera, Jaipur', photo: fakePhoto('checkin', 27.0261, 75.2436) },
    sessionPhotos: [
      fakePhoto('session', 27.0261, 75.2436),
      fakePhoto('session', 27.0262, 75.2437),
      fakePhoto('session', 27.0260, 75.2435),
      fakePhoto('session', 27.0261, 75.2438),
    ],
    students: { male: 38, female: 32, total: 70, grades: [{ grade: 'Class 9', count: 35 }, { grade: 'Class 10', count: 35 }] },
    assessment: { submitted: true, submittedAt: daysAgo(2), responses: ASSESSMENT_RESPONSES },
    // Acknowledgment not yet uploaded
    acknowledgment: { uploaded: false },
    travel: { baseLocation: '', kmTravelled: 0, transportMode: 'bike', fuelAmount: 0, fuelBills: [] },
    checklist: PARTIAL_CHECKLIST,
  });
  console.log(`⏳ Session 3 (In-Progress): Phulera — 70 students, ${daysAgo(2).toDateString()} — acknowledgment pending`);

  // ── Assignment 4: Today's session (not started) ──────────────────────────
  const a4 = await Assignment.create({ trainer: priya._id, school: sanganer._id, date: today, topic: 'AI Pathshala — Module 4: Careers in AI', expectedStudents: 55, notes: 'Bring extra handouts. Principal requested demo of ChatGPT.', status: 'scheduled' });
  console.log(`📅 Session 4 (Scheduled Today): Sanganer — ${today.toDateString()}`);

  // ── Assignment 5: Tomorrow ───────────────────────────────────────────────
  const a5 = await Assignment.create({ trainer: priya._id, school: kishangarh._id, date: daysFromNow(2), topic: 'AI Pathshala — Module 2: AI in Daily Life', expectedStudents: 40, status: 'scheduled' });
  console.log(`📅 Session 5 (Scheduled): Kishangarh — ${daysFromNow(2).toDateString()}`);

  // ── Assignment 6: Next week ──────────────────────────────────────────────
  const a6 = await Assignment.create({ trainer: priya._id, school: phulera._id, date: daysFromNow(5), topic: 'AI Pathshala — Module 1: What is AI?', expectedStudents: 65, status: 'scheduled' });
  console.log(`📅 Session 6 (Scheduled): Phulera — ${daysFromNow(5).toDateString()}`);

  console.log('\n──────────────────────────────────────');
  console.log('Seed complete for Priya Sharma!');
  console.log('Login: priya@bharatcares.in / Trainer@123');
  console.log('──────────────────────────────────────\n');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
