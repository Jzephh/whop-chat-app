import mongoose from 'mongoose';

let isConnecting: Promise<typeof mongoose> | null = null;

export default async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (isConnecting) return isConnecting;

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGO_URI is not set');

  isConnecting = mongoose.connect(mongoUri, {
    dbName: process.env.MONGO_DB || 'chatting-app'
  });

  try {
    await isConnecting;
    return mongoose;
  } finally {
    isConnecting = null;
  }
}

