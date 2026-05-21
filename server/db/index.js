require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/talentforge',
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected client error:', err.message);
});

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
