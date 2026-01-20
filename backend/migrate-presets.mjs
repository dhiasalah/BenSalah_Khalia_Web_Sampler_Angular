// migrate-presets.mjs - Migrate presets from local files to MongoDB
import "dotenv/config";
import { connectDB, isConnected } from "./src/db.mjs";
import { migrateFilesToMongo } from "./src/services/presetService.mjs";

console.log("\n╔═══════════════════════════════════════════════════╗");
console.log("║   Preset Migration to MongoDB Atlas              ║");
console.log("╚═══════════════════════════════════════════════════╝\n");

// Step 1: Check MongoDB connection
console.log("Step 1: Connecting to MongoDB Atlas...");
const connected = await connectDB();

if (!connected) {
  console.error("\n❌ ERROR: Cannot connect to MongoDB Atlas");
  console.error("Please check your MONGODB_URI in the .env file\n");
  process.exit(1);
}

console.log("✅ Connected to MongoDB Atlas\n");

// Step 2: Migrate presets
console.log("Step 2: Migrating presets from local files...");
console.log("Reading JSON files from public/presets/\n");

try {
  const result = await migrateFilesToMongo();

  console.log("\n╔═══════════════════════════════════════════════════╗");
  console.log("║   Migration Results                               ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");

  console.log(`✅ Successfully migrated: ${result.migrated} preset(s)`);

  if (result.errors && result.errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${result.errors.length}`);
    result.errors.forEach((err, i) => {
      console.log(`   ${i + 1}. ${err.file}: ${err.error}`);
    });
  }

  console.log("\n✅ Migration completed successfully!");
  console.log("\nYou can now:");
  console.log("  1. Start the backend: npm start");
  console.log("  2. View presets: http://localhost:5000/api/presets");
  console.log(
    "  3. Check storage mode: http://localhost:5000/api/storage/status\n",
  );
} catch (error) {
  console.error("\n❌ Migration failed:", error.message);
  console.error(error.stack);
  process.exit(1);
}

process.exit(0);
