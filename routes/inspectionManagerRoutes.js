  //innspectionManagerRoute
  const express = require('express');
  const router = express.Router();
  const multer = require('multer');
  const mongoose = require('mongoose');
  const { protect, authorize } = require('../middleware/auth');
  const Inspection = require('../models/Inspection');
  const Device = require('../models/Device');
  const Notification = require('../models/Notification');
  const { v4: uuidv4 } = require('uuid');
  const path = require('path');
  const fs = require('fs');

  // Configure multer for file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  });
  
  const upload = multer({ storage: storage });

  // Get assigned inspections
  router.get('/assigned', protect, authorize('inspection_manager'), async (req, res) => {
    try {
      const inspections = await Inspection.find({ inspector: req.user.id, status: { $in: ['Scheduled', 'In Progress'] } })
        .populate('device', 'serialNumber location type')
        .sort({ scheduledDate: 1 });
      res.json(inspections);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  router.delete('/notifications', protect, authorize('inspection_manager'), async (req, res) => {
    try {
      await Notification.deleteMany({ recipient: req.user.id });
      res.json({ message: 'All notifications cleared successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  router.get('/analytics', protect, authorize('inspection_manager'), async (req, res) => {
    try {
      const completed = await Inspection.countDocuments({ inspector: req.user.id, status: 'Completed' });
      const assigned = await Inspection.countDocuments({ inspector: req.user.id, status: { $in: ['Scheduled', 'In Progress'] } });
      
      res.json({ completed, assigned });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  router.get('/inspections', protect, authorize('inspection_manager'), async (req, res) => {
    try {
      const inspections = await Inspection.find({ inspector: req.user.id })
        .populate('device', 'serialNumber location type')
        .sort({ scheduledDate: 1 });
      res.json(inspections);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // Get inspection details
  
  // Start inspection
  router.post('/start-inspection/:id', protect, authorize('inspection_manager'), async (req, res) => {
    try {
      const inspection = await Inspection.findById(req.params.id).populate('device', 'serialNumber location type');
      if (!inspection) {
        return res.status(404).json({ message: 'Inspection not found' });
      }
      if (inspection.inspector.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      if (inspection.status !== 'Scheduled') {
        return res.status(400).json({ message: 'Inspection cannot be started' });
      }
      inspection.status = 'In Progress';
      await inspection.save();
      res.json(inspection);
    } catch (error) {
      console.error('Error in start-inspection:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
 
  router.post('/complete-inspection/:id', protect, authorize('inspection_manager'), upload.fields([
    { name: 'photos', maxCount: 5 },
    { name: 'documents', maxCount: 5 }
  ]), async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      console.log('Received request body:', req.body);
      console.log('Received files:', req.files);
  
      const inspection = await Inspection.findById(req.params.id).session(session);
      if (!inspection) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Inspection not found' });
      }
      if (inspection.inspector.toString() !== req.user.id) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({ message: 'Not authorized' });
      }
      if (inspection.status !== 'In Progress') {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Inspection cannot be completed' });
      }
  
      inspection.status = 'Completed';
      inspection.completedDate = Date.now();
      inspection.result = req.body.result;
      inspection.comments = req.body.comments;
  
      // Handle checklist parsing
      if (req.body.checklist) {
        try {
          inspection.checklist = JSON.parse(req.body.checklist);
        } catch (parseError) {
          console.error('Error parsing checklist:', parseError);
          inspection.checklist = []; // Set to empty array if parsing fails
        }
      } else {
        inspection.checklist = []; // Set to empty array if checklist is not provided
      }
  
      // Handle file uploads
      if (req.files) {
        if (req.files['photos']) {
          inspection.photos = req.files['photos'].map(file => ({
            filename: file.filename,
            contentType: file.mimetype,
            size: file.size
          }));
        }
        if (req.files['documents']) {
          inspection.documents = req.files['documents'].map(file => ({
            filename: file.filename,
            contentType: file.mimetype,
            size: file.size,
            originalName: file.originalname
          }));
        }
      }
  
      await inspection.save({ session });
  
      // Update device status
      const device = await Device.findById(inspection.device).session(session);
      if (!device) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Associated device not found' });
      }
  
      device.status = req.body.result;
      device.lastInspectionDate = Date.now();
      await device.save({ session });
  
      // Create notification for the device owner
      const notification = new Notification({
        recipient: device.customer,
        message: `Inspection completed for device ${device.serialNumber}. Result: ${req.body.result}`,
        type: 'inspection_completed',
        relatedInspection: inspection._id,
        relatedDevice: device._id
      });
      await notification.save({ session });
  
      await session.commitTransaction();
      session.endSession();
  
      res.json({ message: 'Inspection completed successfully', inspection: inspection.toObject() });
    } catch (error) {
      console.error('Error completing inspection:', error);
      res.status(500).json({ 
        message: 'Server error', 
        error: error.message,
        stack: process.env.NODE_ENV === 'production' ? '🥞' : error.stack
      });
    }
  });
  router.get('/inspection-details/:id', protect, authorize('inspection_manager'), async (req, res) => {
    try {
      const { id } = req.params;
      
      console.log(`Fetching inspection details for ID: ${id}`);
      
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        console.log(`Invalid inspection ID: ${id}`);
        return res.status(400).json({ message: 'Invalid inspection ID' });
      }
  
      const inspection = await Inspection.findById(id)
        .populate('device', 'serialNumber location type')
        .populate('inspector', 'name');
  
      if (!inspection) {
        console.log(`Inspection not found for ID: ${id}`);
        return res.status(404).json({ message: 'Inspection not found' });
      }
      
      if (inspection.inspector._id.toString() !== req.user.id) {
        console.log(`Unauthorized access attempt for inspection ID: ${id} by user: ${req.user.id}`);
        return res.status(403).json({ message: 'Not authorized' });
      }
      
      // Log photo information
      if (inspection.photos && inspection.photos.length > 0) {
        console.log('Photos in inspection:');
        inspection.photos.forEach((photo, index) => {
          console.log(`Photo ${index + 1}:`, {
            filename: photo.filename,
            contentType: photo.contentType,
            size: photo.size
          });
        });
      } else {
        console.log('No photos in this inspection');
      }
  
      console.log(`Successfully fetched inspection details for ID: ${id}`);
      res.json(inspection);
    } catch (error) {
      console.error('Error fetching inspection details:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  router.get('/inspection-images/:id', protect, authorize('inspection_manager'), async (req, res) => {
    try {
      const inspection = await Inspection.findById(req.params.id);
      if (!inspection) {
        return res.status(404).json({ message: 'Inspection not found' });
      }
  
      if (inspection.inspector.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
  
      const images = inspection.photos.map(photo => ({
        id: photo._id,
        filename: photo.filename,
        contentType: photo.contentType
      }));
  
      res.json(images);
    } catch (error) {
      console.error('Error fetching inspection images:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // Route for serving individual images
  router.get('/image/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, '..', 'uploads', filename);
    res.sendFile(filepath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(404).send('Image not found');
      }
    });
  });
  router.get('/document/:inspectionId/:documentId', protect, async (req, res) => {
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
  });
  router.get('/notifications', protect, authorize('inspection_manager'), async (req, res) => {
    try {
      const notifications = await Notification.find({ recipient: req.user.id, read: false })
        .sort({ createdAt: -1 })
        .limit(20);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
    router.get('/document/:id', protect, async (req, res) => {
      try {
        const inspection = await Inspection.findById(req.params.id);
        if (!inspection) {
          return res.status(404).json({ message: 'Inspection not found' });
        }
    
        const document = inspection.documents.find(doc => doc._id.toString() === req.query.docId);
        if (!document) {
          return res.status(404).json({ message: 'Document not found' });
        }
    
        const filePath = path.join(__dirname, '..', 'uploads', document.filename);
        res.contentType(document.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
        res.sendFile(filePath);
      } catch (error) {
        console.error('Error serving document:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
      }
    }); 
    
  module.exports = router;