//inspection.js routes

const express = require('express');
const router = express.Router();
const inspectionController = require('../controllers/inspectionController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.post('/assign', authorize('admin'), inspectionController.assignInspection);
router.get('/managers', authorize('admin'), inspectionController.getInspectorManagers);

module.exports = router;