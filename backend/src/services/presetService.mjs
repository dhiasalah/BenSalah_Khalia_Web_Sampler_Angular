// src/services/presetService.mjs - Preset data access layer
// Supports both MongoDB and local file storage

import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "node:url";
import Preset from "../models/Preset.mjs";
import { isConnected } from "../db.mjs";
import {
  slugify,
  safePresetPath,
  fileExists,
  readJSON,
  writeJSON,
  listPresetFiles,
} from "../utils.mjs";

// Calculate DATA_DIR locally to avoid circular imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = process.env.PUBLIC_DIR
  ? path.resolve(process.env.PUBLIC_DIR)
  : path.resolve(__dirname, "../../public");

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(PUBLIC_DIR, "presets");

/**
 * Check if we should use MongoDB or file storage
 */
const useMongoDb = () => isConnected();

/**
 * Get all presets with optional filters
 */
export const getAllPresets = async ({ q, type, factory } = {}) => {
  if (useMongoDb()) {
    // MongoDB query
    let query = {};

    if (type) {
      query.type = { $regex: new RegExp(`^${type}$`, "i") };
    }

    if (factory !== undefined) {
      query.isFactoryPresets = factory === "true" || factory === true;
    }

    let presets = await Preset.find(query).lean();

    // Text search on name and samples
    if (q) {
      const needle = String(q).toLowerCase();
      presets = presets.filter((p) => {
        const inName = p?.name?.toLowerCase().includes(needle);
        const inSamples =
          Array.isArray(p?.samples) &&
          p.samples.some(
            (s) =>
              s &&
              (s.name?.toLowerCase().includes(needle) ||
                s.url?.toLowerCase().includes(needle)),
          );
        return inName || inSamples;
      });
    }

    return presets;
  } else {
    // File-based storage (original implementation)
    const files = await listPresetFiles();
    let items = await Promise.all(
      files.map((f) => readJSON(path.join(DATA_DIR, f))),
    );

    if (type) {
      const t = String(type).toLowerCase();
      items = items.filter((p) => p?.type?.toLowerCase() === t);
    }
    if (factory !== undefined) {
      const want = String(factory) === "true";
      items = items.filter((p) => Boolean(p?.isFactoryPresets) === want);
    }
    if (q) {
      const needle = String(q).toLowerCase();
      items = items.filter((p) => {
        const inName = p?.name?.toLowerCase().includes(needle);
        const inSamples =
          Array.isArray(p?.samples) &&
          p.samples.some(
            (s) =>
              s &&
              (s.name?.toLowerCase().includes(needle) ||
                s.url?.toLowerCase().includes(needle)),
          );
        return inName || inSamples;
      });
    }

    return items;
  }
};

/**
 * Get a preset by name or slug
 */
export const getPresetByName = async (nameOrSlug) => {
  if (useMongoDb()) {
    const slug = slugify(nameOrSlug);
    const preset = await Preset.findOne({
      $or: [{ slug }, { name: nameOrSlug }],
    }).lean();
    return preset;
  } else {
    const file = safePresetPath(nameOrSlug);
    if (!(await fileExists(file))) return null;
    return await readJSON(file);
  }
};

/**
 * Check if a preset exists
 */
export const presetExists = async (nameOrSlug) => {
  if (useMongoDb()) {
    const slug = slugify(nameOrSlug);
    const count = await Preset.countDocuments({
      $or: [{ slug }, { name: nameOrSlug }],
    });
    return count > 0;
  } else {
    const file = safePresetPath(nameOrSlug);
    return await fileExists(file);
  }
};

/**
 * Create a new preset
 */
export const createPreset = async (presetData) => {
  const now = new Date().toISOString();
  const id = presetData.id || crypto.randomUUID();
  const slug = slugify(presetData.name);

  const preset = {
    id,
    slug,
    name: presetData.name,
    type: presetData.type,
    isFactoryPresets: presetData.isFactoryPresets ?? false,
    samples: presetData.samples || [],
    updatedAt: now,
    createdAt: now,
  };

  if (useMongoDb()) {
    const doc = new Preset(preset);
    await doc.save();
    return doc.toJSON();
  } else {
    const file = safePresetPath(presetData.name);
    await writeJSON(file, preset);
    return preset;
  }
};

/**
 * Update a preset completely (PUT)
 */
