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

  // Generate-PDF state, surfaced in the page (no alerts, no "check the console").
  isGenerating = signal(false);
  generateStatus = signal<string | null>(null);   // progress / success
  generateError = signal<string | null>(null);     // user-facing error
  resultUrl = signal<string | null>(null);         // link to the PDF (fallback if pop-up blocked)

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
    // clear any stale generate messages when the file changes
    this.generateError.set(null);
    this.generateStatus.set(null);
    this.resultUrl.set(null);
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
        this.previewError.set('Could not render the preview. Please try again.');
      }
    } catch (error) {
      if (seq !== this.previewSeq) {
        return;
      }
      this.previewError.set(
        'Preview unavailable - the server may be waking up. Change any setting to retry.'
      );
      console.error('Preview error:', error);
    } finally {
      if (seq === this.previewSeq) {
        this.previewLoading.set(false);
      }
    }
  }

  async onGeneratePdf(): Promise<void> {
    // reset any previous status
    this.generateError.set(null);
    this.generateStatus.set(null);
    this.resultUrl.set(null);

    // --- client-side checks with clear, specific messages ---
    if (!this.csvFile) {
      this.generateError.set('Please choose a CSV file first (Step 2).');
      return;
    }
    if (this.includeReturn) {
      const missing = ([
        ['Name', this.returnName],
        ['Street Address', this.returnStreet],
        ['City', this.returnCity],
        ['State', this.returnState],
        ['ZIP', this.returnZIP],
      ] as [string, string][])
        .filter(([, value]) => !value.trim())
        .map(([label]) => label);

      if (missing.length > 0) {
        this.generateError.set(
          `Please fill in all return address fields (missing: ${missing.join(', ')}), ` +
          `or uncheck "Include Return Address".`
        );
        return;
      }
    }

    this.isGenerating.set(true);
    this.generateStatus.set('Generating your envelopes...');

    const formData = this.buildSettingsFormData();
    formData.append('file', this.csvFile as File);
    const uploadUrl = `${API_BASE_URL}/upload`;

    // Returns the preview_url on success; throws Error(<user-facing message>) on failure.
    const attemptUpload = async (): Promise<string> => {
      const response = await fetch(uploadUrl, { method: 'POST', body: formData });
      if (!response.ok) {
        let backendMsg = '';
        try {
          backendMsg = (await response.json())?.error ?? '';
        } catch (_) { /* response had no JSON body */ }
        throw new Error(this.friendlyUploadError(response.status, backendMsg));
      }
      const data = await response.json();
      if (!data.preview_url) {
        throw new Error('The server did not return a PDF. Please try again.');
      }
      return data.preview_url as string;
    };

    try {
      let previewUrl: string;
      try {
        previewUrl = await attemptUpload();
      } catch (firstError) {
        // One automatic retry, mainly for Render free-tier cold starts.
        this.generateStatus.set('The server may be waking up - retrying...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        previewUrl = await attemptUpload();
      }

      const fullUrl = `${API_BASE_URL}${previewUrl}`;
      this.resultUrl.set(fullUrl);
      const opened = window.open(fullUrl, '_blank');
      if (opened) {
        this.generateStatus.set('Done! Your PDF opened in a new tab.');
      } else {
        // Browsers often block pop-ups opened after an async call - give a link.
        this.generateStatus.set('Your PDF is ready. Your browser blocked the pop-up, so use this link:');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      // Friendly messages we threw ourselves pass through; raw network errors get a generic one.
      this.generateError.set(
        message && !/failed to fetch|networkerror|load failed/i.test(message)
          ? message
          : 'Could not reach the server. It may be waking up, or your connection dropped - please try again in a moment.'
      );
      console.error('Generate PDF error:', error);
    } finally {
      this.isGenerating.set(false);
    }
  }

  /** Map a failed /upload response to a clear, user-facing message. */
  private friendlyUploadError(status: number, backendMsg: string): string {
    const msg = (backendMsg || '').toLowerCase();
    if (status === 400 && msg.includes('column')) {
      return 'Your CSV is missing required columns. It needs: Recipient Name, Street Address, City, State, ZIP.';
    }
    if (status === 400 && msg.includes('return address')) {
      return 'Please fill in all return address fields, or uncheck "Include Return Address".';
    }
    if (status === 400 && backendMsg) {
      return backendMsg; // surface other validation messages as-is
    }
    return `The server had a problem (error ${status}). It may be waking up - please try again in a moment.`;
  }
}
