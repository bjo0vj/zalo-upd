const { Pool } = require('pg');
const config = require('../config.yml'); // Assuming config.yml is loadable or we use process.env

// Use DATABASE_URL from environment (Railway provides this)
const connectionString = process.env.DATABASE_URL;

let pool;

if (connectionString) {
    pool = new Pool({
        connectionString,
        ssl: {
            rejectUnauthorized: false // Required for Railway/Heroku Postgres
        },
        max: 10, // Max connections in pool
        idleTimeoutMillis: 30000
    });
} else {
    console.warn("⚠️ DATABASE_URL not found. Database features will be disabled.");
}

async function query(text, params) {
    if (!pool) return null;
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        // console.log('executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (err) {
        console.error('Error executing query', { text, err });
        throw err;
    }
}

// Cache helpers
async function saveCache(key, data) {
    if (!pool) return;
    const queryText = `
        INSERT INTO cache (id, data, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
    await query(queryText, [key, data]); // pg handles JSON stringification if passed as object, but safer to pass object for JSONB
}

async function loadCache(key) {
    if (!pool) return null;
    const queryText = 'SELECT data FROM cache WHERE id = $1';
    const res = await query(queryText, [key]);
    if (res.rows.length > 0) {
        return res.rows[0].data;
    }
    return null;
}

async function appendMessage(userId, text, meta = {}, expiresAt = null) {
    if (!pool) return;
    const queryText = `
        INSERT INTO messages (user_id, message_text, metadata, expires_at)
        VALUES ($1, $2, $3, $4)
    `;
    await query(queryText, [userId, text, meta, expiresAt]);
}

module.exports = {
    query,
    saveCache,
    loadCache,
    appendMessage,
    pool
};
