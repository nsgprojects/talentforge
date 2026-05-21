const express  = require('express');
const mammoth  = require('mammoth');
const pdfParse = require('pdf-parse');
const upload   = require('../middleware/upload');
const db       = require('../db');
const { askClaude } = require('../services/claude');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const YEAR_RE = /\b(19|20)\d{2}\b/;
const DATE_RE = /present|current|now|today/i;

// ── Ecosystem keyword map (shared with points batch logic) ─
const ECO_KEYWORD_MAP = [
  { name:'DevOps',        keys:['kubernetes','docker','helm','ci/cd','jenkins','gitlab','terraform','ansible','openshift','flux','argocd','gitops'] },
  { name:'Cloud',         keys:['aws','azure','gcp','s3','ec2','lambda','cloudformation','azure devops','openstack'] },
  { name:'Observability', keys:['prometheus','grafana','elk','splunk','datadog','pagerduty','nagios','appd','dynatrace','cloudwatch'] },
  { name:'Security',      keys:['iam','soc','siem','vulnerability','compliance','security','vault','ssl','tls'] },
  { name:'Scripting',     keys:['python','bash','powershell','groovy','perl','shell','ruby'] },
  { name:'Databases',     keys:['postgres','mysql','redis','mongodb','oracle','dynamodb','cassandra','redshift','sql'] },
  { name:'AI/ML',         keys:['machine learning','tensorflow','pytorch','llm','rag','ai agent','nlp','keras'] },
];

async function detectEcosystem(text) {
  const lower = text.toLowerCase();
  for (const entry of ECO_KEYWORD_MAP) {
    if (entry.keys.some(k => lower.includes(k))) {
      try {
        const r = await db.query('SELECT id FROM tech_ecosystems WHERE name=$1 LIMIT 1', [entry.name]);
        if (r.rows[0]) return r.rows[0].id;
      } catch (_) {}
    }
  }
  return null;
}

// ── Extract bullets from raw text for each experience ──────
// Works for Format A (Client:/Role:/R&R) and Format B (no R&R header).
// Called AFTER Claude to fill any experience that came back with empty bullets.
function extractBulletsFromText(rawText, experiences) {
  const lines = rawText.split('\n');

  // Index of every "Client:" line in the doc
  const clientLineIdxs = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^(?:client|employer|company)\s*[:\-]\s*/i.test(lines[i].trim())) {
      clientLineIdxs.push(i);
    }
  }

  return experiences.map(function(exp) {
    // Skip if Claude already filled bullets
    if (exp.bullets && exp.bullets.length > 0) return exp;

    const compNorm = (exp.company || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    if (!compNorm) return exp;

    // Find matching client line
    let clientIdx = -1;
    for (let k = 0; k < clientLineIdxs.length; k++) {
      const lineNorm = lines[clientLineIdxs[k]].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lineNorm.includes(compNorm)) { clientIdx = clientLineIdxs[k]; break; }
    }
    if (clientIdx === -1) return exp;

    // End boundary = next client section or EOF
    const nextClientIdx = clientLineIdxs.find(function(idx) { return idx > clientIdx; }) || lines.length;

    // Find "Roles & Responsibilities" header within the section
    let startIdx = -1;
    for (let i = clientIdx + 1; i < Math.min(clientIdx + 10, nextClientIdx); i++) {
      if (/roles?\s*[&\/]?\s*responsibilities/i.test(lines[i])) { startIdx = i + 1; break; }
    }

    // Fallback: no R&R header — start from first non-blank line after the Role: line
    if (startIdx === -1) {
      for (let i = clientIdx; i < Math.min(clientIdx + 8, nextClientIdx); i++) {
        if (/^role\s*[:\-]/i.test(lines[i].trim())) {
          let j = i + 1;
          while (j < nextClientIdx && !lines[j].trim()) j++;
          startIdx = j;
          break;
        }
      }
    }
    if (startIdx === -1) return exp;

    // Collect bullets until "Environment:" or next client section
    const bullets = [];
    for (let i = startIdx; i < nextClientIdx && bullets.length < 25; i++) {
      const t = lines[i].trim();
      if (!t) continue;
      if (/^environment:/i.test(t)) break;
      if (/^(?:client|employer|company)\s*[:\-]/i.test(t)) break;
      if (/^roles?\s*[&\/]?\s*responsibilities/i.test(t)) continue;
      if (t.length > 15) bullets.push(t);
    }

    return Object.assign({}, exp, { bullets });
  });
}

