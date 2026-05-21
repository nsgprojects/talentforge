require('dotenv').config();
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db      = require('../db');
const { authenticate } = require('../middleware/auth');
const router  = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email||!password) return res.status(400).json({ error:'Email and password required' });
    const { rows } = await db.query(`SELECT id,name,email,role,status,password_hash FROM users WHERE email=$1`, [email.toLowerCase().trim()]);
    const user = rows[0];
    if (!user)               return res.status(401).json({ error:'Invalid credentials' });
    if (user.status!=='active') return res.status(403).json({ error:'Account is inactive' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error:'Invalid credentials' });
    const token = jwt.sign({ id:user.id, email:user.email, role:user.role, name:user.name }, process.env.JWT_SECRET, { expiresIn:'8h' });
    const sessionToken = uuidv4();
    await db.query(`INSERT INTO user_sessions (user_id,session_token,ip_address,user_agent,current_page) VALUES ($1,$2,$3,$4,'Dashboard')`, [user.id, sessionToken, req.ip, req.headers['user-agent']]);
    await db.query(`UPDATE users SET last_login_at=NOW() WHERE id=$1`, [user.id]);
    try { await db.query(`INSERT INTO activity_logs (user_id,action_type,page,details) VALUES ($1,'login','Dashboard',$2)`, [user.id, JSON.stringify({ ip:req.ip })]); } catch(logErr) { console.warn('[activity log]', logErr.message); }
    res.json({ token, user:{ id:user.id, name:user.name, email:user.email, role:user.role } });
  } catch(err) { next(err); }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await db.query(`UPDATE user_sessions SET is_active=FALSE, logged_out_at=NOW() WHERE user_id=$1 AND is_active=TRUE`, [req.user.id]);
    await db.query(`INSERT INTO activity_logs (user_id,action_type,page) VALUES ($1,'logout','—')`, [req.user.id]);
    res.json({ message:'Logged out' });
  } catch(err) { next(err); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(`SELECT id,name,email,role,status,last_login_at FROM users WHERE id=$1`, [req.user.id]);
    res.json(rows[0]);
  } catch(err) { next(err); }
});

router.patch('/page', authenticate, async (req, res, next) => {
  try {
    const { page } = req.body;
    await db.query(`UPDATE user_sessions SET current_page=$1, last_active_at=NOW() WHERE user_id=$2 AND is_active=TRUE`, [page, req.user.id]);
    res.json({ ok:true });
  } catch(err) { next(err); }
});

// ── GET /api/auth/me/settings ──────────────────────────────
router.get('/me/settings', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, email, phone, role, preferences FROM users WHERE id=$1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({
      id:          rows[0].id,
      name:        rows[0].name,
      email:       rows[0].email,
      phone:       rows[0].phone || '',
      role:        rows[0].role,
      preferences: rows[0].preferences || {},
    });
  } catch(err) { next(err); }
});

// ── PUT /api/auth/me/settings ──────────────────────────────
router.put('/me/settings', authenticate, async (req, res, next) => {
  try {
    const { name, phone, preferences } = req.body;
    if (name && name.trim().length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });
    const { rows } = await db.query(
      `UPDATE users SET
        name        = COALESCE($1, name),
        phone       = COALESCE($2, phone),
        preferences = COALESCE($3::jsonb, preferences),
        updated_at  = NOW()
       WHERE id=$4
       RETURNING id, name, email, phone, role, preferences`,
      [name?.trim() || null, phone?.trim() || null, preferences ? JSON.stringify(preferences) : null, req.user.id]
    );
    res.json({
      id:          rows[0].id,
      name:        rows[0].name,
      email:       rows[0].email,
      phone:       rows[0].phone || '',
      preferences: rows[0].preferences || {},
    });
  } catch(err) { next(err); }
});

// ── PUT /api/auth/me/password ──────────────────────────────
router.put('/me/password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword required' });
    if (newPassword !== confirmPassword)   return res.status(400).json({ error: 'Passwords do not match' });
    if (newPassword.length < 8)            return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/[A-Z]/.test(newPassword))        return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
    if (!/[0-9]/.test(newPassword))        return res.status(400).json({ error: 'Password must contain at least one number' });

    const { rows } = await db.query(`SELECT password_hash FROM users WHERE id=$1`, [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query(`UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2`, [hash, req.user.id]);
    try { await db.query(`INSERT INTO activity_logs (user_id,action_type,page) VALUES ($1,'password_change','Settings')`, [req.user.id]); } catch (_) {}
    res.json({ ok: true, message: 'Password changed successfully' });
  } catch(err) { next(err); }
});

// ── GET /api/auth/platform-settings — admin only ──────────
router.get('/platform-settings', authenticate, async (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const { rows } = await db.query('SELECT key, value, updated_at FROM platform_settings ORDER BY key');
    const settings = {};
    rows.forEach(r => { settings[r.key] = { value: r.value, updatedAt: r.updated_at }; });
    res.json(settings);
  } catch(err) { next(err); }
});

// ── PUT /api/auth/platform-settings — admin only ──────────
router.put('/platform-settings', authenticate, async (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    await db.query(
      `INSERT INTO platform_settings (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_by=$3, updated_at=NOW()`,
      [key, value, req.user.id]
    );
    res.json({ ok: true });
  } catch(err) { next(err); }
});

module.exports = router;
