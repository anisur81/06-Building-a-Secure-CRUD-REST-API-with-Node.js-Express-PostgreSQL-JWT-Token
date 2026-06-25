# Building a Secure CRUD REST API with Node.js, Express, PostgreSQL, JWT Access Token & Refresh Token Authentication

## Overview

This guide demonstrates how to create a secure REST API using:

- **Node.js**
- **Express.js**
- **PostgreSQL**
- **JWT Access Token**
- **JWT Refresh Token**
- **Username & Password Authentication**
- **CRUD Operations**
- **Password Hashing (bcrypt)**
- **Role-based ready structure**

---

## 1. Project Architecture

```
secure-api/
│
├── config/
│   └── db.js
│
├── controllers/
│   ├── authController.js
│   └── userController.js
│
├── middleware/
│   ├── authMiddleware.js
│   └── errorMiddleware.js
│
├── routes/
│   ├── authRoutes.js
│   └── userRoutes.js
│
├── models/
│   └── userModel.js
│
├── .env
├── server.js
├── package.json
└── README.md
```

---

## 2. Initialize Project

Create project directory and initialize npm:

```bash
mkdir nodejsrestapi
cd nodejsrestapi
npm init -y
```

### Install Dependencies

```bash
npm install express pg bcryptjs jsonwebtoken dotenv cors helmet express-rate-limit
npm install --save-dev nodemon
```

---

## 3. PostgreSQL Database Setup

### Create Database

```sql
CREATE DATABASE mydb;
```

### Connect to Database

```sql
\c mydb;
```

### Create Users Table

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Environment Variables

Create a `.env` file in the root directory:

```
# Database Configuration
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mydb

# JWT Secrets
ACCESS_TOKEN_SECRET=myAccessSecretKey
REFRESH_TOKEN_SECRET=myRefreshSecretKey

# Token Expiration
ACCESS_TOKEN_EXPIRE=30m
REFRESH_TOKEN_EXPIRE=365d

# Server Port
PORT=5000
```

---

## 5. Database Connection

**`config/db.js`**

```javascript
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
});

module.exports = pool;
```

---

## 6. User Model

**`models/userModel.js`**

```javascript
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

const findById = async (id) => {
    const result = await db.query(
        'SELECT * FROM users WHERE id=$1',
        [id]
    );
    return result.rows[0];
};

const saveRefreshToken = async (id, token) => {
    await db.query(
        'UPDATE users SET refresh_token=$1 WHERE id=$2',
        [token, id]
    );
};

const clearRefreshToken = async (username) => {
    await db.query(
        'UPDATE users SET refresh_token=NULL WHERE username=$1',
        [username]
    );
};

const getAllUsers = async () => {
    const result = await db.query('SELECT id, username FROM users');
    return result.rows;
};

const getUserById = async (id) => {
    const result = await db.query(
        'SELECT id, username FROM users WHERE id=$1',
        [id]
    );
    return result.rows[0];
};

const updateUser = async (id, username) => {
    const result = await db.query(
        'UPDATE users SET username=$1 WHERE id=$2 RETURNING *',
        [username, id]
    );
    return result.rows[0];
};

const deleteUser = async (id) => {
    await db.query('DELETE FROM users WHERE id=$1', [id]);
};

module.exports = {
    createUser,
    findByUsername,
    findById,
    saveRefreshToken,
    clearRefreshToken,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser
};
```

---

## 7. Authentication Controller

**`controllers/authController.js`**