// ── Extract certifications from raw text ───────────────────
// Handles tab-separated multi-cert lines (common in IT resumes).
function extractCertsFromText(rawText) {
  const lines = rawText.split('\n');
  const certIdx = lines.findIndex(function(l) { return /^certif/i.test(l.trim()); });
  if (certIdx === -1) return [];

  const CERT_RE = /certif|associate|professional|administrator|architect|developer|engineer|security|fluency|cisco|microsoft|google|aws|azure|gcp|pmp|itil|comptia|cka|ckad|cks|rhce|mcp|mcse|ccna|ccnp|cism|cissp/i;
  const certs = [];
  for (let i = certIdx + 1; i < Math.min(certIdx + 15, lines.length); i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (/^(education|technical skills|professional experience|experience)/i.test(t)) break;
    // Split tab-separated and whitespace-heavy delimited certs on same line
    const parts = t.split(/\t+|\s{3,}/).map(function(p) { return p.trim(); }).filter(Boolean);
    for (const part of parts) {
      if (part.length > 5 && CERT_RE.test(part)) {
        certs.push({ name: part, date: '' });
      }
    }
  }
  return certs;
}

// ── Fingerprint: detect resume format (A/B/C/T/E) ────────
function fingerprint(text) {
  const lines = text.split('\n');

  // Format A: Client:/Duration:/Role:
  const A = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(?:client|employer|company)\s*[:\-]\s*(.+)/i);
    if (!m) continue;
    let company = m[1].split(/\s{3,}|\t/)[0].replace(/[.,\s]+$/, '').trim();
    let dates = '';
    const dm = lines[i].match(/[Dd]uration\s*[:\-]\s*(.+)/);
    if (dm) dates = dm[1].trim();
    let role = '';
    for (let j = i+1; j < Math.min(i+5, lines.length); j++) {
      const rm = lines[j].match(/^[Rr]ole\s*[:\-]\s*(.+)/);
      if (rm) { role = rm[1].trim(); break; }
    }
    if (company.length > 1) A.push({ company, dates, role });
  }
  if (A.length > 0) return { format:'A', experiences:A };

  // Format B: Company | Title | Date
  const B = [];
  for (const line of lines) {
    const parts = line.split(/\s*\|\s*/);
    if (parts.length >= 3) {
      const last = parts[parts.length-1].trim();
      if ((YEAR_RE.test(last) || DATE_RE.test(last)) && last.length < 40) {
        const company = parts[0].trim(), role = parts[1].trim(), dates = last;
        if (company.length > 1 && role.length > 1) B.push({ company, dates, role });
      }
    }
  }
  if (B.length > 0) return { format:'B', experiences:B };

  // Format T: Table-header (mammoth output)
  const T = [];
  const EDU_RE = /^(pgdmisca|b\.sc|degree|diploma|university|bachelor|master|mba|phd)/i;
  for (let i = 0; i < lines.length-1; i++) {
    const l = lines[i].trim();
    if (!l || l.length > 120 || YEAR_RE.test(l)) continue;
    if (/^(professional|summary|education|skills|certif|earlier|core)/i.test(l)) continue;
    if (EDU_RE.test(l)) continue;
    for (let j = i+1; j <= Math.min(i+2, lines.length-1); j++) {
      const d = lines[j].trim();
      if ((YEAR_RE.test(d) || DATE_RE.test(d)) && d.length < 45) {
        const parts = l.split(/\n|—|–/).map(s=>s.trim()).filter(Boolean);
        let role = parts[0] || l, company = parts[1] || parts[0] || l;
        if (/architect|engineer|lead|manager|developer|analyst|director|specialist|consultant/i.test(parts[0])) {
          role = parts[0]; company = parts[1] || parts[0];
        }
        if (!EDU_RE.test(company)) T.push({ company, role, dates:d });
        break;
      }
    }
  }
  if (T.length > 0) return { format:'T', experiences:T };

  return { format:'E', experiences:[] };
}

