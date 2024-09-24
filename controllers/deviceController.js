//deviceController
const Device = require('../models/Device');
const Inspection = require('../models/Inspection');
const mongoose = require('mongoose');

exports.addDevice = async (req, res) => {
  try {
    const { serialNumber, type, location, installationDate } = req.body;
    const device = new Device({
      serialNumber,
      type,
      location,
      installationDate,
      customer: req.user.id
    });

    await device.save();

    res.status(201).json({
      success: true,
      data: {
        ...device.toObject(),
        qrCode: device.qrCode // Include the QR code in the response
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};  
exports.getAllDevices = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    const devices = await Device.find().populate('customer', 'name email');
    res.json(devices);
  } catch (error) {
    console.error('Error fetching all devices:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
exports.getUserDevices = async (req, res) => {
  try {
    console.log('Fetching devices for user:', req.user.id);
    const devices = await Device.find({ customer: req.user.id });
    console.log('Devices found:', devices.length);
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

exports.getDevice = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    // Check if the device belongs to the current user
    if (device.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized to access this device' });
    }

    res.status(200).json({
      success: true,
      data: {
        ...device.toObject(),
        qrCode: device.qrCode // Include the QR code in the response
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.updateDevice = async (req, res) => {
  try {
    const updatedDevice = await Device.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedDevice) return res.status(404).json({ message: 'Device not found' });
    res.json(updatedDevice);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteDevice = async (req, res) => {
  try {
    const device = await Device.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!device) return res.status(404).json({ message: 'Device not found' });
    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.getCustomerAnalytics = async (req, res) => {
  try {
    const customerId = req.user.id;

    const [deviceCount, inspectionStats] = await Promise.all([
      Device.countDocuments({ customer: customerId }),
      Inspection.aggregate([
        { $match: { customer: new mongoose.Types.ObjectId(customerId) } },
        {
          $group: {
            _id: null,
            totalInspections: { $sum: 1 },
            completedInspections: {
              $sum: {
                $cond: [
                  { $or: [
                    { $eq: ["$status", "Completed"] },
                    { $eq: ["$status", "Maintenance Needed"] }
                  ]},
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            totalInspections: 1,
            completedInspections: 1,
            pendingInspections: { $subtract: ["$totalInspections", "$completedInspections"] }
          }
        }
      ])
    ]);

    const analytics = {
      totalDevices: deviceCount,
      totalInspections: inspectionStats[0]?.totalInspections || 0,
      completedInspections: inspectionStats[0]?.completedInspections || 0,
      pendingInspections: inspectionStats[0]?.pendingInspections || 0
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching customer analytics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getCompletedInspections = async (req, res) => {
  try {
    const customerId = req.user.id;
    const completedInspections = await Inspection.find({
      customer: customerId,
      status: { $in: ['Completed', 'Maintenance Needed'] }
    })
      .populate('device', 'serialNumber location type')
      .sort({ completedDate: -1 });
    
    res.json(completedInspections);
  } catch (error) {
    console.error('Error fetching completed inspections:', error);
    res.status(500).json({ error: 'Failed to fetch completed inspections' });
  }
};