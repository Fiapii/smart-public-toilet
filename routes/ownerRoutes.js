const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getDashboardStats, getCleaners, createCleaner, deleteCleaner, updateCleaner, addToilet, getComplaints, resolveComplaint, getAdmins, getTransactions, downloadTransactions, getBroadcasts, sendBroadcast } = require('../controllers/ownerController');

const router = express.Router();

// Require Owner role
router.use(protect);
router.use(authorize('Owner'));

/**
 * @swagger
 * tags:
 *   name: Owner
 *   description: Owner management (Cleaners and Toilets)
 */

/**
 * @swagger
 * /api/owner/dashboard:
 *   get:
 *     summary: Get owner dashboard statistics
 *     tags: [Owner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 */
router.get('/dashboard', getDashboardStats);

/**
 * @swagger
 * /api/owner/cleaners:
 *   get:
 *     summary: Get all cleaners managed by this owner
 *     tags: [Owner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of cleaners
 */
router.get('/cleaners', getCleaners);

/**
 * @swagger
 * /api/owner/transactions:
 *   get:
 *     summary: Get all transactions for owner's toilets
 *     tags: [Owner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of transactions
 */
router.get('/transactions', getTransactions);
router.get('/transactions/download', downloadTransactions);
router.get('/broadcasts', getBroadcasts);
router.post('/broadcast', sendBroadcast);

router.get('/admins', getAdmins);
router.post('/cleaners', createCleaner);
router.put('/cleaners/:id', updateCleaner);
router.delete('/cleaners/:id', deleteCleaner);
router.post('/toilet', addToilet);
router.post('/toilets', addToilet);
router.get('/complaints', getComplaints);
router.put('/complaints/:id/resolve', resolveComplaint);
//router.get('/revenue/filtered', ownerController.getRevenueFiltered);
module.exports = router;
