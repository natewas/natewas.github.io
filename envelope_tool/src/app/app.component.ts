import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// No trailing slash — we add the leading slash on each route below.
const API_BASE_URL = 'https://natewas-github-io-1.onrender.com';

const PREVIEW_DEBOUNCE_MS = 400;

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
  fontFamily = 'Helvetica';

  // Return address
  includeReturn = false;
  returnName = '';
  returnStreet = '';
  returnCity = '';
  returnState = '';
  returnZIP = '';

  // CSV file
  csvFile: File | null = null;

  // Server-rendered preview state
  previewImageUrl: string | null = null;
  previewLoading = false;
  previewError: string | null = null;

  private previewDebounce: ReturnType<typeof setTimeout> | null = null;
  // Monotonic counter so a slow response can't overwrite a newer one.
  private previewSeq = 0;

  ngOnInit(): void {
    this.refreshServerPreview();
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

  // === Server-side live preview ===
  // The backend renders the actual envelope PDF and returns it as a PNG, so what
  // you see here is produced by the same code that generates the final PDF.

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
    fd.append('match_return_font_size', 'false');

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
    this.previewLoading = true;
    this.previewError = null;

    try {
      const response = await fetch(`${API_BASE_URL}/preview`, {
        method: 'POST',
        body: this.buildSettingsFormData()
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();

      // A newer request started while we were waiting — discard this result.
      if (seq !== this.previewSeq) {
        return;
      }

      if (result.preview_url) {
        this.previewImageUrl = `${API_BASE_URL}${result.preview_url}`;
      } else {
        this.previewError = 'Preview failed to render.';
      }
    } catch (error) {
      if (seq !== this.previewSeq) {
        return;
      }
      this.previewError = 'Could not load preview. Check your connection and try again.';
      console.error('❌ Preview error:', error);
    } finally {
      if (seq === this.previewSeq) {
        this.previewLoading = false;
      }
    }
  }

  // === PDF generation (batch over the uploaded CSV) ===

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
        console.error('❌ Server error response:', errorText);
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      if (result.preview_url) {
        window.open(`${API_BASE_URL}${result.preview_url}`, '_blank');
      } else {
        alert('PDF generation failed. Please check your file.');
      }
    } catch (error) {
      console.error('❌ Error uploading file:', error);
      alert('Failed to upload. Check console for details.');
    }
  }
}
