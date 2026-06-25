const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {

    const authHeader = req.headers.authorization;

    console.log('Authorization:', authHeader);
    console.log('ACCESS_TOKEN_SECRET:', process.env.ACCESS_TOKEN_SECRET);

    if (!authHeader) {
        return res.sendStatus(401);
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET,
        (err, user) => {

            if (err) {
                console.log('JWT Error:', err.message);
                return res.sendStatus(403);
            }

            console.log('Decoded User:', user);

            req.user = user;
            next();
        }
    );
};