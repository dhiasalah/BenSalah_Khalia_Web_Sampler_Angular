import { useEffect, useRef, useState } from "react";
import SamplerEngine from "@/lib/SamplerEngine";

export function useAudioEngine() {
  const [engine, setEngine] = useState<SamplerEngine | null>(null);
  const engineRef = useRef<SamplerEngine | null>(null);

  useEffect(() => {
    // Create audio context and engine only once
    const audioCtx = new AudioContext();
    const sampler = new SamplerEngine(audioCtx);
    engineRef.current = sampler;
    setEngine(sampler);

    return () => {
      // Cleanup if needed
    };
  }, []);

  return engine;
}
