/**
 * Application Constants
 * Centralized configuration and magic numbers used throughout the application
 */

// ============================================
// API Configuration
// ============================================
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
export const API_TIMEOUT = 30000; // milliseconds

// ============================================
// Audio Sampler Configuration
// ============================================
export const MAX_PADS = 16; // Number of audio pads in the sampler (4x4 grid)
export const PAD_PLAY_ANIMATION_DURATION = 150; // milliseconds - how long the "playing" visual effect lasts
export const RECORDING_UPDATE_INTERVAL = 100; // milliseconds - how often to update recording duration display
export const RECORDING_DURATION_DIVISOR = 1000; // milliseconds to seconds conversion

// ============================================
// Waveform Editor Configuration
// ============================================
export const TRIM_BAR_DETECTION_THRESHOLD = 30; // pixels - how close you need to be to a trim bar to select it
export const TRIM_BAR_COLOR = "#00ff00"; // green
export const TRIM_BAR_SELECTED_COLOR = "#ffaa00"; // orange
export const WAVEFORM_CONTAINER_WIDTH = 900; // pixels
export const WAVEFORM_CONTAINER_HEIGHT = 200; // pixels
export const WAVEFORM_COLOR = "#667eea"; // primary purple
export const WAVEFORM_DEFAULT_SAMPLE_STEP = 1; // samples to skip when drawing waveform

// ============================================
// Progress and Loading
// ============================================
export const PROGRESS_COMPLETE = 100; // percentage
export const PROGRESS_START = 0; // percentage

// ============================================
// Keyboard Shortcuts
// ============================================
export const KEYBOARD_PAD_MAP: Record<string, number> = {
  a: 0,
  s: 1,
  d: 2,
  f: 3,
  g: 4,
  h: 5,
  j: 6,
  k: 7,
  z: 8,
  x: 9,
  c: 10,
  v: 11,
  b: 12,
  n: 13,
  m: 14,
  ",": 15,
  // Additional mappings for alternative layouts
  q: 0,
  w: 1,
  e: 2,
  r: 3,
  t: 4,
  y: 5,
  u: 6,
  i: 7,
  o: 8,
  p: 9,
};

// ============================================
// UI Theme Colors (CSS Variables)
// ============================================
export const THEME_COLORS = {
  PRIMARY: "#667eea",
  SECONDARY: "#764ba2",
  ACCENT: "#00ff00",
  DARK_BG: "#0f0f1e",
  LIGHT_TEXT: "#ffffff",
  CARD_BG: "#1a1a2e",
  BORDER: "#2d2d44",
  SUCCESS: "#00ff88",
  WARNING: "#ffaa00",
  DANGER: "#ff4466",
} as const;

// ============================================
// Audio Format Configuration
// ============================================
export const RECORDING_MIME_TYPE = "audio/webm";
export const RECORDING_FILE_EXTENSION = ".webm";

// ============================================
// File Upload and Loading
// ============================================
export const MAX_SOUNDS_PER_PRESET = 16; // Limit sounds to number of pads
export const SOUND_LOAD_TIMEOUT = 30000; // milliseconds

// ============================================
// Error Messages
// ============================================
export const ERROR_MESSAGES = {
  NO_PRESETS: "No presets found on server",
  NO_SOUNDS: "Failed to load any sounds",
  INVALID_PAD_INDEX: "Invalid pad index",
  PAD_NOT_LOADED: "Pad is not loaded",
  NO_BACKEND: "Backend not available - Using demo mode",
  RECORDING_FAILED: "Error starting recording",
} as const;

// ============================================
// Success Messages
// ============================================
export const SUCCESS_MESSAGES = {
  PRESETS_LOADED: "Preset list loaded successfully",
  SOUNDS_LOADED: "Sounds loaded successfully",
  RECORDING_STARTED: "Recording started",
  RECORDING_STOPPED: "Recording stopped",
} as const;

// ============================================
// Application Metadata
// ============================================
export const APP_VERSION = "1.0";
export const APP_NAME = "Web Audio Sampler";
export const APP_DESCRIPTION =
  "Professional web-based audio sampler and beat maker";
