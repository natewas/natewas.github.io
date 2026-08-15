import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { APP_VERSION } from '../version';

const API_BASE_URL = 'https://natewas-github-io-1.onrender.com';
const PREVIEW_DEBOUNCE_MS = 300;

interface BackendVersion {
  commit: string;
  started_at: string;
  uptime_seconds: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  envelopeSize: 'A7' | '10' | 'A2' = 'A7';

  fontSize = '12';
  alignment: 'center' | 'left' = 'center';
  lineSpacing = '1.5';
  fontFamily = 'Helvetica';

  includeReturn = false;
  matchReturnFontSize = false;
  returnName = '';
  returnStreet = '';
  returnCity = '';
  returnState = '';
  returnZIP = '';

  csvFile: File | null = null;

  // Reactive preview state. Signals notify change detection on every write,
  // so async updates repaint immediately whether the app runs zoneful or zoneless.
  previewImageUrl = signal<string | null>(null);
  previewLoading = signal(false);
  previewError = signal<string | null>(null);

  // Version stamps: frontend is baked in at build time; backend is fetched live.
  readonly appVersion = APP_VERSION;
  backendVersion = signal<BackendVersion | null>(null);

  private previewDebounce: ReturnType<typeof setTimeout> | null = null;
  private previewSeq = 0;

  ngOnInit(): void {
    this.refreshServerPreview();
    this.loadBackendVersion();
  }

  ngOnDestroy(): void {
    if (this.previewDebounce) {
      clearTimeout(this.previewDebounce);
    }
  }

  onSettingsChange(): void {
    this.schedulePreview();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.csvFile = input.files && input.files[0] ? input.files[0] : null;
  }

  private async loadBackendVersion(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/version`);
      if (response.ok) {
        this.backendVersion.set(await response.json());
      }
    } catch (_) {
      // backend asleep/unreachable - footer just omits the backend stamp
    }
  }

  private schedulePreview(): void {
    if (this.previewDebounce) {
      clearTimeout(this.previewDebounce);
    }
    this.previewDebounce = setTimeout(
      () => this.refreshServerPreview(),
      PREVIEW_DEBOUNCE_MS
    );
  }

  private buildSettingsFormData(): FormData {
    const fd = new FormData();
    fd.append('size', this.envelopeSize);
    fd.append('font_size', this.fontSize);
    fd.append('alignment', this.alignment);
    fd.append('line_spacing', this.lineSpacing);
    fd.append('font_family', this.fontFamily);
    fd.append('include_return', String(this.includeReturn));
    fd.append('match_return_font_size', String(this.matchReturnFontSize));

    if (this.includeReturn) {
      fd.append('return_name', this.returnName.trim());
      fd.append('return_street', this.returnStreet.trim());
      fd.append('return_city', this.returnCity.trim());
      fd.append('return_state', this.returnState.trim());
      fd.append('return_zip', this.returnZIP.trim());
    }
    return fd;
  }

  async refreshServerPreview(): Promise<void> {
    const seq = ++this.previewSeq;
    this.previewLoading.set(true);
    this.previewError.set(null);

    try {
      const response = await fetch(`${API_BASE_URL}/preview`, {
        method: 'POST',
        body: this.buildSettingsFormData()
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();

      if (seq !== this.previewSeq) {
        return;
      }

      if (result.preview_url) {
        this.previewImageUrl.set(`${API_BASE_URL}${result.preview_url}`);
      } else {
        this.previewError.set('Preview failed to render.');
      }
    } catch (error) {
      if (seq !== this.previewSeq) {
        return;
      }
      this.previewError.set('Could not load preview. Check your connection and try again.');
      console.error('Preview error:', error);
    } finally {
      if (seq === this.previewSeq) {
        this.previewLoading.set(false);
      }
    }
  }

  async onGeneratePdf(): Promise<void> {
    if (!this.csvFile) {
      alert('Please select a CSV file.');
      return;
    }

    const formData = this.buildSettingsFormData();
    formData.append('file', this.csvFile);

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      if (result.preview_url) {
        window.open(`${API_BASE_URL}${result.preview_url}`, '_blank');
      } else {
        alert('PDF generation failed. Please check your file.');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload. Check console for details.');
    }
  }
}