// ── Extract text from file buffer ─────────────────────────
async function extractText(buffer, originalName) {
  const ext = (originalName||'').split('.').pop().toLowerCase();
  if (ext === 'docx' || ext === 'doc') {
    const res = await mammoth.extractRawText({ buffer });
    return res.value;
  }
  if (ext === 'pdf') {
    const res = await pdfParse(buffer);
    return res.text;
  }
  return buffer.toString('utf8');
}

// ── Best-effort fallback parser (no Claude needed) ────────
// Extracts name/email/phone/skills/experiences from raw text
// using regex + fingerprint. Used when Claude is unavailable.
function bestEffortParse(rawText, fpExps) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  // Name: first non-empty line that looks like a person name (no @ : / digits)
  let name = '';
  for (const l of lines.slice(0, 6)) {
    if (l.length > 2 && l.length < 60 && !/[@:/\d]/.test(l) && /[A-Za-z]/.test(l)) {
      name = l.replace(/[^A-Za-z\s.\-]/g, '').trim();
      if (name.split(' ').length >= 2) break;
    }
  }

  // Contact fields via regex
  const emailM = rawText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  const phoneM = rawText.match(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/);
  const linkedinM = rawText.match(/linkedin\.com\/in\/[a-zA-Z0-9\-_%]+/i);
  const githubM   = rawText.match(/github\.com\/[a-zA-Z0-9\-_%]+/i);
  const locationM = rawText.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2})\b/);

  // Summary: paragraph after "summary" heading
  let summary = '';
  const summaryIdx = lines.findIndex(l => /^(professional\s+)?summary$/i.test(l));
  if (summaryIdx >= 0) {
    const summaryLines = [];
    for (let i = summaryIdx + 1; i < Math.min(summaryIdx + 8, lines.length); i++) {
      if (/^(experience|skills|education|certif)/i.test(lines[i])) break;
      if (lines[i].length > 20) summaryLines.push(lines[i]);
    }
    summary = summaryLines.join(' ').slice(0, 600);
  }

  // Skills: lines near a "skills" heading that look like tech terms
  const TECH_RE = /\b(AWS|Azure|GCP|Docker|Kubernetes|Terraform|Ansible|Jenkins|Python|Java|Linux|Git|SQL|NoSQL|CI\/CD|DevOps|React|Node|REST|API|Kafka|Redis|Nginx|Helm|Prometheus|Grafana|Splunk)\b/gi;
  const skillMatches = [...new Set((rawText.match(TECH_RE) || []).map(s => s.trim()))];
  const skills = skillMatches.length > 0 ? { 'Detected Skills': skillMatches } : {};

  // Experiences from fingerprint + bullet extraction from raw text
  const EDU_WORDS = /pgdmisca|b\.sc|bachelor|master|mba|phd|university|college|diploma/i;
  const baseExps = fpExps
    .filter(e => !EDU_WORDS.test(e.company) && !EDU_WORDS.test(e.role || ''))
    .map(e => ({ company: e.company, role: e.role || '', dates: e.dates || '', location: '', client: '', bullets: [] }));
  // Extract bullets directly from raw text — works regardless of resume length
  const experiences = extractBulletsFromText(rawText, baseExps);

  // Certifications: handles tab-separated multi-cert lines
  const certifications = extractCertsFromText(rawText);

  // Years experience from text
  const yrsM = rawText.match(/(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/i);
  const years = yrsM ? parseInt(yrsM[1]) : 0;

  return {
    name,
    title:    '',
    email:    emailM    ? emailM[0]    : '',
    phone:    phoneM    ? phoneM[0]    : '',
    location: locationM ? locationM[0] : '',
    linkedin: linkedinM ? linkedinM[0] : '',
    github:   githubM   ? githubM[0]   : '',
    summary,
    years,
    experiences,
    skills,
    certifications,
    education: [],
  };
}

