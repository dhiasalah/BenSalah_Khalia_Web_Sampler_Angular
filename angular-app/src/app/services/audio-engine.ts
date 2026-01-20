import { Injectable } from '@angular/core';

/**
 * Interface for a sampler pad
 */
export interface Pad {
  index: number;
  buffer: AudioBuffer | null;
  name: string;
  loaded: boolean;
  trimStart: number;
  trimEnd: number;
  gain: number;
}

/**
 * AudioEngine - Core audio processing engine (headless)
 * This service is completely independent from the GUI
 * Can be used in headless mode for testing or automation
 */
@Injectable({
  providedIn: 'root',
})
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private pads: Pad[] = [];
  private maxPads: number = 16;
  private masterGain: GainNode | null = null;
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;

  // Recording state
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;

  constructor() {
    // Don't initialize audio context in constructor
    // Let it be initialized when needed (user interaction)
  }

  /**
   * Initialize the audio engine
   * Must be called after user interaction
   */
  async initialize(): Promise<void> {
    if (this.ctx) return; // Already initialized

    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.initializePads();
  }

  /**
   * Initialize empty pads
   */
  private initializePads(): void {
    this.pads = [];
    for (let i = 0; i < this.maxPads; i++) {
      this.pads.push({
        index: i,
        buffer: null,
        name: `Pad ${i + 1}`,
        loaded: false,
        trimStart: 0,
        trimEnd: 1,
        gain: 1.0,
      });
    }
  }

  /**
   * Check if engine is initialized
   */
  isInitialized(): boolean {
    return this.ctx !== null;
  }

  /**
   * Load a sound into a specific pad
   */
  async loadSound(
    padIndex: number,
    audioData: ArrayBuffer,
    name: string | null = null,
    progressCallback: ((progress: number) => void) | null = null,
  ): Promise<Pad> {
    if (!this.ctx) throw new Error('AudioEngine not initialized');
    if (padIndex < 0 || padIndex >= this.maxPads) {
      throw new Error(`Invalid pad index: ${padIndex}`);
    }

    try {
      const buffer = await this.ctx.decodeAudioData(audioData);

      const pad = this.pads[padIndex];
      pad.buffer = buffer;
      pad.name = name || `Pad ${padIndex + 1}`;
      pad.loaded = true;
      pad.trimStart = 0;
      pad.trimEnd = buffer.duration;
      pad.gain = 1.0;

      if (progressCallback) {
        progressCallback(100);
      }

      return pad;
    } catch (error) {
      console.error(`Error decoding audio for pad ${padIndex}:`, error);
      throw error;
    }
  }

  /**
   * Load a sound from URL
   */
  async loadSoundFromURL(
    padIndex: number,
    url: string,
    progressCallback: ((progress: number) => void) | null = null,
  ): Promise<Pad> {
    if (!this.ctx) throw new Error('AudioEngine not initialized');

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch sound from ${url}: ${response.status} ${response.statusText}`,
      );
    }

    const contentLength = response.headers.get('content-length');
    let receivedLength = 0;
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      if (progressCallback && contentLength) {
        const progress = (receivedLength / parseInt(contentLength)) * 100;
        progressCallback(progress);
      }
    }

    const chunksAll = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      chunksAll.set(chunk, position);
      position += chunk.length;
    }

    const fileName =
      url
        .split('/')
        .pop()
        ?.replace(/\.[^/.]+$/, '') || 'sound';

    return await this.loadSound(padIndex, chunksAll.buffer, fileName, progressCallback);
  }

  /**
   * Play a pad
   */
  play(padIndex: number): void {
    if (!this.ctx || !this.masterGain) {
      console.warn('AudioEngine not initialized');
      return;
    }

    if (padIndex < 0 || padIndex >= this.maxPads) {
      console.warn(`Invalid pad index: ${padIndex}`);
      return;
    }

    const pad = this.pads[padIndex];

    if (!pad.loaded || !pad.buffer) {
      console.warn(`Pad ${padIndex} is not loaded`);
      return;
    }

    this._playBuffer(pad.buffer, pad.trimStart, pad.trimEnd, pad.gain);
  }

  /**
   * Internal method to play a buffer
   */
  private _playBuffer(
    buffer: AudioBuffer,
    startTime: number,
    endTime: number,
    gain: number = 1.0,
  ): void {
    if (!this.ctx || !this.masterGain) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = gain;

    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    startTime = Math.max(0, Math.min(startTime, buffer.duration));
    endTime = Math.max(startTime, Math.min(endTime, buffer.duration));

    source.start(0, startTime, endTime - startTime);
  }

  /**
   * Set trim points for a pad
   */
  setTrimPoints(padIndex: number, startTime: number, endTime: number): void {
    if (padIndex < 0 || padIndex >= this.maxPads) return;

    const pad = this.pads[padIndex];
    if (!pad.loaded || !pad.buffer) return;

    pad.trimStart = Math.max(0, startTime);
    pad.trimEnd = Math.min(pad.buffer.duration, endTime);
  }

  /**
   * Set gain for a pad
   */
  setGain(padIndex: number, gain: number): void {
    if (padIndex < 0 || padIndex >= this.maxPads) return;
    const pad = this.pads[padIndex];
    pad.gain = Math.max(0, Math.min(2.0, gain));
  }

  /**
   * Get pad data
   */
  getPad(padIndex: number): Pad | null {
    if (padIndex < 0 || padIndex >= this.maxPads) return null;
    return this.pads[padIndex];
  }

  /**
   * Get all pads
   */
  getAllPads(): Pad[] {
    return this.pads;
  }

  /**
   * Reset a pad
   */
  resetPad(padIndex: number): void {
    if (padIndex < 0 || padIndex >= this.maxPads) return;

    const pad = this.pads[padIndex];
    if (pad.loaded && pad.buffer) {
      pad.trimStart = 0;
      pad.trimEnd = pad.buffer.duration;
      pad.gain = 1.0;
    }
  }

  /**
   * Clear a specific pad
   */
  clearPad(padIndex: number): void {
    if (padIndex < 0 || padIndex >= this.maxPads) return;

    const pad = this.pads[padIndex];
    pad.buffer = null;
    pad.loaded = false;
    pad.trimStart = 0;
    pad.trimEnd = 1;
    pad.gain = 1.0;
    pad.name = `Pad ${padIndex + 1}`;
  }

  /**
   * Clear all pads
   */
  clearAll(): void {
    this.pads.forEach((_, index) => this.clearPad(index));
  }

  /**
   * Get audio context (for advanced usage)
   */
  getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Resume audio context if suspended
   */
  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // ==================== MICROPHONE RECORDING ====================

  /**
   * Start recording from microphone
   */
  async startRecording(): Promise<void> {
    if (!this.ctx) throw new Error('AudioEngine not initialized');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordedChunks = [];

      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  /**
   * Stop recording and return the audio buffer
   */
  async stopRecording(): Promise<AudioBuffer> {
    if (!this.ctx) throw new Error('AudioEngine not initialized');
    if (!this.mediaRecorder) throw new Error('No recording in progress');

    return new Promise((resolve, reject) => {
      this.mediaRecorder!.onstop = async () => {
        try {
          // Stop all tracks
          this.mediaStream?.getTracks().forEach((track) => track.stop());

          // Create blob from chunks
          const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });

          // Convert to ArrayBuffer
          const arrayBuffer = await blob.arrayBuffer();

          // Decode to AudioBuffer
          const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);

          this.mediaRecorder = null;
          this.mediaStream = null;
          this.recordedChunks = [];

          resolve(audioBuffer);
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder!.stop();
    });
  }

  /**
   * Cancel ongoing recording
   */
  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaRecorder = null;
    this.mediaStream = null;
    this.recordedChunks = [];
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  /**
   * Load an AudioBuffer directly into a pad
   */
  loadBuffer(padIndex: number, buffer: AudioBuffer, name: string): Pad {
    if (padIndex < 0 || padIndex >= this.maxPads) {
      throw new Error(`Invalid pad index: ${padIndex}`);
    }

    const pad = this.pads[padIndex];
    pad.buffer = buffer;
    pad.name = name;
    pad.loaded = true;
    pad.trimStart = 0;
    pad.trimEnd = buffer.duration;
    pad.gain = 1.0;

    return pad;
  }

  /**
   * Detect silence segments in an audio buffer
   * Returns array of { start, end } in seconds for non-silent segments
   */
  detectSoundSegments(
    buffer: AudioBuffer,
    silenceThreshold: number = 0.02,
    minSilenceDuration: number = 0.1,
    minSoundDuration: number = 0.05,
  ): Array<{ start: number; end: number }> {
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const segments: Array<{ start: number; end: number }> = [];

    let isInSound = false;
    let soundStart = 0;
    let silenceStart = 0;

    const minSilenceSamples = minSilenceDuration * sampleRate;
    const minSoundSamples = minSoundDuration * sampleRate;

    for (let i = 0; i < data.length; i++) {
      const amplitude = Math.abs(data[i]);

      if (amplitude > silenceThreshold) {
        if (!isInSound) {
          // Start of sound
          isInSound = true;
          soundStart = i;
        }
        silenceStart = i;
      } else {
        if (isInSound) {
          // Check if silence is long enough
          if (i - silenceStart >= minSilenceSamples) {
            // End of sound segment
            const segmentLength = silenceStart - soundStart;
            if (segmentLength >= minSoundSamples) {
              segments.push({
                start: soundStart / sampleRate,
                end: silenceStart / sampleRate,
              });
            }
            isInSound = false;
          }
        }
      }
    }

    // Handle last segment
    if (isInSound) {
      const segmentLength = data.length - soundStart;
      if (segmentLength >= minSoundSamples) {
        segments.push({
          start: soundStart / sampleRate,
          end: data.length / sampleRate,
        });
      }
    }

    return segments;
  }

  /**
   * Split an audio buffer into segments
   */
  splitBuffer(buffer: AudioBuffer, segments: Array<{ start: number; end: number }>): AudioBuffer[] {
    if (!this.ctx) throw new Error('AudioEngine not initialized');

    const buffers: AudioBuffer[] = [];

    for (const segment of segments) {
      const startSample = Math.floor(segment.start * buffer.sampleRate);
      const endSample = Math.floor(segment.end * buffer.sampleRate);
      const length = endSample - startSample;

      if (length > 0) {
        const newBuffer = this.ctx.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const sourceData = buffer.getChannelData(channel);
          const destData = newBuffer.getChannelData(channel);

          for (let i = 0; i < length; i++) {
            destData[i] = sourceData[startSample + i];
          }
        }

        buffers.push(newBuffer);
      }
    }

    return buffers;
  }
}
