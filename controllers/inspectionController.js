//inspectionController
const Inspection = require('../models/Inspection');
const Device = require('../models/Device');
const User = require('../models/User');
const Notification = require('../models/Notification');

exports.assignInspection = async (req, res) => {
  try {
    const { deviceId, managerId, scheduledDate } = req.body;

    // Validate input
    if (!deviceId || !managerId || !scheduledDate) {
      return res.status(400).json({ message: 'Device ID, Manager ID, and Scheduled Date are required' });
    }

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const manager = await User.findById(managerId);
    if (!manager || manager.role !== 'inspection_manager') {
      return res.status(400).json({ message: 'Invalid manager selected' });
    }

    const inspection = new Inspection({
      device: deviceId,
      inspector: managerId,
      status: 'Scheduled',
      scheduledDate: new Date(scheduledDate)
    });

    await inspection.save();

    // Create notification for the manager
    const notification = new Notification({
      recipient: managerId,
      message: `New inspection assigned for device ${device.serialNumber}`,
      type: 'inspection_assigned',
      relatedInspection: inspection._id,
      relatedDevice: deviceId
    });

    await notification.save();

    // Update the device status to 'Inspection Scheduled'
    device.status = 'Inspection Scheduled';
    await device.save();

    res.status(201).json({ message: 'Inspection assigned successfully', inspection });
  } catch (error) {
    console.error('Error assigning inspection:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getInspectorManagers = async (req, res) => {
  try {
    const inspectorManagers = await User.find({ role: 'inspection_manager' }).select('_id name email');
    res.json(inspectorManagers);
  } catch (error) {
    console.error('Error fetching inspector managers:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};