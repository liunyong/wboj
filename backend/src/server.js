import dotenv from 'dotenv';
import app from './app.js';
import connectDatabase from './config/database.js';

dotenv.config();

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/judge0';

const startServer = async () => {
  await connectDatabase(MONGO_URI);

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
};

startServer();
