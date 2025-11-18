export default function InfoSection() {
  return (
    <section className="info-section">
      <h3>📚 How to Use</h3>
      <div className="instructions-grid">
        <div className="instruction-card">
          <span className="card-icon">1️⃣</span>
          <h4>Select Preset</h4>
          <p>Choose a drum kit from the dropdown menu</p>
        </div>
        <div className="instruction-card">
          <span className="card-icon">2️⃣</span>
          <h4>Load Sounds</h4>
          <p>Click &quot;Load Sounds&quot; to download samples</p>
        </div>
        <div className="instruction-card">
          <span className="card-icon">3️⃣</span>
          <h4>Play &amp; Edit</h4>
          <p>Click pads or press keyboard to trigger</p>
        </div>
        <div className="instruction-card">
          <span className="card-icon">4️⃣</span>
          <h4>Trim Samples</h4>
          <p>Drag green bars to trim waveforms</p>
        </div>
        <div className="instruction-card">
          <span className="card-icon">5️⃣</span>
          <h4>Record Performance</h4>
          <p>Click Record button to capture your beats and download</p>
        </div>
      </div>

      <div className="keyboard-shortcuts">
        <h4>⌨️ Keyboard Shortcuts (A-P)</h4>
        <div className="shortcuts-grid">
          <div className="shortcut-row">
            <strong>Row 1:</strong>
            <code>A S D F</code> <em>(Pads 1-4)</em>
          </div>
          <div className="shortcut-row">
            <strong>Row 2:</strong>
            <code>G H J K</code> <em>(Pads 5-8)</em>
          </div>
          <div className="shortcut-row">
            <strong>Row 3:</strong>
            <code>Z X C V</code> <em>(Pads 9-12)</em>
          </div>
          <div className="shortcut-row">
            <strong>Row 4:</strong>
            <code>B N M ,</code> <em>(Pads 13-16)</em>
          </div>
        </div>
      </div>
    </section>
  );
}
