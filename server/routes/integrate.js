const express = require('express');
const { spawn } = require('child_process');
const path    = require('path');
const fs      = require('fs');
const db      = require('../db');
const { authenticate } = require('../middleware/auth');

const router  = express.Router();
const INSERT_SCRIPT  = path.join(__dirname, '../scripts/insert_bullets.py');
const GENERATE_SCRIPT = path.join(__dirname, '../scripts/generate_docx.py');

router.use(authenticate);

// ── Run python script with JSON payload, return stdout string ──
function runPython(scriptPath, payload) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(scriptPath)) {
      return reject(new Error('Script not found: ' + scriptPath));
    }
    const json  = JSON.stringify(payload);
    const child = spawn('python3', [scriptPath], { timeout: 90000 });
    let stdout = '', stderr = '';
    child.stdin.on('error', e => reject(new Error('stdin error: ' + e.message)));
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', code => {
      if (stderr) console.warn('[python]', scriptPath.split('/').pop(), stderr.slice(0, 400));
      if (code !== 0 || !stdout.trim()) {
        reject(new Error('Python failed: ' + (stderr || 'exit ' + code).slice(0, 200)));
      } else {
        resolve(stdout.trim());
      }
    });
    child.on('error', e => reject(new Error('Could not start python3: ' + e.message)));
    try { child.stdin.write(json); child.stdin.end(); }
    catch (e) { reject(new Error('Failed to send data to Python: ' + e.message)); }
  });
}

// ── Insert bullets into existing DOCX (insert_bullets.py) ─
function insertIntoDOCX(originalDocxBase64, roleInsertions) {
  return runPython(INSERT_SCRIPT, {
    docx: originalDocxBase64,
    roles: roleInsertions.map((r, i) => ({
      company:    r.company || r.anchor || '',
      role_index: r.roleIndex !== undefined ? r.roleIndex : i,
      bullets:    (r.bullets || []).filter(Boolean),
    })),
  });
}

// ── Generate fresh DOCX from template (generate_docx.py) ──
function generateFromTemplate(resumeParsed, selectedPointsByRole, templateName) {
  // Normalise resumeParsed — handle both old flat shape and new header-wrapped shape
  var content = resumeParsed || {};
  if (!content.header && (content.name || content.email)) {
    // Old flat shape — reshape
    content = {
      header: {
        name:     content.name     || '',
        email:    content.email    || '',
        phone:    content.phone    || '',
        location: content.location || '',
        linkedin: content.linkedin || '',
        github:   content.github   || '',
      },
      summary:        content.summary        || '',
      skills:         content.skills         || {},
      experiences:    content.experiences    || [],
      education:      content.education      || [],
      certifications: content.certifications || [],
    };
  }
  return runPython(GENERATE_SCRIPT, {
    content:             content,
    selectedPointsByRole: selectedPointsByRole || [],
    templateName:        templateName || 'classic',
  });
}

// ── Text integration (pure JS, no subprocess) ─────────────
function insertIntoText(resumeText, roleInsertions) {
  const lines = resumeText.split('\n');
  const norm  = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const ops   = [];
  for (const { anchor, bullets } of roleInsertions) {
    if (!anchor || !bullets || !bullets.length) continue;
    const key    = norm(anchor).slice(0, 10);
    const secIdx = lines.findIndex(l => key && norm(l).includes(key));
    if (secIdx === -1) continue;
    let lastContent = secIdx;
    for (let i = secIdx + 1; i < Math.min(secIdx + 80, lines.length); i++) {
      const t = lines[i].trim();
      if (t.toLowerCase().startsWith('environment:') || (t.toLowerCase().startsWith('client:') && i > secIdx + 4)) break;
      if (t) lastContent = i;
    }
    ops.push({ insertAfter: lastContent, bullets });
  }
  ops.sort((a, b) => b.insertAfter - a.insertAfter);
  const result = [...lines];
  for (const { insertAfter, bullets } of ops) {
    result.splice(insertAfter + 1, 0, ...bullets);
  }
  return result.join('\n');
}

// ── POST /api/integrate/run ────────────────────────────────
router.post('/run', async (req, res, next) => {
  try {
    const {
      resumeText, resumeParsed, selectedPointsByRole,
      originalDocxBase64, extractedExperiences, detectedFormat,
    } = req.body;

    if (!selectedPointsByRole || !selectedPointsByRole.length) {
      return res.status(400).json({ error: 'selectedPointsByRole required' });
    }

    const roleInsertions = selectedPointsByRole.map((r, i) => ({
      company:   r.company || (resumeParsed && resumeParsed.experiences && resumeParsed.experiences[i] ? resumeParsed.experiences[i].company : ''),
      anchor:    r.company || '',
      roleIndex: i,
      bullets:   (r.bullets || []).filter(Boolean),
    }));

    // ── Always generate plain-text version (fast, no subprocess) ──
    const integratedResume = insertIntoText(resumeText || '', roleInsertions);

    // ── Always generate a DOCX ─────────────────────────────────
    let resultDocxBase64 = null;
    let mode = 'generated'; // 'inserted' = into original | 'generated' = from template
    const insertedBullets = roleInsertions.flatMap(r =>
      (r.bullets || []).map(b => ({ role: r.company, bullet: b }))
    );

    if (originalDocxBase64) {
      // Try inserting into the original DOCX first (preserves original formatting)
      try {
        resultDocxBase64 = await insertIntoDOCX(originalDocxBase64, roleInsertions);
        mode = 'inserted';
        console.log('[integrate] DOCX insert succeeded, mode=inserted');
      } catch (pyErr) {
        console.error('[integrate] DOCX insert failed, falling back to template generation:', pyErr.message);
      }
    }

    if (!resultDocxBase64) {
      // No original DOCX, or insert failed — generate fresh from template
      try {
        // Detect template from base resume — default to classic
        const templateName = (resumeParsed && resumeParsed.template_name) || 'classic';
        resultDocxBase64 = await generateFromTemplate(resumeParsed, selectedPointsByRole, templateName);
        mode = 'generated';
        console.log('[integrate] Template DOCX generated, template=' + templateName);
      } catch (genErr) {
        // Generation failed — DOCX unavailable but TXT still works
        console.error('[integrate] DOCX generation failed:', genErr.message);
        resultDocxBase64 = null;
      }
    }

    await db.query(
      `INSERT INTO activity_logs (user_id,action_type,entity_type,details,page)
       VALUES ($1,'resume_export','tailored_resume',$2,'Resume Optimizer')`,
      [req.user.id, JSON.stringify({ mode, totalBullets: insertedBullets.length })]
    );

    // Always return both — client shows both download buttons
    res.json({
      data: {
        resultDocxBase64,   // null only if both DOCX paths failed
        integratedResume,   // always present
        insertedBullets,
        mode,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
