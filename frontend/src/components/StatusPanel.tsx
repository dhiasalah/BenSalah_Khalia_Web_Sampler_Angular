interface StatusPanelProps {
  statusText: string;
  statusClass: string;
  progress: number;
}

export default function StatusPanel({
  statusText,
  statusClass,
  progress,
}: StatusPanelProps) {
  const progressBarStyle = {
    "--progress": `${progress}%`,
  } as React.CSSProperties;

  return (
    <section className="control-panel">
      <div className="status-panel">
        <span className={`status-text ${statusClass}`}>{statusText}</span>
        {progress > 0 && (
          <div className="progress-container">
            <div className="progress-bar" style={progressBarStyle}></div>
            <span className="progress-text">{progress}%</span>
          </div>
        )}
      </div>
    </section>
  );
}