// ── POST /api/resume/parse ─────────────────────────────────
// Accepts multipart file OR { text: "..." } JSON body
// Tier 1: Claude full parse. Tier 2: best-effort regex fallback.
router.post('/parse', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    let rawText = '';
    let docxBase64 = null;
    let originalName = '';

    if (req.file) {
      originalName = req.file.originalname;
      rawText = await extractText(req.file.buffer, originalName);
      const ext = originalName.split('.').pop().toLowerCase();
      if (ext === 'docx') docxBase64 = req.file.buffer.toString('base64');
    } else if (req.body.text) {
      rawText = req.body.text;
    } else {
      return res.status(400).json({ error: 'Provide a file upload or text body' });
    }

    if (!rawText || rawText.length < 50) {
      return res.status(400).json({ error: 'Could not extract text from file. Try a different format.' });
    }

    // Fingerprint to detect format
    const { format, experiences: fpExps } = fingerprint(rawText);

    // Build constraint string for Claude
    const expConstraints = fpExps.slice(0,5).map((e,i) =>
      `  [${i}] company="${e.company}", role="${e.role||'?'}", dates="${e.dates||'?'}"`
    ).join('\n') || '  (none — let Claude detect)';

    // ── Tier 1: Try Claude ────────────────────────────────
    let parsed = null;
    let claudeFailed = false;

    try {
      parsed = await askClaude(`Parse this resume completely. Return ONLY JSON:
{
  "name":"","title":"","email":"","phone":"","location":"","linkedin":"","github":"",
  "summary":"full professional summary from resume",
  "years":0,
  "experiences":[{
    "company":"","role":"","dates":"","location":"","client":"",
    "bullets":["copy exact bullet verbatim","another bullet verbatim"]
  }],
  "skills":{
    "Cloud Platforms":["AWS","Azure"],
    "CI/CD Tools":["Jenkins"],
    "Containerization":["Docker","Kubernetes"]
  },
  "certifications":[{"name":"AWS Certified Developer","date":"2023"}],
  "education":[{"school":"University Name","degree":"Bachelor of Science","start":"2009","end":"2013","location":""}]
}

RULES:
- Copy ALL bullet points VERBATIM from each role — do not summarize or skip any
- Extract skills grouped by category from the technical skills section
- Copy summary paragraph(s) verbatim
- Extract all certifications with name and year
- Extract all education entries

CRITICAL — Copy VERBATIM into experiences[], same order:
\${expConstraints}

Resume (format=\${format}):
\${rawText.slice(0, 8000)}`, 4000);
    } catch (claudeErr) {
      console.warn('[parse] Claude unavailable, using best-effort fallback:', claudeErr.message);
      claudeFailed = true;
    }

    // ── Tier 2: Fallback if Claude failed or returned empty ──
    if (!parsed || !parsed.name || (parsed.experiences || []).length === 0) {
      const fallback = bestEffortParse(rawText, fpExps);
      if (!parsed) {
        parsed = fallback;
      } else {
        // Claude returned something partial — fill in gaps from fallback
        if (!parsed.name)           parsed.name           = fallback.name;
        if (!parsed.email)          parsed.email          = fallback.email;
        if (!parsed.phone)          parsed.phone          = fallback.phone;
        if (!parsed.location)       parsed.location       = fallback.location;
        if (!parsed.linkedin)       parsed.linkedin       = fallback.linkedin;
        if (!parsed.github)         parsed.github         = fallback.github;
        if (!parsed.summary)        parsed.summary        = fallback.summary;
        if (!(parsed.experiences || []).length) parsed.experiences = fallback.experiences;
        if (!parsed.skills || !Object.keys(parsed.skills).length) parsed.skills = fallback.skills;
      }
      claudeFailed = true;
    }

    // ── Always fill bullets + certs from raw text (regex) ────
    // This covers: Claude not seeing bullets due to text slice, Claude skipping tabs in cert lines,
    // and the fallback path entirely. extractBulletsFromText skips experiences that already
    // have bullets so there is no overwrite risk.
    parsed.experiences = extractBulletsFromText(rawText, parsed.experiences || []);
    if (!parsed.certifications || parsed.certifications.length === 0) {
      parsed.certifications = extractCertsFromText(rawText);
    }

    // Filter education entries that slipped into experiences
    const EDU_WORDS = /pgdmisca|b\.sc|bachelor|master|mba|phd|university|college|diploma/i;
    const cleanExps = (parsed.experiences || []).filter(e =>
      !EDU_WORDS.test(e.company) && !EDU_WORDS.test(e.role||'')
    );
    parsed.experiences = cleanExps;

    // Normalize education
    if (typeof parsed.education === 'string') {
      parsed.education = parsed.education
        ? [{ school: parsed.education, degree:'', start:'', end:'', gpa:'', location:'' }]
        : [];
    }
    if (!Array.isArray(parsed.education)) parsed.education = [];

    // Normalize skills (flat array -> grouped object)
    if (Array.isArray(parsed.skills)) {
      parsed.skills = parsed.skills.length > 0 ? { 'Detected Skills': parsed.skills } : {};
    }
    if (!parsed.skills || typeof parsed.skills !== 'object') parsed.skills = {};

    // Log activity (never block response)
    try {
      await db.query(
        `INSERT INTO activity_logs (user_id,action_type,entity_type,details,page)
         VALUES ($1,'resume_parse','base_resume',$2,'Resume Optimizer')`,
        [req.user.id, JSON.stringify({ format, roles: cleanExps.length, chars: rawText.length, claudeFailed })]
      );
    } catch (logErr) { console.warn('[activity log]', logErr.message); }

    res.json({
      data: parsed,
      rawText,
      docxBase64,
      originalName,
      detectedFormat: format,
      extractedExperiences: cleanExps,
      claudeFailed,
    });
  } catch(err) { next(err); }
});

