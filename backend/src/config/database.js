import mongoose from 'mongoose';

const connectDatabase = async (mongoUri) => {
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000
  });
  console.log('MongoDB connected');
};

export default connectDatabase;
