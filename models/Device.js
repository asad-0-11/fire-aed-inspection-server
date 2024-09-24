const mongoose = require('mongoose');
const qrcode = require('qrcode');

const DeviceSchema = new mongoose.Schema({
  serialNumber: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['Fire Extinguisher', 'AED'],
    required: true
  },
  location: {
    type: String,
    required: true
  },
  installationDate: {
    type: Date,
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  qrCode: {
    type: String
  },
  status: {
    type: String,
    enum: ['Approved', 'Rejected', 'Maintenance Needed', 'Inspection Scheduled'],
    default: 'Approved'
  },
  lastInspectionDate: {
    type: Date
  },
  nextInspectionDate: {
    type: Date
  },
  photos: [{
    type: String
  }],
  documents: [{
    type: String
  }],
  lastInspectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inspection'
  }
}, { timestamps: true });

DeviceSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('serialNumber') || this.isModified('lastInspectionId')) {
    try {
      const qrCodeData = JSON.stringify({
        id: this._id,
        serialNumber: this.serialNumber,
        type: this.type,
        lastInspectionId: this.lastInspectionId
      });
      this.qrCode = await qrcode.toDataURL(qrCodeData);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  }
  next();
});

module.exports = mongoose.model('Device', DeviceSchema);