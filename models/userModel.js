const db = require('../config/db');

const createUser = async (username, password) => {
    const result = await db.query(
        'INSERT INTO users(username,password) VALUES($1,$2) RETURNING *',
        [username, password]
    );

    return result.rows[0];
};

const findByUsername = async (username) => {
    const result = await db.query(
        'SELECT * FROM users WHERE username=$1',
        [username]
    );

    return result.rows[0];
};

const saveRefreshToken = async (id, token) => {
    await db.query(
        'UPDATE users SET refresh_token=$1 WHERE id=$2',
        [token, id]
    );
};

module.exports = {
    createUser,
    findByUsername,
    saveRefreshToken
};