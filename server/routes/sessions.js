const router = require('express').Router();
const Session = require('../models/Session');
const Assignment = require('../models/Assignment');
const SessionReview = require('../models/SessionReview');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const School = require('../models/School');
const { auth } = require('../middleware/auth');
const { createDriveFolder, uploadFileToDrive, provisionTrainerDriveFolders, appendToSheet, ensureSheetHeaders, getOrCreateTrainerSheet, appendToTrainerSheet, driveConfigured } = require('../config/googleApis');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

/* ── Sanitise a name for a filename ── */
const sanitise = (s) => (s || '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
const dateFmt  = (d) => new Date(d).toISOString().split('T')[0];

/* ── Upload a local file from /uploads to a Drive folder ── */
async function uploadLocalFile(filename, destName, mimeType, folderId) {
  if (!driveConfigured() || !folderId || !filename) return null;
  const p = path.join(__dirname, '..', 'uploads', filename);
  if (!fs.existsSync(p)) return null;
  try {
    const buf = fs.readFileSync(p);
    return await uploadFileToDrive(buf, destName, mimeType, folderId);
  } catch (e) {
    console.log(`Drive upload failed [${destName}]:`, e.message);
    return null;
  }
}

/* ── Ensure trainer has all 3 Drive subfolders; provisions if missing ── */
async function ensureTrainerFolders(trainer) {
  if (!driveConfigured()) return null;
  // If all 3 subfolders already exist, return them
  if (trainer.driveAlFolderId && trainer.driveBaFolderId && trainer.drivePhotosFolderId) {
    return {
      rootId:   trainer.driveFolderId,
      alId:     trainer.driveAlFolderId,
      baId:     trainer.driveBaFolderId,
      photosId: trainer.drivePhotosFolderId,
    };
  }
  // Provision all folders
  try {
    const folders = await provisionTrainerDriveFolders(trainer.name, process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID);
    if (folders?.rootId) {
      await User.findByIdAndUpdate(trainer._id, {
        driveFolderId:       folders.rootId,
        driveFolderUrl:      folders.rootUrl,
        driveAlFolderId:     folders.alId,
        driveBaFolderId:     folders.baId,
        drivePhotosFolderId: folders.photosId,
      });
      Object.assign(trainer, {
        driveFolderId:       folders.rootId,
        driveFolderUrl:      folders.rootUrl,
        driveAlFolderId:     folders.alId,
        driveBaFolderId:     folders.baId,
        drivePhotosFolderId: folders.photosId,
      });
    }
    return folders;
  } catch (e) { console.log('Trainer folder provision failed:', e.message); return null; }
}

/* ── Get or create the per-school photos subfolder inside trainer's Photos/ ── */
async function ensureSchoolPhotoFolder(trainer, school, date) {
  const folders = await ensureTrainerFolders(trainer);
  if (!folders?.photosId) return null;
  const sName = sanitise(school.name || 'School');
  const dStr  = dateFmt(date);
  try {
    return await createDriveFolder(`${sName}_${dStr}`, folders.photosId);
  } catch (e) { console.log('School photo folder creation failed:', e.message); return null; }
}

/* ── Build Sheets HYPERLINK formula or plain value ── */
const sheetLink = (url, label) => url ? `=HYPERLINK("${url}","${label}")` : label || '';

const LOGO_PATH   = path.join(__dirname, '..', 'assets', 'bharat-cares-logo.png');
const NAVY        = '#0f2d6b';
const BC_BLUE     = '#1b9cd9';
const BC_GREEN    = '#78be20';
const GRAY        = '#64748b';
const LIGHT       = '#f8fafc';
const PG_W        = 495; // A4 usable width at margin=50

/* ── Shared: draw branded header on a pdfkit doc ── */
function drawBrandHeader(doc, title, subtitle) {
  // Top colour bar
  doc.rect(50, 40, PG_W, 5).fill(NAVY);
  doc.moveDown(0.5);

  // Logo + title side by side
  const logoH = 44;
  let logoW   = 0;
  if (fs.existsSync(LOGO_PATH)) {
    try {
      doc.image(LOGO_PATH, 50, 52, { height: logoH });
      logoW = Math.round(logoH * (560 / 160)); // approx logo aspect
    } catch { logoW = 0; }
  }

  // If no logo, text fallback
  if (logoW === 0) {
    doc.fontSize(20).font('Helvetica-Bold').fillColor(BC_BLUE).text('Bharat', 50, 54, { continued: true });
    doc.fillColor(BC_GREEN).text('Cares', { continued: false });
    logoW = 120;
  }

  // Title right-aligned
  const titleX = 50 + logoW + 12;
  doc.fontSize(15).font('Helvetica-Bold').fillColor(NAVY)
     .text(title, titleX, 52, { width: PG_W - logoW - 12, align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor(GRAY)
     .text(subtitle || 'AI Pathshala — Bharat Cares × Kyndryl', titleX, 72, { width: PG_W - logoW - 12, align: 'right' });

  doc.y = 52 + logoH + 14;
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(NAVY).lineWidth(1.5).stroke();
  doc.moveDown(0.8);
}

/* ── Shared: draw page footer ── */
function drawFooter(doc, label) {
  const y = doc.page.height - 36;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.fontSize(8).font('Helvetica').fillColor(GRAY)
     .text(label || 'AI Pathshala — Bharat Cares × Kyndryl', 50, y + 6, { width: PG_W, align: 'center' });
}

/* ── Shared: info row key→value ── */
function infoRow(doc, key, val) {
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor(GRAY).text(`${key}:  `, { continued: true });
  doc.font('Helvetica').fillColor('#1e293b').text(val || '—');
}

/* ── Convert an uploaded image file to a properly branded Acknowledgment Letter PDF ── */
async function imageToPdf(imageFilename, pdfFilename, ctx = {}) {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  const imgPath    = path.join(uploadsDir, imageFilename);
  const pdfPath    = path.join(uploadsDir, pdfFilename);
  if (!fs.existsSync(imgPath)) return null;

  const dateStr = ctx.date
    ? new Date(ctx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    /* ── Header ── */
    drawBrandHeader(doc, 'Acknowledgment Letter', `${ctx.schoolName || ''} · ${dateStr}`);

    /* ── Session meta info strip ── */
    doc.rect(50, doc.y, PG_W, 70).fill(LIGHT).stroke('#e2e8f0');
    const metaY = doc.y + 10;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY).text('School:', 62, metaY);
    doc.font('Helvetica').fillColor('#1e293b').text(ctx.schoolName || '—', 120, metaY);
    doc.font('Helvetica-Bold').fillColor(NAVY).text('Trainer:', 62, metaY + 16);
    doc.font('Helvetica').fillColor('#1e293b').text(ctx.trainerName || '—', 120, metaY + 16);
    doc.font('Helvetica-Bold').fillColor(NAVY).text('Date:', 62, metaY + 32);
    doc.font('Helvetica').fillColor('#1e293b').text(dateStr, 120, metaY + 32);
    if (ctx.signedBy) {
      doc.font('Helvetica-Bold').fillColor(NAVY).text('Signed By:', 300, metaY);
      doc.font('Helvetica').fillColor('#1e293b').text(ctx.signedBy, 375, metaY);
    }
    if (ctx.designation) {
      doc.font('Helvetica-Bold').fillColor(NAVY).text('Designation:', 300, metaY + 16);
      doc.font('Helvetica').fillColor('#1e293b').text(ctx.designation, 390, metaY + 16);
    }
    doc.y = metaY + 70;
    doc.moveDown(0.6);

    /* ── Acknowledgment label ── */
    doc.fontSize(10).font('Helvetica-Bold').fillColor(GRAY)
       .text('ORIGINAL ACKNOWLEDGMENT LETTER', 50, doc.y, { align: 'center' });
    doc.moveDown(0.4);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    doc.moveDown(0.4);

    /* ── Photo (letter image) — centered, max height keeping aspect ── */
    const maxH = doc.page.height - doc.y - 70;
    const maxW = PG_W;
    try {
      doc.image(imgPath, 50, doc.y, { fit: [maxW, maxH], align: 'center', valign: 'center' });
    } catch {
      doc.fontSize(11).fillColor(GRAY).text('[Acknowledgment letter image could not be embedded]', { align: 'center' });
    }

    /* ── Footer ── */
    const footerLabel = `${pdfFilename}  |  ${ctx.schoolName || ''}  |  ${dateStr}`;
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(doc, footerLabel);
    }

    doc.end();
    stream.on('finish', () => resolve(pdfPath));
    stream.on('error', reject);
  });
}

