import { useRef } from "react";
import SamplerEngine from "@/lib/SamplerEngine";
import { getPadButtonsRef } from "@/components/PadsGrid";

export function usePadSelection() {
  const selectedPadIndexRef = useRef(-1);
  const selectPadRef = useRef<
    (padIndex: number, engine: SamplerEngine | null) => void
  >((padIndex, engine) => {
    if (!engine) return;

    selectedPadIndexRef.current = padIndex;
    const pad = engine.getPad(padIndex);

    const padButtonsRef = getPadButtonsRef();
    const buttons = (padButtonsRef as Record<string, unknown>)
      ?.current as (HTMLButtonElement | null)[];

    buttons?.forEach((btn, idx) => {
      if (btn) {
        if (idx === padIndex) {
          btn.classList.add("selected");
        } else {
          btn.classList.remove("selected");
        }
      }
    });

    return pad;
  });

  return {
    selectPadRef,
    getSelectedPadIndex: () => selectedPadIndexRef.current,
  };
}
