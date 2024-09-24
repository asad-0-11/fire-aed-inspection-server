//customer route
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Notification = require('../models/Notification');
const Inspection = require('../models/Inspection');
const Device = require('../models/Device');
const path = require('path');
const fs = require('fs');
router.get('/customer-notifications', protect, authorize('customer'), async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id, read: false })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
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
router.delete('/customer-notifications', protect, authorize('customer'), async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user.id });
    res.json({ message: 'All notifications cleared successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/customer-notifications/:id', protect, authorize('customer'), async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// New route to fetch device inspections
router.get('/device-inspections/:deviceId', protect, authorize('customer'), async (req, res) => {
  try {
    const inspections = await Inspection.find({ device: req.params.deviceId })
      .sort({ completedDate: -1 })
      .limit(1);
    res.json(inspections);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// New route to fetch inspection details
router.get('/inspection-details/:inspectionId', protect, authorize('customer'), async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.inspectionId)
      .populate('device', 'serialNumber location type');
    
    if (!inspection) {
      return res.status(404).json({ message: 'Inspection not found' });
    }

    res.json(inspection);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
router.get('/device-report/:deviceId/:inspectionId', protect, authorize('customer'), async (req, res) => {
    try {
      const { deviceId, inspectionId } = req.params;
  
      // Check if the device belongs to the customer
      const device = await Device.findOne({ _id: deviceId, customer: req.user.id });
      if (!device) {
        return res.status(404).json({ message: 'Device not found or does not belong to the customer' });
      }
  
      // Fetch the inspection report
      const inspection = await Inspection.findOne({ _id: inspectionId, device: deviceId })
        .populate('device', 'serialNumber location type')
        .populate('inspector', 'name');
  
      if (!inspection) {
        return res.status(404).json({ message: 'Inspection report not found' });
      }
  
      // Prepare the response
      const response = {
        ...inspection.toObject(),
        checklist: inspection.checklist || [],
        photos: inspection.photos || [],
        documents: inspection.documents || []
      };
  
      res.json(response);
    } catch (error) {
      console.error('Error fetching customer device report:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Serve inspection images for customer
  router.get('/image/:filename', async (req, res) => {
    try {
      const filename = req.params.filename;
      const filepath = path.join(__dirname, '..', 'uploads', filename);
      
      // Check if file exists
      if (!fs.existsSync(filepath)) {
        console.error('File not found:', filepath);
        return res.status(404).send('Image not found');
      }
      
      // Send the file
      res.sendFile(filepath, (err) => {
        if (err) {
          console.error('Error sending file:', err);
          res.status(500).send('Error sending image');
        }
      });
    } catch (error) {
      console.error('Error serving image:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Serve inspection documents for customer
  router.get('/document/:inspectionId/:documentId', protect, authorize('customer'), async (req, res) => {
    try {
      const { inspectionId, documentId } = req.params;
      const inspection = await Inspection.findById(inspectionId);
      if (!inspection) {
        return res.status(404).json({ message: 'Inspection not found' });
      }
  
      // Check if the device belongs to the customer
      const device = await Device.findOne({ _id: inspection.device, customer: req.user.id });
      if (!device) {
        return res.status(403).json({ message: 'Access denied' });
      }
  
      const document = inspection.documents.id(documentId);
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
  
      const filePath = path.join(__dirname, '..', 'uploads', document.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found' });
      }
  
      res.contentType(document.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
      res.setHeader('Content-Type', document.contentType);
      res.sendFile(filePath);
    } catch (error) {
      console.error('Error serving document:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
module.exports = router;