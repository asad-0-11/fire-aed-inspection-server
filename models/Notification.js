//Notification model
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['inspection_assigned', 'inspection_completed', 'device_status_change'],
    required: true
  },
  relatedInspection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inspection'
  },
  relatedDevice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Notification', NotificationSchema);