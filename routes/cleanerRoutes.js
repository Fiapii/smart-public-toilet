const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { getAlerts, updateToiletStatus, getOwners, getComplaints, resolveComplaint, getBroadcasts } = require('../controllers/cleanerController');

const router = express.Router();

// Require Cleaner role
router.use(protect);
router.use(authorize('Cleaner'));

router.get('/alerts', getAlerts);
router.get('/complaints', getComplaints);
router.put('/complaints/:id/resolve', resolveComplaint);
router.put('/toilet/:id', updateToiletStatus);
router.get('/owners', getOwners);
router.get('/broadcasts', getBroadcasts);

module.exports = router;
