import { useEffect, useRef, useCallback, useState } from "react";

interface PadsGridProps {
  onPadSelect: (padIndex: number) => void;
}

const keyboardShortcuts = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
];

interface PadState {
  name: string;
  disabled: boolean;
  loading: boolean;
  error: boolean;
  progress: number;
}

export default function PadsGrid({ onPadSelect }: PadsGridProps) {
  const padButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [padStates, setPadStates] = useState<PadState[]>(
    Array(16)
      .fill(null)
      .map(() => ({
        name: "Empty",
        disabled: true,
        loading: false,
        error: false,
        progress: 0,
      }))
  );

  // Create 16 pads programmatically and render them
  const pads = Array.from({ length: 16 }, (_, i) => i);

  const handlePadClick = useCallback(
    (padIndex: number) => {
      onPadSelect(padIndex);
    },
    [onPadSelect]
  );

  useEffect(() => {
    // Expose refs for external access (for updatePadButton helper)
    const globalWindow = typeof window !== "undefined" ? window : null;
    if (globalWindow) {
      (globalWindow as unknown as Record<string, unknown>).__padButtonsRef =
        padButtonsRef;
      // Also expose setPadStates for updatePadButton
      (globalWindow as unknown as Record<string, unknown>).__setPadStates =
        setPadStates;
    }
  }, []);

  return (
    <section className="pads-section">
      <div className="pads-header">
        <h2>🎹 Trigger Pads</h2>
        <p className="pads-subtitle">Press A-P or click pads to play</p>
      </div>
      <div className="pads-grid">
        {pads.map((padIndex) => (
          <button
            key={padIndex}
            ref={(el) => {
              if (el) padButtonsRef.current[padIndex] = el;
            }}
            className={`pad ${padStates[padIndex]?.loading ? "loading" : ""} ${
              padStates[padIndex]?.error ? "error" : ""
            }`}
            disabled={padStates[padIndex]?.disabled}
            onClick={() => handlePadClick(padIndex)}
          >
            <span className="pad-name">{padStates[padIndex]?.name}</span>
            <span className="pad-shortcut">{keyboardShortcuts[padIndex]}</span>
            <div
              className="pad-progress"
              style={
                {
                  "--progress": `${padStates[padIndex]?.progress}%`,
                } as React.CSSProperties
              }
            ></div>
          </button>
        ))}
      </div>
    </section>
  );
}

// Helper function to get pad buttons ref for external access
export function getPadButtonsRef() {
  const globalWindow = typeof window !== "undefined" ? window : null;
  if (!globalWindow) return { current: [] };
  return (
    (globalWindow as unknown as Record<string, unknown>).__padButtonsRef || {
      current: [],
    }
  );
}

// Helper function to update pad button
export function updatePadButton(
  padIndex: number,
  state: string,
  engine: unknown,
  prog: number = 0
) {
  const globalWindow = typeof window !== "undefined" ? window : null;
  if (!globalWindow) return;

  const setPadStates = (globalWindow as unknown as Record<string, unknown>)
    .__setPadStates as
    | ((fn: (prev: PadState[]) => PadState[]) => void)
    | undefined;

  if (!setPadStates) return;

  const engineAny = engine as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const pad = engineAny?.getPad?.(padIndex);

  setPadStates((prev) => {
    const newStates = [...prev];
    const padState = newStates[padIndex];

    switch (state) {
      case "loading":
        newStates[padIndex] = {
          ...padState,
          loading: true,
          error: false,
          disabled: true,
          name: "Loading...",
          progress: prog,
        };
        break;

      case "loaded":
        newStates[padIndex] = {
          ...padState,
          loading: false,
          error: false,
          disabled: false,
          name: pad?.name || "Sound",
          progress: 100,
        };
        // Reset progress after a short delay
        setTimeout(() => {
          setPadStates((p) => {
            const updated = [...p];
            updated[padIndex] = { ...updated[padIndex], progress: 0 };
            return updated;
          });
        }, 500);
        break;

      case "error":
        newStates[padIndex] = {
          ...padState,
          loading: false,
          error: true,
          disabled: true,
          name: "Error",
          progress: 0,
        };
        break;

      case "empty":
        newStates[padIndex] = {
          ...padState,
          loading: false,
          error: false,
          disabled: true,
          name: "Empty",
          progress: 0,
        };
        break;
    }

    return newStates;
  });
}
