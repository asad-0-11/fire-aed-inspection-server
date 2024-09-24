// controllers/adminDashboardController.js
const User = require('../models/User');
const Device = require('../models/Device');
const Inspection = require('../models/Inspection');

exports.getDashboardStats = async (req, res) => {
  try {
    const [userStats, deviceStats, inspectionStats] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            customerCount: { 
              $sum: { $cond: [{ $eq: ['$role', 'customer'] }, 1, 0] }
            },
            inspectorCount: { 
              $sum: { $cond: [{ $eq: ['$role', 'inspection_manager'] }, 1, 0] }
            }
          }
        }
      ]),
      Device.aggregate([
        {
          $group: {
            _id: null,
            totalDevices: { $sum: 1 },
            deviceTypes: { $addToSet: '$type' }
          }
        }
      ]),
      Inspection.aggregate([
        {
          $group: {
            _id: null,
            totalInspections: { $sum: 1 },
            completedInspections: {
              $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
            },
            pendingInspections: {
              $sum: { $cond: [{ $ne: ['$status', 'Completed'] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    res.json({
      users: userStats[0] || { totalUsers: 0, customerCount: 0, inspectorCount: 0 },
      devices: deviceStats[0] || { totalDevices: 0, deviceTypes: [] },
      inspections: inspectionStats[0] || { totalInspections: 0, completedInspections: 0, pendingInspections: 0 }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getRecentCompletedInspections = async (req, res) => {
  try {
    const recentInspections = await Inspection.aggregate([
      { $match: { status: 'Completed' } },
      { $sort: { completedDate: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'devices',
          localField: 'device',
          foreignField: '_id',
          as: 'deviceInfo'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'inspector',
          foreignField: '_id',
          as: 'inspectorInfo'
        }
      },
      {
        $project: {
          _id: 1,
          result: 1,
          completedDate: 1,
          'deviceInfo.serialNumber': 1,
          'inspectorInfo.name': 1
        }
      }
    ]);

    res.json(recentInspections);
  } catch (error) {
    console.error('Error fetching recent completed inspections:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};