// ── POST /api/resume/save-base ─────────────────────────────
// Save parsed resume as a base resume (or new version of existing).
// content is always stored in the { header, summary, skills, experiences,
// education, certifications } shape that ResumeEditor reads back.
router.post('/save-base', authenticate, async (req, res, next) => {
  try {
    const {
      name, tech_stack, years_experience, parsed, content: contentOverride,
      rawText, docxBase64, originalName, detectedFormat, parentResumeId, template_name
    } = req.body;

    // If parentResumeId given → new version; else → version 1
    let versionNumber = 1;
    if (parentResumeId) {
      const vRes = await db.query(
        `SELECT MAX(version_number) AS max_v FROM base_resumes WHERE parent_resume_id=$1 OR id=$1`,
        [parentResumeId]
      );
      versionNumber = (vRes.rows[0]?.max_v || 1) + 1;
    }

    // Prefer a pre-shaped content object (sent by ResumeEditor on create).
    // Fall back to reshaping the flat parsed object from the upload flow.
    let storedContent;
    if (contentOverride && contentOverride.header) {
      storedContent = contentOverride;
    } else {
      const p = parsed || {};
      // Normalise skills: flat array → grouped object
      let skills = p.skills || {};
      if (Array.isArray(skills)) {
        skills = skills.length > 0 ? { 'Detected Skills': skills } : {};
      }
      // Normalise education: string → array
      let education = p.education || [];
      if (typeof education === 'string') {
        education = education
          ? [{ school: education, degree:'', start:'', end:'', gpa:'', location:'' }]
          : [];
      }
      if (!Array.isArray(education)) education = [];

      storedContent = {
        header: {
          name:     p.name     || '',
          email:    p.email    || '',
          phone:    p.phone    || '',
          location: p.location || '',
          linkedin: p.linkedin || '',
          github:   p.github   || '',
        },
        summary:        p.summary        || '',
        skills,
        experiences:    Array.isArray(p.experiences)    ? p.experiences    : [],
        education,
        certifications: Array.isArray(p.certifications) ? p.certifications : [],
        rawText:        rawText || '',
      };
    }

    const { rows } = await db.query(`
      INSERT INTO base_resumes
        (user_id,parent_resume_id,version_number,name,tech_stack,years_experience,
         summary_text,content,original_file_b64,original_file_name,original_file_type,
         detected_format,ats_score,template_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        req.user.id,
        parentResumeId || null,
        versionNumber,
        name || `Resume V${versionNumber}`,
        tech_stack || null,
        years_experience || null,
        storedContent.summary || (parsed && parsed.summary) || '',
        JSON.stringify(storedContent),
        docxBase64 || null,
        originalName || null,
        originalName?.split('.').pop()?.toLowerCase() || null,
        detectedFormat || 'E',
        0,
        template_name || 'classic',
      ]
    );

    await db.query(
      `INSERT INTO activity_logs (user_id,action_type,entity_type,entity_id,entity_name,page)
       VALUES ($1,'create','base_resume',$2,$3,'Resume Optimizer')`,
      [req.user.id, rows[0].id, rows[0].name]
    );

    // ── Auto-save bullets to points library (non-blocking) ──
    // Each bullet from each experience is batch-inserted with per-user
    // duplicate detection and auto ecosystem detection.
    try {
      const allBullets = (storedContent.experiences || []).flatMap(function(exp) {
        return (exp.bullets || [])
          .filter(function(b) { return b && b.trim().length > 15; })
          .map(function(b) { return { text: b.trim(), role: exp.role || '', company: exp.company || '' }; });
      });

      for (const bullet of allBullets) {
        // Skip if user already has this exact bullet
        const dup = await db.query(
          'SELECT id FROM bullet_points WHERE created_by=$1 AND content=$2 AND is_flagged=FALSE LIMIT 1',
          [req.user.id, bullet.text]
        );
        if (dup.rows[0]) continue;

        // Auto-detect ecosystem from bullet text
        const ecoId = await detectEcosystem(bullet.text);

        await db.query(
          `INSERT INTO bullet_points
             (content, ecosystem_id, stack_label, experience_role, tags, source, created_by)
           VALUES ($1, $2, $3, $4, $5, 'imported', $6)`,
          [bullet.text, ecoId, bullet.company || null, bullet.role || null, [], req.user.id]
        );
      }
      if (allBullets.length > 0) {
        console.log('[save-base] auto-saved', allBullets.length, 'bullets to points library for user', req.user.id);
      }
    } catch (pointsErr) {
      console.warn('[save-base] points auto-save skipped:', pointsErr.message);
    }

    res.status(201).json(rows[0]);
  } catch(err) { next(err); }
});

// ── GET /api/resume/base ──────────────────────────────────
router.get('/base', authenticate, async (req, res, next) => {
  try {
    let query, params;
    if (req.user.role === 'admin') {
      query = `SELECT br.*, u.name AS user_name FROM base_resumes br
               JOIN users u ON u.id=br.user_id
               WHERE br.is_active=TRUE ORDER BY br.updated_at DESC`;
      params = [];
    } else {
      query = `SELECT br.*, u.name AS user_name FROM base_resumes br
               JOIN users u ON u.id=br.user_id
               WHERE br.user_id=$1 AND br.is_active=TRUE ORDER BY br.updated_at DESC`;
      params = [req.user.id];
    }
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch(err) { next(err); }
});

// ── GET /api/resume/base/:id ──────────────────────────────
router.get('/base/:id', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT br.*, u.name AS user_name FROM base_resumes br
       JOIN users u ON u.id=br.user_id WHERE br.id=$1 AND br.is_active=TRUE`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error:'Not found' });
    if (req.user.role !== 'admin' && rows[0].user_id !== req.user.id)
      return res.status(403).json({ error:'Access denied' });
    res.json(rows[0]);
  } catch(err) { next(err); }
});

