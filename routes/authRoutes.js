const express = require('express');
const { register, login, requestPasswordReset, resetPassword, updatePassword, updateProfile, getAllAdmins, checkInit, getNotifications, getRoleEmails } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();
router.get('/notifications', protect, getNotifications);
router.get('/emails/:role', getRoleEmails);

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and User management
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post('/login', login);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new admin (if none exists)
 *     tags: [Auth]
 *     responses:
 *       201:
 *         description: Admin registered
 */
router.post('/register', (req, res, next) => {
  // Pass to register, but register internally checks if it's first admin or not
  register(req, res, next);
});

router.get('/check-init', checkInit);
router.get('/admins', protect, authorize('Admin'), getAllAdmins);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.put('/update-password', protect, updatePassword);
router.put('/profile', protect, updateProfile);

module.exports = router;
