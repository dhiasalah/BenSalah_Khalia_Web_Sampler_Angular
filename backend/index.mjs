// Load environment variables from .env file
import "dotenv/config";

import { app } from "./src/app.mjs";

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 API Presets http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📦 Storage status: http://localhost:${PORT}/api/storage/status`);
});
