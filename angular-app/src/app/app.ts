import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PresetMenu } from './components/preset-menu/preset-menu';
import { HeadlessTest } from './components/headless-test/headless-test';
import { PadsGrid } from './components/pads-grid/pads-grid';
import { PresetManager } from './components/preset-manager/preset-manager';
import type { Preset } from './models';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PresetMenu, HeadlessTest, PadsGrid, PresetManager],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('Angular Audio Sampler');
  protected readonly selectedPreset = signal<Preset | null>(null);
  protected readonly showHeadlessTest = signal(false);
  protected readonly showPresetManager = signal(false);

  onPresetSelected(preset: Preset): void {
    this.selectedPreset.set(preset);
  }

  toggleHeadlessTest(): void {
    this.showHeadlessTest.update((v) => !v);
  }

  togglePresetManager(): void {
    this.showPresetManager.update((v) => !v);
  }

  onLoadingComplete(): void {
    // All samples loaded - can add additional logic here if needed
  }
}