/* ── Generate Baseline Assessment PDF ── */
async function generateAssessmentPdf(session, responses) {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  const tName     = sanitise(session.trainer?.name || 'Trainer');
  const sName     = sanitise(session.school?.name  || 'School');
  const dStr      = sanitise(dateFmt(session.date));
  const filename  = `BA_${tName}_${sName}_${dStr}.pdf`;
  const pdfPath   = path.join(uploadsDir, filename);

  const school    = session.school  || {};
  const trainer   = session.trainer || {};
  const dateStr   = new Date(session.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const totalQ    = (responses || []).length;
  const answered  = (responses || []).filter(r => r.answer || r.selectedLabel).length;

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    /* ── Header ── */
    drawBrandHeader(doc, 'Baseline Assessment', `${school.name || ''} · ${dateStr}`);

    /* ── Session info strip ── */
    doc.rect(50, doc.y, PG_W, 56).fill(LIGHT).stroke('#e2e8f0');
    const iy = doc.y + 10;
    doc.fontSize(10.5).font('Helvetica-Bold').fillColor(NAVY).text('School:', 62, iy);
    doc.font('Helvetica').fillColor('#1e293b').text(school.name || '—', 122, iy);
    doc.font('Helvetica-Bold').fillColor(NAVY).text('Block:', 62, iy + 18);
    doc.font('Helvetica').fillColor('#1e293b').text(school.block || '—', 122, iy + 18);
    doc.font('Helvetica-Bold').fillColor(NAVY).text('Trainer:', 310, iy);
    doc.font('Helvetica').fillColor('#1e293b').text(trainer.name || '—', 370, iy);
    doc.font('Helvetica-Bold').fillColor(NAVY).text('Date:', 310, iy + 18);
    doc.font('Helvetica').fillColor('#1e293b').text(dateStr, 370, iy + 18);
    doc.y = iy + 56;
    doc.moveDown(0.5);

    /* ── Score summary ── */
    doc.fontSize(10).font('Helvetica').fillColor(GRAY)
       .text(`${totalQ} questions · ${answered} answered`, 50, doc.y, { align: 'right', width: PG_W });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    doc.moveDown(0.6);

    /* ── Questions ── */
    (responses || []).forEach((r, idx) => {
      if (doc.y > doc.page.height - 150) { doc.addPage(); doc.moveDown(1); }

      // Q number badge
      doc.rect(50, doc.y, 22, 22).fill(NAVY);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#fff')
         .text(`${idx + 1}`, 50, doc.y + 5, { width: 22, align: 'center' });
      const qX = 80, qY = doc.y + 3;

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b')
         .text(r.question, qX, qY, { width: PG_W - 30 });
      doc.moveDown(0.4);

      if (r.type === 'mcq') {
        const opts = r.options && r.options.length ? r.options : (r.selectedLabel ? [r.selectedLabel] : []);
        opts.forEach((opt, oi) => {
          const sel = oi === r.selectedOption || opt === r.selectedLabel;
          if (sel) {
            doc.rect(76, doc.y - 2, PG_W - 26, 18).fill('#dbeafe').stroke('#bfdbfe');
          }
          doc.fontSize(10.5)
             .font(sel ? 'Helvetica-Bold' : 'Helvetica')
             .fillColor(sel ? NAVY : '#475569')
             .text(`  ${sel ? '◉' : '○'}  ${opt}`, 80, doc.y + (sel && oi === 0 ? 0 : 0), { width: PG_W - 30 });
          doc.moveDown(0.25);
        });
      } else {
        doc.rect(76, doc.y - 2, PG_W - 26, Math.max(22, 14 * Math.ceil((r.answer || '').length / 60))).fill('#f0fdf4').stroke('#bbf7d0');
        doc.fontSize(10.5).font('Helvetica').fillColor('#166534')
           .text(`  ${r.answer || '(not answered)'}`, 80, doc.y + 2, { width: PG_W - 30 });
      }
      doc.moveDown(0.9);
    });

    /* ── Footer ── */
    const footLabel = `${filename}  |  ${school.name || ''}  |  ${dateStr}`;
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(doc, footLabel);
    }

    doc.end();
    stream.on('finish', () => resolve({ filename, url: `/uploads/${filename}` }));
    stream.on('error', reject);
  });
}

