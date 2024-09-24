//devices.js routes


const deviceController = require('../controllers/deviceController');
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Notification = require('../models/Notification');
const Inspection = require('../models/Inspection');
const Device = require('../models/Device');
const path = require('path');
const fs = require('fs');
router.use(protect);
router.get('/analytics', protect, authorize('customer'), async (req, res) => {
    try {
      // Get all devices for the customer
      const devices = await Device.find({ customer: req.user.id });
  
      // Get the device IDs
      const deviceIds = devices.map(device => device._id);
  
      // Fetch all inspections for the customer's devices
      const inspections = await Inspection.find({ device: { $in: deviceIds } });
  
      // Calculate analytics
      const totalDevices = devices.length;
      const totalInspections = inspections.length;
      const completedInspections = inspections.filter(inspection => inspection.status === 'Completed').length;
      const pendingInspections = totalInspections - completedInspections;
  
      res.json({
        totalDevices,
        totalInspections,
        completedInspections,
        pendingInspections
      });
    } catch (error) {
      console.error('Error fetching customer analytics:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  router.post('/', deviceController.addDevice);
router.get('/', deviceController.getUserDevices);
router.get('/all', deviceController.getAllDevices);
router.get('/:id', deviceController.getDevice);
router.put('/:id', deviceController.updateDevice);
router.delete('/:id', deviceController.deleteDevice);
router.get('/completed-inspections', deviceController.getCompletedInspections);
module.exports = router;