import { Component, inject, signal, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PresetService, Preset, PresetsByCategory } from '../../services/preset';

@Component({
  selector: 'app-preset-menu',
  imports: [CommonModule],
  templateUrl: './preset-menu.html',
  styleUrl: './preset-menu.css',
})
export class PresetMenu {
  private readonly presetService = inject(PresetService);

  // Signals for reactive state management
  presets = signal<Preset[]>([]);
  presetsByCategory = signal<PresetsByCategory>({});
  selectedPreset = signal<Preset | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  showCategories = signal(true); // Toggle between flat list and categorized view

  // Computed values
  categories = computed(() => Object.keys(this.presetsByCategory()));
  hasPresets = computed(() => this.presets().length > 0);

  // Output event when a preset is selected
  presetSelected = output<Preset>();

  constructor() {
    this.loadPresets();
  }

  /**
   * Load presets from the backend API
   */
  loadPresets(): void {
    this.isLoading.set(true);
    this.error.set(null);

    // Load both flat list and categorized presets
    this.presetService.getPresets().subscribe({
      next: (presets) => {
        this.presets.set(presets);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading presets:', err);
        this.error.set('Failed to load presets. Make sure the backend is running.');
        this.isLoading.set(false);
      },
    });

    this.presetService.getPresetsGroupedByCategory().subscribe({
      next: (grouped) => {
        this.presetsByCategory.set(grouped);
      },
      error: (err) => {
        console.error('Error loading categorized presets:', err);
      },
    });
  }

  /**
   * Handle preset selection
   */
  selectPreset(preset: Preset): void {
    this.selectedPreset.set(preset);
    this.presetSelected.emit(preset);
  }

  /**
   * Toggle between flat and categorized view
   */
  toggleCategoryView(): void {
    this.showCategories.update((v) => !v);
  }

  /**
   * Reload presets from server
   */
  refresh(): void {
    this.loadPresets();
  }
}
