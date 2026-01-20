import {
  Component,
  inject,
  input,
  signal,
  effect,
  output,
  OnInit,
  OnDestroy,
  HostListener,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AudioEngine, Pad } from '../../services/audio-engine';
import { Preset, Sample, PresetService, SampleToSave } from '../../services/preset';

/**
 * Loading state for each pad
 */
interface PadLoadingState {
  isLoading: boolean;
  progress: number;
  error: string | null;
}

/**
 * Keyboard mapping for pads
 */
const KEYBOARD_MAP: { [key: string]: number } = {
  // Bottom row (pads 0-3)
  a: 0,
  s: 1,
  d: 2,
  f: 3,
  // Second row (pads 4-7)
  q: 4,
  w: 5,
  e: 6,
  r: 7,
  // Third row (pads 8-11)
  z: 8,
  x: 9,
  c: 10,
  v: 11,
  // Top row (pads 12-15)
  t: 12,
  y: 13,
  u: 14,
  i: 15,
};

/**
 * PadsGrid - Visual grid of sampler pads
 * Layout: 4x4 grid with pad 0 (kick) at bottom left
 * Supports keyboard controls like a piano
 */
@Component({
  selector: 'app-pads-grid',
  imports: [CommonModule, FormsModule],
  templateUrl: './pads-grid.html',
  styleUrl: './pads-grid.css',
})
export class PadsGrid implements OnInit, OnDestroy, AfterViewInit {
  private readonly audioEngine = inject(AudioEngine);
  private readonly presetService = inject(PresetService);

  // Canvas reference for waveform display
  @ViewChild('waveformCanvas') waveformCanvas!: ElementRef<HTMLCanvasElement>;

  // Input: preset to load
  preset = input<Preset | null>(null);

  // Output: when all samples are loaded
  loadingComplete = output<void>();

  // State
  pads = signal<Pad[]>([]);
  loadingStates = signal<PadLoadingState[]>([]);
  isLoadingPreset = signal(false);
  overallProgress = signal(0);
  activePad = signal<number | null>(null);
  pressedKeys = signal<Set<string>>(new Set());
  selectedPadIndex = signal<number | null>(null);
  selectedPadName = signal<string>('');

  // Trim controls state
  trimStart = signal<number>(0); // 0-1 normalized
  trimEnd = signal<number>(1); // 0-1 normalized
  isDragging = signal<'start' | 'end' | null>(null);
  audioDuration = signal<number>(0);

  // Recording state
  isRecording = signal(false);
  recordingTime = signal(0);
  recordedBuffer = signal<AudioBuffer | null>(null);
  showRecordingPanel = signal(false);
  targetPadForRecording = signal<number | null>(null);
  autoSplitEnabled = signal(true);
  silenceThreshold = signal(0.02);
  detectedSegments = signal<Array<{ start: number; end: number }>>([]);
  private recordingTimer: ReturnType<typeof setInterval> | null = null;
  activeRecordedPad = signal(false);
  recordedPadTrimStart = signal(0);
  recordedPadTrimEnd = signal(1);

  // Current preset tracking
  currentPresetName = signal<string | null>(null);

  // Save preset state
  showSavePanel = signal(false);
  savePresetName = signal('');
  savePresetCategory = signal('Drumkit');
  isSaving = signal(false);
  saveError = signal<string | null>(null);
  saveSuccess = signal(false);

  // Available categories for presets
  readonly categories = [
    'Drumkit',
    'Electronic',
    'Hip-Hop',
    'Acoustic',
    'Piano',
    'Percussion',
    'FX',
    'Other',
  ];

  // Base URL for audio files
  private readonly baseUrl = 'http://localhost:5000/presets';

  constructor() {
    // Initialize loading states for 16 pads
    this.initializeLoadingStates();

    // Watch for preset changes
    effect(() => {
      const currentPreset = this.preset();
      if (currentPreset) {
        this.currentPresetName.set(currentPreset.name);
        this.loadPreset(currentPreset);
      }
    });
  }

  ngOnInit(): void {
    // Keyboard listeners are handled via @HostListener
  }

  ngAfterViewInit(): void {
    // Canvas is ready
  }

  ngOnDestroy(): void {
    // Clean up if needed
  }

