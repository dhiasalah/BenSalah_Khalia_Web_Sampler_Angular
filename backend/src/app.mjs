// src/app.mjs — with MongoDB support
import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "node:url";

import crypto from "crypto";
import multer from "multer";

// import utility functions from utils.mjs
import {
  slugify,
  safePresetPath,
  fileExists,
  readJSON,
  writeJSON,
  listPresetFiles,
  validatePreset,
} from "./utils.mjs";

// Import database connection
import { connectDB, isConnected } from "./db.mjs";

// Import preset service (handles both MongoDB and file storage)
import * as presetService from "./services/presetService.mjs";

export const app = express();
app.use(express.json({ limit: "2mb" }));

// Add CORS headers for all responses
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// configure multer for file uploads
// storage is diskStorage with destination and filename functions
// multer means "multipart/form-data" which is used for file uploads
// Before HTML5 it was not possible to upload files with AJAX easily
// so we use a form with enctype="multipart/form-data" and method="POST"
// The form can be submitted with JavaScript (e.g., fetch API) or directly by the browser
const upload = multer({
  storage: multer.diskStorage({
    // cb is the callback to indicate where to store the file
    destination: async (req, file, cb) => {
      const folder = req.params.folder || "";
      const destDir = path.join(DATA_DIR, folder);
      await fs.mkdir(destDir, { recursive: true }).catch(() => {});
      cb(null, destDir);
    },
    filename: (req, file, cb) => {
      // Use original filename
      cb(null, file.originalname);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // limit files to 10MB
});

// --------- Cross-platform paths (Mac/Linux/Windows) ---------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PUBLIC_DIR: env var wins, else ../public (absolute path)
export const PUBLIC_DIR = process.env.PUBLIC_DIR
  ? path.resolve(process.env.PUBLIC_DIR)
  : path.resolve(__dirname, "../public");

// DATA_DIR: env var wins, else <PUBLIC_DIR>/presets
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(PUBLIC_DIR, "presets");

// No decodeURIComponent needed anymore; these are file system paths

// Defines where static files are located, for example the file
// data/presets/Basic Kit/kick.wav
// will be accessible at http://localhost:3000/presets/Basic%20Kit/kick.wav
// The file PUBLIC_DIR/index.html will be served at http://localhost:3000/ or
// http://localhost:3000/index.html
// app.use should use a path that works on unix and windows
app.use(express.static(PUBLIC_DIR));

// Ensure data dir exists at startup (best-effort)
await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});

// Initialize MongoDB connection (optional - falls back to file storage)
const dbConnected = await connectDB();
console.log(
  `📦 Storage mode: ${dbConnected ? "MongoDB Atlas" : "Local files"}`,
);

// ------- Routes -------
// This is where we define the API endpoints (also called web services or routes)
// Each route has a method (get, post, put, patch, delete) and a path (e.g., /api/presets)
// The handler function takes the request (req), response (res), and next (for error handling) as parameters

// Simple health check endpoint, this is generally the first endpoint to test
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, now: new Date().toISOString() }),
);

// GET list/search
app.get("/api/presets", async (req, res, next) => {
  try {
    const { q, type, factory } = req.query;
    const items = await presetService.getAllPresets({ q, type, factory });
    res.json(items);
  } catch (e) {
    next(e);
  }
});

// GET one preset by name or slug
app.get("/api/presets/:name", async (req, res, next) => {
  try {
    const preset = await presetService.getPresetByName(req.params.name);
    if (!preset) return res.status(404).json({ error: "Preset not found" });
    res.json(preset);
  } catch (e) {
    next(e);
  }
});

// POST for creating a new preset
app.post("/api/presets", async (req, res, next) => {
  try {
    const preset = req.body ?? {};

    // validate the received preset object
    const errs = validatePreset(preset);
    if (errs.length) return res.status(400).json({ errors: errs });

    // check if a preset with the same name already exists
    if (await presetService.presetExists(preset.name))
      return res
        .status(409)
        .json({ error: "A preset with this name already exists" });

    // Create the preset using the service
    const created = await presetService.createPreset(preset);

    // return the created preset
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// POST route for uploading audio sample files (.wav, .mp3 etc./)
// This route will take as a parameter the sample/folder name where to store the file
// and the file will be available at http://localhost:3000/presets/:folder/:filename
// we can add multiple files with multer. 16 below is the max number of files accepted
// NOTE: THIS CODE IS INCOMPLETE: a folder should be created for each preset
// and the audio files should be stored in that folder.
// Here, if all files (the preset json file and the audio files) are uploaded at once, they all
// will be stored in the same folder, which is not what we want. We want:
// the preset file in the preset folder, and the audio files in a subfolder with the same name
// For example:
// public/presets/Basic Kit.json
// public/presets/Basic Kit/kick.wav
// public/presets/Basic Kit/snare.wav
// etc.
// To do that, we will need to modify later both this code and the front-end code
// We will see that in the next session
app.post("/api/upload/:folder", upload.array("files", 16), (req, res) => {
  // All files are in req.files
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files were uploaded." });
  }

  const destinationFolder = req.params.folder || "";
  console.log(
    `Uploaded ${req.files.length} files to folder: ${destinationFolder}`,
  );

  // Prepare response with file information
  const fileInfos = req.files.map((file) => ({
    originalName: file.originalname,
    storedName: file.filename,
    size: file.size,
    url: `/presets/${req.params.folder}/${file.filename}`,
  }));

  // with the current multer setup, files are already saved in the correct folder
  // so we just return the file information
  res.status(201).json({ uploaded: fileInfos.length, files: fileInfos });
});

// PUT for replacing or renaming a preset file completely
app.put("/api/presets/:name", async (req, res, next) => {
  try {
    // Check if preset exists
    if (!(await presetService.presetExists(req.params.name)))
      return res.status(404).json({ error: "Preset not found" });

    const preset = req.body ?? {};
    const errs = validatePreset(preset);
    if (errs.length) return res.status(400).json({ errors: errs });

    const updated = await presetService.updatePreset(req.params.name, preset);
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// PATCH partial
app.patch("/api/presets/:name", async (req, res, next) => {
  try {
    // Validate partial update
    const errs = validatePreset(req.body, { partial: true });
    if (errs.length) return res.status(400).json({ errors: errs });

    const updated = await presetService.patchPreset(req.params.name, req.body);
    if (!updated) return res.status(404).json({ error: "Preset not found" });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// DELETE a preset by name
app.delete("/api/presets/:name", async (req, res, next) => {
  try {
    await presetService.deletePreset(req.params.name);
    // 204 means No Content
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

// POST for seeding multiple presets at once (for testing or initial setup)
app.post("/api/presets:seed", async (req, res, next) => {
  try {
    const arr = Array.isArray(req.body) ? req.body : null;
    if (!arr)
      return res
        .status(400)
        .json({ error: "Body must be an array of presets" });

    // Validate all presets first
    for (const p of arr) {
      const errs = validatePreset(p);
      if (errs.length) return res.status(400).json({ errors: errs });
    }

    const result = await presetService.seedPresets(arr);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

// POST for migrating presets from file storage to MongoDB
app.post("/api/presets:migrate", async (req, res, next) => {
  try {
    if (!isConnected()) {
      return res.status(400).json({
        error: "MongoDB not connected. Cannot migrate.",
        hint: "Set MONGODB_URI environment variable",
      });
    }
    const result = await presetService.migrateFilesToMongo();
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// GET storage status
app.get("/api/storage/status", (_req, res) => {
  res.json({
    mode: isConnected() ? "mongodb" : "files",
    mongoConnected: isConnected(),
    dataDir: DATA_DIR,
  });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});
