import { useCallback } from "react";
import SamplerEngine from "@/lib/SamplerEngine";

interface RecordingPanelProps {
  engine: SamplerEngine | null;
  isRecording: boolean;
  recordedBlob: Blob | null;
  recordingDuration: number;
  onStartRecording: (engine: SamplerEngine | null) => void;
  onStopRecording: () => void;
  onPlayRecording: () => void;
  onDownloadRecording: () => void;
  onClearRecording: () => void;
}

export default function RecordingPanel({
  engine,
  isRecording,
  recordedBlob,
  recordingDuration,
  onStartRecording,
  onStopRecording,
  onPlayRecording,
  onDownloadRecording,
  onClearRecording,
}: RecordingPanelProps) {
  const handleStartRecording = useCallback(() => {
    onStartRecording(engine);
  }, [engine, onStartRecording]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <section className="recording-section">
      <div className="recording-header">
        <h2>🎙️ Recording</h2>
        <p className="recording-subtitle">Record your pad performances</p>
      </div>

      <div className="recording-controls">
        <div className="recording-status">
          {isRecording && (
            <div className="recording-indicator">
              <span className="recording-dot"></span>
              <span className="recording-time">
                REC {formatTime(recordingDuration)}
              </span>
            </div>
          )}
          {!isRecording && recordedBlob && (
            <div className="recording-ready">
              <span className="ready-indicator">✓</span>
              <span className="ready-text">Recording ready</span>
            </div>
          )}
          {!isRecording && !recordedBlob && (
            <div className="recording-idle">
              <span className="idle-text">No recording</span>
            </div>
          )}
        </div>

        <div className="recording-buttons">
          {!isRecording ? (
            <button
              className="record-btn"
              onClick={handleStartRecording}
              title="Start recording"
            >
              ⏺️ RECORD
            </button>
          ) : (
            <button
              className="stop-btn"
              onClick={onStopRecording}
              title="Stop recording"
            >
              ⏹️ STOP
            </button>
          )}

          {recordedBlob && !isRecording && (
            <>
              <button
                className="play-btn"
                onClick={onPlayRecording}
                title="Play recording"
              >
                ▶️ PLAY
              </button>
              <button
                className="download-btn"
                onClick={onDownloadRecording}
                title="Download recording"
              >
                ⬇️ DOWNLOAD
              </button>
              <button
                className="clear-btn"
                onClick={onClearRecording}
                title="Clear recording"
              >
                🗑️ CLEAR
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
