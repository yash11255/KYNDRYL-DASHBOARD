/**
 * Format Google Sheets: clear duplicates, re-sync data with hyperlinks, apply full formatting
 * Run: node format-sheets.js
 */
require('dotenv').config();
require('./models/User');
require('./models/School');
require('./models/Assignment');
const mongoose = require('mongoose');
const Session  = require('./models/Session');
const { getSheets, appendToTrainerSheet } = require('./config/googleApis');

const SHEETS_ID = process.env.GOOGLE_SHEETS_ID;

const sanitise = (s) => (s || '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
const dateFmt  = (d) => new Date(d).toISOString().split('T')[0];
const sheetLink = (url, label) => (url && label) ? `=HYPERLINK("${url}","${label}")` : label || '';

/* ── Colour constants matching the real tracker ── */
const NAVY   = { red: 0.059, green: 0.176, blue: 0.420 }; // #0f2d6b
const WHITE  = { red: 1,     green: 1,     blue: 1     };
const LBLUE  = { red: 0.812, green: 0.886, blue: 0.953 }; // #CFF alternate rows
const BORDER = { style: 'SOLID', color: { red: 0.8, green: 0.8, blue: 0.8 } };

const HEADERS = [
  'Date','Time','Block','School Name','Enrollment',
  'Acknowledgment Letter','Baseline Assessment',
  'Attendance [Prena Portal]','Attendance (Drive Link)',
  'Photographs (Drive Link)','ATL LAB STATUS',
  'Feedback','Teacher Training Willingness',
];

/* Column widths in pixels */
const COL_WIDTHS = [90, 70, 100, 220, 80, 180, 180, 160, 160, 130, 110, 280, 160];

async function getSheetMeta(sheets) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SHEETS_ID,
    fields: 'sheets.properties',
  });
  return res.data.sheets || [];
}

async function clearSheet(sheets, sheetId) {
  // Delete all rows except header (keep row 1)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEETS_ID,
    requestBody: {
      requests: [{
        updateCells: {
          range: { sheetId, startRowIndex: 1 },
          fields: 'userEnteredValue',
        },
      }],
    },
  });
}

async function applyFormatting(sheets, sheetId, dataRowCount) {
  const requests = [];
  const totalRows = dataRowCount + 1; // header + data rows

  /* 1. Header row: navy background, white bold text, frozen */
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: NAVY,
          textFormat: { foregroundColor: WHITE, bold: true, fontSize: 10, fontFamily: 'Arial' },
          verticalAlignment: 'MIDDLE',
          horizontalAlignment: 'CENTER',
          wrapStrategy: 'WRAP',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment,wrapStrategy)',
    },
  });

  /* 2. Freeze header row */
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
      fields: 'gridProperties.frozenRowCount',
    },
  });

  /* 3. Data rows: alternating white / light blue, wrap, auto-height */
  if (dataRowCount > 0) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: totalRows },
        cell: {
          userEnteredFormat: {
            textFormat: { fontSize: 10, fontFamily: 'Arial' },
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
          },
        },
        fields: 'userEnteredFormat(textFormat,verticalAlignment,wrapStrategy)',
      },
    });

    /* Alternate row shading */
    for (let r = 1; r < totalRows; r++) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: r, endRowIndex: r + 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: r % 2 === 0
                ? { red: 0.949, green: 0.961, blue: 0.980 } // light blue-grey
                : { red: 1, green: 1, blue: 1 },            // white
            },
          },
          fields: 'userEnteredFormat.backgroundColor',
        },
      });
    }
  }

  /* 4. Column widths */
  COL_WIDTHS.forEach((px, i) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: px },
        fields: 'pixelSize',
      },
    });
  });

  /* 5. Row height: header 40px, data rows 50px */
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 40 },
      fields: 'pixelSize',
    },
  });
  if (dataRowCount > 0) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: totalRows },
        properties: { pixelSize: 50 },
        fields: 'pixelSize',
      },
    });
  }

  /* 6. Borders on data area */
  if (dataRowCount > 0) {
    requests.push({
      updateBorders: {
        range: { sheetId, startRowIndex: 0, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: 13 },
        top:    BORDER, bottom: BORDER, left: BORDER, right: BORDER,
        innerHorizontal: BORDER, innerVertical: BORDER,
      },
    });
  }

  /* 7. Centre-align specific columns: Date, Time, Block, Enrollment, ATL */
  [0, 1, 2, 4, 10].forEach(col => {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: Math.max(totalRows, 2), startColumnIndex: col, endColumnIndex: col + 1 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
        fields: 'userEnteredFormat.horizontalAlignment',
      },
    });
  });

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEETS_ID, requestBody: { requests } });
}

