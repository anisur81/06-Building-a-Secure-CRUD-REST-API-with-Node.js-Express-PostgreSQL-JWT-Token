const db = require('../config/db');

/*
exports.getUsers = async(req,res)=>{

    const result =
        await db.query(
            'SELECT id,username FROM users'
        );

    res.json(result.rows);
};
*/



exports.getUsers = async(req,res)=>{
    try{
        const result =
            await db.query(
                'SELECT id,username FROM users'
            );

        res.json(result.rows);

    }catch(error){
        res.status(500).json({
            message:error.message
        });
    }
};


exports.getUser = async(req,res)=>{

    const result =
        await db.query(
            'SELECT id,username FROM users WHERE id=$1',
            [req.params.id]
        );

    res.json(result.rows[0]);
};

exports.createUser = async(req,res)=>{

    const { username,password } = req.body;

    const result =
        await db.query(
            'INSERT INTO users(username,password) VALUES($1,$2) RETURNING *',
            [username,password]
        );

    res.json(result.rows[0]);
};

exports.updateUser = async(req,res)=>{

    const { username } = req.body;

    const result =
        await db.query(
            'UPDATE users SET username=$1 WHERE id=$2 RETURNING *',
            [username, req.params.id]
        );

    res.json(result.rows[0]);
};

exports.deleteUser = async(req,res)=>{

    await db.query(
        'DELETE FROM users WHERE id=$1',
        [req.params.id]
    );

    res.json({
        message:'Deleted'
    });
};