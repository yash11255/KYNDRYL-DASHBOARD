const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { auth } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only images and PDFs are allowed'));
  },
});

router.post('/photo', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    filename: req.file.filename,
    url: `${baseUrl}/uploads/${req.file.filename}`,
    originalName: req.file.originalname,
    size: req.file.size,
  });
});

router.post('/photos', auth, upload.array('files', 20), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded' });
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json(req.files.map(f => ({
    filename: f.filename,
    url: `${baseUrl}/uploads/${f.filename}`,
    originalName: f.originalname,
    size: f.size,
  })));
});

module.exports = router;
