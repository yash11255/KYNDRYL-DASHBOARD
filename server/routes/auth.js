const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { getOAuthClient, saveOAuthToken, OAUTH_SCOPES, isDriveAuthorized } = require('../config/googleApis');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid email or password' });
    if (!user.active)
      return res.status(403).json({ message: 'Account is deactivated' });
    res.json({ token: signToken(user._id), user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

router.put('/me', auth, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { name, phone }, { new: true }).select('-password');
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(currentPassword)))
      return res.status(400).json({ message: 'Current password is incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── Google Drive OAuth 2.0 ── */

// Step 1: Redirect to Google consent screen (open in browser)
router.get('/google/authorize', (req, res) => {
  const client = getOAuthClient();
  if (!client) return res.status(503).send('OAuth not configured — add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to .env');
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: OAUTH_SCOPES,
    prompt: 'consent', // force refresh_token every time
  });
  res.redirect(url);
});

// Step 2: Google redirects here with ?code=...
router.get('/google/callback', async (req, res) => {
  try {
    const client = getOAuthClient();
    if (!client) return res.status(503).send('OAuth not configured');
    const { tokens } = await client.getToken(req.query.code);
    client.setCredentials(tokens);
    saveOAuthToken(tokens);
    console.log('✅ Google Drive OAuth token saved');
    res.send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2 style="color:#0f2d6b">✅ Google Drive Connected!</h2>
        <p>AI Pathshala can now upload files directly to your Google Drive.</p>
        <p>You can close this tab.</p>
      </body></html>
    `);
  } catch (e) {
    res.status(500).send('OAuth error: ' + e.message);
  }
});

// Status check
router.get('/google/status', (req, res) => {
  res.json({ driveAuthorized: isDriveAuthorized() });
});

module.exports = router;
