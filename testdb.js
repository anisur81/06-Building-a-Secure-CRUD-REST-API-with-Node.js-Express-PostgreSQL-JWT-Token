require('dotenv').config();
const pool = require('./config/db');

(async () => {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ PostgreSQL Connected');
        console.log(result.rows[0]);
        await pool.end();
    } catch (err) {
        console.error('❌ PostgreSQL Connection Failed');
        console.error(err.message);
    }
})();