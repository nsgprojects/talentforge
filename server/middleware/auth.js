const jwt = require('jsonwebtoken');
const { query } = require('../db');

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    // Verify user still exists in DB (catches post-reset stale tokens)
    const { rows } = await query('SELECT id, role, name, email FROM users WHERE id=$1 AND status=$2', [decoded.id, 'active']);
    if (!rows[0]) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user && req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Required: ' + roles.join(' or ') });
  }
  next();
};

module.exports = { authenticate, requireRole };
