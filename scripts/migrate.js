const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load env vars if running locally (optional, requires dotenv)
// require('dotenv').config(); 

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ DATABASE_URL is not set. Cannot run migration.");
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function migrate() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, '../database/init.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("🚀 Running migration...");
        await client.query(sql);
        console.log("✅ Migration completed successfully.");
    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