async function buildRow(session) {
  const tName = sanitise(session.trainer?.name || 'Trainer');
  const sName = sanitise(session.school?.name  || 'School');
  const dStr  = dateFmt(session.date);

  const d = new Date(session.date);
  const dateFormatted = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

  const checkInTime = session.checkIn?.time
    ? new Date(session.checkIn.time).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:false })
    : '';

  const alLabel  = session.acknowledgment?.pdfFilename || `AL_${tName}_${sName}_${dStr}.pdf`;
  const alCol    = sheetLink(session.acknowledgment?.pdfDriveUrl, alLabel);
  const baLabel  = session.assessment?.pdfFilename    || `BA_${tName}_${sName}_${dStr}.pdf`;
  const baCol    = sheetLink(session.assessment?.driveUrl,       baLabel);
  const photoCol = sheetLink(session.driveFolderUrl, session.driveFolderUrl ? 'View Photos' : '');

  return [
    dateFormatted,
    checkInTime,
    session.school?.block || '',
    session.school?.name  || '',
    session.students?.total || 0,
    alCol,
    baCol,
    '', // Attendance Prena — manual
    '', // Attendance Drive — manual
    photoCol,
    session.atlLabStatus || 'NA',
    session.trainerFeedback || '',
    session.teacherTrainingWillingness || 'NO',
  ];
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB connected\n');

  const sheets = getSheets();
  if (!sheets) { console.error('❌ Sheets not configured'); process.exit(1); }

  const sheetMeta = await getSheetMeta(sheets);
  const tabMap = {};
  sheetMeta.forEach(s => { tabMap[s.properties.title] = s.properties.sheetId; });
  console.log('Existing tabs:', Object.keys(tabMap).join(', '), '\n');

  // Get all submitted sessions grouped by trainer first-name
  const sessions = await Session.find({ status: 'submitted' })
    .populate('trainer', 'name')
    .populate('school', 'name block')
    .sort({ date: 1 });

  const byTrainer = {};
  for (const s of sessions) {
    const tab = (s.trainer?.name || 'Unknown').split(' ')[0].trim();
    if (!byTrainer[tab]) byTrainer[tab] = [];
    byTrainer[tab].push(s);
  }

  for (const [tabName, trainerSessions] of Object.entries(byTrainer)) {
    const sheetId = tabMap[tabName];
    if (sheetId === undefined) {
      console.log(`⚠️  Tab "${tabName}" not found in sheet — run sync-to-sheets first`);
      continue;
    }

    console.log(`📋 Formatting tab: ${tabName} (${trainerSessions.length} sessions)`);

    // 1. Clear old data (keep header)
    await clearSheet(sheets, sheetId);

    // 2. Write header row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEETS_ID,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });

    // 3. Write data rows with hyperlinks
    if (trainerSessions.length > 0) {
      const rows = await Promise.all(trainerSessions.map(buildRow));
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEETS_ID,
        range: `${tabName}!A2`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rows },
      });
    }

    // 4. Apply full formatting
    await applyFormatting(sheets, sheetId, trainerSessions.length);

    console.log(`   ✅ Done — ${trainerSessions.length} rows written\n`);
  }

  console.log('════════════════════════════════════════');
  console.log('✅ All tabs formatted and synced');
  console.log(`Open: https://docs.google.com/spreadsheets/d/${SHEETS_ID}/edit`);
  process.exit(0);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
