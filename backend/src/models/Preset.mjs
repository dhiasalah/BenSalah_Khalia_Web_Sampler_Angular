// src/models/Preset.mjs - MongoDB Schema for Presets
import mongoose from "mongoose";

/**
 * Sample Schema - represents one audio sample in a preset
 */
const SampleSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
  },
  { _id: false },
); // Don't create _id for subdocuments

/**
 * Preset Schema - represents a complete preset with samples
 */
const PresetSchema = new mongoose.Schema(
  {
    // Custom ID (UUID) - we use this instead of MongoDB's _id for API compatibility
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Preset name
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // URL-friendly slug
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Category/type (Drumkit, Electronic, Hip-Hop, etc.)
    type: {
      type: String,
      required: true,
      trim: true,
    },
    // Is this a factory preset (read-only) or user-created
    isFactoryPresets: {
      type: Boolean,
      default: false,
    },
    // Array of samples
    samples: {
      type: [SampleSchema],
      default: [],
    },
    // Metadata
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Options
    timestamps: true, // Auto-manage createdAt and updatedAt
    toJSON: {
      // Transform output when converting to JSON
      transform: (doc, ret) => {
        // Remove MongoDB-specific fields from API responses
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Index for text search on name
PresetSchema.index({ name: "text" });

// Pre-save hook to update the slug
PresetSchema.pre("save", function () {
  if (this.isModified("name") || !this.slug) {
    this.slug = slugify(this.name);
  }
});

// Helper function to slugify (same as utils.mjs)
function slugify(s) {
  return (s ?? "")
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .toLowerCase();
}

// Create and export the model
const Preset = mongoose.model("Preset", PresetSchema);

export default Preset;
