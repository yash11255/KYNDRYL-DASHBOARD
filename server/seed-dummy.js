/**
 * Dummy data seed — creates realistic sessions with PDFs for testing
 * Run: node seed-dummy.js
 */
require('dotenv').config();
const mongoose   = require('mongoose');
const path       = require('path');
const fs         = require('fs');
const PDFDocument = require('pdfkit');

const User       = require('./models/User');
const School     = require('./models/School');
const Assignment = require('./models/Assignment');
const Session    = require('./models/Session');
const AssessmentTemplate = require('./models/AssessmentTemplate');

/* ── re-use server PDF helpers ── */
const UPLOADS   = path.join(__dirname, 'uploads');
const ASSETS    = path.join(__dirname, 'assets');
const LOGO_PATH = path.join(ASSETS, 'bharat-cares-logo.png');
const NAVY = '#0f2d6b', BC_BLUE = '#1b9cd9', BC_GREEN = '#78be20', GRAY = '#64748b', LIGHT = '#f8fafc';
const PG_W = 495;

function drawBrandHeader(doc, title, subtitle) {
  doc.rect(50, 40, PG_W, 5).fill(NAVY);
  doc.moveDown(0.5);
  const logoH = 44;
  let logoW = 0;
  if (fs.existsSync(LOGO_PATH)) {
    try { doc.image(LOGO_PATH, 50, 52, { height: logoH }); logoW = Math.round(logoH * (560 / 160)); } catch { logoW = 0; }
  }
  if (logoW === 0) {
    doc.fontSize(20).font('Helvetica-Bold').fillColor(BC_BLUE).text('Bharat', 50, 54, { continued: true });
    doc.fillColor(BC_GREEN).text('Cares'); logoW = 120;
  }
  const tX = 50 + logoW + 12;
  doc.fontSize(15).font('Helvetica-Bold').fillColor(NAVY).text(title, tX, 52, { width: PG_W - logoW - 12, align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor(GRAY).text(subtitle || 'AI Pathshala — Bharat Cares × Kyndryl', tX, 72, { width: PG_W - logoW - 12, align: 'right' });
  doc.y = 52 + logoH + 14;
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(NAVY).lineWidth(1.5).stroke();
  doc.moveDown(0.8);
}
function drawFooter(doc, label) {
  const y = doc.page.height - 36;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.fontSize(8).font('Helvetica').fillColor(GRAY).text(label || 'AI Pathshala — Bharat Cares × Kyndryl', 50, y + 6, { width: PG_W, align: 'center' });
}

async function makeAckPdf(imgFilename, pdfFilename, ctx) {
  const imgPath = path.join(UPLOADS, imgFilename);
  const pdfPath = path.join(UPLOADS, pdfFilename);
  const dateStr = ctx.date ? new Date(ctx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    doc.pipe(fs.createWriteStream(pdfPath));
    drawBrandHeader(doc, 'Acknowledgment Letter', `${ctx.schoolName || ''} · ${dateStr}`);
    doc.rect(50, doc.y, PG_W, 56).fill(LIGHT).stroke('#e2e8f0');
    const iy = doc.y + 10;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY).text('School:', 62, iy);
    doc.font('Helvetica').fillColor('#1e293b').text(ctx.schoolName || '', 122, iy);
    doc.font('Helvetica-Bold').fillColor(NAVY).text('Trainer:', 62, iy + 18);
    doc.font('Helvetica').fillColor('#1e293b').text(ctx.trainerName || '', 122, iy + 18);
    doc.font('Helvetica-Bold').fillColor(NAVY).text('Date:', 310, iy);
    doc.font('Helvetica').fillColor('#1e293b').text(dateStr, 370, iy);
    doc.font('Helvetica-Bold').fillColor(NAVY).text('Signed By:', 310, iy + 18);
    doc.font('Helvetica').fillColor('#1e293b').text(ctx.signedBy || 'Principal', 390, iy + 18);
    doc.y = iy + 56; doc.moveDown(0.6);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(GRAY).text('ORIGINAL ACKNOWLEDGMENT LETTER', { align: 'center' });
    doc.moveDown(0.4);
    try { doc.image(imgPath, 50, doc.y, { fit: [PG_W, doc.page.height - doc.y - 70], align: 'center' }); } catch {}
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) { doc.switchToPage(range.start + i); drawFooter(doc, pdfFilename); }
    doc.end();
    doc._stream?.on('finish', () => resolve(pdfPath));
    doc.pipe.__proto__; // trigger
    setTimeout(() => resolve(pdfPath), 2000);
  });
}

