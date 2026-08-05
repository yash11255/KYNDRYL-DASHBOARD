require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

connectDB();

// Allowed origins — hardcoded so this doesn't break on every new Vercel
// preview URL. Vercel gives each deployment its own unique subdomain
// (e.g. kyndryl-dashboard-<hash>-<team>.vercel.app), so we match the
// whole *.vercel.app domain rather than a single fixed string.
//
// Also allow localhost:5001 (the backend's own port): CRA's local dev
// proxy rewrites the Origin header to match its target before forwarding,
// so requests coming through `npm start`'s proxy arrive here looking
// like they came from the backend itself. Harmless in dev, never hit
// in production where the frontend calls the API's absolute URL directly.
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5001',
  'https://kyndryl-dashboard.vercel.app',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // server-to-server / curl / same-origin
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    try {
      if (new URL(origin).hostname.endsWith('.vercel.app')) return callback(null, true);
    } catch { /* ignore invalid origin header */ }
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',                require('./routes/auth'));
app.use('/api/admin',               require('./routes/admin'));
app.use('/api/sessions',            require('./routes/sessions'));
app.use('/api/upload',              require('./routes/upload'));
app.use('/api/basestay',            require('./routes/basestay'));
app.use('/api/expenses',            require('./routes/expenses'));
app.use('/api/audit',               require('./routes/audit'));
app.use('/api/assessment-template', require('./routes/assessmentTemplate'));

app.get('/api/health', (_, res) => res.json({ status: 'ok', app: 'Bharat Cares Pathshala' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`\n🚀 Server running on http://localhost:${PORT}\n`));
