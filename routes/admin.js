//admin route

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Inspection = require('../models/Inspection');
const Device = require('../models/Device');
const User = require('../models/User');
const adminDashboardController = require('../controllers/adminDashboardController');

// New dashboard analytics routes (without protection)
router.get('/dashboard-stats', adminDashboardController.getDashboardStats);
router.get('/recent-completed-inspections', adminDashboardController.getRecentCompletedInspections);

router.get('/public/document/:inspectionId/:documentId', async (req, res) => {
  try {
    const { inspectionId, documentId } = req.params;
    const inspection = await Inspection.findById(inspectionId);
    if (!inspection) {
      return res.status(404).json({ message: 'Inspection not found' });
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
    console.error('Error serving public document:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});router.get('/completed-inspections', async (req, res) => {
  try {
    const completedInspections = await Inspection.find({ status: 'Completed' })
      .populate('device', 'serialNumber location type')
      .populate('inspector', 'name')
      .sort({ completedDate: -1 });
    
    res.json(completedInspections);
  } catch (error) {
    console.error('Error fetching completed inspections:', error);
    res.status(500).json({ error: 'Failed to fetch completed inspections' });
  }
});

router.get('/inspection-details/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const inspection = await Inspection.findById(id)
      .populate('device', 'serialNumber location type')
      .populate('inspector', 'name');

    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    const response = {
      ...inspection.toObject(),
      checklist: inspection.checklist || [],
      photos: inspection.photos || [],
      documents: inspection.documents || []
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching inspection details:', error);
    res.status(500).json({ error: 'Failed to fetch inspection details' });
  }
});
// Get inspection details (admin view)

// Get inspection details (admin view)
// Get inspection details (admin view)
router.get('/inspection-details/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const inspection = await Inspection.findById(id)
      .populate('device', 'serialNumber location type')
      .populate('inspector', 'name');

    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    // Include checklist, photos, and documents in the response
    const response = {
      ...inspection.toObject(),
      checklist: inspection.checklist || [],
      photos: inspection.photos || [],
      documents: inspection.documents || []
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching inspection details:', error);
    res.status(500).json({ error: 'Failed to fetch inspection details' });
  }
});

// Serve inspection images (admin view)
router.get('/image/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, '..', 'uploads', filename);
  
  // Check if the file exists
  fs.access(filepath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('Error accessing file:', err);
      return res.status(404).send('Image not found');
    }
    
    // If the file exists, send it
    res.sendFile(filepath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).send('Error sending image');
      }
    });
  });
});
// Serve inspection documents (admin view)
router.get('/document/:inspectionId/:documentId', async (req, res) => {
  try {
    const { inspectionId, documentId } = req.params;
    const inspection = await Inspection.findById(inspectionId);
    if (!inspection) {
      return res.status(404).json({ message: 'Inspection not found' });
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


// Get all inspections (admin view)
router.get('/all-inspections', async (req, res) => {
  try {
    const inspections = await Inspection.find()
      .populate('device', 'serialNumber location type')
      .populate('inspector', 'name')
      .sort({ scheduledDate: 1 });
    res.json(inspections);
  } catch (error) {
    console.error('Error fetching all inspections:', error);
    res.status(500).json({ error: 'Failed to fetch all inspections' });
  }
});

// Get all devices (admin view)
router.get('/all-devices', async (req, res) => {
  try {
    const devices = await Device.find().populate('customer', 'name');
    res.json(devices);
  } catch (error) {
    console.error('Error fetching all devices:', error);
    res.status(500).json({ error: 'Failed to fetch all devices' });
  }
});

// Get all inspection managers (admin view)
router.get('/inspection-managers', async (req, res) => {
  try {
    const inspectionManagers = await User.find({ role: 'inspection_manager' }, 'name email');
    res.json(inspectionManagers);
  } catch (error) {
    console.error('Error fetching inspection managers:', error);
    res.status(500).json({ error: 'Failed to fetch inspection managers' });
  }
});

// Assign inspection to an inspection manager (admin action)
router.post('/assign-inspection', async (req, res) => {
  try {
    const { inspectionId, inspectorId } = req.body;

    const inspection = await Inspection.findById(inspectionId);
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    const inspector = await User.findById(inspectorId);
    if (!inspector || inspector.role !== 'inspection_manager') {
      return res.status(400).json({ error: 'Invalid inspector' });
    }

    inspection.inspector = inspectorId;
    inspection.status = 'Scheduled';
    await inspection.save();

    res.json({ message: 'Inspection assigned successfully', inspection });
  } catch (error) {
    console.error('Error assigning inspection:', error);
    res.status(500).json({ error: 'Failed to assign inspection' });
  }
});

// Get inspection statistics (admin view)
router.get('/inspection-statistics', async (req, res) => {
  try {
    const totalInspections = await Inspection.countDocuments();
    const completedInspections = await Inspection.countDocuments({ status: 'Completed' });
    const pendingInspections = await Inspection.countDocuments({ status: { $in: ['Scheduled', 'In Progress'] } });

    res.json({
      totalInspections,
      completedInspections,
      pendingInspections
    });
  } catch (error) {
    console.error('Error fetching inspection statistics:', error);
    res.status(500).json({ error: 'Failed to fetch inspection statistics' });
  }
});

module.exports = router;
