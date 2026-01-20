// test-connection.mjs - Test MongoDB connection
import "dotenv/config";
import { connectDB, isConnected } from "./src/db.mjs";

console.log("\n=== MongoDB Connection Test ===\n");

console.log("Environment variables:");
console.log(
  "- MONGODB_URI:",
  process.env.MONGODB_URI ? "SET (hidden)" : "NOT SET",
);
console.log("- PORT:", process.env.PORT || "5000 (default)");

console.log("\nAttempting to connect to MongoDB...");
const connected = await connectDB();

console.log("\n=== Results ===");
console.log("Connected to MongoDB:", connected);
console.log("Connection status:", isConnected());

if (connected) {
  console.log("\n✅ SUCCESS: Backend is connected to MongoDB Atlas");
  console.log("Your presets will be stored in the cloud database.");
} else {
  console.log("\n⚠️  WARNING: Using local file storage");
  console.log("Presets will be stored in JSON files.");
  console.log("\nTo use MongoDB:");
  console.log("1. Create a .env file in the backend folder");
  console.log("2. Add: MONGODB_URI=mongodb+srv://...");
}

console.log("\n");
process.exit(0);