async function makeAssessmentPdf(pdfFilename, ctx, responses) {
  const pdfPath = path.join(UPLOADS, pdfFilename);
  const dateStr = new Date(ctx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const ws = fs.createWriteStream(pdfPath);
    doc.pipe(ws);
    drawBrandHeader(doc, 'Baseline Assessment', `${ctx.schoolName} · ${dateStr}`);
    doc.rect(50, doc.y, PG_W, 56).fill(LIGHT).stroke('#e2e8f0');
    const iy = doc.y + 10;
    doc.fontSize(10.5).font('Helvetica-Bold').fillColor(NAVY).text('School:', 62, iy);
    doc.font('Helvetica').fillColor('#1e293b').text(ctx.schoolName, 122, iy);
    doc.font('Helvetica-Bold').fillColor(NAVY).text('Block:', 62, iy + 18);
    doc.font('Helvetica').fillColor('#1e293b').text(ctx.block || '—', 122, iy + 18);
    doc.font('Helvetica-Bold').fillColor(NAVY).text('Trainer:', 310, iy);
    doc.font('Helvetica').fillColor('#1e293b').text(ctx.trainerName, 370, iy);
    doc.font('Helvetica-Bold').fillColor(NAVY).text('Date:', 310, iy + 18);
    doc.font('Helvetica').fillColor('#1e293b').text(dateStr, 370, iy + 18);
    doc.y = iy + 56; doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke(); doc.moveDown(0.6);
    responses.forEach((r, idx) => {
      if (doc.y > doc.page.height - 150) { doc.addPage(); doc.moveDown(1); }
      doc.rect(50, doc.y, 22, 22).fill(NAVY);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#fff').text(`${idx + 1}`, 50, doc.y + 5, { width: 22, align: 'center' });
      const qY = doc.y + 3;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text(r.question, 80, qY, { width: PG_W - 30 });
      doc.moveDown(0.4);
      if (r.type === 'mcq') {
        (r.options || []).forEach((opt, oi) => {
          const sel = oi === r.selectedOption;
          if (sel) doc.rect(76, doc.y - 2, PG_W - 26, 18).fill('#dbeafe').stroke('#bfdbfe');
          doc.fontSize(10.5).font(sel ? 'Helvetica-Bold' : 'Helvetica').fillColor(sel ? NAVY : '#475569')
             .text(`  ${sel ? '◉' : '○'}  ${opt}`, 80, doc.y, { width: PG_W - 30 });
          doc.moveDown(0.25);
        });
      } else {
        doc.rect(76, doc.y - 2, PG_W - 26, 22).fill('#f0fdf4').stroke('#bbf7d0');
        doc.fontSize(10.5).font('Helvetica').fillColor('#166534').text(`  ${r.answer}`, 80, doc.y + 2, { width: PG_W - 30 });
      }
      doc.moveDown(0.9);
    });
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) { doc.switchToPage(range.start + i); drawFooter(doc, pdfFilename); }
    doc.end();
    ws.on('finish', () => resolve(pdfPath));
    ws.on('error', () => resolve(pdfPath));
  });
}

/* ── SAMPLE DATA ── */
const SCHOOLS_DATA = [
  { name: 'COMPOSITE PMV GAHIRA',       block: 'Kharobar', district: 'Gorakhpur', latitude: 26.7505, longitude: 83.3732 },
  { name: 'COMPOSITE PMV SIKTAUR',      block: 'Kharobar', district: 'Gorakhpur', latitude: 26.7612, longitude: 83.3801 },
  { name: 'P.M.V., LALPURTIKAR',        block: 'Kharobar', district: 'Gorakhpur', latitude: 26.7450, longitude: 83.3655 },
  { name: 'COMPOSITE PMV NARAYANPUR',   block: 'Charganwa', district: 'Gorakhpur', latitude: 26.7200, longitude: 83.4100 },
  { name: 'COMPOSITE PMV JUNGLE SHALIGRAM', block: 'Nagar Kshetra', district: 'Gorakhpur', latitude: 26.7634, longitude: 83.3700 },
];

