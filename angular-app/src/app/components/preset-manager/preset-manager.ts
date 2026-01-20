import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PresetService, Preset, Sample } from '../../services/preset';

@Component({
  selector: 'app-preset-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './preset-manager.html',
  styleUrl: './preset-manager.css',
})
export class PresetManager implements OnInit {
  private readonly presetService = inject(PresetService);

  // State
  readonly presets = signal<Preset[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Modal states
  readonly showRenameModal = signal(false);
  readonly showDeleteModal = signal(false);
  readonly showCreateModal = signal(false);

  // Selected preset for operations
  readonly selectedPreset = signal<Preset | null>(null);

  // Form fields
  readonly newName = signal('');
  readonly createForm = signal({
    name: '',
    type: 'Drumkit',
    samples: [] as { name: string; url: string }[],
  });
  readonly newSampleName = signal('');
  readonly newSampleUrl = signal('');

  // File upload
  readonly uploadFiles = signal<File[]>([]);
  readonly useFileUpload = signal(false);

  // Computed: sorted presets by name
  readonly sortedPresets = computed(() =>
    [...this.presets()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  // Preset types for dropdown
  readonly presetTypes = ['Drumkit', 'Electronic', 'Hip-Hop', 'Piano', 'Synth', 'Other'];

  ngOnInit(): void {
    this.loadPresets();
  }

  loadPresets(): void {
    this.loading.set(true);
    this.error.set(null);

    this.presetService.getPresets().subscribe({
      next: (presets) => {
        this.presets.set(presets);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load presets: ' + err.message);
        this.loading.set(false);
      },
    });
  }

  // ===== RENAME =====
  openRenameModal(preset: Preset): void {
    this.selectedPreset.set(preset);
    this.newName.set(preset.name);
    this.showRenameModal.set(true);
    this.clearMessages();
  }

  closeRenameModal(): void {
    this.showRenameModal.set(false);
    this.selectedPreset.set(null);
    this.newName.set('');
  }

  confirmRename(): void {
    const preset = this.selectedPreset();
    const name = this.newName().trim();

    if (!preset || !name) return;
    if (name === preset.name) {
      this.closeRenameModal();
      return;
    }

    this.loading.set(true);
    this.presetService.renamePreset(preset.name, name).subscribe({
      next: () => {
        this.showSuccess(`Preset renamed to "${name}"`);
        this.closeRenameModal();
        this.loadPresets();
      },
      error: (err) => {
        this.error.set('Failed to rename: ' + err.message);
        this.loading.set(false);
      },
    });
  }

  // ===== DELETE =====
  openDeleteModal(preset: Preset): void {
    this.selectedPreset.set(preset);
    this.showDeleteModal.set(true);
    this.clearMessages();
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.selectedPreset.set(null);
  }

  confirmDelete(): void {
    const preset = this.selectedPreset();
    if (!preset) return;

    this.loading.set(true);
    this.presetService.deletePreset(preset.name).subscribe({
      next: () => {
        this.showSuccess(`Preset "${preset.name}" deleted`);
        this.closeDeleteModal();
        this.loadPresets();
      },
      error: (err) => {
        this.error.set('Failed to delete: ' + err.message);
        this.loading.set(false);
      },
    });
  }

  // ===== CREATE =====
  openCreateModal(): void {
    this.createForm.set({
      name: '',
      type: 'Drumkit',
      samples: [],
    });
    this.uploadFiles.set([]);
    this.useFileUpload.set(false);
    this.showCreateModal.set(true);
    this.clearMessages();
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.createForm.set({ name: '', type: 'Drumkit', samples: [] });
    this.uploadFiles.set([]);
  }

  addSampleUrl(): void {
    const name = this.newSampleName().trim();
    const url = this.newSampleUrl().trim();

    if (!name || !url) return;

    this.createForm.update((form) => ({
      ...form,
      samples: [...form.samples, { name, url }],
    }));

    this.newSampleName.set('');
    this.newSampleUrl.set('');
  }

  removeSample(index: number): void {
    this.createForm.update((form) => ({
      ...form,
      samples: form.samples.filter((_, i) => i !== index),
    }));
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.uploadFiles.set(Array.from(input.files));
    }
  }

  removeFile(index: number): void {
    this.uploadFiles.update((files) => files.filter((_, i) => i !== index));
  }

  confirmCreate(): void {
    const form = this.createForm();
    const name = form.name.trim();

    if (!name) {
      this.error.set('Please enter a preset name');
      return;
    }

    this.loading.set(true);

    if (this.useFileUpload() && this.uploadFiles().length > 0) {
      // Upload files first, then create preset
      this.presetService.uploadAudioFiles(name, this.uploadFiles()).subscribe({
        next: (uploadResponse) => {
          const samples: Sample[] = uploadResponse.files.map((file) => ({
            url: file.url,
            name: file.originalName.replace(/\.[^/.]+$/, ''), // Remove extension
          }));

          this.createPresetWithSamples(name, form.type, samples);
        },
        error: (err) => {
          this.error.set('Failed to upload files: ' + err.message);
          this.loading.set(false);
        },
      });
    } else if (form.samples.length > 0) {
      // Create with URL samples
      this.createPresetWithSamples(name, form.type, form.samples);
    } else {
      // Create empty preset
      this.createPresetWithSamples(name, form.type, []);
    }
  }

  private createPresetWithSamples(name: string, type: string, samples: Sample[]): void {
    const preset = {
      name,
      type,
      isFactoryPresets: false,
      samples,
    };

    this.presetService.createPreset(preset).subscribe({
      next: () => {
        this.showSuccess(`Preset "${name}" created successfully!`);
        this.closeCreateModal();
        this.loadPresets();
      },
      error: (err) => {
        this.error.set('Failed to create preset: ' + err.message);
        this.loading.set(false);
      },
    });
  }

  // ===== UTILS =====
  private showSuccess(message: string): void {
    this.successMessage.set(message);
    this.loading.set(false);
    setTimeout(() => this.successMessage.set(null), 3000);
  }

  private clearMessages(): void {
    this.error.set(null);
    this.successMessage.set(null);
  }

  getSampleCount(preset: Preset): number {
    return preset.samples?.length || 0;
  }

  // Form update helpers (arrow functions not allowed in templates)
  updateFormName(name: string): void {
    this.createForm.update((f) => ({ ...f, name }));
  }

  updateFormType(type: string): void {
    this.createForm.update((f) => ({ ...f, type }));
  }
}
