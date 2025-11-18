import { useState, useCallback } from "react";
import { getPresets, type Preset } from "@/lib/api";
import SamplerEngine from "@/lib/SamplerEngine";
import { updatePadButton } from "@/components/PadsGrid";

interface PromiseResult {
  success: boolean;
  index: number;
  error?: Error;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export function usePresetLoader() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [statusText, setStatusText] = useState("Initializing...");
  const [statusClass, setStatusClass] = useState("");
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [soundsLoaded, setSoundsLoaded] = useState(false);

  const loadPresetsFromServer = useCallback(async () => {
    try {
      setStatusText("Connecting to server...");
      setStatusClass("");

      const data = await getPresets();

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No presets found on server");
      }

      setPresets(data);
      setStatusText(`✓ Found ${data.length} preset(s) - Ready!`);
      setStatusClass("success");
    } catch (error) {
      console.error("Error loading presets:", error);
      setStatusText("⚠ Server not available - Using demo mode");
      setStatusClass("error");
      loadDemoPresets();
    }
  }, []);

  const loadDemoPresets = () => {
    const demoPresets: Preset[] = [
      {
        name: "Demo Drums",
        files: [
          "https://upload.wikimedia.org/wikipedia/commons/a/a3/Hardstyle_kick.wav",
          "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c7/Redoblante_de_marcha.ogg/Redoblante_de_marcha.ogg.mp3",
          "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c9/Hi-Hat_Cerrado.ogg/Hi-Hat_Cerrado.ogg.mp3",
          "https://upload.wikimedia.org/wikipedia/commons/transcoded/0/07/Hi-Hat_Abierto.ogg/Hi-Hat_Abierto.ogg.mp3",
          "https://upload.wikimedia.org/wikipedia/commons/transcoded/3/3c/Tom_Agudo.ogg/Tom_Agudo.ogg.mp3",
          "https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a4/Tom_Medio.ogg/Tom_Medio.ogg.mp3",
          "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/8d/Tom_Grave.ogg/Tom_Grave.ogg.mp3",
          "https://upload.wikimedia.org/wikipedia/commons/transcoded/6/68/Crash.ogg/Crash.ogg.mp3",
          "https://upload.wikimedia.org/wikipedia/commons/transcoded/2/24/Ride.ogg/Ride.ogg.mp3",
        ],
      },
    ];
    setPresets(demoPresets);
  };

  const loadPresetSounds = useCallback(
    async (selectedPresetIndex: string, engine: SamplerEngine | null) => {
      if (!engine || selectedPresetIndex === "") return;

      const presetIndex = parseInt(selectedPresetIndex);
      const preset = presets[presetIndex];

      try {
        setStatusText(`Loading preset: ${preset.name}...`);
        setStatusClass("");
        setIsLoading(true);
        setProgress(0);

        let soundURLs: string[] = [];
        let soundNames: string[] = [];

        if (preset.samples && Array.isArray(preset.samples)) {
          soundURLs = preset.samples.map((sample) => {
            if (sample.url.startsWith("http")) {
              return sample.url;
            } else {
              const cleanPath = sample.url.startsWith("./")
                ? sample.url.substring(2)
                : sample.url;
              return `${API_BASE_URL}/presets/${cleanPath}`;
            }
          });
          soundNames = preset.samples.map((sample) => sample.name);
        } else if (preset.files && Array.isArray(preset.files)) {
          if (typeof preset.files[0] === "string") {
            soundURLs = preset.files.map((file) => {
              if (file.startsWith("http")) {
                return file;
              } else {
                return `${API_BASE_URL}/sounds/${file}`;
              }
            });
          }
        }

        if (soundURLs.length === 0) {
          throw new Error("No sound files found in preset");
        }

        soundURLs = soundURLs.slice(0, 16);
        soundNames = soundNames.slice(0, 16);

        let loadedCount = 0;
        const totalSounds = soundURLs.length;

        const loadPromises = soundURLs.map(async (url, index) => {
          try {
            updatePadButton(index, "loading", engine, 0);

            const soundName = soundNames[index] || `Sound ${index + 1}`;
            await engine.loadSoundFromURL(index, url, (prog) => {
              updatePadButton(index, "loading", engine, prog);
            });

            const pad = engine.getPad(index);
            if (pad) {
              pad.name = soundName;
            }

            updatePadButton(index, "loaded", engine);
            loadedCount++;

            const overallProgress = (loadedCount / totalSounds) * 100;
            setProgress(Math.round(overallProgress));

            return { success: true, index } as PromiseResult;
          } catch (error) {
            console.error(`Failed to load sound ${index}:`, error);
            updatePadButton(index, "error", engine);
            return {
              success: false,
              index,
              error: error instanceof Error ? error : new Error(String(error)),
            } as PromiseResult;
          }
        });

        const results = await Promise.allSettled(loadPromises);

        const successCount = results.filter(
          (r) => r.status === "fulfilled" && (r.value as PromiseResult).success
        ).length;

        setProgress(0);

        if (successCount === 0) {
          throw new Error("Failed to load any sounds");
        }

        setStatusText(`✓ Loaded ${successCount}/${totalSounds} sounds`);
        setStatusClass("success");
        setSoundsLoaded(true);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("Error loading preset sounds:", error);
        setStatusText(`✗ Error: ${errorMsg}`);
        setStatusClass("error");
      } finally {
        setIsLoading(false);
      }
    },
    [presets]
  );

  return {
    presets,
    statusText,
    statusClass,
    progress,
    isLoading,
    soundsLoaded,
    loadPresetsFromServer,
    loadPresetSounds,
  };
}
