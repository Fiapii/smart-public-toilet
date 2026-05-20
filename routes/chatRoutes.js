const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { sendMessage, getChatHistory, editMessage, deleteMessage } = require('../controllers/chatController');

const router = express.Router();

// All chat routes require authentication
router.use(protect);

router.post('/send', sendMessage);
router.get('/history/:userId', getChatHistory);
router.put('/edit/:id', editMessage);
router.delete('/delete/:id', deleteMessage);

module.exports = router;
