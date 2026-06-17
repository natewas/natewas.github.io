import { Component, OnInit, OnDestroy, signal, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { APP_VERSION } from '../version';

// Use the local dev backend when running on localhost, prod otherwise.
// Guarded with `typeof window` so it is safe during SSR/prerender (no window there).
const API_BASE_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:5001'
    : 'https://natewas-github-io-1.onrender.com';

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
  // loading state for cold-start UX (used in onGeneratePdf)
  isLoading = false;
  loadingMessage = '';

  // Step 1: envelope size
  envelopeSize: 'A7' | '10' | 'A2' = 'A7';

  // Step 3: settings
  fontSize = '12';                // pt
  alignment: 'center' | 'left' = 'center';
  lineSpacing = '1.5';

  availableFonts = [
    { label: 'Helvetica (built-in)', value: 'Helvetica' },
    { label: 'Times (built-in)', value: 'Times-Roman' },
    { label: 'Courier (built-in)', value: 'Courier' },
    { label: 'Roboto', value: 'Roboto' },
    { label: 'Open Sans', value: 'Open Sans' },
    { label: 'Lato', value: 'Lato' },
    { label: 'Poppins', value: 'Poppins' },
    { label: 'Merriweather', value: 'Merriweather' },
    { label: 'Montserrat', value: 'Montserrat' },
    { label: 'Noto Sans', value: 'Noto Sans' },
    { label: 'Imperial Script', value: 'Imperial Script' },
  ];

  fontFamily = 'Helvetica';

  // Return address
  includeReturn = false;
  returnName = '';
  returnStreet = '';
  returnCity = '';
  returnState = '';
  returnZIP = '';

  // Match return font size to recipient
  matchReturnFontSize = false;

  // CSV file
  csvFile: File | null = null;

  // Server-rendered preview state (signals -> repaint on async write, zoneful or zoneless)
  previewImageUrl = signal<string | null>(null);
  previewLoading = signal(false);
  previewError = signal<string | null>(null);

  // Version stamps: frontend baked in at build time; backend fetched live.
  readonly appVersion = APP_VERSION;
  backendVersion = signal<BackendVersion | null>(null);

  private previewDebounce: ReturnType<typeof setTimeout> | null = null;
  private previewSeq = 0;

  // Network/timers must not run during SSR/prerender - browser only.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  ngOnInit(): void {
    if (this.isBrowser) {
      this.refreshServerPreview();
      this.loadBackendVersion();
    }
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
    if (!this.isBrowser) {
      return;
    }
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

    this.isLoading = true;
    this.loadingMessage = '';

    const formData = this.buildSettingsFormData();
    formData.append('file', this.csvFile as File);

    const uploadUrl = `${API_BASE_URL}/upload`;

    const attemptUpload = async () => {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      return response.json() as Promise<{ preview_url: string }>;
    };

    try {
      const result = await attemptUpload();
      window.open(`${API_BASE_URL}${result.preview_url}`, '_blank');
    } catch (firstError) {
      console.warn('First attempt failed. Retrying after delay...', firstError);
      this.loadingMessage = 'Waking up server... please wait...';

      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const result = await attemptUpload();
        window.open(`${API_BASE_URL}${result.preview_url}`, '_blank');
      } catch (finalError) {
        console.error('Error uploading file:', finalError);
        alert('The server took too long to respond. Please try again.');
      }
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }
}
