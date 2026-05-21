const express = require('express');
const { authenticate } = require('../middleware/auth');
const { askClaude }   = require('../services/claude');

const router = express.Router();
router.use(authenticate);

// POST /api/home/market-pulse  — US IT market trends, cached on client 24h
router.get('/market-pulse', async (req, res, next) => {
  try {
    const data = await askClaude(`You are an expert US IT staffing market analyst.
Return ONLY valid JSON — no prose, no markdown:
{
  "topSkills": ["10 most in-demand IT skills in US job market right now, concise labels"],
  "hotTitles": ["5 hottest IT job titles in US staffing right now"],
  "insight": "2-3 sentence market insight paragraph for IT recruiters covering current hiring trends, rate movements, and what to tell candidates"
}
Base your answer on: Stack Overflow Developer Survey, LinkedIn Talent Insights, Dice Tech Job Report, Indeed Hiring Lab, and Bureau of Labor Statistics data for IT occupations. Be specific and current.`, 600);
    res.json({ data });
  } catch (err) {
    res.json({ data: null, error: err.message });
  }
});

// GET /api/home/news  — US IT staffing news, cached on client 2h
router.get('/news', async (req, res, next) => {
  try {
    const data = await askClaude(`You are an expert US IT staffing industry analyst.
Return ONLY a valid JSON array of 5 news items — start with [ and end with ], no markdown, no prose:
[
  {
    "title": "specific headline about US IT staffing, tech hiring, H-1B, or workforce trends",
    "summary": "2-3 sentence summary relevant to an IT staffing recruiter — what does this mean for their business?",
    "category": "one of: Visa & Immigration | Market Trends | Industry News | Workforce Trends",
    "time": "Today | This week | This month",
    "url": "a real, valid URL to a relevant authoritative source (uscis.gov, dice.com, bls.gov, linkedin.com, staffingindustry.com)"
  }
]
Focus on: H-1B cap and visa updates, tech hiring trends, IT salary movements, remote work policies, top staffing firm news, OPT/STEM extension news, and skills demand shifts. Make each item specific and actionable for a recruiter.`, 1000);

    // data may be an array directly, or an object containing an array
    let items = null;
    if (Array.isArray(data)) {
      items = data;
    } else if (data && typeof data === 'object') {
      // Claude sometimes wraps in { "news": [...] } or { "items": [...] }
      const key = Object.keys(data).find(k => Array.isArray(data[k]));
      if (key) items = data[key];
    }
    res.json({ data: (items && items.length > 0) ? items : null });
  } catch (err) {
    res.json({ data: null, error: err.message });
  }
});

module.exports = router;
