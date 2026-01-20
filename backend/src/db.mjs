// src/db.mjs - MongoDB connection configuration
import mongoose from "mongoose";

/**
 * Connect to MongoDB Atlas
 * Uses the MONGODB_URI environment variable
 */
export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      console.warn(
        "⚠️  MONGODB_URI not set. Using local file storage for presets.",
      );
      return false;
    }

    await mongoose.connect(mongoUri, {
      // These options are no longer needed in Mongoose 6+, but kept for compatibility
    });

    console.log("✅ Connected to MongoDB Atlas");
    return true;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    return false;
  }
};

/**
 * Disconnect from MongoDB
 */
export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log("📤 Disconnected from MongoDB");
  } catch (error) {
    console.error("Error disconnecting from MongoDB:", error.message);
  }
};

/**
 * Check if MongoDB is connected
 */
export const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

export default mongoose;