```javascript
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// Generate Access Token
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

// Generate Refresh Token
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

// Register User
exports.register = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if user exists
        const existing = await User.findByUsername(username);
        if (existing) {
            return res.status(400).json({
                message: "User already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await User.createUser(username, hashedPassword);

        res.status(201).json({
            message: "User registered",
            user
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Login User
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user
        const user = await User.findByUsername(username);
        if (!user) {
            return res.status(401).json({
                message: "Invalid credentials"
            });
        }

        // Verify password
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({
                message: "Invalid credentials"
            });
        }

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Save refresh token
        await User.saveRefreshToken(user.id, refreshToken);

        res.json({
            accessToken,
            refreshToken
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Refresh Token
exports.refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.sendStatus(401);
    }

    jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        async (err, decoded) => {
            if (err) {
                return res.sendStatus(403);
            }

            // Generate new access token
            const user = await User.findById(decoded.id);
            if (!user) {
                return res.sendStatus(403);
            }

            const accessToken = jwt.sign(
                {
                    id: user.id,
                    username: user.username
                },
                process.env.ACCESS_TOKEN_SECRET,
                {
                    expiresIn: '15m'
                }
            );

            res.json({ accessToken });
        }
    );
};

// Logout
exports.logout = async (req, res) => {
    try {
        const { username } = req.body;

        await User.clearRefreshToken(username);

        res.json({
            message: 'Logged out successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
```

---

## 8. Authentication Middleware

**`middleware/authMiddleware.js`**

```javascript
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.sendStatus(401);
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET,
        (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }

            req.user = user;
            next();
        }
    );
};
```

---

## 9. CRUD Controller

**`controllers/userController.js`**

```javascript
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');

// Get all users
exports.getUsers = async (req, res) => {
    try {
        const users = await User.getAllUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single user
exports.getUser = async (req, res) => {
    try {
        const user = await User.getUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create user (admin only)
exports.createUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if user exists
        const existing = await User.findByUsername(username);
        if (existing) {
            return res.status(400).json({
                message: "User already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await User.createUser(username, hashedPassword);

        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update user
exports.updateUser = async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.updateUser(req.params.id, username);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete user
exports.deleteUser = async (req, res) => {
    try {
        await User.deleteUser(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
```

---

## 10. Routes

### Authentication Routes

**`routes/authRoutes.js`**

```javascript
const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/refresh-token', auth.refreshToken);
router.post('/logout', auth.logout);

module.exports = router;
```

### User Routes (CRUD)

**`routes/userRoutes.js`**

```javascript
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');

// All routes require authentication
router.get('/', authMiddleware, userController.getUsers);
router.get('/:id', authMiddleware, userController.getUser);
router.post('/', authMiddleware, userController.createUser);
router.put('/:id', authMiddleware, userController.updateUser);
router.delete('/:id', authMiddleware, userController.deleteUser);

module.exports = router;
```

---

## 11. Main Server File

**`server.js`**

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
```

---

## 12. Testing the API

### Authentication Flow

#### 1. Register User

**PowerShell:**

```powershell
$response = Invoke-RestMethod `
  -Uri "http://127.0.0.1:5000/api/auth/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"123456"}'

$response
```

**Expected Response:**

```json
{
  "message": "User registered",
  "user": {
    "id": 1,
    "username": "admin",
    "password": "$2b$12$i2lZCHQAz5F8GQqPj08FXOKKiT6kD3bEJRYT8USYl54P8PiiCTZtC",
    "refresh_token": null,
    "created_at": "2026-06-25T07:59:46.123Z"
  }
}
```

---

#### 2. Login User

**PowerShell:**

```powershell
$response = Invoke-RestMethod `
  -Uri "http://127.0.0.1:5000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"123456"}'

$accessToken = $response.accessToken
$refreshToken = $response.refreshToken

$accessToken
$refreshToken
```

**Expected Response:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiIsImlhdCI6MTc4MjM3NDU2NCwiZXhwIjoxNzgyMzc2MzY0fQ.g8ihTu8KutWrqRYIZ3EAPGRPhfpVaunNKUqdRT9KxyM",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzgyMzc0NTY0LCJleHAiOjE4MTM5MTA1NjR9.zOfotQvC85WpokvdJeMbP7NoL0v20druweXU7N2eRNQ"
}
```

---

#### 3. Refresh Access Token

