const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const pool = require('../config/db');

const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            username: user.username
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRE
        }
    );
};

const generateRefreshToken = (user) => {
    return jwt.sign(
        {
            id: user.id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRE
        }
    );
};

exports.register = async (req, res) => {
    try {

        const { username, password } = req.body;

        const existing = await User.findByUsername(username);

        if(existing){
            return res.status(400).json({
                message:"User already exists"
            });
        }

        const hashedPassword =
            await bcrypt.hash(password, 12);

        const user = await User.createUser(
            username,
            hashedPassword
        );

        res.status(201).json({
            message:"User registered",
            user
        });

    } catch(error){
        res.status(500).json(error.message);
    }
};

exports.login = async (req,res)=>{
    try{

        const { username,password } = req.body;

        const user =
            await User.findByUsername(username);

        if(!user){
            return res.status(401).json({
                message:"Invalid credentials"
            });
        }

        const valid =
            await bcrypt.compare(
                password,
                user.password
            );

        if(!valid){
            return res.status(401).json({
                message:"Invalid credentials"
            });
        }

        const accessToken =
            generateAccessToken(user);

        const refreshToken =
            generateRefreshToken(user);

        await User.saveRefreshToken(
            user.id,
            refreshToken
        );

        res.json({
            accessToken,
            refreshToken
        });

    }catch(error){
        res.status(500).json(error.message);
    }
};





exports.refreshToken = async(req,res)=>{

    const { refreshToken } = req.body;

    if(!refreshToken){
        return res.sendStatus(401);
    }

    jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        (err,user)=>{

            if(err){
                return res.sendStatus(403);
            }

            const accessToken =
                jwt.sign(
                    {
                        id:user.id
                    },
                    process.env.ACCESS_TOKEN_SECRET,
                    {
                        expiresIn:'30m'
                    }
                );

            res.json({
                accessToken
            });
        }
    );
};




exports.logout = async (req, res) => {
    try {
        const { username } = req.body;

        await pool.query(
            'UPDATE users SET refresh_token = NULL WHERE username = $1',
            [username]
        );

        res.json({
            message: 'Logged out'
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};