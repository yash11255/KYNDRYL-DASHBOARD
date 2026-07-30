const { google } = require('googleapis');
const fs   = require('fs');
const path = require('path');

/* ─────────────────────────────────────────────────────────────
   SERVICE ACCOUNT — used only for Google Sheets
   ───────────────────────────────────────────────────────────── */
const sheetsConfigured = !!(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
  process.env.GOOGLE_PRIVATE_KEY &&
  process.env.GOOGLE_SHEETS_ID
);

const getSheetsAuth = () => {
  if (!sheetsConfigured) return null;
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
};

const getSheets = () => {
  const auth = getSheetsAuth();
  if (!auth) return null;
  return google.sheets({ version: 'v4', auth });
};

/* ─────────────────────────────────────────────────────────────
   OAUTH 2.0 — used for Google Drive uploads (as the real user)
   Refresh token stored in server/config/oauth_token.json
   ───────────────────────────────────────────────────────────── */
const TOKEN_PATH = path.join(__dirname, 'oauth_token.json');

const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive',
];

const getOAuthClient = () => {
  const id     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!id || !secret) return null;

  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:5001/api/auth/google/callback';
  const client = new google.auth.OAuth2(id, secret, redirectUri);

  // Load saved token if it exists
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      client.setCredentials(token);
    } catch { /* ignore parse errors */ }
  }
  return client;
};

const saveOAuthToken = (token) => {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
};

const isDriveAuthorized = () => {
  if (!fs.existsSync(TOKEN_PATH)) return false;
  try {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    return !!(token.refresh_token || token.access_token);
  } catch { return false; }
};

const getDrive = () => {
  const client = getOAuthClient();
  if (!client || !isDriveAuthorized()) return null;
  return google.drive({ version: 'v3', auth: client });
};

const isConfigured = sheetsConfigured; // Sheets always works via service account
const driveConfigured = () => isDriveAuthorized() && !!getOAuthClient();

/* ─────────────────────────────────────────────────────────────
   DRIVE OPERATIONS
   ───────────────────────────────────────────────────────────── */
const createDriveFolder = async (name, parentId) => {
  const drive = getDrive();
  if (!drive) return null;
  const parent = parentId || process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parent ? { parents: [parent] } : {}),
    },
    fields: 'id,webViewLink',
  });
  return res.data;
};

const uploadFileToDrive = async (fileBuffer, fileName, mimeType, folderId) => {
  const drive = getDrive();
  if (!drive) return null;
  const { Readable } = require('stream');
  const stream = Readable.from(fileBuffer);
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      ...(folderId ? { parents: [folderId] } : {}),
    },
    media: { mimeType, body: stream },
    fields: 'id,webViewLink,name',
  });
  // Make file publicly readable so the link works for anyone
  try {
    await drive.permissions.create({
      fileId: res.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
    });
  } catch { /* non-fatal */ }
  return res.data;
};

/* ─────────────────────────────────────────────────────────────
   SHEETS OPERATIONS (service account)
   ───────────────────────────────────────────────────────────── */
const appendToSheet = async (values) => {
  const sheets = getSheets();
  if (!sheets || !process.env.GOOGLE_SHEETS_ID) return null;
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: 'Sessions!A:R',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
};

const ensureSheetHeaders = async () => {
  const sheets = getSheets();
  if (!sheets || !process.env.GOOGLE_SHEETS_ID) return;
  const headers = [
    'Session ID','Date','Trainer Name','Trainer Phone',
    'School Name','District','Total Students','Male','Female',
    'Grade/Class','Check-in Time','Check-in Location',
    'Session Photos','Acknowledgment Letter','Assessment Done',
    'Checklist %','KM Travelled','Travel Notes','Drive Folder','Status',
  ];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Sessions!A1:T1',
    });
    if (!res.data.values?.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: 'Sessions!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
    }
  } catch (e) { console.log('Sheet headers check skipped:', e.message); }
};

const TRAINER_SHEET_HEADERS = [
  'Date','Time','Block','School Name','Enrollment',
  'Acknowledgment Letter','Baseline Assessment',
  'Attendance [Prena Portal] (Drive Link)','Attendance (Drive Link)',
  'Photographs (Drive Link)','ATL LAB STATUS (YES/NO)',
  'Feedback','Teacher Training Willingness',
];

const trainerTabName = (name) => (name || 'Trainer').split(' ')[0].trim();

const getOrCreateTrainerSheet = async (sheetsId, trainerName) => {
  const sheets = getSheets();
  if (!sheets) return null;
  const tabName = trainerTabName(trainerName);
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetsId, fields: 'sheets.properties.title' });
  const existingTabs = (meta.data.sheets || []).map(s => s.properties.title);
  if (!existingTabs.includes(tabName)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetsId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetsId,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [TRAINER_SHEET_HEADERS] },
    });
  }
  return tabName;
};

const appendToTrainerSheet = async (trainerName, rowData) => {
  const sheets = getSheets();
  if (!sheets || !process.env.GOOGLE_SHEETS_ID) return null;
  const tabName = await getOrCreateTrainerSheet(process.env.GOOGLE_SHEETS_ID, trainerName);
  if (!tabName) return null;
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: `${tabName}!A:M`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowData] },
  });
};

/* ─────────────────────────────────────────────────────────────
   Provision all 3 subfolders for a trainer (AL, BA, Photos)
   Returns { alId, baId, photosId }
   ───────────────────────────────────────────────────────────── */
const provisionTrainerDriveFolders = async (trainerName, parentFolderId) => {
  if (!driveConfigured()) return null;
  const root = await createDriveFolder(trainerName, parentFolderId || process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID);
  if (!root?.id) return null;
  const [al, ba, photos] = await Promise.all([
    createDriveFolder('Acknowledgment Letters', root.id),
    createDriveFolder('Baseline Assessments',   root.id),
    createDriveFolder('Photos',                 root.id),
  ]);
  return {
    rootId:       root.id,
    rootUrl:      root.webViewLink,
    alId:         al?.id,
    baId:         ba?.id,
    photosId:     photos?.id,
  };
};

module.exports = {
  isConfigured,
  driveConfigured,
  isDriveAuthorized,
  getOAuthClient,
  saveOAuthToken,
  OAUTH_SCOPES,
  getDrive,
  getSheets,
  createDriveFolder,
  uploadFileToDrive,
  provisionTrainerDriveFolders,
  appendToSheet,
  ensureSheetHeaders,
  getOrCreateTrainerSheet,
  appendToTrainerSheet,
};
