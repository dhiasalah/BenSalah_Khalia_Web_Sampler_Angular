import { Preset } from "@/lib/api";

interface ControlPanelProps {
  presets: Preset[];
  selectedPreset: string;
  onPresetChange: (value: string) => void;
  onLoadSounds: () => void;
  isLoading: boolean;
}

export default function ControlPanel({
  presets,
  selectedPreset,
  onPresetChange,
  onLoadSounds,
  isLoading,
}: ControlPanelProps) {
  return (
    <section className="control-panel">
      <div className="preset-section">
        <label htmlFor="presetDropdown" className="label-icon">
          🎵
        </label>
        <select
          id="presetDropdown"
          disabled={presets.length === 0}
          className="preset-select"
          value={selectedPreset}
          onChange={(e) => onPresetChange(e.target.value)}
        >
          <option value="">-- Select a preset --</option>
          {presets.map((preset, index) => (
            <option key={index} value={index}>
              {preset.name || `Preset ${index + 1}`}
            </option>
          ))}
        </select>
        <button
          id="loadAllBtn"
          disabled={selectedPreset === "" || isLoading}
          className="btn btn-primary"
          onClick={onLoadSounds}
        >
          <span>⚡ Load Sounds</span>
        </button>
      </div>
    </section>
  );
}