// ── GET /api/resume/base/:id/versions ─────────────────────
router.get('/base/:id/versions', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM base_resumes
       WHERE (id=$1 OR parent_resume_id=$1) AND is_active=TRUE
       ORDER BY version_number ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch(err) { next(err); }
});

// ── DELETE /api/resume/base/:id ───────────────────────────
router.delete('/base/:id', authenticate, async (req, res, next) => {
  try {
    await db.query(`UPDATE base_resumes SET is_active=FALSE WHERE id=$1`, [req.params.id]);
    res.json({ message:'Deleted' });
  } catch(err) { next(err); }
});

// ── GET /api/resume/tailored ──────────────────────────────
router.get('/tailored', authenticate, async (req, res, next) => {
  try {
    let query, params;
    if (req.user.role === 'admin') {
      query = `SELECT tr.*, br.name AS base_name, u.name AS user_name
               FROM tailored_resumes tr
               JOIN base_resumes br ON br.id=tr.base_resume_id
               JOIN users u ON u.id=tr.user_id
               ORDER BY tr.updated_at DESC`;
      params = [];
    } else {
      query = `SELECT tr.*, br.name AS base_name
               FROM tailored_resumes tr
               JOIN base_resumes br ON br.id=tr.base_resume_id
               WHERE tr.user_id=$1 ORDER BY tr.updated_at DESC`;
      params = [req.user.id];
    }
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch(err) { next(err); }
});

// ── POST /api/resume/tailored ─────────────────────────────
router.post('/tailored', authenticate, async (req, res, next) => {
  try {
    const {
      base_resume_id, name, target_company, target_title,
      job_description, jd_parsed, gap_analysis, selected_points,
      content, match_score, ats_score_before, ats_score_after,
      result_docx_b64
    } = req.body;
    if (!base_resume_id) return res.status(400).json({ error:'base_resume_id required' });

    // Auto-version
    const vRes = await db.query(
      `SELECT COUNT(*) AS cnt FROM tailored_resumes WHERE base_resume_id=$1 AND user_id=$2`,
      [base_resume_id, req.user.id]
    );
    const versionNumber = parseInt(vRes.rows[0].cnt) + 1;

    const { rows } = await db.query(`
      INSERT INTO tailored_resumes
        (base_resume_id,user_id,name,version_number,target_company,target_title,
         job_description,jd_parsed,gap_analysis,selected_points,content,
         match_score,ats_score_before,ats_score_after,result_docx_b64)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *`,
      [base_resume_id, req.user.id, name||`V${versionNumber}`, versionNumber,
       target_company, target_title, job_description,
       JSON.stringify(jd_parsed||{}), JSON.stringify(gap_analysis||{}),
       JSON.stringify(selected_points||[]), JSON.stringify(content||{}),
       match_score||0, ats_score_before||0, ats_score_after||0,
       result_docx_b64||null]
    );

    await db.query(
      `INSERT INTO activity_logs (user_id,action_type,entity_type,entity_id,entity_name,page)
       VALUES ($1,'create','tailored_resume',$2,$3,'Resume Optimizer')`,
      [req.user.id, rows[0].id, rows[0].name]
    );

    res.status(201).json(rows[0]);
  } catch(err) { next(err); }
});

// ── PUT /api/resume/base/:id ──────────────────────────────
// Update content/name/template of a base resume.
// Params: $1-$7 SET, $8=id, $9=user_id, $10=role
router.put('/base/:id', authenticate, async (req, res, next) => {
  try {
    const { name, tech_stack, years_experience, summary_text, content, ats_score, template_name } = req.body;
    const { rows } = await db.query(`
      UPDATE base_resumes SET
        name=COALESCE($1,name),
        tech_stack=COALESCE($2,tech_stack),
        years_experience=COALESCE($3,years_experience),
        summary_text=COALESCE($4,summary_text),
        content=COALESCE($5::jsonb,content),
        ats_score=COALESCE($6,ats_score),
        template_name=COALESCE($7,template_name)
      WHERE id=$8 AND (user_id=$9 OR $10='admin')
      RETURNING *`,
      [
        name            || null,
        tech_stack      || null,
        years_experience || null,
        summary_text    || null,
        content ? JSON.stringify(content) : null,
        ats_score       || null,
        template_name   || null,
        req.params.id,
        req.user.id,
        req.user.role,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error:'Not found or access denied' });
    res.json(rows[0]);
  } catch(err) { next(err); }
});

// ── POST /api/resume/generate-summary ────────────────────
// AI-generate a professional summary from prompt context.
router.post('/generate-summary', authenticate, async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });
    const { askClaudeText } = require('../services/claude');
    const summary = await askClaudeText(prompt, 300,
      'You are an expert IT resume writer. Write concise, professional, human-sounding summaries. No AI cliches. No "I am" or "I have". Sound like the candidate wrote it themselves.'
    );
    res.json({ summary: summary.trim() });
  } catch(err) { next(err); }
});

module.exports = router;