router.use(auth);

/* ── Helpers ── */
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
};

/* ── My assignments (trainer + reviewer) ── */
router.get('/my-assignments', async (req, res) => {
  try {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const query = req.user.role === 'reviewer'
      ? { reviewer: req.user._id, date: { $gte: twoWeeksAgo }, status: { $ne: 'cancelled' } }
      : { trainer: req.user._id, date: { $gte: twoWeeksAgo }, status: { $ne: 'cancelled' } };

    const assignments = await Assignment.find(query)
      .populate('trainer', 'name phone district')
      .populate('reviewer', 'name phone')
      .populate('school', 'name district block address googleMapsLink latitude longitude principalName principalPhone spokeContactName spokeContactPhone spokeWhatsAppLink')
      .sort({ date: 1 });
    res.json(assignments);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── Schools list (for trainer self-scheduling picker) ── */
router.get('/schools', async (req, res) => {
  try {
    const schools = await School.find({ active: true }).sort({ name: 1 });
    res.json(schools);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── Trainer: self-schedule their own assignment (itinerary) ──
   Admins/managers/team leads already have full create access via
   POST /api/admin/assignments. This lets a trainer do the same for
   themselves, without being able to assign other trainers. ── */
router.post('/my-assignments', async (req, res) => {
  try {
    if (req.user.role !== 'trainer')
      return res.status(403).json({ message: 'Only trainers can self-schedule assignments' });

    const { school, date, topic, expectedStudents, notes } = req.body;
    if (!school || !date)
      return res.status(400).json({ message: 'School and date are required' });

    const assignment = await (new Assignment({
      trainer: req.user._id,
      school, date, topic, expectedStudents: expectedStudents || undefined, notes,
    })).save();

    await assignment.populate([
      { path: 'trainer', select: 'name phone district' },
      { path: 'school', select: 'name district block address googleMapsLink latitude longitude principalName principalPhone spokeContactName spokeContactPhone spokeWhatsAppLink' },
    ]);

    res.status(201).json(assignment);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── My sessions ── */
router.get('/my-sessions', async (req, res) => {
  try {
    const sessions = await Session.find({ trainer: req.user._id })
      .populate('school', 'name district block address googleMapsLink')
      .sort({ date: -1 }).limit(100);
    res.json(sessions);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── Get or create session for an assignment ── */
router.get('/for-assignment/:assignmentId', async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId)
      .populate('school')
      .populate('reviewer', 'name phone');
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    const isTrainer  = assignment.trainer.toString() === req.user._id.toString();
    const isReviewer = assignment.reviewer && assignment.reviewer._id.toString() === req.user._id.toString();
    if (!isTrainer && !isReviewer && !['super_admin','manager','team_lead'].includes(req.user.role))
      return res.status(403).json({ message: 'Not your assignment' });

    let session = await Session.findOne({ assignment: assignment._id });
    if (!session && isTrainer) {
      session = new Session({
        assignment: assignment._id, trainer: req.user._id,
        school: assignment.school._id, date: assignment.date, status: 'draft',
      });
      await session.save();
    }

    // If reviewer, also fetch their review (if any)
    let review = null;
    if (isReviewer && session) {
      review = await SessionReview.findOne({ session: session._id, reviewer: req.user._id });
    }

    if (session) await session.populate([
      { path: 'trainer', select: 'name phone' },
      { path: 'school',  select: 'name district block address googleMapsLink latitude longitude principalName principalPhone spokeContactName spokeContactPhone spokeWhatsAppLink' },
    ]);

    res.json({ session, assignment, review, isReviewer });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── Single session ── */
router.get('/:id', async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('trainer', 'name phone')
      .populate('school', 'name district block address googleMapsLink latitude longitude principalName spokeContactName spokeContactPhone spokeWhatsAppLink');
    if (!session) return res.status(404).json({ message: 'Session not found' });
    const allowed = session.trainer._id.toString() === req.user._id.toString()
      || ['super_admin','manager','team_lead','reviewer'].includes(req.user.role);
    if (!allowed) return res.status(403).json({ message: 'Access denied' });
    res.json(session);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ═══════════════ JOURNEY TRACKING ═══════════════ */

/* Start journey → captures GPS, opens navigation mode */
router.put('/:id/journey/start', async (req, res) => {
  try {
    const { latitude, longitude, locationName } = req.body;
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Not found' });
    session.journey = {
      ...(session.journey || {}),
      departedAt: new Date(), departLatitude: latitude, departLongitude: longitude,
      departLocation: locationName, status: 'travelling',
    };
    if (session.status === 'draft') session.status = 'in-progress';
    await session.save();
    res.json(session);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* Arrived at school → GPS verify + auto-calc km from base */
router.put('/:id/journey/arrive', async (req, res) => {
  try {
    const { latitude, longitude, locationName } = req.body;
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Not found' });

    const j = session.journey || {};
    const depLat = j.departLatitude; const depLon = j.departLongitude;
    const kmOneWay = (depLat && depLon)
      ? parseFloat(haversineKm(depLat, depLon, latitude, longitude))
      : null;

    session.journey = {
      ...j,
      arrivedAt: new Date(), arriveLatitude: latitude, arriveLongitude: longitude,
      arriveLocation: locationName, status: 'arrived',
      kmBaseToSchool: kmOneWay,
      kmRoundTrip: kmOneWay ? parseFloat((kmOneWay * 2).toFixed(1)) : null,
    };
    // Pre-fill travel distances (can be overridden)
    if (!session.travel) session.travel = {};
    if (kmOneWay) {
      session.travel.kmBaseToSchool = kmOneWay;
      session.travel.kmRoundTrip    = parseFloat((kmOneWay * 2).toFixed(1));
      session.travel.kmTravelled    = session.travel.kmTravelled || parseFloat((kmOneWay * 2).toFixed(1));
    }
    await session.save();
    res.json(session);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* Check out from school → records departure time + updates journey */
router.put('/:id/journey/checkout', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Not found' });

    const now = new Date();
    session.checkOut = { time: now, latitude, longitude };
    session.journey = {
      ...(session.journey || {}),
      departedSchoolAt: now, departSchoolLat: latitude, departSchoolLon: longitude,
      status: 'checked_out',
    };
    await session.save();
    res.json(session);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ═══════════════ SESSION STEPS ═══════════════ */

/* Step 1: Check-in */
router.put('/:id/checkin', async (req, res) => {
  try {
    const { latitude, longitude, locationName, photoUrl, photoFilename } = req.body;
    const session = await Session.findById(req.params.id)
      .populate('trainer', 'name driveFolderId driveFolderUrl')
      .populate('school', 'name');
    if (!session) return res.status(404).json({ message: 'Not found' });

    let checkInPhoto = photoUrl ? { url: photoUrl, filename: photoFilename, latitude, longitude, capturedAt: new Date(), tag: 'checkin' } : undefined;

    // Upload check-in photo to Drive → Photos/SchoolName_Date/
    if (checkInPhoto?.filename) {
      try {
        const photoFolder = await ensureSchoolPhotoFolder(session.trainer, session.school, session.date);
        if (photoFolder?.id) {
          const tName = sanitise(session.trainer.name);
          const dStr  = dateFmt(session.date);
          const up = await uploadLocalFile(photoFilename, `CheckIn_${tName}_${dStr}.jpg`, 'image/jpeg', photoFolder.id);
          if (up?.webViewLink) { checkInPhoto.driveUrl = up.webViewLink; checkInPhoto.url = up.webViewLink; }
        }
      } catch (e) { console.log('CheckIn Drive upload skipped:', e.message); }
    }

    session.checkIn = { time: new Date(), latitude, longitude, locationName, photo: checkInPhoto };
    if (session.status === 'draft') session.status = 'in-progress';
    await session.save();
    res.json(session);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* Step 2: Session photos */
router.put('/:id/photos', async (req, res) => {
  try {
    const { photos } = req.body;
    const session = await Session.findById(req.params.id)
      .populate('trainer', 'name driveFolderId driveFolderUrl')
      .populate('school', 'name');
    if (!session) return res.status(404).json({ message: 'Not found' });

    const newPhotos = photos.map(p => ({ ...p, tag: 'session', capturedAt: new Date() }));

    // Upload session photos to Drive → Photos/SchoolName_Date/
    try {
      const photoFolder = await ensureSchoolPhotoFolder(session.trainer, session.school, session.date);
      if (photoFolder?.id) {
        const tName    = sanitise(session.trainer.name);
        const dStr     = dateFmt(session.date);
        const startIdx = session.sessionPhotos.length + 1;
        for (let i = 0; i < newPhotos.length; i++) {
          const p = newPhotos[i];
          if (!p.filename) continue;
          const label = `Session_${String(startIdx + i).padStart(3,'0')}_${tName}_${dStr}.jpg`;
          const up = await uploadLocalFile(p.filename, label, 'image/jpeg', photoFolder.id);
          if (up?.webViewLink) { newPhotos[i].driveUrl = up.webViewLink; newPhotos[i].url = up.webViewLink; }
        }
      }
    } catch (e) { console.log('Photos Drive upload skipped:', e.message); }

    session.sessionPhotos.push(...newPhotos);
    await session.save();
    res.json(session);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* Step 3: Student count */
router.put('/:id/students', async (req, res) => {
  try {
    const { male, female, grades } = req.body;
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Not found' });
    session.students = { male: Number(male), female: Number(female), total: Number(male) + Number(female), grades };
    await session.save();
    res.json(session);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* Step 4: Assessment */
router.put('/:id/assessment', async (req, res) => {
  try {
    const { responses, templateVersion } = req.body;
    const session = await Session.findById(req.params.id)
      .populate('trainer', 'name driveFolderId driveFolderUrl').populate('school', 'name block');
    if (!session) return res.status(404).json({ message: 'Not found' });

    session.assessment = { submitted: true, submittedAt: new Date(), responses, templateVersion: templateVersion || null };

    try {
      const { filename, url } = await generateAssessmentPdf(session, responses);
      session.assessment.pdfFilename = filename;
      session.assessment.pdfUrl      = url;

      // Upload BA PDF → trainer's BA/ subfolder
      const folders = await ensureTrainerFolders(session.trainer);
      if (folders?.baId) {
        const up = await uploadLocalFile(filename, filename, 'application/pdf', folders.baId);
        if (up?.webViewLink) { session.assessment.driveUrl = up.webViewLink; session.assessment.pdfUrl = up.webViewLink; }
        console.log(`Drive ✅ BA PDF → BA/: ${filename}`);
      }
    } catch (e) { console.log('Assessment PDF/Drive skipped:', e.message); }

    await session.save();
    res.json(session);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* Step 5: Acknowledgment — saves photo, converts to branded PDF, uploads both to Drive */
router.put('/:id/acknowledgment', async (req, res) => {
  try {
    const { photoUrl, photoFilename, signedBy, designation } = req.body;
    const session = await Session.findById(req.params.id)
      .populate('trainer', 'name driveFolderId driveFolderUrl').populate('school', 'name');
    if (!session) return res.status(404).json({ message: 'Not found' });

    let pdfFilename = null; let pdfUrl = null; let pdfDriveUrl = null;
    let photoObj = { url: photoUrl, filename: photoFilename, capturedAt: new Date(), tag: 'acknowledgment' };

    if (photoFilename) {
      const tName = sanitise(session.trainer?.name || 'Trainer');
      const sName = sanitise(session.school?.name  || 'School');
      const dStr  = sanitise(dateFmt(session.date));
      pdfFilename = `AL_${tName}_${sName}_${dStr}.pdf`;

      try {
        // 1. Generate branded PDF
        await imageToPdf(photoFilename, pdfFilename, {
          trainerName: session.trainer?.name,
          schoolName:  session.school?.name,
          date:        session.date,
          signedBy, designation,
        });
        pdfUrl = `/uploads/${pdfFilename}`;

        // Upload AL PDF → trainer's AL/ subfolder; photo → Photos/
        const folders = await ensureTrainerFolders(session.trainer);
        if (folders?.alId) {
          // Branded PDF → AL/
          const upPdf = await uploadLocalFile(pdfFilename, pdfFilename, 'application/pdf', folders.alId);
          if (upPdf?.webViewLink) { pdfDriveUrl = upPdf.webViewLink; }

          // Original photo → Photos/SchoolName_Date/
          if (folders.photosId) {
            const photoFolder = await ensureSchoolPhotoFolder(session.trainer, session.school, session.date);
            if (photoFolder?.id) {
              const upPhoto = await uploadLocalFile(photoFilename, `AL_Photo_${tName}_${dStr}.jpg`, 'image/jpeg', photoFolder.id);
              if (upPhoto?.webViewLink) { photoObj.driveUrl = upPhoto.webViewLink; photoObj.url = upPhoto.webViewLink; }
            }
          }
          console.log(`Drive ✅ AL PDF → AL/: ${pdfFilename}`);
        }
      } catch (e) { console.log('AL PDF/Drive skipped:', e.message); }
    }

    session.acknowledgment = { uploaded: true, photo: photoObj, pdfFilename, pdfUrl, pdfDriveUrl, signedBy, designation };
    await session.save();
    res.json(session);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* Step 6: Travel */
router.put('/:id/travel', async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Not found' });
    session.travel = req.body;
    await session.save();
    res.json(session);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* Step 7: Checklist */
router.put('/:id/checklist', async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Not found' });
    session.checklist = req.body;
    await session.save();
    res.json(session);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── Session metadata (ATL status, feedback, teacher willingness) ── */
router.put('/:id/meta', async (req, res) => {
  try {
    const { atlLabStatus, trainerFeedback, teacherTrainingWillingness } = req.body;
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Not found' });
    if (atlLabStatus !== undefined)               session.atlLabStatus = atlLabStatus;
    if (trainerFeedback !== undefined)            session.trainerFeedback = trainerFeedback;
    if (teacherTrainingWillingness !== undefined) session.teacherTrainingWillingness = teacherTrainingWillingness;
    await session.save();
    res.json(session);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ═══════════════ SUBMIT ═══════════════ */
router.post('/:id/submit', async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('trainer', 'name phone district driveFolderId driveFolderUrl')
      .populate('school', 'name district block');
    if (!session) return res.status(404).json({ message: 'Not found' });

    const tName = sanitise(session.trainer.name);
    const sName = sanitise(session.school.name);
    const dStr  = dateFmt(session.date);

    /* ── Drive: catch-up upload for any files not yet on Drive ── */
    try {
      const folders = await ensureTrainerFolders(session.trainer);
      if (folders) {
        // AL PDF → AL/
        if (session.acknowledgment?.pdfFilename && !session.acknowledgment.pdfDriveUrl && folders.alId) {
          const up = await uploadLocalFile(session.acknowledgment.pdfFilename, session.acknowledgment.pdfFilename, 'application/pdf', folders.alId);
          if (up?.webViewLink) session.acknowledgment.pdfDriveUrl = up.webViewLink;
        }
        // BA PDF → BA/
        if (session.assessment?.pdfFilename && !session.assessment.driveUrl && folders.baId) {
          const up = await uploadLocalFile(session.assessment.pdfFilename, session.assessment.pdfFilename, 'application/pdf', folders.baId);
          if (up?.webViewLink) { session.assessment.driveUrl = up.webViewLink; session.assessment.pdfUrl = up.webViewLink; }
        }
        // Photos → Photos/SchoolName_Date/
        const needsPhotos = [
          ...(session.checkIn?.photo?.filename && !session.checkIn.photo.driveUrl
            ? [{ obj: session.checkIn.photo, label: `CheckIn_${tName}_${dStr}.jpg` }] : []),
          ...session.sessionPhotos
            .filter(p => p.filename && !p.driveUrl)
            .map((p, i) => ({ obj: p, label: `Session_${String(i+1).padStart(3,'0')}_${tName}_${dStr}.jpg` })),
        ];
        if (needsPhotos.length && folders.photosId) {
          const photoFolder = await ensureSchoolPhotoFolder(session.trainer, session.school, session.date);
          if (photoFolder?.id) {
            for (const { obj, label } of needsPhotos) {
              const up = await uploadLocalFile(obj.filename, label, 'image/jpeg', photoFolder.id);
              if (up?.webViewLink) { obj.driveUrl = up.webViewLink; obj.url = up.webViewLink; }
            }
          }
        }
        // Save Drive folder URL (trainer root)
        session.driveFolderUrl = folders.rootUrl || session.driveFolderUrl;
        console.log(`Drive ✅ Submit sync: ${session.trainer.name} → ${session.school.name}`);
      }
    } catch (e) { console.log('Drive catch-up skipped:', e.message); }

    /* ── Sheets sync ── */
    try {
      const sessionDate = new Date(session.date);
      const dd   = String(sessionDate.getDate()).padStart(2,'0');
      const mm   = String(sessionDate.getMonth()+1).padStart(2,'0');
      const yyyy = sessionDate.getFullYear();
      const dateFormatted = `${dd}/${mm}/${yyyy}`;

      const checkInTime = session.checkIn?.time
        ? new Date(session.checkIn.time).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:false })
        : '';

      const alLabel = session.acknowledgment?.pdfFilename || (session.acknowledgment?.uploaded ? `AL_${tName}_${sName}_${dStr}.pdf` : '');
      const alCol   = sheetLink(session.acknowledgment?.pdfDriveUrl, alLabel);

      const baLabel = session.assessment?.pdfFilename || (session.assessment?.submitted ? `BA_${tName}_${sName}_${dStr}.pdf` : '');
      const baCol   = sheetLink(session.assessment?.driveUrl, baLabel);

      const photosCol = sheetLink(session.driveFolderUrl, session.driveFolderUrl ? 'View Photos' : '');

      const rowData = [
        dateFormatted,                                // Date
        checkInTime,                                  // Time
        session.school.block || '',                   // Block
        session.school.name,                          // School Name
        session.students?.total || 0,                 // Enrollment
        alCol,                                        // Acknowledgment Letter (hyperlink)
        baCol,                                        // Baseline Assessment (hyperlink)
        '',                                           // Attendance [Prena Portal] — manual
        '',                                           // Attendance Drive Link — manual
        photosCol,                                    // Photographs Drive Link (hyperlink)
        session.atlLabStatus || 'NA',                 // ATL LAB STATUS
        session.trainerFeedback || '',                // Feedback
        session.teacherTrainingWillingness || 'NO',   // Teacher Training Willingness
      ];

      await appendToTrainerSheet(session.trainer.name, rowData);
      session.sheetsRowUpdated = true;
      console.log(`Sheets ✅ ${session.trainer.name} row appended`);
    } catch (e) { console.log('Sheets sync failed:', e.message); }

    session.status = 'submitted';
    session.submitTime = new Date();
    await Assignment.findByIdAndUpdate(session.assignment, { status: 'completed' });
    await session.save();
    res.json({ message: 'Session submitted successfully', session });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ═══════════════ BULK SYNC TO GOOGLE SHEETS ═══════════════ */
router.post('/sync-to-sheets', async (req, res) => {
  try {
    const ADMIN_ROLES = ['super_admin', 'manager', 'team_lead'];
    if (!ADMIN_ROLES.includes(req.user.role))
      return res.status(403).json({ message: 'Admins only' });

    if (!googleConfigured)
      return res.status(503).json({ message: 'Google APIs not configured' });

    const sessions = await Session.find({ status: 'submitted' })
      .populate('trainer', 'name driveFolderId driveFolderUrl')
      .populate('school', 'name block');

    let synced = 0;
    const errors = [];

    for (const session of sessions) {
      try {
        const tName = sanitise(session.trainer?.name || 'Trainer');
        const sName = sanitise(session.school?.name  || 'School');
        const dStr  = dateFmt(session.date);

        const sessionDate = new Date(session.date);
        const dd   = String(sessionDate.getDate()).padStart(2, '0');
        const mm   = String(sessionDate.getMonth() + 1).padStart(2, '0');
        const yyyy = sessionDate.getFullYear();
        const dateFormatted = `${dd}/${mm}/${yyyy}`;

        const checkInTime = session.checkIn?.time
          ? new Date(session.checkIn.time).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:false })
          : '';

        const alLabel = session.acknowledgment?.pdfFilename || (session.acknowledgment?.uploaded ? `AL_${tName}_${sName}_${dStr}.pdf` : '');
        const alCol   = sheetLink(session.acknowledgment?.pdfDriveUrl, alLabel);

        const baLabel = session.assessment?.pdfFilename || (session.assessment?.submitted ? `BA_${tName}_${sName}_${dStr}.pdf` : '');
        const baCol   = sheetLink(session.assessment?.driveUrl, baLabel);

        const photosCol = sheetLink(session.driveFolderUrl, session.driveFolderUrl ? 'View Photos' : '');

        const rowData = [
          dateFormatted,
          checkInTime,
          session.school?.block || '',
          session.school?.name  || '',
          session.students?.total || 0,
          alCol,
          baCol,
          '',
          '',
          photosCol,
          session.atlLabStatus   || 'NA',
          session.trainerFeedback || '',
          session.teacherTrainingWillingness || 'NO',
        ];

        await appendToTrainerSheet(session.trainer?.name || 'Trainer', rowData);
        synced++;
      } catch (e) {
        errors.push(`${session._id}: ${e.message}`);
      }
    }

    res.json({ synced, total: sessions.length, errors: errors.length ? errors : undefined });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ═══════════════ SESSION REVIEWS (by reviewer role) ═══════════════ */

/* Get review for a session */
router.get('/:id/review', async (req, res) => {
  try {
    const review = await SessionReview.findOne({ session: req.params.id })
      .populate('reviewer', 'name phone').populate('trainer', 'name');
    res.json(review || null);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* Create / update review */
router.put('/:id/review', async (req, res) => {
  try {
    if (!['reviewer','super_admin','manager','team_lead'].includes(req.user.role))
      return res.status(403).json({ message: 'Only reviewers can submit reviews' });

    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    let review = await SessionReview.findOne({ session: session._id, reviewer: req.user._id });
    if (!review) {
      review = new SessionReview({
        session: session._id, assignment: session.assignment,
        trainer: session.trainer, reviewer: req.user._id,
      });
    }
    Object.assign(review, req.body);
    await review.save();

    // Notify the trainer's manager
    const trainer = await User.findById(session.trainer);
    if (trainer?.managerId) {
      await AuditLog.create({
        actor: req.user._id, actorName: req.user.name, actorRole: req.user.role,
        action: 'session_review_submitted', entityType: 'Session', entityId: session._id,
        entityName: `Review for session by ${trainer.name}`,
        notifiedTo: [trainer.managerId],
      });
    }

    res.json(review);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* Submit (finalize) review */
router.post('/:id/review/submit', async (req, res) => {
  try {
    const review = await SessionReview.findOneAndUpdate(
      { session: req.params.id, reviewer: req.user._id },
      { submitted: true, submittedAt: new Date(), ...req.body },
      { new: true }
    );
    if (!review) return res.status(404).json({ message: 'Review not found' });
    res.json(review);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ═══════════════ FULL SESSION REPORT PDF (manager download) ═══════════════ */
router.get('/:id/full-report', async (req, res) => {
  try {
    const ADMIN_ROLES = ['super_admin', 'manager', 'team_lead', 'trainer', 'reviewer'];
    if (!ADMIN_ROLES.includes(req.user.role))
      return res.status(403).json({ message: 'Access denied' });

    const session = await Session.findById(req.params.id)
      .populate('trainer', 'name phone district')
      .populate('school', 'name district block address principalName');
    if (!session) return res.status(404).json({ message: 'Not found' });

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const tName = sanitise(session.trainer?.name || 'Trainer');
    const sName = sanitise(session.school?.name  || 'School');
    const dStr  = dateFmt(session.date);
    const filename = `Report_${tName}_${sName}_${dStr}.pdf`;

    const dateStr = new Date(session.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = session.checkIn?.time ? new Date(session.checkIn.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    doc.pipe(res);

    const NAVY = '#0f2d6b';
    const GRAY = '#64748b';
    const BLACK = '#1e293b';
    const pgW = doc.page.width - 100; // usable width

    const drawHR = (color = '#e2e8f0', w = 2) => {
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(color).lineWidth(w).stroke();
      doc.moveDown(0.5);
    };

    const sectionTitle = (title) => {
      doc.moveDown(0.6);
      drawHR(NAVY, 1.5);
      doc.fontSize(13).font('Helvetica-Bold').fillColor(NAVY).text(title.toUpperCase(), { characterSpacing: 0.5 });
      doc.moveDown(0.4);
    };

    const kv = (key, val) => {
      doc.fontSize(11).font('Helvetica-Bold').fillColor(GRAY).text(`${key}:  `, { continued: true, width: pgW });
      doc.font('Helvetica').fillColor(BLACK).text(val || '—');
    };

    /* ── Page 1: Header + Session Info ── */
    drawBrandHeader(doc, 'Session Report', `${session.school?.name || ''} · ${dateStr}`);

    // School + date as large title
    doc.fontSize(16).font('Helvetica-Bold').fillColor(BLACK).text(session.school?.name || 'School', { align: 'center' });
    doc.fontSize(12).font('Helvetica').fillColor(GRAY).text(`${dateStr}  ·  ${session.school?.block || ''}  ·  ${session.school?.district || ''}`, { align: 'center' });
    doc.moveDown(1.2);

    sectionTitle('Session Details');
    kv('Date',           dateStr);
    kv('Check-In Time',  timeStr);
    if (session.checkIn?.locationName) kv('Check-In Location', session.checkIn.locationName);
    if (session.checkOut?.time) kv('Check-Out Time', new Date(session.checkOut.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));
    kv('Trainer',        session.trainer?.name);
    kv('Trainer Phone',  session.trainer?.phone);
    kv('Principal',      session.school?.principalName);
    doc.moveDown(0.5);

    sectionTitle('Student Attendance');
    kv('Total Students', `${session.students?.total ?? '—'}`);
    kv('Male',           `${session.students?.male ?? '—'}`);
    kv('Female',         `${session.students?.female ?? '—'}`);
    if (session.students?.grades?.length) kv('Grades', session.students.grades.join(', '));
    doc.moveDown(0.5);

    sectionTitle('School Assessment');
    kv('ATL Lab Status',               session.atlLabStatus || 'NA');
    kv('Teacher Training Willingness', session.teacherTrainingWillingness || 'NO');
    if (session.trainerFeedback) {
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(GRAY).text('Feedback:');
      doc.fontSize(11).font('Helvetica').fillColor(BLACK).text(session.trainerFeedback, { lineGap: 3, width: pgW });
    }

    /* ── Session Photos page ── */
    const photos = (session.sessionPhotos || []).filter(p => p.filename && fs.existsSync(path.join(uploadsDir, p.filename)));
    if (photos.length > 0) {
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').fillColor(NAVY).text('SESSION PHOTOS', { align: 'center', characterSpacing: 0.5 });
      doc.fontSize(10).font('Helvetica').fillColor(GRAY).text(`${photos.length} photo${photos.length > 1 ? 's' : ''} captured during session`, { align: 'center' });
      doc.moveDown(0.8);

      const imgW = 230, imgH = 170, gapX = 15, gapY = 20;
      let col = 0;
      let y = doc.y;

      for (const photo of photos) {
        const imgPath = path.join(uploadsDir, photo.filename);
        try {
          if (y + imgH > doc.page.height - 100) {
            doc.addPage();
            y = 60;
            col = 0;
          }
          const x = 50 + col * (imgW + gapX);
          doc.image(imgPath, x, y, { width: imgW, height: imgH, cover: [imgW, imgH] });

          // Caption
          if (photo.locationName || photo.timestamp) {
            doc.fontSize(8).font('Helvetica').fillColor(GRAY)
              .text(photo.locationName || new Date(photo.timestamp).toLocaleString(), x, y + imgH + 2, { width: imgW });
          }

          col++;
          if (col >= 2) { col = 0; y += imgH + gapY + 16; }
        } catch { /* skip corrupt images */ }
      }
    }

    /* ── Acknowledgment Letter ── */
    if (session.acknowledgment?.photo?.filename) {
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').fillColor(NAVY).text('ACKNOWLEDGMENT LETTER', { align: 'center', characterSpacing: 0.5 });
      doc.moveDown(0.5);
      drawHR();
      const ackPath = path.join(uploadsDir, session.acknowledgment.photo.filename);
      if (fs.existsSync(ackPath)) {
        try {
          doc.image(ackPath, 50, doc.y, { width: pgW, fit: [pgW, 580] });
        } catch { doc.fontSize(11).fillColor(GRAY).text('[Acknowledgment letter image not readable]'); }
      }
    }

    /* ── Baseline Assessment ── */
    if (session.assessment?.responses?.length > 0) {
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').fillColor(NAVY).text('BASELINE ASSESSMENT', { align: 'center', characterSpacing: 0.5 });
      doc.fontSize(10).font('Helvetica').fillColor(GRAY).text(`Template v${session.assessment.templateVersion || '1'} · ${session.assessment.responses.length} questions`, { align: 'center' });
      doc.moveDown(0.8);
      drawHR();

      session.assessment.responses.forEach((r, i) => {
        if (doc.y > doc.page.height - 120) doc.addPage();
        doc.fontSize(11).font('Helvetica-Bold').fillColor(BLACK).text(`Q${i + 1}.  ${r.question}`);
        doc.moveDown(0.25);
        if (r.type === 'mcq') {
          (r.options || []).forEach((opt, oi) => {
            const sel = oi === r.selectedOption;
            doc.fontSize(11).font(sel ? 'Helvetica-Bold' : 'Helvetica').fillColor(sel ? NAVY : '#374151')
              .text(`       ${sel ? '◉' : '○'}  ${opt}`);
          });
          if (!r.options?.length) {
            doc.fontSize(11).font('Helvetica-Bold').fillColor(NAVY).text(`       ◉  ${r.selectedLabel || r.answer || '—'}`);
          }
        } else {
          doc.fontSize(11).font('Helvetica').fillColor('#374151').text(`       ${r.answer || '(no answer)'}`, { lineGap: 2 });
        }
        doc.moveDown(0.7);
      });
    }

    /* ── Footer on all pages ── */
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.rect(50, doc.page.height - 34, pgW, 1).fill('#e2e8f0');
      doc.fontSize(8).font('Helvetica').fillColor(GRAY)
        .text(
          `AI Pathshala — Bharat Cares × Kyndryl  |  ${session.school?.name}  |  ${dateStr}  |  Page ${i + 1} of ${range.count}`,
          50, doc.page.height - 28, { width: pgW, align: 'center' }
        );
    }

    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
});

module.exports = router;
