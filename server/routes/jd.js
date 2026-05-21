const express = require('express');
const crypto  = require('crypto');
const db      = require('../db');
const { askClaude } = require('../services/claude');
const { authenticate } = require('../middleware/auth');
const upload  = require('../middleware/upload');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

const router = express.Router();
router.use(authenticate);

function hashJD(text) {
  const normalized = text.toLowerCase().replace(/\s+/g,' ').trim().slice(0,500);
  return crypto.createHash('md5').update(normalized).digest('hex');
}

async function extractJDText(buffer, originalName) {
  const ext = (originalName||'').split('.').pop().toLowerCase();
  if (ext==='docx'||ext==='doc') { const r=await mammoth.extractRawText({buffer}); return r.value; }
  if (ext==='pdf') { const r=await pdfParse(buffer); return r.text; }
  return buffer.toString('utf8');
}

async function parseJDText(text) {
  return await askClaude(`Parse this job description. Return ONLY JSON:
{
  "title":"","company":"","location":"","workType":"Full-time","experienceRequired":"3+ years",
  "yearsRequired":3,"required":["skill"],"preferred":["skill"],
  "responsibilities":["responsibility"],"keywords":["keyword"],
  "summary":"1 sentence role summary","benefits":["benefit"],"industry":"","seniority":"Senior",
  "hiringManager":"","h1bSponsorship":false,"applicantCount":""
}
JD:
${text.slice(0,6000)}`, 2000);
}

// POST /api/jd/parse — parse only, no save
router.post('/parse', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text||text.length<30) return res.status(400).json({ error:'Paste a job description (30+ chars)' });
    const parsed = await parseJDText(text);
    try { await db.query(`INSERT INTO activity_logs (user_id,action_type,page) VALUES ($1,'jd_parse','Jobs')`, [req.user.id]); } catch(e) { console.warn('activity log skipped:', e.message); }
    res.json({ data: parsed });
  } catch(err) { next(err); }
});

// POST /api/jd/parse-file — upload JD file and parse
router.post('/parse-file', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error:'No file uploaded' });
    const text = await extractJDText(req.file.buffer, req.file.originalname);
    if (!text||text.length<30) return res.status(400).json({ error:'Could not extract text from file' });
    const parsed = await parseJDText(text);
    res.json({ data: parsed, rawText: text });
  } catch(err) { next(err); }
});

// POST /api/jd/live-parse — fast debounced parse while typing
router.post('/live-parse', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text||text.length<60) return res.json({ data:{ required:[],preferred:[],title:'',keywords:[] } });
    const parsed = await askClaude(`Extract skills quickly. Return ONLY JSON:
{"title":"","required":["skill"],"preferred":["skill"],"keywords":["kw"],"yearsRequired":0}
Text: ${text.slice(0,2500)}`, 600);
    res.json({ data: parsed });
  } catch(err) { next(err); }
});

// GET /api/jd
router.get('/', async (req, res, next) => {
  try {
    const limit = req.user.role==='admin' ? 200 : 50;
    let q, params;
    if (req.user.role==='admin') {
      q = `SELECT jd.*, u.name AS user_name FROM job_descriptions jd LEFT JOIN users u ON u.id=jd.user_id ORDER BY jd.created_at DESC LIMIT $1`;
      params = [limit];
    } else {
      q = `SELECT * FROM job_descriptions WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`;
      params = [req.user.id, limit];
    }
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch(err) { next(err); }
});

// GET /api/jd/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(`SELECT * FROM job_descriptions WHERE id=$1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error:'Not found' });
    if (req.user.role!=='admin' && rows[0].user_id!==req.user.id) return res.status(403).json({ error:'Access denied' });
    res.json(rows[0]);
  } catch(err) { next(err); }
});

// POST /api/jd — save with duplicate detection
router.post('/', async (req, res, next) => {
  try {
    const { raw_text, parsed, status='saved' } = req.body;
    if (!raw_text) return res.status(400).json({ error:'raw_text required' });

    const hash = hashJD(raw_text);

    // Duplicate check
    const dupCheck = await db.query(
      `SELECT id, title, company FROM job_descriptions WHERE user_id=$1 AND text_hash=$2 LIMIT 1`,
      [req.user.id, hash]
    );
    if (dupCheck.rows[0]) {
      return res.status(409).json({
        error: 'duplicate',
        message: `This job description already exists in your list: "${dupCheck.rows[0].title||'Untitled'}"`,
        existingId: dupCheck.rows[0].id
      });
    }

    // Parse if not provided
    let p = parsed;
    if (!p) {
      try { p = await parseJDText(raw_text); } catch { p = {}; }
    }

    const { rows } = await db.query(`
      INSERT INTO job_descriptions
        (user_id,title,company,location,work_type,experience_req,raw_text,parsed_json,
         skills_required,skills_preferred,keywords,status,text_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [req.user.id, p.title||'', p.company||'', p.location||'', p.workType||'',
       p.experienceRequired||`${p.yearsRequired||0}+ years`,
       raw_text, JSON.stringify(p),
       p.required||[], p.preferred||[], p.keywords||[], status, hash]
    );

    try { await db.query(`INSERT INTO activity_logs (user_id,action_type,entity_type,entity_id,entity_name,page) VALUES ($1,'create','job_description',$2,$3,'Jobs')`, [req.user.id, rows[0].id, rows[0].title]); } catch(e) { console.warn('activity log skipped:', e.message); }

    res.status(201).json(rows[0]);
  } catch(err) { next(err); }
});

// PUT /api/jd/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { status, match_score, is_primary } = req.body;
    const { rows } = await db.query(
      `UPDATE job_descriptions SET
        status=COALESCE($1,status), match_score=COALESCE($2,match_score), is_primary=COALESCE($3,is_primary)
       WHERE id=$4 AND user_id=$5 RETURNING *`,
      [status, match_score, is_primary, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error:'Not found' });
    res.json(rows[0]);
  } catch(err) { next(err); }
});

// DELETE /api/jd/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await db.query(`DELETE FROM job_descriptions WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
    res.json({ message:'Deleted' });
  } catch(err) { next(err); }
});

// POST /api/jd/:id/analyze-fit
router.post('/:id/analyze-fit', async (req, res, next) => {
  try {
    const { base_resume_id } = req.body;
    const [jdRes, resumeRes] = await Promise.all([
      db.query(`SELECT * FROM job_descriptions WHERE id=$1`, [req.params.id]),
      db.query(`SELECT * FROM base_resumes WHERE id=$1`, [base_resume_id]),
    ]);
    const jd=jdRes.rows[0], resume=resumeRes.rows[0];
    if (!jd||!resume) return res.status(404).json({ error:'JD or resume not found' });

    const analysis = await askClaude(`Analyze resume fit for this job. Return ONLY JSON:
{
  "overallScore":85,"experienceScore":90,"skillScore":80,"industryScore":75,
  "matchedSkills":["skill"],"missingSkills":["skill"],
  "strengths":["point"],"gaps":["gap"],"recommendation":"1-2 sentence summary"
}
JD TITLE: ${jd.title} at ${jd.company}
REQUIRED: ${(jd.skills_required||[]).join(', ')}
YEARS REQUIRED: ${jd.parsed_json?.yearsRequired||0}
RESUME SUMMARY: ${resume.summary_text||''}
RESUME SKILLS: ${JSON.stringify(resume.content?.skills||{})}
YEARS EXP: ${resume.years_experience||0}`, 1500);

    res.json({ data: analysis });
  } catch(err) { next(err); }
});

module.exports = router;
