import SamplerEngine from "@/lib/SamplerEngine";
import { getUpdateTrimBarsFromPadRef } from "./WaveformEditor";

interface WaveformControlsProps {
  engine: SamplerEngine | null;
  selectedPadIndex: number;
  visible: boolean;
}

export default function WaveformControls({
  engine,
  selectedPadIndex,
  visible,
}: WaveformControlsProps) {
  const handlePlaySelected = () => {
    if (selectedPadIndex >= 0 && engine) {
      engine.play(selectedPadIndex);
    }
  };

  const handlePlayFull = () => {
    if (selectedPadIndex >= 0 && engine) {
      const pad = engine.getPad(selectedPadIndex);
      if (pad && pad.loaded) {
        const originalStart = pad.trimStart;
        const originalEnd = pad.trimEnd;
        pad.trimStart = 0;
        pad.trimEnd = pad.buffer!.duration;
        engine.play(selectedPadIndex);
        pad.trimStart = originalStart;
        pad.trimEnd = originalEnd;
      }
    }
  };

  const handleResetTrim = () => {
    if (selectedPadIndex >= 0 && engine) {
      engine.resetPad(selectedPadIndex);
      const updateTrimBarsRef = getUpdateTrimBarsFromPadRef() as {
        current: (() => void) | undefined;
      };
      updateTrimBarsRef.current?.();
    }
  };

  if (!visible) return null;

  return (
    <div className="waveform-controls">
      <button className="btn btn-secondary" onClick={handlePlaySelected}>
        <span>▶ Play Selection</span>
      </button>
      <button className="btn btn-secondary" onClick={handlePlayFull}>
        <span>▶▶ Play Full</span>
      </button>
      <button className="btn btn-tertiary" onClick={handleResetTrim}>
        <span>↺ Reset</span>
      </button>
    </div>
  );
}