  /**
   * Handle keyboard key down
   */
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    // Ignore keyboard events when typing in input fields
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT'
    ) {
      return;
    }

    const key = event.key.toLowerCase();

    // Handle spacebar for recorded sound
    if (key === ' ') {
      if (this.recordedBuffer()) {
        event.preventDefault();
        this.playRecordedSound();
      }
      return;
    }

    // Prevent default for keys we're using
    if (key in KEYBOARD_MAP) {
      event.preventDefault();

      // Prevent repeated keydown events when holding key
      if (this.pressedKeys().has(key)) return;

      this.pressedKeys.update((keys) => {
        const newKeys = new Set(keys);
        newKeys.add(key);
        return newKeys;
      });

      const padIndex = KEYBOARD_MAP[key];
      this.playPad(padIndex);
    }
  }

  /**
   * Handle keyboard key up
   */
  @HostListener('window:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();

    if (key in KEYBOARD_MAP) {
      this.pressedKeys.update((keys) => {
        const newKeys = new Set(keys);
        newKeys.delete(key);
        return newKeys;
      });
    }
  }

  private initializeLoadingStates(): void {
    const states: PadLoadingState[] = [];
    for (let i = 0; i < 16; i++) {
      states.push({ isLoading: false, progress: 0, error: null });
    }
    this.loadingStates.set(states);
  }

  /**
   * Load all samples from a preset into the pads
   */
  async loadPreset(preset: Preset): Promise<void> {
    this.isLoadingPreset.set(true);
    this.overallProgress.set(0);
    this.initializeLoadingStates();

    try {
      // Initialize audio engine if needed
      if (!this.audioEngine.isInitialized()) {
        await this.audioEngine.initialize();
      }

      // Clear existing pads
      this.audioEngine.clearAll();

      const samples = preset.samples;
      const totalSamples = Math.min(samples.length, 16);
      let loadedCount = 0;

      // Load each sample
      for (let i = 0; i < totalSamples; i++) {
        const sample = samples[i];
        const url = this.buildSampleUrl(sample.url);

        // Update loading state for this pad
        this.updateLoadingState(i, { isLoading: true, progress: 0, error: null });

        try {
          await this.audioEngine.loadSoundFromURL(i, url, (progress) => {
            this.updateLoadingState(i, { isLoading: true, progress, error: null });

            // Update overall progress
            const overall = ((loadedCount + progress / 100) / totalSamples) * 100;
            this.overallProgress.set(Math.round(overall));
          });

          // Mark as loaded
          this.updateLoadingState(i, { isLoading: false, progress: 100, error: null });
          loadedCount++;
        } catch (error) {
          console.error(`Failed to load sample ${sample.name}:`, error);
          this.updateLoadingState(i, {
            isLoading: false,
            progress: 0,
            error: `Failed to load: ${sample.name}`,
          });
        }
      }

      // Update pads signal
      this.pads.set(this.audioEngine.getAllPads());
      this.overallProgress.set(100);
      this.loadingComplete.emit();
    } catch (error) {
      console.error('Error loading preset:', error);
    } finally {
      this.isLoadingPreset.set(false);
    }
  }

  /**
   * Build full URL for sample
   */
  private buildSampleUrl(sampleUrl: string): string {
    // Remove leading ./ if present
    const cleanUrl = sampleUrl.replace(/^\.\//, '');
    return `${this.baseUrl}/${cleanUrl}`;
  }

  /**
   * Update loading state for a specific pad
   */
  private updateLoadingState(index: number, state: PadLoadingState): void {
    this.loadingStates.update((states) => {
      const newStates = [...states];
      newStates[index] = state;
      return newStates;
    });
  }

  /**
   * Play a pad
   */
  playPad(index: number): void {
    if (!this.audioEngine.isInitialized()) return;

    const pad = this.audioEngine.getPad(index);
    if (pad?.loaded) {
      this.audioEngine.play(index);
      this.triggerPadAnimation(index);
      this.displayWaveform(index);
    }
  }

  /**
   * Handle pad click - play if loaded, import file if empty
   */
  onPadClick(
    event: Event,
    padIndex: number,
    pad: Pad | null | undefined,
    fileInput: HTMLInputElement,
  ): void {
    event.preventDefault();
    event.stopPropagation();

    if (!pad?.loaded) {
      // Empty pad - trigger file selection
      fileInput.click();
    } else {
      // Loaded pad - play sound
      this.playPad(padIndex);
    }
  }

  /**
   * Handle file selection for a specific pad
   */
  async onPadFileSelected(event: Event, padIndex: number): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    await this.importFileToSpecificPad(file, padIndex);

    // Reset input
    input.value = '';
  }

  /**
   * Import a single audio file to a specific pad
   */
  private async importFileToSpecificPad(file: File, padIndex: number): Promise<void> {
    // Ensure AudioEngine is initialized
    if (!this.audioEngine.isInitialized()) {
      await this.audioEngine.initialize();
    }

    // Update loading state
    this.updateLoadingState(padIndex, {
      isLoading: true,
      progress: 0,
      error: null,
    });

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Update progress
      this.updateLoadingState(padIndex, {
        isLoading: true,
        progress: 50,
        error: null,
      });

      // Decode audio
      const ctx = this.audioEngine.getAudioContext();
      if (!ctx) throw new Error('No audio context');
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Get clean name from filename (remove extension)
      const name = file.name.replace(/\.[^/.]+$/, '');

      // Load into pad
      this.audioEngine.loadBuffer(padIndex, audioBuffer, name);

      // Update loading state
      this.updateLoadingState(padIndex, {
        isLoading: false,
        progress: 100,
        error: null,
      });

      // Update pads signal
      this.updatePadsFromEngine();

      console.log(`Imported "${name}" into pad ${padIndex + 1}`);

      // Upload to server if we have a current preset
      const presetName = this.currentPresetName();
      if (presetName) {
        try {
          console.log(`Uploading "${file.name}" to preset: ${presetName}`);
          const uploadResponse = await this.presetService
            .uploadAudioFiles(presetName, [file])
            .toPromise();

          if (uploadResponse) {
            // Update the preset JSON with new sample
            await this.updatePresetWithNewSamples(presetName, uploadResponse.files);
            console.log('File uploaded and preset updated successfully');
          }
        } catch (error) {
          console.error('Error uploading file to server:', error);
          // Continue anyway - file is loaded locally
        }
      }
    } catch (error) {
      console.error(`Error importing ${file.name}:`, error);
      this.updateLoadingState(padIndex, {
        isLoading: false,
        progress: 0,
        error: `Failed to load ${file.name}`,
      });
    }
  }

  /**
   * Display waveform for a pad in the canvas
   */
  private displayWaveform(padIndex: number): void {
    const pad = this.audioEngine.getPad(padIndex);
    if (!pad?.buffer) return;

    // Set signals first to show the canvas container
    this.selectedPadIndex.set(padIndex);
    this.selectedPadName.set(pad.name);
    this.audioDuration.set(pad.buffer.duration);

    // Load current trim values from pad (normalized 0-1)
    const duration = pad.buffer.duration;
    this.trimStart.set(pad.trimStart / duration);
    this.trimEnd.set(pad.trimEnd / duration);

    // Wait for next tick so the canvas is rendered in the DOM
    setTimeout(() => {
      this.drawWaveformWithTrim();
    }, 0);
  }

  /**
   * Draw the waveform on the canvas with trim indicators
   */
  private drawWaveformWithTrim(): void {
    const padIndex = this.selectedPadIndex();
    if (padIndex === null || !this.waveformCanvas) return;

    const pad = this.audioEngine.getPad(padIndex);
    if (!pad?.buffer) return;

    const canvas = this.waveformCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const trimStartX = this.trimStart() * width;
    const trimEndX = this.trimEnd() * width;

    // Clear canvas
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, width, height);

    // Draw trimmed out regions (darker)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, trimStartX, height);
    ctx.fillRect(trimEndX, 0, width - trimEndX, height);

    // Get audio data
    const buffer = pad.buffer;
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    // Draw waveform
    ctx.beginPath();
    ctx.moveTo(0, amp);

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum !== undefined) {
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
      }

      ctx.lineTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }

    // Color based on if in trim zone
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw center line
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.lineTo(width, amp);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.stroke();

    // Draw trim start bar
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(trimStartX - 3, 0, 6, height);

    // Draw trim start handle
    ctx.beginPath();
    ctx.moveTo(trimStartX, 0);
    ctx.lineTo(trimStartX + 10, 0);
    ctx.lineTo(trimStartX + 10, 15);
    ctx.lineTo(trimStartX, 25);
    ctx.closePath();
    ctx.fill();

    // Draw trim end bar
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(trimEndX - 3, 0, 6, height);

    // Draw trim end handle
    ctx.beginPath();
    ctx.moveTo(trimEndX, 0);
    ctx.lineTo(trimEndX - 10, 0);
    ctx.lineTo(trimEndX - 10, 15);
    ctx.lineTo(trimEndX, 25);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Handle mouse down on canvas for trim dragging
   */
  onCanvasMouseDown(event: MouseEvent): void {
    const canvas = this.waveformCanvas?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width;
    const normalizedX = x / width;

    const startDist = Math.abs(normalizedX - this.trimStart());
    const endDist = Math.abs(normalizedX - this.trimEnd());

    // Check if close enough to a trim bar (within 5%)
    if (startDist < 0.05 && startDist < endDist) {
      this.isDragging.set('start');
    } else if (endDist < 0.05) {
      this.isDragging.set('end');
    }
  }

  /**
   * Handle mouse move on canvas for trim dragging
   */
  onCanvasMouseMove(event: MouseEvent): void {
    if (!this.isDragging()) return;

    const canvas = this.waveformCanvas?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const normalizedX = Math.max(0, Math.min(1, x / rect.width));

    if (this.isDragging() === 'start') {
      // Don't let start go past end
      const newStart = Math.min(normalizedX, this.trimEnd() - 0.01);
      this.trimStart.set(Math.max(0, newStart));
    } else if (this.isDragging() === 'end') {
      // Don't let end go before start
      const newEnd = Math.max(normalizedX, this.trimStart() + 0.01);
      this.trimEnd.set(Math.min(1, newEnd));
    }

    // Update trim for recorded pad or regular pad
    if (this.selectedPadIndex() === -1) {
      this.updateRecordedTrimValues();
      const buffer = this.recordedBuffer();
      if (buffer) this.drawRecordedWaveform(buffer);
    } else {
      this.updateTrimValues();
      this.drawWaveformWithTrim();
    }
  }

  /**
   * Handle mouse up to stop dragging
   */
  onCanvasMouseUp(): void {
    this.isDragging.set(null);
  }

  /**
   * Handle mouse leave to stop dragging
   */
  onCanvasMouseLeave(): void {
    this.isDragging.set(null);
  }

  /**
   * Update trim values in the audio engine
   */
  private updateTrimValues(): void {
    const padIndex = this.selectedPadIndex();
    if (padIndex === null) return;

    const duration = this.audioDuration();
    const startTime = this.trimStart() * duration;
    const endTime = this.trimEnd() * duration;

    this.audioEngine.setTrimPoints(padIndex, startTime, endTime);
  }

  /**
   * Get formatted time from normalized value
   */
  getFormattedTime(normalized: number): string {
    const seconds = normalized * this.audioDuration();
    return seconds.toFixed(2) + 's';
  }

  /**
   * Reset trim to full sample
   */
  resetTrim(): void {
    this.trimStart.set(0);
    this.trimEnd.set(1);

    if (this.selectedPadIndex() === -1) {
      // Recorded sound
      this.updateRecordedTrimValues();
      const buffer = this.recordedBuffer();
      if (buffer) this.drawRecordedWaveform(buffer);
    } else {
      // Regular pad
      this.updateTrimValues();
      this.drawWaveformWithTrim();
    }
  }

  /**
   * Preview the trimmed sound
   */
  previewTrimmedSound(): void {
    const padIndex = this.selectedPadIndex();

    if (padIndex === -1) {
      // Preview recorded sound
      this.playRecordedSound();
    } else if (padIndex !== null) {
      // Preview regular pad
      this.audioEngine.play(padIndex);
    }
  }

  /**
   * Trigger visual animation on pad
   */
  private triggerPadAnimation(index: number): void {
    this.activePad.set(index);
    setTimeout(() => {
      if (this.activePad() === index) {
        this.activePad.set(null);
      }
    }, 150);
  }

  /**
   * Get pad display index for grid layout
   * Reorders so pad 0 is at bottom-left
   * Grid layout (visual):
   *   12 13 14 15  (row 0, top)
   *    8  9 10 11  (row 1)
   *    4  5  6  7  (row 2)
   *    0  1  2  3  (row 3, bottom)
   */
  getPadIndexForPosition(position: number): number {
    const row = Math.floor(position / 4);
    const col = position % 4;
    // Invert row order: row 0 becomes row 3, etc.
    const invertedRow = 3 - row;
    return invertedRow * 4 + col;
  }

  /**
   * Get position in grid for a given pad index
   */
  getPositionForPadIndex(padIndex: number): number {
    const row = Math.floor(padIndex / 4);
    const col = padIndex % 4;
    const invertedRow = 3 - row;
    return invertedRow * 4 + col;
  }

  /**
   * Get array of grid positions (0-15)
   */
  getGridPositions(): number[] {
    return Array.from({ length: 16 }, (_, i) => i);
  }

  /**
   * Get pad info for a grid position
   */
  getPadForPosition(position: number): Pad | null {
    const padIndex = this.getPadIndexForPosition(position);
    const allPads = this.pads();
    return allPads[padIndex] || null;
  }

  /**
   * Get loading state for a grid position
   */
  getLoadingStateForPosition(position: number): PadLoadingState {
    const padIndex = this.getPadIndexForPosition(position);
    return this.loadingStates()[padIndex] || { isLoading: false, progress: 0, error: null };
  }

  /**
   * Check if pad at position is active (playing)
   */
  isPadActive(position: number): boolean {
    const padIndex = this.getPadIndexForPosition(position);
    return this.activePad() === padIndex;
  }

  /**
   * Get keyboard key for a pad index
   */
  getKeyForPad(padIndex: number): string | null {
    for (const [key, index] of Object.entries(KEYBOARD_MAP)) {
      if (index === padIndex) {
        return key.toUpperCase();
      }
    }
    return null;
  }

  /**
   * Get keyboard key for a grid position
   */
  getKeyForPosition(position: number): string | null {
    const padIndex = this.getPadIndexForPosition(position);
    return this.getKeyForPad(padIndex);
  }

  /**
   * Check if a key is currently pressed
   */
  isKeyPressed(key: string): boolean {
    return this.pressedKeys().has(key.toLowerCase());
  }

  /**
   * Check if the key for this position is pressed
   */
  isPositionKeyPressed(position: number): boolean {
    const key = this.getKeyForPosition(position);
    return key ? this.isKeyPressed(key) : false;
  }

  // ==================== MICROPHONE RECORDING ====================

  /**
   * Toggle recording panel visibility
   */
  toggleRecordingPanel(): void {
    this.showRecordingPanel.update((v) => !v);
    if (!this.showRecordingPanel()) {
      this.resetRecordingState();
    }
  }

  /**
   * Start recording from microphone
   */
  async startRecording(): Promise<void> {
    try {
      if (!this.audioEngine.isInitialized()) {
        await this.audioEngine.initialize();
      }

      await this.audioEngine.startRecording();
      this.isRecording.set(true);
      this.recordingTime.set(0);
      this.recordedBuffer.set(null);
      this.detectedSegments.set([]);

      // Start timer
      this.recordingTimer = setInterval(() => {
        this.recordingTime.update((t) => t + 0.1);
      }, 100);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<void> {
    try {
      // Stop timer
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer);
        this.recordingTimer = null;
      }

      const buffer = await this.audioEngine.stopRecording();
      this.isRecording.set(false);
      this.recordedBuffer.set(buffer);

      // Auto-detect segments if enabled
      if (this.autoSplitEnabled()) {
        this.analyzeRecording();
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.isRecording.set(false);
    }
  }

  /**
   * Analyze recording for silence detection
   */
  analyzeRecording(): void {
    const buffer = this.recordedBuffer();
    if (!buffer) return;

    const segments = this.audioEngine.detectSoundSegments(
      buffer,
      this.silenceThreshold(),
      0.1, // min silence duration
      0.05, // min sound duration
    );

    this.detectedSegments.set(segments);
  }

  /**
   * Assign recorded sound to a single pad
   */
  assignToSinglePad(padIndex: number): void {
    const buffer = this.recordedBuffer();
    if (!buffer) return;

    const name = `Rec ${new Date().toLocaleTimeString()}`;
    this.audioEngine.loadBuffer(padIndex, buffer, name);
    this.pads.set(this.audioEngine.getAllPads());
    this.displayWaveform(padIndex);
    this.showRecordingPanel.set(false);
    this.resetRecordingState();
  }

  /**
   * Split recording and assign to multiple pads
   */
  splitAndAssignToPads(): void {
    const buffer = this.recordedBuffer();
    const segments = this.detectedSegments();

    if (!buffer || segments.length === 0) {
      alert('No segments detected. Try adjusting the silence threshold or record again.');
      return;
    }

    // Split the buffer
    const splitBuffers = this.audioEngine.splitBuffer(buffer, segments);

    // Assign to pads starting from pad 0
    const maxPads = Math.min(splitBuffers.length, 16);
    for (let i = 0; i < maxPads; i++) {
      const name = `Rec ${i + 1}`;
      this.audioEngine.loadBuffer(i, splitBuffers[i], name);
    }

    this.pads.set(this.audioEngine.getAllPads());

    // Select first pad to show waveform
    if (maxPads > 0) {
      this.displayWaveform(0);
    }

    this.showRecordingPanel.set(false);
    this.resetRecordingState();
  }

  /**
   * Preview recorded sound
   */
  previewRecording(): void {
    const buffer = this.recordedBuffer();
    if (!buffer || !this.audioEngine.isInitialized()) return;

    // Create a temporary source to play the buffer
    const ctx = this.audioEngine.getAudioContext();
    if (!ctx) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }

  /**
   * Reset recording state
   */
  private resetRecordingState(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
    this.isRecording.set(false);
    this.recordingTime.set(0);
    this.recordedBuffer.set(null);
    this.detectedSegments.set([]);
    this.targetPadForRecording.set(null);
  }

  /**
   * Get formatted recording time
   */
  getFormattedRecordingTime(): string {
    const time = this.recordingTime();
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms}`;
  }

  /**
   * Update silence threshold
   */
  updateSilenceThreshold(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.silenceThreshold.set(value);
    this.analyzeRecording();
  }

  /**
   * Get first empty pad index
   */
  getFirstEmptyPadIndex(): number {
    const allPads = this.pads();
    for (let i = 0; i < allPads.length; i++) {
      if (!allPads[i]?.loaded) {
        return i;
      }
    }
    return 0; // Default to first pad if all are full
  }

  /**
   * Get number of segments (max 16)
   */
  getSegmentsCount(): number {
    return Math.min(this.detectedSegments().length, 16);
  }

  // ==================== RECORDED PAD METHODS ====================

  /**
   * Play recorded sound
   */
  playRecordedSound(): void {
    const buffer = this.recordedBuffer();
    if (!buffer || !this.audioEngine.isInitialized()) return;

    const ctx = this.audioEngine.getAudioContext();
    if (!ctx) return;

    const duration = buffer.duration;
    const startTime = this.recordedPadTrimStart() * duration;
    const endTime = this.recordedPadTrimEnd() * duration;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0, startTime, endTime - startTime);

    this.activeRecordedPad.set(true);
    setTimeout(() => {
      this.activeRecordedPad.set(false);
    }, 150);
  }

  /**
   * Check if recorded pad is active
   */
  isRecordedPadActive(): boolean {
    return this.activeRecordedPad();
  }

  /**
   * Display recorded waveform in canvas for trimming
   */
  displayRecordedWaveform(): void {
    const buffer = this.recordedBuffer();
    if (!buffer) return;

    // Set signals for waveform display
    this.selectedPadIndex.set(-1); // Special index for recorded sound
    this.selectedPadName.set(`Recorded Sound (${this.recordingTime().toFixed(1)}s)`);
    this.audioDuration.set(buffer.duration);

    // Load current trim values
    this.trimStart.set(this.recordedPadTrimStart());
    this.trimEnd.set(this.recordedPadTrimEnd());

    // Wait for next tick so the canvas is rendered in the DOM
    setTimeout(() => {
      this.drawRecordedWaveform(buffer);
    }, 0);
  }

  /**
   * Draw recorded waveform on canvas
   */
  private drawRecordedWaveform(buffer: AudioBuffer): void {
    if (!this.waveformCanvas) return;

    const canvas = this.waveformCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const trimStartX = this.trimStart() * width;
    const trimEndX = this.trimEnd() * width;

    // Clear canvas
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, width, height);

    // Draw trimmed out regions
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, trimStartX, height);
    ctx.fillRect(trimEndX, 0, width - trimEndX, height);

    // Get audio data
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    // Draw waveform
    ctx.beginPath();
    ctx.moveTo(0, amp);

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum !== undefined) {
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
      }

      ctx.lineTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }

    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw center line
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.lineTo(width, amp);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.stroke();

    // Draw trim bars (orange start, red end)
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(trimStartX - 3, 0, 6, height);
    ctx.beginPath();
    ctx.moveTo(trimStartX, 0);
    ctx.lineTo(trimStartX + 10, 0);
    ctx.lineTo(trimStartX + 10, 15);
    ctx.lineTo(trimStartX, 25);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(trimEndX - 3, 0, 6, height);
    ctx.beginPath();
    ctx.moveTo(trimEndX, 0);
    ctx.lineTo(trimEndX - 10, 0);
    ctx.lineTo(trimEndX - 10, 15);
    ctx.lineTo(trimEndX, 25);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Update trim values for recorded sound
   */
  private updateRecordedTrimValues(): void {
    this.recordedPadTrimStart.set(this.trimStart());
    this.recordedPadTrimEnd.set(this.trimEnd());
  }

  /**
   * Delete recorded sound
   */
  deleteRecording(): void {
    this.recordedBuffer.set(null);
    this.recordingTime.set(0);
    this.recordedPadTrimStart.set(0);
    this.recordedPadTrimEnd.set(1);
    this.detectedSegments.set([]);

    // Clear waveform if showing recorded sound
    if (this.selectedPadIndex() === -1) {
      this.selectedPadIndex.set(null);
      this.selectedPadName.set('');
    }
  }

  // ===== SAVE PRESET METHODS =====

  /**
   * Toggle save preset panel visibility
   */
  toggleSavePanel(): void {
    this.showSavePanel.update((v) => !v);
    this.saveError.set(null);
    this.saveSuccess.set(false);
  }

  /**
   * Get count of loaded samples that can be saved
   */
  getLoadedSamplesCount(): number {
    const pads = this.pads();
    let count = pads.filter((p) => p.loaded && p.buffer).length;
    // Add recorded sound if exists
    if (this.recordedBuffer()) {
      count++;
    }
    return count;
  }

  /**
   * Save current preset to server
   */
  savePreset(): void {
    const name = this.savePresetName().trim();
    const category = this.savePresetCategory();

    // Validation
    if (!name) {
      this.saveError.set('Please enter a preset name');
      return;
    }

    if (name.length < 2) {
      this.saveError.set('Preset name must be at least 2 characters');
      return;
    }

    // Collect samples to save
    const samplesToSave: SampleToSave[] = [];
    const pads = this.pads();

    // Add loaded pads
    for (const pad of pads) {
      if (pad.loaded && pad.buffer) {
        samplesToSave.push({
          name: pad.name,
          audioBuffer: pad.buffer,
        });
      }
    }

    // Add recorded sound if exists
    const recordedBuf = this.recordedBuffer();
    if (recordedBuf) {
      samplesToSave.push({
        name: 'Recorded',
        audioBuffer: recordedBuf,
      });
    }

    if (samplesToSave.length === 0) {
      this.saveError.set('No samples to save. Load some sounds first.');
      return;
    }

    // Start saving
    this.isSaving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    this.presetService.savePresetWithAudio(name, category, samplesToSave).subscribe({
      next: (preset) => {
        console.log('Preset saved successfully:', preset);
        this.isSaving.set(false);
        this.saveSuccess.set(true);
        this.savePresetName.set('');

        // Hide success message after 3 seconds
        setTimeout(() => {
          this.saveSuccess.set(false);
        }, 3000);
      },
      error: (err) => {
        console.error('Error saving preset:', err);
        this.isSaving.set(false);
        this.saveError.set(
          err.error?.error || err.error?.errors?.[0] || 'Failed to save preset. Please try again.',
        );
      },
    });
  }

  // ===== IMPORT AUDIO FILES METHODS =====

  /**
   * Handle file selection from file input
   */
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    this.importAudioFiles(files);

    // Reset the input so the same file can be selected again
    input.value = '';
  }

  /**
   * Import audio files into available pads
   */
  private async importAudioFiles(files: File[]): Promise<void> {
    // Ensure AudioEngine is initialized
    if (!this.audioEngine.isInitialized()) {
      await this.audioEngine.initialize();
    }

    // Find available pads (not loaded)
    const pads = this.pads();
    const availablePadIndices: number[] = [];

    for (let i = 0; i < 16; i++) {
      if (!pads[i]?.loaded) {
        availablePadIndices.push(i);
      }
    }

    if (availablePadIndices.length === 0) {
      console.warn('No available pads for import');
      return;
    }

    // Limit files to available pads
    const filesToLoad = files.slice(0, availablePadIndices.length);

    // Check if we have a current preset to update
    const presetName = this.currentPresetName();
    let uploadedToServer = false;

    // Load each file into a pad
    for (let i = 0; i < filesToLoad.length; i++) {
      const file = filesToLoad[i];
      const padIndex = availablePadIndices[i];

      // Update loading state
      this.updateLoadingState(padIndex, {
        isLoading: true,
        progress: 0,
        error: null,
      });

      try {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Update progress
        this.updateLoadingState(padIndex, {
          isLoading: true,
          progress: 50,
          error: null,
        });

        // Decode audio
        const ctx = this.audioEngine.getAudioContext();
        if (!ctx) throw new Error('No audio context');
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        // Get clean name from filename (remove extension)
        const name = file.name.replace(/\.[^/.]+$/, '');

        // Load into pad
        this.audioEngine.loadBuffer(padIndex, audioBuffer, name);

        // Update loading state
        this.updateLoadingState(padIndex, {
          isLoading: false,
          progress: 100,
          error: null,
        });

        // Update pads signal
        this.updatePadsFromEngine();

        console.log(`Imported "${name}" into pad ${padIndex + 1}`);
      } catch (error) {
        console.error(`Error importing ${file.name}:`, error);
        this.updateLoadingState(padIndex, {
          isLoading: false,
          progress: 0,
          error: `Failed to load ${file.name}`,
        });
      }
    }

    // Upload files to server if we have a current preset
    if (presetName && filesToLoad.length > 0) {
      try {
        console.log(`Uploading ${filesToLoad.length} file(s) to preset: ${presetName}`);
        const uploadResponse = await this.presetService
          .uploadAudioFiles(presetName, filesToLoad)
          .toPromise();

        if (uploadResponse) {
          // Update the preset JSON with new samples
          await this.updatePresetWithNewSamples(presetName, uploadResponse.files);
          uploadedToServer = true;
          console.log('Files uploaded and preset updated successfully');
        }
      } catch (error) {
        console.error('Error uploading files to server:', error);
        // Continue anyway - files are loaded locally
      }
    }
  }

  /**
   * Update pads signal from engine
   */
  private updatePadsFromEngine(): void {
    const pads: Pad[] = [];
    for (let i = 0; i < 16; i++) {
      const pad = this.audioEngine.getPad(i);
      if (pad) {
        pads.push(pad);
      }
    }
    this.pads.set(pads);
  }

  /**
   * Update preset with newly uploaded samples
   */
  private async updatePresetWithNewSamples(
    presetName: string,
    uploadedFiles: Array<{ url: string; originalName: string }>,
  ): Promise<void> {
    try {
      // Get current preset data
      const currentPreset = await this.presetService.getPreset(presetName).toPromise();

      if (!currentPreset) {
        throw new Error('Preset not found');
      }

      // Add new samples to existing samples
      const newSamples: Sample[] = uploadedFiles.map((file) => ({
        url: file.url,
        name: file.originalName.replace(/\.[^/.]+$/, ''), // Remove extension
      }));

      // Merge with existing samples
      const updatedSamples = [...currentPreset.samples, ...newSamples];

      // Update preset via PATCH endpoint
      await this.presetService
        .updatePreset(presetName, {
          samples: updatedSamples,
        })
        .toPromise();

      console.log(`Preset "${presetName}" updated with ${newSamples.length} new sample(s)`);
    } catch (error) {
      console.error('Error updating preset:', error);
      throw error;
    }
  }

  /**
   * Clear all pads (reset)
   */
  clearAllPads(): void {
    for (let i = 0; i < 16; i++) {
      this.audioEngine.clearPad(i);
      this.updateLoadingState(i, {
        isLoading: false,
        progress: 0,
        error: null,
      });
    }
    this.updatePadsFromEngine();
    this.selectedPadIndex.set(null);
    this.selectedPadName.set('');
  }
}