const TRAINERS_DATA = [
  { name: 'Yash Singh',    email: 'yash@bharatcares.in',    password: 'Trainer@123', phone: '9876540001', district: 'Gorakhpur', employeeId: 'TR003' },
  { name: 'Harshal Patel', email: 'harshal@bharatcares.in', password: 'Trainer@123', phone: '9876540002', district: 'Gorakhpur', employeeId: 'TR004' },
  { name: 'Sourabh Pandey',email: 'sourabh@bharatcares.in', password: 'Trainer@123', phone: '9876540003', district: 'Gorakhpur', employeeId: 'TR005' },
];

const ASSESSMENT_QUESTIONS = [
  {
    order: 1, type: 'text', isRequired: true,
    question: 'What is Artificial Intelligence in your own words?',
  },
  {
    order: 2, type: 'mcq', isRequired: true,
    question: 'Have you heard about AI before this session?',
    options: ['Yes, I use it regularly', 'Yes, I have heard about it', 'No, this is my first time', 'Not sure'],
  },
  {
    order: 3, type: 'mcq', isRequired: true,
    question: 'Which AI tool have you used before?',
    options: ['ChatGPT', 'Google Gemini', 'None', 'Other'],
  },
  {
    order: 4, type: 'text', isRequired: false,
    question: 'How do you think AI can help students in rural areas?',
  },
  {
    order: 5, type: 'mcq', isRequired: true,
    question: 'After this session, how confident are you about AI?',
    options: ['Very confident', 'Somewhat confident', 'Not confident yet', 'Need more sessions'],
  },
  {
    order: 6, type: 'text', isRequired: false,
    question: 'What topic from today\'s session was most interesting?',
  },
  {
    order: 7, type: 'mcq', isRequired: false,
    question: 'Would you like to attend more AI sessions?',
    options: ['Definitely yes', 'Yes if it helps academics', 'Maybe', 'No'],
  },
];

