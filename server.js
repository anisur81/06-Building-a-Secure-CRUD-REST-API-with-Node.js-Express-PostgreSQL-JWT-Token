require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());

app.use(
    '/api/auth',
    require('./routes/authRoutes')
);

app.use(
    '/api/users',
    require('./routes/userRoutes')
);

const PORT =
process.env.PORT || 5000;



app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Secure Node.js REST API is running'
    });
});

app.listen(PORT,'0.0.0.0',()=>{
    console.log(
        `Server running on port ${PORT}`
    );
});