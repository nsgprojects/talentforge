const express = require('express');
const db      = require('../db');
const { askClaudeText } = require('../services/claude');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.post('/generate', async (req, res, next) => {
  try {
    const { jd_id, base_resume_id, tone = 'professional' } = req.body;
    const [jdRes, resumeRes] = await Promise.all([
      db.query('SELECT * FROM job_descriptions WHERE id=$1', [jd_id]),
      db.query('SELECT * FROM base_resumes WHERE id=$1', [base_resume_id]),
    ]);
    const jd     = jdRes.rows[0];
    const resume = resumeRes.rows[0];
    if (!jd || !resume) return res.status(404).json({ error: 'JD or resume not found' });

    const content = await askClaudeText(
      'Write a ' + tone + ' cover letter for this IT professional.\n\n' +
      'CANDIDATE: ' + (resume.content && resume.content.header ? resume.content.header.name : 'Candidate') + '\n' +
      'YEARS EXP: ' + (resume.years_experience || '') + '\n' +
      'SUMMARY: ' + (resume.summary_text || '') + '\n' +
      'KEY SKILLS: ' + JSON.stringify(resume.content && resume.content.skills ? resume.content.skills : {}) + '\n\n' +
      'JOB: ' + jd.title + ' at ' + jd.company + '\n' +
      'REQUIRED SKILLS: ' + (jd.skills_required || []).join(', ') + '\n' +
      'JD SUMMARY: ' + (jd.parsed_json && jd.parsed_json.summary ? jd.parsed_json.summary : (jd.raw_text || '').slice(0, 300)) + '\n\n' +
      'Write a 3-paragraph cover letter. First: express interest and mention the role and company. Second: highlight 2-3 most relevant skills. Third: close with call to action. Under 350 words. Body paragraphs only — no subject line or address.',
      1200,
      'You are an expert professional cover letter writer. Write natural, confident, specific letters. Avoid cliches.'
    );

    const { rows } = await db.query(
      'INSERT INTO cover_letters (user_id,jd_id,base_resume_id,content,tone) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.id, jd_id, base_resume_id, content, tone]
    );

    try {
      await db.query(
        "INSERT INTO activity_logs (user_id,action_type,entity_type,entity_id,page) VALUES ($1,'create','cover_letter',$2,'Jobs')",
        [req.user.id, rows[0].id]
      );
    } catch (logErr) {
      console.warn('[activity log]', logErr.message);
    }

    res.json({ data: { ...rows[0], content } });
  } catch (err) { next(err); }
});

module.exports = router;
