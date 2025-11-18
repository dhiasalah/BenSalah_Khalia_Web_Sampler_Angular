import { useState, useRef, useCallback } from "react";
import SamplerEngine from "@/lib/SamplerEngine";

interface RecordingState {
  isRecording: boolean;
  recordedBlob: Blob | null;
  recordingDuration: number;
}

export function useRecording() {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    recordedBlob: null,
    recordingDuration: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const startRecording = useCallback(async (engine: SamplerEngine | null) => {
    if (!engine) return;

    try {
      // Get or create audio context
      if (!audioContextRef.current) {
        audioContextRef.current = engine.getAudioContext();
      }

      const audioContext = audioContextRef.current;

      // Create media stream destination if not exists
      if (!destinationRef.current) {
        destinationRef.current = audioContext.createMediaStreamDestination();
        // Connect the engine's master gain to the recording destination
        engine.connectRecordingDestination(destinationRef.current);
      }

      const destination = destinationRef.current;

      // Create a new MediaRecorder from the media stream
      const mediaStream = destination.stream;
      const mediaRecorder = new MediaRecorder(mediaStream);

      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        setRecordingState((prev) => ({
          ...prev,
          isRecording: false,
          recordedBlob: audioBlob,
        }));
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;

      setRecordingState((prev) => ({
        ...prev,
        isRecording: true,
        recordingDuration: 0,
      }));

      // Update recording duration every 100ms
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - recordingStartTimeRef.current) / 1000
        );
        setRecordingState((prev) => ({
          ...prev,
          recordingDuration: elapsed,
        }));
      }, 100);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState.isRecording) {
      mediaRecorderRef.current.stop();

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  }, [recordingState.isRecording]);

  const playRecording = useCallback(() => {
    if (recordingState.recordedBlob) {
      const url = URL.createObjectURL(recordingState.recordedBlob);
      const audio = new Audio(url);
      audio.play();
    }
  }, [recordingState.recordedBlob]);

  const downloadRecording = useCallback(() => {
    if (recordingState.recordedBlob) {
      const url = URL.createObjectURL(recordingState.recordedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recording-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [recordingState.recordedBlob]);

  const clearRecording = useCallback(() => {
    audioChunksRef.current = [];
    setRecordingState({
      isRecording: false,
      recordedBlob: null,
      recordingDuration: 0,
    });
  }, []);

  return {
    ...recordingState,
    startRecording,
    stopRecording,
    playRecording,
    downloadRecording,
    clearRecording,
  };
}
