const express = require('express');
const db      = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const router  = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.status, u.last_login_at,
             s.current_page, s.logged_in_at, s.last_active_at,
             CASE WHEN s.last_active_at > NOW()-INTERVAL '5 min' THEN TRUE ELSE FALSE END AS is_online,
             COUNT(DISTINCT br.id) FILTER (WHERE br.is_active) AS total_base_resumes,
             COUNT(DISTINCT tr.id) AS total_tailored_resumes,
             COUNT(DISTINCT s2.id) FILTER (WHERE s2.logged_in_at > NOW()-INTERVAL '24h') AS sessions_today,
             COUNT(DISTINCT al.id) FILTER (WHERE al.created_at > NOW()-INTERVAL '24h') AS actions_today,
             COUNT(DISTINCT br2.id) FILTER (WHERE br2.created_at > NOW()-INTERVAL '24h') AS resumes_today
      FROM users u
      LEFT JOIN user_sessions s   ON s.user_id=u.id AND s.is_active=TRUE
      LEFT JOIN user_sessions s2  ON s2.user_id=u.id
      LEFT JOIN activity_logs al  ON al.user_id=u.id
      LEFT JOIN base_resumes br   ON br.user_id=u.id
      LEFT JOIN base_resumes br2  ON br2.user_id=u.id
      LEFT JOIN tailored_resumes tr ON tr.user_id=u.id
      WHERE u.role != 'admin'
      GROUP BY u.id, s.current_page, s.logged_in_at, s.last_active_at
      ORDER BY is_online DESC, u.name`);
    res.json(rows);
  } catch(err) { next(err); }
});

router.get('/activity', async (req, res, next) => {
  try {
    const { limit=50 } = req.query;
    const { rows } = await db.query(
      `SELECT al.id, al.action_type, al.entity_type, al.entity_name, al.page, al.details, al.created_at,
              u.name AS user_name, u.role AS user_role
       FROM activity_logs al JOIN users u ON u.id=al.user_id
       ORDER BY al.created_at DESC LIMIT $1`, [limit]
    );
    res.json(rows);
  } catch(err) { next(err); }
});

router.get('/activity/:userId', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT al.*, u.name AS user_name FROM activity_logs al JOIN users u ON u.id=al.user_id
       WHERE al.user_id=$1 ORDER BY al.created_at DESC LIMIT 50`,
      [req.params.userId]
    );
    res.json(rows);
  } catch(err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const [users, resumes, points, activity] = await Promise.all([
      db.query(`SELECT COUNT(*) FILTER (WHERE role='recruiter') AS recruiters,
                COUNT(*) FILTER (WHERE status='active') AS active_users FROM users WHERE role!='admin'`),
      db.query(`SELECT COUNT(*) FILTER (WHERE is_active) AS base_resumes,
                (SELECT COUNT(*) FROM tailored_resumes) AS tailored_resumes FROM base_resumes`),
      db.query(`SELECT COUNT(*) FILTER (WHERE NOT is_flagged) AS total_points FROM bullet_points`),
      db.query(`SELECT COUNT(*) FILTER (WHERE created_at > NOW()-INTERVAL '24h') AS today_actions FROM activity_logs`),
    ]);
    res.json({ ...users.rows[0], ...resumes.rows[0], ...points.rows[0], ...activity.rows[0] });
  } catch(err) { next(err); }
});

module.exports = router;
