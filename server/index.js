require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const { execSync } = require('child_process');

const app  = express();
const PORT = process.env.PORT || 5000;

// Python health check
let pythonOk = false;
try {
  execSync('python3 -c "import docx; print(1)"', { timeout:5000, stdio:'pipe' });
  pythonOk = true;
  console.log('✓ Python3 + python-docx — DOCX export enabled');
} catch {
  console.warn('⚠ python-docx not found — falling back to text export. Run: pip3 install python-docx');
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 15*60*1000, max: 500 }));

// Routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/resume',      require('./routes/resume'));
app.use('/api/jd',          require('./routes/jd'));
app.use('/api/analysis',    require('./routes/analysis'));
app.use('/api/integrate',   require('./routes/integrate'));
app.use('/api/export',      require('./routes/export'));
app.use('/api/points',      require('./routes/points'));
app.use('/api/monitoring',  require('./routes/monitoring'));
app.use('/api/coverletter', require('./routes/coverletter'));
app.use('/api/home',        require('./routes/home'));
app.use('/api/interview',   require('./routes/interview'));

app.get('/api/health', (_req, res) => res.json({
  status: 'ok', timestamp: new Date().toISOString(),
  ai: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
  python: pythonOk ? 'available' : 'missing',
}));

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../client/dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(err.status||500).json({ error: err.message||'Internal server error' });
});

app.listen(PORT, () => console.log(`✦ TalentForge v2 → http://localhost:${PORT}`));
