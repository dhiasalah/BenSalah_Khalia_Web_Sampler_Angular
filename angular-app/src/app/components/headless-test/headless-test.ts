import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AudioEngine } from '../../services/audio-engine';
import { PresetService } from '../../services/preset';
import { environment } from '../../config/environment';
import type { Preset } from '../../models';

/**
 * Log entry for test output
 */
interface TestLog {
  timestamp: Date;
  level: 'info' | 'success' | 'error';
  message: string;
}

/**
 * Test configuration constants
 */
const TEST_CONFIG = {
  BASE_URL: `${environment.BACKEND_URL}/presets`,
  MAX_SAMPLES_TO_LOAD: 8,
  DELAY_BETWEEN_SAMPLES_MS: 300,
  DELAY_BETWEEN_PLAYS_MS: 400,
  RHYTHM_DELAY_MS: 250,
} as const;

/**
 * HeadlessTest - Component to test the audio engine without GUI interaction
 * Demonstrates that the engine can work independently
 */
@Component({
  selector: 'app-headless-test',
  imports: [CommonModule],
  templateUrl: './headless-test.html',
  styleUrl: './headless-test.css',
})
export class HeadlessTest {
  private readonly audioEngine = inject(AudioEngine);
  private readonly presetService = inject(PresetService);

  readonly logs = signal<TestLog[]>([]);
  readonly isRunning = signal(false);
  readonly testProgress = signal(0);

  private log(message: string, level: 'info' | 'success' | 'error' = 'info'): void {
    this.logs.update((logs) => [
      ...logs,
      {
        timestamp: new Date(),
        level,
        message,
      },
    ]);
  }

  /**
   * Run automated headless test
   * This demonstrates the engine working without any GUI controls
   */
  async runHeadlessTest(): Promise<void> {
    this.isRunning.set(true);
    this.logs.set([]);
    this.testProgress.set(0);

    try {
      this.log('Starting headless audio engine test...', 'info');

      // Step 1: Initialize engine
      this.log('Step 1: Initializing audio engine...', 'info');
      await this.audioEngine.initialize();
      this.testProgress.set(10);
      this.log('Audio engine initialized', 'success');
      await this.delay(500);

      // Step 2: Fetch presets from API
      this.log('Step 2: Fetching presets from backend...', 'info');
      const presets = await this.fetchPresets();
      this.testProgress.set(20);
      this.log(`Found ${presets.length} presets`, 'success');
      await this.delay(500);

      if (presets.length === 0) {
        this.log('No presets available. Make sure backend is running.', 'error');
        return;
      }

      // Step 3: Select first preset
      const preset = presets[0];
      this.log(`Step 3: Loading preset "${preset.name}"...`, 'info');
      this.testProgress.set(30);

      // Step 4: Load samples into pads
      const samplesToLoad = Math.min(preset.samples.length, TEST_CONFIG.MAX_SAMPLES_TO_LOAD);

      for (let i = 0; i < samplesToLoad; i++) {
        const sample = preset.samples[i];
        const url = `${TEST_CONFIG.BASE_URL}/${sample.url}`;

        this.log(`  Loading sample ${i + 1}/${samplesToLoad}: ${sample.name}...`, 'info');

        try {
          await this.audioEngine.loadSoundFromURL(i, url, (progress) => {
            const stepProgress =
              30 + (i / samplesToLoad) * 40 + (progress / 100) * (40 / samplesToLoad);
            this.testProgress.set(Math.round(stepProgress));
          });

          this.log(`  Loaded "${sample.name}" into pad ${i}`, 'success');
        } catch (error) {
          this.log(`  Failed to load "${sample.name}": ${error}`, 'error');
        }

        await this.delay(TEST_CONFIG.DELAY_BETWEEN_SAMPLES_MS);
      }

      this.testProgress.set(70);
      this.log('All samples loaded', 'success');
      await this.delay(1000);

      // Step 5: Play samples in sequence (automated)
      this.log('Step 5: Playing samples in sequence (automated)...', 'info');
      this.testProgress.set(80);

      for (let i = 0; i < samplesToLoad; i++) {
        const pad = this.audioEngine.getPad(i);
        if (pad?.loaded) {
          this.log(`  Playing pad ${i}: ${pad.name}`, 'info');
          this.audioEngine.play(i);
          await this.delay(TEST_CONFIG.DELAY_BETWEEN_PLAYS_MS);
        }
      }

      this.testProgress.set(90);
      await this.delay(500);

      // Step 6: Test trim functionality
      this.log('Step 6: Testing trim functionality on pad 0...', 'info');
      const pad0 = this.audioEngine.getPad(0);
      if (pad0?.loaded && pad0.buffer) {
        const halfDuration = pad0.buffer.duration / 2;
        this.audioEngine.setTrimPoints(0, 0, halfDuration);
        this.log(`  Set trim: 0s to ${halfDuration.toFixed(2)}s`, 'info');
        this.log('  Playing trimmed sample...', 'info');
        this.audioEngine.play(0);
        await this.delay(1000);
        this.log('  Trim test complete', 'success');
      }

      this.testProgress.set(100);
      this.log('Headless test completed successfully!', 'success');
      this.log(`Tested ${samplesToLoad} pads without any GUI interaction`, 'info');
    } catch (error) {
      this.log(`Test failed: ${error}`, 'error');
      console.error('Headless test error:', error);
    } finally {
      this.isRunning.set(false);
    }
  }

  /**
   * Play a specific preset pattern (programmatic)
   */
  async playPattern(pattern: number[], delayMs: number = 300): Promise<void> {
    this.log(`Playing pattern: [${pattern.join(', ')}]`, 'info');

    for (const padIndex of pattern) {
      const pad = this.audioEngine.getPad(padIndex);
      if (pad?.loaded) {
        this.log(`Playing pad ${padIndex}`, 'info');
        this.audioEngine.play(padIndex);
        await this.delay(delayMs);
      }
    }
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch presets from API
   */
  private async fetchPresets(): Promise<Preset[]> {
    return new Promise((resolve, reject) => {
      this.presetService.getPresets().subscribe({
        next: (presets) => resolve(presets),
        error: (err) => reject(err),
      });
    });
  }

  /**
   * Clear test logs
   */
  clearLogs(): void {
    this.logs.set([]);
    this.testProgress.set(0);
  }

  /**
   * Quick test - play a simple rhythm pattern
   */
  async quickRhythmTest(): Promise<void> {
    if (!this.audioEngine.isInitialized()) {
      this.log('Audio engine not initialized. Run full test first.', 'error');
      return;
    }

    this.log('Playing quick rhythm pattern...', 'info');
    const pattern = [0, 1, 0, 2, 0, 1, 3, 1]; // Simple drum pattern
    await this.playPattern(pattern, TEST_CONFIG.RHYTHM_DELAY_MS);
    this.log('Rhythm pattern complete', 'success');
  }
}
