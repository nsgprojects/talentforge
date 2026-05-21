require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { pool } = require('./index');

async function migrate() {
  console.log('⟳  Running migration…');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('✓  Migration complete');
  } catch(err) {
    console.error('✗  Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}
migrate();
