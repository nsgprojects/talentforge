const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// POST /api/export/docx-from-base64
router.post('/docx-from-base64', async (req, res, next) => {
  try {
    const { base64 } = req.body;
    if (!base64) return res.status(400).json({ error:'base64 required' });
    const buf = Buffer.from(base64, 'base64');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="optimized_resume.docx"');
    res.send(buf);
  } catch(err) { next(err); }
});

// POST /api/export/txt
router.post('/txt', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error:'text required' });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="optimized_resume.txt"');
    res.send(text);
  } catch(err) { next(err); }
});

module.exports = router;
