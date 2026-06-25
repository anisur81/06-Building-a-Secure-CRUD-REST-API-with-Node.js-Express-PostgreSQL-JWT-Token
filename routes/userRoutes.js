const express = require('express');
const router = express.Router();

const authMiddleware =
require('../middleware/authMiddleware');

const userController =
require('../controllers/userController');

router.get('/',
    authMiddleware,
    userController.getUsers);

router.get('/:id',
    authMiddleware,
    userController.getUser);

router.post('/',
    authMiddleware,
    userController.createUser);

router.put('/:id',
    authMiddleware,
    userController.updateUser);

router.delete('/:id',
    authMiddleware,
    userController.deleteUser);

module.exports = router;