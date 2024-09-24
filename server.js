require('dotenv').config(); // Add this at the top to load environment variables
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const deviceRoutes = require('./routes/devices');
const inspectionRoutes = require('./routes/inspections');
const userRoutes = require('./routes/userRoutes');
const inspectionManagerRoutes = require('./routes/inspectionManagerRoutes');
const admin = require('./routes/admin');
const customerRoutes = require('./routes/customerRoutes');
const adminNotificationRoutes = require('./routes/adminNotificationRoutes');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

const connectOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

const connectWithRetry = () => {
  mongoose.connect(MONGODB_URI, connectOptions)
    .then(() => console.log('MongoDB connected successfully'))
    .catch((err) => {
      console.error('MongoDB connection error:', err);
      console.log('Retrying connection in 5 seconds...');
      setTimeout(connectWithRetry, 5000);
    });
};

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
  connectWithRetry();
});

process.on('SIGINT', () => {
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  });
});

connectWithRetry();

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/manager', inspectionManagerRoutes);
app.use('/api/admin', admin);
app.use('/api/customer', customerRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});