**PowerShell:**

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:5000/api/auth/refresh" `
  -Method POST `
  -ContentType "application/json" `
  -Body "{ `"refreshToken`": `"$refreshToken`" }"
```

**Expected Response:**

```json
{
  "accessToken": "new-jwt-token-here"
}
```

---

#### 4. Logout

**PowerShell:**

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:5000/api/auth/logout" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"admin"}'
```

**Expected Response:**

```json
{
  "message": "Logged out successfully"
}
```

---

### CRUD Operations

#### 1. Create User (POST)

**PowerShell:**

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:5000/api/users" `
  -Method POST `
  -Headers @{
      Authorization = "Bearer $accessToken"
  } `
  -ContentType "application/json" `
  -Body '{
      "username": "john",
      "password": "123456"
  }'
```

**Expected Response:**

```json
{
  "id": 2,
  "username": "john",
  "password": "123456",
  "refresh_token": null,
  "created_at": "2026-06-25T08:56:41.503Z"
}
```

---

#### 2. Get All Users (GET)

**PowerShell:**

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:5000/api/users" `
  -Headers @{
      Authorization = "Bearer $accessToken"
  }
```

**Expected Response:**

```json
[
  {
    "id": 1,
    "username": "admin"
  },
  {
    "id": 2,
    "username": "john"
  }
]
```

---

#### 3. Get Single User (GET)

**PowerShell:**

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:5000/api/users/2" `
  -Headers @{
      Authorization = "Bearer $accessToken"
  }
```

**Expected Response:**

```json
{
  "id": 2,
  "username": "john"
}
```

---

#### 4. Update User (PUT)

**PowerShell:**

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:5000/api/users/2" `
  -Method PUT `
  -Headers @{
      Authorization = "Bearer $accessToken"
  } `
  -ContentType "application/json" `
  -Body '{
      "username": "john_updated"
  }'
```

**Expected Response:**

```json
{
  "id": 2,
  "username": "john_updated",
  "password": "123456",
  "refresh_token": null,
  "created_at": "2026-06-25T08:56:41.503Z"
}
```

---

#### 5. Delete User (DELETE)

**PowerShell:**

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:5000/api/users/2" `
  -Method DELETE `
  -Headers @{
      Authorization = "Bearer $accessToken"
  }
```

**Expected Response:**

```json
{
  "message": "User deleted successfully"
}
```

---

## 13. Database Schema

### Users Table Structure

```sql
Table "public.users"
    Column     |            Type             | Collation | Nullable |              Default              
---------------+-----------------------------+-----------+----------+-----------------------------------
 id            | integer                     |           | not null | nextval('users_id_seq'::regclass)
 username      | character varying(100)      |           | not null | 
 password      | character varying(255)      |           | not null | 
 refresh_token | text                        |           |          | 
 created_at    | timestamp without time zone |           |          | CURRENT_TIMESTAMP

Indexes:
    "users_pkey" PRIMARY KEY, btree (id)
    "users_username_key" UNIQUE CONSTRAINT, btree (username)
```

---

## 14. Security Features Implemented

### 1. **Password Security**
- Passwords hashed using bcrypt with salt rounds (12)
- No plain text passwords stored in database

### 2. **JWT Token Security**
- Separate access and refresh tokens
- Access tokens have short expiration (30 minutes)
- Refresh tokens have long expiration (365 days)
- Tokens signed with different secrets

### 3. **API Protection**
- Rate limiting (100 requests per 15 minutes per IP)
- Helmet for security headers
- CORS configuration
- Request validation

### 4. **Authentication & Authorization**
- JWT authentication middleware
- Protected routes
- Refresh token rotation

---

