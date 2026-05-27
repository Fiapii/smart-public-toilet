const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController'); // import the whole controller

const router = express.Router();

// All routes require Admin role
router.use(protect);
router.use(authorize('Admin'));

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin management (Owners)
 */

/**
 * @swagger
 * /api/admin/owners:
 *   get:
 *     summary: Get all owners
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of owners
 */
router.get('/dashboard', adminController.getAdminDashboard);
router.get('/owners', adminController.getAllOwners);
router.get('/broadcasts', adminController.getBroadcasts);
router.post('/broadcast', adminController.sendBroadcast);

/**
 * @swagger
 * /api/admin/owners:
 *   post:
 *     summary: Create a new owner
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Owner created successfully
 */
router.post('/owners', adminController.createOwner);

/**
 * @swagger
 * /api/admin/owners/{id}:
 *   get:
 *     summary: Get owner by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Owner details
 */
router.get('/owners/:id', adminController.getOwnerById);

/**
 * @swagger
 * /api/admin/owners/{id}:
 *   put:
 *     summary: Update an owner
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Owner updated successfully
 */
router.put('/owners/:id', adminController.updateOwner);

/**
 * @swagger
 * /api/admin/owners/{id}:
 *   delete:
 *     summary: Delete an owner
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Owner deleted successfully
 */
router.delete('/owners/:id', adminController.deleteOwner);

// Revenue filter endpoint (for admin dashboard)
router.get('/revenue/filtered', adminController.getSystemRevenueFiltered);

module.exports = router;