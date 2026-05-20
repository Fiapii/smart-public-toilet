const express = require('express');
const { listCards, registerCard, updateCard, deleteCard } = require('../controllers/rfidController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication (Owner or Admin)
router.get('/cards',        protect, listCards);
router.post('/cards',       protect, registerCard);
router.put('/cards/:id',    protect, updateCard);
router.delete('/cards/:id', protect, deleteCard);

module.exports = router;
