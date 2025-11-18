import { useEffect } from "react";
import SamplerEngine from "@/lib/SamplerEngine";
import { getPadButtonsRef } from "@/components/PadsGrid";

interface KeyboardConfig {
  engine: SamplerEngine | null;
}

const keyToPadMap: Record<string, number> = {
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  e: 4,
  f: 5,
  g: 6,
  h: 7,
  i: 8,
  j: 9,
  k: 10,
  l: 11,
  m: 12,
  n: 13,
  o: 14,
  p: 15,
  q: 0,
  r: 1,
  s: 2,
  t: 3,
  u: 4,
  v: 5,
  w: 6,
  x: 7,
  y: 8,
  z: 9,
};

export function useKeyboardControls({ engine }: KeyboardConfig) {
  useEffect(() => {
    const keysPressed: Record<string, boolean> = {};

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key in keyToPadMap && !keysPressed[key]) {
        keysPressed[key] = true;
        event.preventDefault();

        const padIndex = keyToPadMap[key];
        const pad = engine?.getPad(padIndex);

        if (pad && pad.loaded) {
          const padButtonsRef = getPadButtonsRef();
          const buttons = (padButtonsRef as Record<string, unknown>)
            ?.current as (HTMLButtonElement | null)[];
          const button = buttons?.[padIndex];

          if (button) button.classList.add("playing");

          engine?.play(padIndex);

          setTimeout(() => {
            if (button) button.classList.remove("playing");
          }, 150);
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key in keyToPadMap) {
        keysPressed[key] = false;
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [engine]);
}

export { keyToPadMap };
