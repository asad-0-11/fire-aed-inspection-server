//routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/user', protect, authController.getUser);
router.put('/user', protect, authController.updateUser); // New route for updating user

module.exports = router;