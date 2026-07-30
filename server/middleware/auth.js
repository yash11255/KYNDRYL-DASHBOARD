const jwt = require('jsonwebtoken');
const User = require('../models/User');

const ADMIN_ROLES = ['super_admin', 'manager', 'team_lead'];

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Legacy alias — now accepts any admin-tier role
const adminOnly = (req, res, next) => {
  if (!ADMIN_ROLES.includes(req.user?.role)) return res.status(403).json({ message: 'Admin access required' });
  next();
};

module.exports = { auth, adminOnly, ADMIN_ROLES };
