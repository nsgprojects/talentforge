const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/users
router.get('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      const r = await db.query(`SELECT id,name,email,phone,role,status FROM users WHERE id=$1`, [req.user.id]);
      return res.json(r.rows);
    }
    const { rows } = await db.query(`
      SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.last_login_at, u.created_at,
             COUNT(DISTINCT br.id) FILTER (WHERE br.is_active) AS base_resume_count,
             COUNT(DISTINCT tr.id) AS tailored_resume_count,
             COUNT(DISTINCT jd.id) AS jd_count,
             s.current_page, s.last_active_at,
             CASE WHEN s.last_active_at > NOW()-INTERVAL '5 min' THEN TRUE ELSE FALSE END AS is_online
      FROM users u
      LEFT JOIN user_sessions s   ON s.user_id=u.id AND s.is_active=TRUE
      LEFT JOIN base_resumes br   ON br.user_id=u.id
      LEFT JOIN tailored_resumes tr ON tr.user_id=u.id
      LEFT JOIN job_descriptions jd ON jd.user_id=u.id
      WHERE u.id != $1
      GROUP BY u.id, s.current_page, s.last_active_at
      ORDER BY u.role='admin' DESC, u.name`,
      [req.user.id]
    );
    res.json(rows);
  } catch(err) { next(err); }
});

// POST /api/users — admin creates recruiter or another admin
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, email, phone, role = 'recruiter', password = 'Welcome@123' } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });
    if (!['recruiter','admin'].includes(role)) return res.status(400).json({ error: 'role must be recruiter or admin' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      `INSERT INTO users (name,email,phone,role,password_hash,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,email,role,status`,
      [name, email.toLowerCase().trim(), phone, role, hash, req.user.id]
    );
    await db.query(`INSERT INTO activity_logs (user_id,action_type,entity_type,entity_id,entity_name) VALUES ($1,'create','user',$2,$3)`,
      [req.user.id, rows[0].id, name]);
    res.status(201).json({ ...rows[0], tempPassword: password });
  } catch(err) {
    if (err.code==='23505') return res.status(409).json({ error:'Email already exists' });
    next(err);
  }
});

// PUT /api/users/:id — admin updates name/phone/status/role
router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id && req.body.role && req.body.role !== 'admin')
      return res.status(400).json({ error: 'Cannot demote yourself' });
    const { name, phone, status, role } = req.body;
    const { rows } = await db.query(
      `UPDATE users SET
        name=COALESCE($1,name), phone=COALESCE($2,phone),
        status=COALESCE($3,status), role=COALESCE($4,role)
       WHERE id=$5 RETURNING id,name,email,role,status`,
      [name, phone, status, role, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error:'Not found' });
    res.json(rows[0]);
  } catch(err) { next(err); }
});

// DELETE /api/users/:id
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error:'Cannot suspend yourself' });
    await db.query(`UPDATE users SET status='suspended' WHERE id=$1`, [req.params.id]);
    res.json({ message:'User suspended' });
  } catch(err) { next(err); }
});

module.exports = router;
