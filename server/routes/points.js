const express = require('express');
const db      = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/points — paginated, 20 per page
router.get('/', async (req, res, next) => {
  try {
    const { ecosystem, search, page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset   = (pageNum - 1) * limitNum;

    let where  = ['bp.is_flagged = FALSE'];
    let params = [];

    // Recruiters see only own points; admins see all
    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      where.push(`bp.created_by = $${params.length}`);
    }
    if (ecosystem) {
      params.push(ecosystem);
      where.push(`te.name = $${params.length}`);
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      where.push(`bp.content ILIKE $${params.length}`);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // Total count
    const countQ  = `SELECT COUNT(*) AS total FROM bullet_points bp LEFT JOIN tech_ecosystems te ON te.id = bp.ecosystem_id ${whereClause}`;
    const countRes = await db.query(countQ, params);
    const total    = parseInt(countRes.rows[0].total);
    const pages    = Math.ceil(total / limitNum);

    // Data
    const dataParams = [...params, limitNum, offset];
    const dataQ = `
      SELECT bp.*, te.name AS ecosystem_name, te.color_hex,
             u.name AS created_by_name
      FROM bullet_points bp
      LEFT JOIN tech_ecosystems te ON te.id = bp.ecosystem_id
      LEFT JOIN users u ON u.id = bp.created_by
      ${whereClause}
      ORDER BY bp.created_at DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;

    const { rows } = await db.query(dataQ, dataParams);

    res.json({ data: rows, total, page: pageNum, pages, limit: limitNum });
  } catch (err) { next(err); }
});

// GET /api/points/ecosystems
router.get('/ecosystems', async (req, res, next) => {
  try {
    let userFilter = '';
    let params = [];
    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      userFilter = `AND bp.created_by = $1`;
    }
    const { rows } = await db.query(`
      SELECT te.id, te.name, te.color_hex, te.sort_order,
             COUNT(bp.id) FILTER (WHERE NOT bp.is_flagged ${userFilter}) AS point_count
      FROM tech_ecosystems te
      LEFT JOIN bullet_points bp ON bp.ecosystem_id = te.id
      GROUP BY te.id ORDER BY te.sort_order`, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/points
router.post('/', async (req, res, next) => {
  try {
    const { content, ecosystem_id, stack_label, tags, experience_role } = req.body;
    if (!content) return res.status(400).json({ error: 'content required' });

    // Duplicate check per user
    const dup = await db.query(
      'SELECT id FROM bullet_points WHERE created_by=$1 AND content=$2 AND is_flagged=FALSE LIMIT 1',
      [req.user.id, content.trim()]
    );
    if (dup.rows[0]) return res.status(409).json({ error: 'duplicate', id: dup.rows[0].id });

    const { rows } = await db.query(
      `INSERT INTO bullet_points (content,ecosystem_id,stack_label,tags,experience_role,source,created_by)
       VALUES ($1,$2,$3,$4,$5,'ai',$6) RETURNING *`,
      [content.trim(), ecosystem_id || null, stack_label || null, tags || [], experience_role || null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/points/batch — save multiple, skip exact duplicates per user
router.post('/batch', async (req, res, next) => {
  try {
    const { points } = req.body;
    if (!points || !points.length) return res.status(400).json({ error: 'points array required' });

    let saved = 0, skipped = 0;

    for (const p of points) {
      if (!p.content || !p.content.trim()) continue;
      const text = p.content.trim();

      // Per-user duplicate check
      const dup = await db.query(
        'SELECT id FROM bullet_points WHERE created_by=$1 AND content=$2 AND is_flagged=FALSE LIMIT 1',
        [req.user.id, text]
      );
      if (dup.rows[0]) { skipped++; continue; }

      // Auto-detect ecosystem from stack_label
      let ecoId = p.ecosystem_id || null;
      if (!ecoId && p.stack_label) {
        const ecoRes = await db.query(
          'SELECT id FROM tech_ecosystems WHERE LOWER(name) = LOWER($1) LIMIT 1',
          [p.stack_label]
        );
        if (ecoRes.rows[0]) ecoId = ecoRes.rows[0].id;
      }
      // Fallback: detect from bullet text keywords
      if (!ecoId) {
        const text_lower = text.toLowerCase();
        const keywordMap = [
          { name:'DevOps',        keys:['kubernetes','docker','helm','ci/cd','jenkins','gitlab','terraform','ansible','openshift'] },
          { name:'Cloud',         keys:['aws','azure','gcp','s3','ec2','lambda','cloudformation','azure devops'] },
          { name:'Observability', keys:['prometheus','grafana','elk','splunk','datadog','pagerduty','nagios','appd'] },
          { name:'Security',      keys:['iam','soc','siem','vulnerability','compliance','security'] },
          { name:'Scripting',     keys:['python','bash','powershell','groovy','perl','shell'] },
          { name:'Databases',     keys:['postgres','mysql','redis','mongodb','oracle','dynamodb','cassandra'] },
          { name:'AI/ML',         keys:['machine learning','tensorflow','pytorch','llm','rag','ai agent'] },
        ];
        for (const entry of keywordMap) {
          if (entry.keys.some(k => text_lower.includes(k))) {
            const r = await db.query('SELECT id FROM tech_ecosystems WHERE name=$1 LIMIT 1', [entry.name]);
            if (r.rows[0]) { ecoId = r.rows[0].id; break; }
          }
        }
      }

      try {
        await db.query(
          `INSERT INTO bullet_points (content,ecosystem_id,stack_label,tags,experience_role,source,created_by)
           VALUES ($1,$2,$3,$4,$5,'ai',$6)`,
          [text, ecoId, p.stack_label || null, p.tags || [], p.experience_role || null, req.user.id]
        );
        saved++;
      } catch (e) { if (e.code !== '23505') console.warn('[points batch]', e.message); }
    }

    res.status(201).json({ saved, skipped });
  } catch (err) { next(err); }
});

// POST /api/points/:id/copy
router.post('/:id/copy', async (req, res, next) => {
  try {
    await db.query('UPDATE bullet_points SET usage_count=usage_count+1 WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/points/:id — own points or admin
router.delete('/:id', async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      await db.query('UPDATE bullet_points SET is_flagged=TRUE WHERE id=$1', [req.params.id]);
    } else {
      await db.query('UPDATE bullet_points SET is_flagged=TRUE WHERE id=$1 AND created_by=$2', [req.params.id, req.user.id]);
    }
    res.json({ message: 'Removed' });
  } catch (err) { next(err); }
});

module.exports = router;