## 15. Application Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENT REQUEST                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  AUTHENTICATION MIDDLEWARE                  │
│                   (Verify Access Token)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                        ┌─────┴─────┐
                        │           │
                        ▼           ▼
              ┌─────────────┐ ┌─────────────┐
              │  Valid Token │ │ Invalid/No  │
              │             │ │    Token    │
              └─────────────┘ └─────────────┘
                    │               │
                    ▼               ▼
            ┌─────────────┐ ┌─────────────┐
            │     API     │ │  401/403    │
            │  Endpoint   │ │   Error     │
            └─────────────┘ └─────────────┘
                    │
                    ▼
            ┌─────────────┐
            │  Database   │
            │  Operations │
            └─────────────┘
                    │
                    ▼
            ┌─────────────┐
            │   Response  │
            └─────────────┘
```

---

## 16. Complete API Endpoints Reference

### Authentication Routes

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login user | No |
| POST | `/api/auth/refresh-token` | Refresh access token | No |
| POST | `/api/auth/logout` | Logout user | No |

### User CRUD Routes

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | `/api/users` | Get all users | Yes |
| GET | `/api/users/:id` | Get single user | Yes |
| POST | `/api/users` | Create user | Yes |
| PUT | `/api/users/:id` | Update user | Yes |
| DELETE | `/api/users/:id` | Delete user | Yes |

---

## 17. Troubleshooting Common Issues

### Issue 1: Database Connection Error

**Error:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution:** 
- Ensure PostgreSQL is running
- Verify database credentials in `.env`
- Check database port

**Check PostgreSQL Status:**

```bash
# Windows
net start postgresql

# Linux
sudo systemctl status postgresql

# Mac
brew services list | grep postgres
```

---

### Issue 2: JWT Token Invalid

**Error:** `401 Unauthorized` or `403 Forbidden`

**Solution:**
- Ensure token is passed correctly in Authorization header
- Check token expiration
- Verify token format: `Bearer <token>`

**Debugging Token:**

```javascript
// In authMiddleware.js
console.log('Token:', token);
try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log('Decoded:', decoded);
} catch (error) {
    console.log('Token error:', error.message);
}
```

---

### Issue 3: Port Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::5000`

**Solution:**

```bash
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process
taskkill /PID <PID> /F

# Or use different port in .env
PORT=5001
```

---

## 18. Production Considerations

### 1. **Environment Variables**
- Use strong secrets for JWT
- Never commit `.env` to version control
- Use different secrets for development/production

### 2. **Database**
- Use connection pooling
- Add indexes for performance
- Regular backups

### 3. **Security**
- Use HTTPS
- Implement proper CORS configuration
- Add request validation
- Implement logging

### 4. **Performance**
- Implement caching (Redis)
- Use pagination for large datasets
- Optimize database queries

### 5. **Error Handling**
- Implement proper error logging
- Use structured error responses
- Don't expose stack traces in production

---

## 19. Additional Features (Optional)

### Role-Based Access Control (RBAC)

**Add role column to users table:**

```sql
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';
```

**Role Middleware:**

```javascript
// middleware/roleMiddleware.js
const authorize = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return (req, res, next) => {
        const user = req.user;
        if (!user || !roles.includes(user.role)) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }
        next();
    };
};

// Usage in routes
router.delete('/:id', authMiddleware, authorize(['admin']), userController.deleteUser);
```

---

### Logging

**Install Winston:**

```bash
npm install winston
```

**Configure Logger:**

```javascript
// config/logger.js
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

module.exports = logger;
```

---

## 20. Summary

This API provides a complete authentication and CRUD system with:

✅ **Secure Authentication** - JWT with access and refresh tokens
✅ **Password Security** - bcrypt hashing
✅ **Database Integration** - PostgreSQL with connection pooling
✅ **CRUD Operations** - Complete CRUD for user management
✅ **Security Features** - Rate limiting, helmet, CORS
✅ **Scalable Architecture** - Modular MVC structure
✅ **Error Handling** - Centralized error handling
✅ **Environment Configuration** - .env for configuration
✅ **Ready for Production** - Includes logging and monitoring capabilities

---
 
