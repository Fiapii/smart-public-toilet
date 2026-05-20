const express = require('express');
const { createComplaint, getToilets } = require('../controllers/publicController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Public
 *   description: Public customer endpoints
 */

/**
 * @swagger
 * /api/public/toilets:
 *   get:
 *     summary: Get all toilets
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: List of toilets
 */
router.get('/toilets', getToilets);

/**
 * @swagger
 * /api/public/complaints:
 *   post:
 *     summary: Submit a suggestion or complaint
 *     tags: [Public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - toilet_id
 *               - description
 *             properties:
 *               toilet_id:
 *                 type: integer
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Complaint submitted
 */
router.post('/complaints', createComplaint);

module.exports = router;