export const updatePreset = async (nameOrSlug, presetData) => {
  const now = new Date().toISOString();
  const newSlug = slugify(presetData.name);

  if (useMongoDb()) {
    const slug = slugify(nameOrSlug);
    const existing = await Preset.findOne({
      $or: [{ slug }, { name: nameOrSlug }],
    });

    if (!existing) return null;

    const updated = {
      ...presetData,
      id: existing.id,
      slug: newSlug,
      updatedAt: now,
      createdAt: existing.createdAt,
    };

    await Preset.findOneAndUpdate({ _id: existing._id }, updated, {
      new: true,
    });

    return updated;
  } else {
    const oldFile = safePresetPath(nameOrSlug);
    if (!(await fileExists(oldFile))) return null;

    const current = await readJSON(oldFile).catch(() => ({}));
    const updated = {
      id: current.id || presetData.id || crypto.randomUUID(),
      slug: newSlug,
      updatedAt: now,
      ...presetData,
      name: presetData.name,
    };

    const newFile = safePresetPath(presetData.name);
    await writeJSON(newFile, updated);
    if (newFile !== oldFile) await fs.rm(oldFile, { force: true });

    return updated;
  }
};

/**
 * Partially update a preset (PATCH)
 */
export const patchPreset = async (nameOrSlug, updates) => {
  const now = new Date().toISOString();

  if (useMongoDb()) {
    const slug = slugify(nameOrSlug);
    const existing = await Preset.findOne({
      $or: [{ slug }, { name: nameOrSlug }],
    });

    if (!existing) return null;

    const merged = {
      ...existing.toObject(),
      ...updates,
      updatedAt: now,
    };

    if (updates.name) {
      merged.slug = slugify(updates.name);
    }

    // Remove MongoDB fields before saving
    delete merged._id;
    delete merged.__v;

    await Preset.findOneAndUpdate({ _id: existing._id }, merged, { new: true });

    return merged;
  } else {
    const oldFile = safePresetPath(nameOrSlug);
    if (!(await fileExists(oldFile))) return null;

    const current = await readJSON(oldFile);
    const merged = { ...current, ...updates };
    merged.name = merged.name ?? current.name;
    merged.slug = slugify(merged.name);
    merged.updatedAt = now;

    const newFile = safePresetPath(merged.name);
    await writeJSON(newFile, merged);
    if (newFile !== oldFile) await fs.rm(oldFile, { force: true });

    return merged;
  }
};

/**
 * Delete a preset
 */
export const deletePreset = async (nameOrSlug) => {
  if (useMongoDb()) {
    const slug = slugify(nameOrSlug);
    const result = await Preset.deleteOne({
      $or: [{ slug }, { name: nameOrSlug }],
    });
    return result.deletedCount > 0;
  } else {
    const file = safePresetPath(nameOrSlug);
    await fs.rm(file, { force: true });

    // Also delete audio files folder
    const folderPath = path.join(DATA_DIR, nameOrSlug);
    await fs.rm(folderPath, { recursive: true, force: true }).catch(() => {});

    return true;
  }
};

/**
 * Seed multiple presets (for initial setup)
 */
export const seedPresets = async (presets) => {
  const created = [];

  for (const p of presets) {
    const preset = await createPreset(p);
    created.push(preset.slug);
  }

  return { created: created.length, slugs: created };
};

/**
 * Migrate presets from file storage to MongoDB
 * Useful for initial migration
 */
export const migrateFilesToMongo = async () => {
  if (!useMongoDb()) {
    console.log("MongoDB not connected. Cannot migrate.");
    return { migrated: 0, errors: [] };
  }

  const files = await listPresetFiles();
  let migrated = 0;
  const errors = [];

  for (const file of files) {
    try {
      const preset = await readJSON(path.join(DATA_DIR, file));

      // Check if already exists in MongoDB
      const exists = await Preset.findOne({
        slug: preset.slug || slugify(preset.name),
      });
      if (exists) {
        console.log(`Skipping ${preset.name} - already exists in MongoDB`);
        continue;
      }

      await createPreset(preset);
      migrated++;
      console.log(`Migrated: ${preset.name}`);
    } catch (error) {
      errors.push({ file, error: error.message });
      console.error(`Error migrating ${file}:`, error.message);
    }
  }

  return { migrated, errors };
};