const SESSION_TEMPLATES = [
  {
    trainerIdx: 0, schoolIdx: 0,
    daysAgo: 3, checkInHour: 9, checkOutHour: 11,
    lat: 26.7505, lon: 83.3732,
    locationName: 'COMPOSITE PMV GAHIRA, Kharobar, Gorakhpur',
    students: { male: 35, female: 28, total: 63, grades: [{grade:'6',count:22},{grade:'7',count:21},{grade:'8',count:20}] },
    ackImg: 'dummy_ack_priya.jpg', signedBy: 'Shri Ram Prasad', designation: 'Principal',
    sessionPhotos: [
      { file: 'dummy_session1_priya.jpg', lat: 26.7505, lon: 83.3732, loc: 'School Ground, COMPOSITE PMV GAHIRA' },
      { file: 'dummy_session2_priya.jpg', lat: 26.7506, lon: 83.3733, loc: 'Classroom, COMPOSITE PMV GAHIRA' },
      { file: 'dummy_session3_priya.jpg', lat: 26.7504, lon: 83.3731, loc: 'Assembly Hall, COMPOSITE PMV GAHIRA' },
    ],
    assessment: [
      { q: 0, answer: 'AI is the ability of machines to think and learn like humans. It can help us solve many problems.' },
      { q: 1, selectedOption: 1, selectedLabel: 'Yes, I have heard about it' },
      { q: 2, selectedOption: 2, selectedLabel: 'None' },
      { q: 3, answer: 'AI can help students access better learning materials and get answers to questions even without teachers.' },
      { q: 4, selectedOption: 0, selectedLabel: 'Very confident' },
      { q: 5, answer: 'The demonstration of ChatGPT was most interesting. Students asked many questions.' },
      { q: 6, selectedOption: 0, selectedLabel: 'Definitely yes' },
    ],
    atlStatus: 'YES', feedback: 'Students were eager to learn new things. Looking forward for Hands-on stuffs. Very cooperative staff.',
    teacherWilling: 'YES',
    travelBase: 'Hotel Sunrise, Gorakhpur', travelKm: 28, transportMode: 'bike',
  },
  {
    trainerIdx: 0, schoolIdx: 2,
    daysAgo: 2, checkInHour: 10, checkOutHour: 12,
    lat: 26.7450, lon: 83.3655,
    locationName: 'P.M.V., LALPURTIKAR, Kharobar, Gorakhpur',
    students: { male: 4, female: 6, total: 10, grades: [{grade:'7',count:5},{grade:'8',count:5}] },
    ackImg: 'dummy_ack_priya2.jpg', signedBy: 'Smt. Sunita Devi', designation: 'HM',
    sessionPhotos: [
      { file: 'dummy_session1_priya2.jpg', lat: 26.7450, lon: 83.3655, loc: 'P.M.V. LALPURTIKAR Classroom' },
    ],
    assessment: [
      { q: 0, answer: 'Artificial Intelligence means computers that can think and make decisions.' },
      { q: 1, selectedOption: 2, selectedLabel: 'No, this is my first time' },
      { q: 2, selectedOption: 2, selectedLabel: 'None' },
      { q: 3, answer: 'AI can provide educational videos and smart learning apps.' },
      { q: 4, selectedOption: 1, selectedLabel: 'Somewhat confident' },
      { q: 5, answer: 'Story of how AI is used in hospitals.' },
      { q: 6, selectedOption: 1, selectedLabel: 'Yes if it helps academics' },
    ],
    atlStatus: 'NO', feedback: 'Less participation but willing to learn more. Only 10 students attended.',
    teacherWilling: 'NO',
    travelBase: 'Hotel Sunrise, Gorakhpur', travelKm: 22, transportMode: 'bike',
  },
  {
    trainerIdx: 1, schoolIdx: 4,
    daysAgo: 1, checkInHour: 9, checkOutHour: 11,
    lat: 26.7634, lon: 83.3700,
    locationName: 'COMPOSITE PMV JUNGLE SHALIGRAM, Nagar Kshetra, Gorakhpur',
    students: { male: 40, female: 45, total: 85, grades: [{grade:'6',count:22},{grade:'7',count:22},{grade:'8',count:22},{grade:'9',count:19}] },
    ackImg: 'dummy_ack_ravi.jpg', signedBy: 'Shri K.K. Sharma', designation: 'Principal',
    sessionPhotos: [
      { file: 'dummy_session1_ravi.jpg', lat: 26.7634, lon: 83.3700, loc: 'Main Hall, COMPOSITE PMV JUNGLE SHALIGRAM' },
      { file: 'dummy_session2_ravi.jpg', lat: 26.7635, lon: 83.3701, loc: 'Garden, COMPOSITE PMV JUNGLE SHALIGRAM' },
    ],
    assessment: [
      { q: 0, answer: 'AI is technology that lets machines learn from data and make smart decisions without human help.' },
      { q: 1, selectedOption: 0, selectedLabel: 'Yes, I use it regularly' },
      { q: 2, selectedOption: 0, selectedLabel: 'ChatGPT' },
      { q: 3, answer: 'AI can help by providing personalized learning and answering student queries instantly.' },
      { q: 4, selectedOption: 0, selectedLabel: 'Very confident' },
      { q: 5, answer: 'AI in healthcare was very interesting for students.' },
      { q: 6, selectedOption: 0, selectedLabel: 'Definitely yes' },
    ],
    atlStatus: 'NO', feedback: 'Session was good and interactive. Students were eager to learn about AI. Very good engagement.',
    teacherWilling: 'NO',
    travelBase: 'Hotel Grand, Gorakhpur', travelKm: 14, transportMode: 'auto',
  },
  {
    trainerIdx: 2, schoolIdx: 1,
    daysAgo: 1, checkInHour: 8, checkOutHour: 10,
    lat: 26.7612, lon: 83.3801,
    locationName: 'COMPOSITE PMV SIKTAUR, Kharobar, Gorakhpur',
    students: { male: 42, female: 38, total: 80, grades: [{grade:'7',count:28},{grade:'8',count:27},{grade:'9',count:25}] },
    ackImg: 'dummy_ack_priya.jpg', signedBy: 'Shri Mohan Lal', designation: 'Head Master',
    sessionPhotos: [
      { file: 'dummy_session1_priya.jpg', lat: 26.7612, lon: 83.3801, loc: 'COMPOSITE PMV SIKTAUR, Gorakhpur' },
      { file: 'dummy_session2_priya.jpg', lat: 26.7613, lon: 83.3802, loc: 'Classroom Block A' },
    ],
    assessment: [
      { q: 0, answer: 'AI is like a smart robot brain that can learn and solve problems.' },
      { q: 1, selectedOption: 1, selectedLabel: 'Yes, I have heard about it' },
      { q: 2, selectedOption: 1, selectedLabel: 'Google Gemini' },
      { q: 3, answer: 'AI can bring quality education through smart apps and voice assistants.' },
      { q: 4, selectedOption: 1, selectedLabel: 'Somewhat confident' },
      { q: 5, answer: 'How AI can help farmers was very interesting.' },
      { q: 6, selectedOption: 0, selectedLabel: 'Definitely yes' },
    ],
    atlStatus: 'NO', feedback: 'GREAT INFRA AND HM IS GREAT. Students were highly motivated and asking great questions about AI applications.',
    teacherWilling: 'YES',
    travelBase: 'Hotel Comfort, Gorakhpur', travelKm: 19, transportMode: 'bike',
  },
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  /* ── 1. Ensure schools exist ── */
  console.log('📍 Creating schools...');
  const schoolIds = [];
  const mgr = await User.findOne({ role: 'manager' });

  for (const sd of SCHOOLS_DATA) {
    let s = await School.findOne({ name: sd.name });
    if (!s) {
      s = await School.create({ ...sd, address: `${sd.block}, ${sd.district}, UP`, active: true });
      console.log(`   Created: ${s.name}`);
    } else {
      console.log(`   Exists:  ${s.name}`);
    }
    schoolIds.push(s._id);
  }

  /* ── 2. Ensure trainers exist ── */
  console.log('\n👤 Creating trainers...');
  const trainerIds = [];
  for (const td of TRAINERS_DATA) {
    let t = await User.findOne({ email: td.email });
    if (!t) {
      t = await User.create({ ...td, role: 'trainer', managerId: mgr?._id, active: true });
      console.log(`   Created: ${t.name} (${t.email}) pwd: Trainer@123`);
    } else {
      console.log(`   Exists:  ${t.name}`);
    }
    trainerIds.push(t._id);
  }

  /* ── 3. Create assessment template ── */
  console.log('\n📋 Setting up assessment template...');
  await AssessmentTemplate.updateMany({}, { isActive: false });
  const superAdmin = await User.findOne({ role: 'super_admin' });
  const template = await AssessmentTemplate.create({
    questions: ASSESSMENT_QUESTIONS,
    version: 1, isActive: true,
    createdBy: superAdmin?._id, updatedBy: superAdmin?._id,
  });
  console.log(`   Template v${template.version}: ${template.questions.length} questions`);

  /* ── 4. Clear old dummy sessions ── */
  const deletedCount = await Session.deleteMany({ 'travel.travelNotes': /dummy-seed/ });
  if (deletedCount.deletedCount) console.log(`\n🗑  Removed ${deletedCount.deletedCount} old dummy sessions`);

  /* ── 5. Create sessions ── */
  console.log('\n🏫 Creating sessions with PDFs...\n');

  for (const tmpl of SESSION_TEMPLATES) {
    const trainer  = await User.findById(trainerIds[tmpl.trainerIdx]);
    const school   = await School.findById(schoolIds[tmpl.schoolIdx]);

    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() - tmpl.daysAgo);
    sessionDate.setHours(0, 0, 0, 0);

    const checkInTime  = new Date(sessionDate); checkInTime.setHours(tmpl.checkInHour, Math.floor(Math.random()*30), 0);
    const checkOutTime = new Date(sessionDate); checkOutTime.setHours(tmpl.checkOutHour, Math.floor(Math.random()*30), 0);

    /* ── Names for files ── */
    const san = (s) => (s||'').replace(/[^a-zA-Z0-9]/g,'_').slice(0,30);
    const tN  = san(trainer.name);
    const sN  = san(school.name);
    const dS  = sessionDate.toISOString().split('T')[0];

    const alFilename = `AL_${tN}_${sN}_${dS}.pdf`;
    const baFilename = `BA_${tN}_${sN}_${dS}.pdf`;

    /* ── Generate Acknowledgment Letter PDF ── */
    process.stdout.write(`   Generating AL PDF: ${alFilename}... `);
    await makeAckPdf(tmpl.ackImg, alFilename, {
      trainerName: trainer.name, schoolName: school.name, date: sessionDate,
      signedBy: tmpl.signedBy, designation: tmpl.designation,
    });
    console.log('✅');

    /* ── Build assessment responses ── */
    const responses = ASSESSMENT_QUESTIONS.map((q, i) => {
      const ans = tmpl.assessment[i];
      if (!ans) return { question: q.question, type: q.type, answer: '', selectedOption: null, selectedLabel: '' };
      if (q.type === 'mcq') return {
        question: q.question, type: 'mcq',
        selectedOption: ans.selectedOption, selectedLabel: ans.selectedLabel,
        answer: ans.selectedLabel, options: q.options,
      };
      return { question: q.question, type: 'text', answer: ans.answer };
    });

    /* ── Generate Baseline Assessment PDF ── */
    process.stdout.write(`   Generating BA PDF: ${baFilename}... `);
    await makeAssessmentPdf(baFilename, {
      trainerName: trainer.name, schoolName: school.name,
      block: school.block, date: sessionDate,
    }, responses);
    console.log('✅');

    /* ── Session photos ── */
    const sessionPhotos = tmpl.sessionPhotos.map(p => ({
      filename: p.file,
      url:      `/uploads/${p.file}`,
      latitude:  p.lat,
      longitude: p.lon,
      locationName: p.loc,
      timestamp: checkInTime,
    }));

    /* ── Create or upsert session ── */
    const assignment = await Assignment.findOneAndUpdate(
      { trainer: trainer._id, school: school._id, date: sessionDate },
      { trainer: trainer._id, school: school._id, date: sessionDate, status: 'completed' },
      { upsert: true, new: true }
    );

    const session = await Session.create({
      assignment: assignment._id,
      trainer:    trainer._id,
      school:     school._id,
      date:       sessionDate,
      status:     'submitted',
      submitTime: new Date(),

      checkIn: {
        time:         checkInTime,
        latitude:     tmpl.lat,
        longitude:    tmpl.lon,
        locationName: tmpl.locationName,
        photo: { filename: `dummy_checkin_${tmpl.trainerIdx === 0 ? 'priya' : tmpl.trainerIdx === 1 ? 'ravi' : 'priya2'}.jpg`, url: `/uploads/dummy_checkin.jpg` },
      },

      checkOut: {
        time:      checkOutTime,
        latitude:  tmpl.lat + 0.001,
        longitude: tmpl.lon + 0.001,
        locationName: tmpl.locationName,
      },

      sessionPhotos,

      students: { ...tmpl.students },

      assessment: {
        submitted:       true,
        submittedAt:     checkInTime,
        templateVersion: template.version,
        responses,
        pdfFilename: baFilename,
        pdfUrl:      `/uploads/${baFilename}`,
      },

      acknowledgment: {
        uploaded:   true,
        signedBy:   tmpl.signedBy,
        designation: tmpl.designation,
        photo:      { filename: tmpl.ackImg, url: `/uploads/${tmpl.ackImg}` },
        pdfFilename: alFilename,
        pdfUrl:     `/uploads/${alFilename}`,
      },

      travel: {
        baseLocation:  tmpl.travelBase,
        kmTravelled:   String(tmpl.travelKm),
        kmBaseToSchool: String(Math.round(tmpl.travelKm / 2)),
        kmRoundTrip:   String(tmpl.travelKm),
        transportMode: tmpl.transportMode,
        travelNotes:   'dummy-seed',
      },

      checklist: {
        sessionConducted:  true,
        photosUploaded:    true,
        ackLetterSigned:   true,
        assessmentDone:    true,
      },

      atlLabStatus:               tmpl.atlStatus,
      trainerFeedback:            tmpl.feedback,
      teacherTrainingWillingness: tmpl.teacherWilling,
    });

    console.log(`   ✅ Session: ${trainer.name} → ${school.name} (${sessionDate.toDateString()})`);
    console.log(`      Students: ${tmpl.students.total} | ATL: ${tmpl.atlStatus} | Teacher Willing: ${tmpl.teacherWilling}`);
    console.log(`      AL: ${alFilename}`);
    console.log(`      BA: ${baFilename}\n`);
  }

  console.log('════════════════════════════════════════════════');
  console.log('✅ SEED COMPLETE\n');
  console.log('Login credentials:');
  console.log('  Admin:   admin@bharatcares.in    / Admin@1234');
  console.log('  Manager: manager@bharatcares.in  / Manager@123');
  console.log('  Yash:    yash@bharatcares.in     / Trainer@123');
  console.log('  Harshal: harshal@bharatcares.in  / Trainer@123');
  console.log('  Sourabh: sourabh@bharatcares.in  / Trainer@123');
  console.log('\nOpen manager tracker: http://localhost:3001/admin/sessions');
  console.log('Trainer sessions:     http://localhost:3001/trainer/sessions');
  console.log('Assessment builder:   http://localhost:3001/admin/assessment-builder');
  console.log('════════════════════════════════════════════════\n');

  process.exit(0);
}

run().catch(e => { console.error('❌ Seed failed:', e.message); process.exit(1); });
