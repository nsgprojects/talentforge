const express = require('express');
const db      = require('../db');
const { askClaude } = require('../services/claude');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function calcMonths(dates) {
  if (!dates) return 0;
  var parts = dates.split(/\s*[-–]\s*/);
  function toDate(s) {
    if (!s) return null;
    var n = s.toLowerCase().trim();
    if (/present|current|now/.test(n)) return new Date();
    var y = n.match(/\b(19|20)\d{2}\b/);
    if (!y) return null;
    var ms = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    var m = 0;
    for (var i = 0; i < ms.length; i++) if (n.includes(ms[i])) { m = i; break; }
    return new Date(+y[0], m);
  }
  var start = toDate(parts[0]);
  var end   = parts[1] ? toDate(parts[1]) : new Date();
  if (!start || !end) return 0;
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
}

function seniorityTier(months) {
  return months >= 72 ? 'PRINCIPAL' : months >= 24 ? 'SENIOR' : 'MID';
}

var TIER_VERBS = {
  PRINCIPAL: 'Designed, Established, Architected, Spearheaded, Championed',
  SENIOR:    'Architected, Owned, Built, Engineered, Drove, Streamlined',
  MID:       'Implemented, Developed, Configured, Deployed, Automated',
};

// ── SINGLE COMBINED CALL: gaps + bullets together ─────────
// POST /api/analysis/gaps  (now does both in one call)
router.post('/gaps', async (req, res, next) => {
  try {
    var { resumeText, resumeParsed, jdText, jdParsed } = req.body;
    if (!resumeText || !jdText) return res.status(400).json({ error: 'resumeText and jdText required' });

    var experiences = (resumeParsed && resumeParsed.experiences) ? resumeParsed.experiences : [];
    var top3 = experiences.slice(0, 3);
    var roleContext = top3.map(function(e, i) {
      var months = calcMonths(e.dates);
      var tier   = seniorityTier(months);
      var verbs  = TIER_VERBS[tier];
      var bullets = (e.bullets || []).slice(0, 2).map(function(b) { return '    - ' + b; }).join('\n') || '    (none)';
      return 'Role ' + i + ': "' + (e.role || '?') + '" at "' + (e.company || '?') + '" (' + (e.dates || '?') + ', tier=' + tier + ')\n  Verbs: ' + verbs + '\n  Bullets:\n' + bullets;
    }).join('\n\n');

    var combined = await askClaude(
      'You are a senior ATS resume strategist. Do BOTH tasks in ONE response.\n\n' +
      'RESUME:\n' + (resumeText || '').slice(0, 6000) + '\n\n' +
      'JOB DESCRIPTION:\n' + (jdText || '').slice(0, 3000) + '\n\n' +
      'ROLES:\n' + roleContext + '\n\n' +
      'Return ONLY this JSON with both gap analysis AND generated bullets:\n' +
      '{\n' +
      '  "matchScore": 72,\n' +
      '  "industry": "Cloud/DevOps",\n' +
      '  "yearsInResume": 10,\n' +
      '  "yearsInJD": 8,\n' +
      '  "matchedSkills": ["skill"],\n' +
      '  "missingSkills": [{"skill": "name", "priority": "HIGH", "context": "why"}],\n' +
      '  "ecosystemGaps": [{"name": "gap", "severity": "HIGH"}],\n' +
      '  "keyThemes": ["theme"],\n' +
      '  "overallRecommendation": "1-2 sentences",\n' +
      '  "roles": [\n' +
      '    {\n' +
      '      "roleIndex": 0,\n' +
      '      "company": "",\n' +
      '      "roleName": "",\n' +
      '      "dates": "",\n' +
      '      "suggestedPoints": [\n' +
      '        {"text": "bullet using action verb + metric", "confidence": "HIGH", "rationale": "why", "qualityScore": 3}\n' +
      '      ]\n' +
      '    }\n' +
      '  ]\n' +
      '}\n\n' +
      'RULES FOR BULLETS:\n' +
      '- Generate exactly 5 bullets per role\n' +
      '- CRITICAL: Sound like a real senior engineer wrote these on their own resume — NOT like AI generated them\n' +
      '- BANNED WORDS (never use): Spearheaded, Leveraged, Utilized, Championed, Orchestrated, Transformed, Revolutionized, Synergized, Streamlined, Robust, Cutting-edge\n' +
      '- USE INSTEAD: Built, Owned, Led, Designed, Wrote, Set up, Moved, Fixed, Cut, Grew, Shipped, Ran, Managed\n' +
      '- VARY sentence structure (not always Verb + Object + Metric):\n' +
      '  * 2 bullets: start with action verb, include ONE realistic specific detail (team size, system count, time saved — only if believable from the resume context)\n' +
      '  * 2 bullets: describe what was BUILT or OWNED focusing on the tech stack and scope — no forced numbers\n' +
      '  * 1 bullet: describe a collaboration, a hard problem solved, or an architectural decision made\n' +
      '- NEVER invent percentages — if you use a number it must be clearly grounded in the resume content\n' +
      '- VARY bullet length — some short and punchy (1 sentence), some longer with context (2 sentences max)\n' +
      '- Reference the ACTUAL company industry context if known (media company = ad delivery, streaming; automotive = manufacturing, connected vehicles)\n' +
      '- Each bullet across ALL roles must start differently — no two bullets can open with the same word\n' +
      '- Read the existing bullets in the resume and MATCH that engineer style and voice',
      5000
    );

    // Apply years penalty
    if (combined.yearsInJD > 0 && combined.yearsInResume < combined.yearsInJD) {
      var penalty = Math.min(20, (combined.yearsInJD - combined.yearsInResume) * 4);
      combined.matchScore = Math.max(0, (combined.matchScore || 50) - penalty);
    }

    // Evidence-based confidence scoring
    var rt = (resumeText || '').toLowerCase();
    (combined.roles || []).forEach(function(role) {
      (role.suggestedPoints || []).forEach(function(pt) {
        var techs = (pt.text || '').match(/\b[A-Z][a-zA-Z0-9]{2,}\b/g) || [];
        var matched = techs.filter(function(t) { return rt.includes(t.toLowerCase()); }).length;
        if (techs.length > 0) {
          var ratio = matched / techs.length;
          pt.confidence = ratio >= 0.7 ? 'HIGH' : ratio >= 0.35 ? 'MEDIUM' : 'LOW';
        }
        if (!pt.qualityScore) pt.qualityScore = 2;
      });
    });

    try {
      await db.query("INSERT INTO activity_logs (user_id,action_type,details,page) VALUES ($1,'gap_analysis',$2,'Optimizer')",
        [req.user.id, JSON.stringify({ matchScore: combined.matchScore, gaps: (combined.missingSkills || []).length })]);
    } catch (logErr) { console.warn('[activity log]', logErr.message); }

    res.json({ data: combined });
  } catch (err) { next(err); }
});

// ── GENERATE is now a pass-through (gaps already includes bullets) ──
// POST /api/analysis/generate  — kept for compatibility, just returns gapAnalysis roles
router.post('/generate', async (req, res, next) => {
  try {
    var { gapAnalysis } = req.body;
    if (!gapAnalysis) return res.status(400).json({ error: 'gapAnalysis required' });
    // Bullets already generated in /gaps — just return them
    res.json({ data: { roles: gapAnalysis.roles || [] } });
  } catch (err) { next(err); }
});

module.exports = router;
