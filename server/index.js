require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

connectDB();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
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
