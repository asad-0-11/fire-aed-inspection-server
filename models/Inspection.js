const mongoose = require('mongoose');

const InspectionSchema = new mongoose.Schema({
  device: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Device', 
    required: true 
  },
  inspector: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  scheduledDate: { 
    type: Date, 
    required: true 
  },
  completedDate: { 
    type: Date 
  },
  status: { 
    type: String, 
    enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'], 
    default: 'Scheduled' 
  },
  result: { 
    type: String, 
    enum: ['Approved', 'Rejected', 'Maintenance Needed'] 
  },
  comments: { 
    type: String 
  },
   checklist: [{
    id: Number,
    name: String,
    checked: Boolean
  }],
  photos: [{
    filename: String,
    contentType: String,
    size: Number
  }],
  documents: [{
    filename: String,
    contentType: String,
    size: Number,
    originalName: String
  }],
  signature: {
    filename: String,
    contentType: String
  }
}, { timestamps: true });



module.exports = mongoose.model('Inspection', InspectionSchema);