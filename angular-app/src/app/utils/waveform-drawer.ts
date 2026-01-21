import { Injectable, ElementRef } from '@angular/core';
import type { SoundSegment } from '../models';

/**
 * Configuration for waveform rendering
 */
export interface WaveformConfig {
  /** Background color */
  backgroundColor: string;
  /** Waveform line color */
  waveformColor: string;
  /** Center line color */
  centerLineColor: string;
  /** Trim start bar color */
  trimStartColor: string;
  /** Trim end bar color */
  trimEndColor: string;
  /** Trimmed out overlay color */
  trimmedOutColor: string;
}

/**
 * Default waveform configuration
 */
const DEFAULT_CONFIG: WaveformConfig = {
  backgroundColor: '#0f0f1a',
  waveformColor: '#22c55e',
  centerLineColor: 'rgba(255, 255, 255, 0.1)',
  trimStartColor: '#f59e0b',
  trimEndColor: '#ef4444',
  trimmedOutColor: 'rgba(0, 0, 0, 0.6)',
};

/**
 * Recorded waveform configuration (red theme)
 */
const RECORDED_CONFIG: WaveformConfig = {
  ...DEFAULT_CONFIG,
  waveformColor: '#dc2626',
};

/**
 * WaveformDrawer - Utility service for drawing audio waveforms on canvas
 */
@Injectable({
  providedIn: 'root',
})
export class WaveformDrawer {
  /**
   * Draw a waveform with trim indicators on a canvas
   *
   * @param canvasRef - Reference to the canvas element
   * @param buffer - AudioBuffer to visualize
   * @param trimStart - Normalized trim start position (0-1)
   * @param trimEnd - Normalized trim end position (0-1)
   * @param config - Optional custom configuration
   */
  drawWaveform(
    canvasRef: ElementRef<HTMLCanvasElement>,
    buffer: AudioBuffer,
    trimStart: number,
    trimEnd: number,
    config: WaveformConfig = DEFAULT_CONFIG,
  ): void {
    const canvas = canvasRef.nativeElement;
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
    const trimStartX = trimStart * width;
    const trimEndX = trimEnd * width;

    // Clear canvas with background color
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw trimmed out regions (darker)
    ctx.fillStyle = config.trimmedOutColor;
    ctx.fillRect(0, 0, trimStartX, height);
    ctx.fillRect(trimEndX, 0, width - trimEndX, height);

    // Draw waveform
    this.drawWaveformData(ctx, buffer, width, height, config.waveformColor);

    // Draw center line
    this.drawCenterLine(ctx, width, height, config.centerLineColor);

    // Draw trim bars
    this.drawTrimBar(ctx, trimStartX, height, config.trimStartColor, 'start');
    this.drawTrimBar(ctx, trimEndX, height, config.trimEndColor, 'end');
  }

  /**
   * Draw waveform for recorded audio (uses red color scheme)
   */
  drawRecordedWaveform(
    canvasRef: ElementRef<HTMLCanvasElement>,
    buffer: AudioBuffer,
    trimStart: number,
    trimEnd: number,
  ): void {
    this.drawWaveform(canvasRef, buffer, trimStart, trimEnd, RECORDED_CONFIG);
  }

  /**
   * Draw waveform data
   */
  private drawWaveformData(
    ctx: CanvasRenderingContext2D,
    buffer: AudioBuffer,
    width: number,
    height: number,
    color: string,
  ): void {
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

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

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /**
   * Draw the center line
   */
  private drawCenterLine(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    color: string,
  ): void {
    const amp = height / 2;
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.lineTo(width, amp);
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  /**
   * Draw a trim bar with handle
   */
  private drawTrimBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    height: number,
    color: string,
    type: 'start' | 'end',
  ): void {
    // Draw vertical bar
    ctx.fillStyle = color;
    ctx.fillRect(x - 3, 0, 6, height);

    // Draw handle triangle
    ctx.beginPath();
    if (type === 'start') {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 10, 0);
      ctx.lineTo(x + 10, 15);
      ctx.lineTo(x, 25);
    } else {
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 10, 0);
      ctx.lineTo(x - 10, 15);
      ctx.lineTo(x, 25);
    }
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Calculate normalized position from mouse event
   */
  getNormalizedPosition(event: MouseEvent, canvasRef: ElementRef<HTMLCanvasElement>): number {
    const rect = canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  }

  /**
   * Determine which trim bar is being targeted
   *
   * @returns 'start' | 'end' | null
   */
  getTrimBarTarget(
    normalizedX: number,
    trimStart: number,
    trimEnd: number,
    threshold = 0.05,
  ): 'start' | 'end' | null {
    const startDist = Math.abs(normalizedX - trimStart);
    const endDist = Math.abs(normalizedX - trimEnd);

    if (startDist < threshold && startDist < endDist) {
      return 'start';
    } else if (endDist < threshold) {
      return 'end';
    }
    return null;
  }

  /**
   * Calculate new trim position with constraints
   */
  calculateTrimPosition(
    normalizedX: number,
    currentStart: number,
    currentEnd: number,
    type: 'start' | 'end',
    minGap = 0.01,
  ): number {
    if (type === 'start') {
      const maxStart = currentEnd - minGap;
      return Math.max(0, Math.min(normalizedX, maxStart));
    } else {
      const minEnd = currentStart + minGap;
      return Math.min(1, Math.max(normalizedX, minEnd));
    }
  }
}
