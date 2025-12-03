import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

const API_BASE_URL =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:5001'
    : 'https://natewas-github-io-1.onrender.com';

const POINT_TO_PIXEL = 1.33; // same as envelope_tool.js

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
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

  // Preview styles
  envelopePreviewStyles: { [k: string]: string } = {};
  recipientStyles: { [k: string]: string } = {};
  returnAddressStyles: { [k: string]: string } = {};

  ngOnInit(): void {
    this.updateLivePreview();
  }

  onSettingsChange(): void {
    this.updateLivePreview();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.csvFile = input.files && input.files[0] ? input.files[0] : null;
  }

  // === Live preview (ported from updateLivePreview) ===
  private updateLivePreview(): void {
    const envelopeSizes: Record<string, { width: number; height: number }> = {
      A7: { width: 696, height: 504 },   // A7 Envelope
      '10': { width: 912, height: 396 }, // #10
      A2: { width: 552, height: 420 }    // A2
    };

    const size = envelopeSizes[this.envelopeSize];
    if (!size) {
      console.error('❌ Envelope size not recognized:', this.envelopeSize);
      return;
    }

    this.envelopePreviewStyles = {
      width: `${size.width}px`,
      height: `${size.height}px`,
      position: 'relative'
    };

    const fontSizePt = parseInt(this.fontSize, 10);
    const lineSpacingNum = parseFloat(this.lineSpacing);
    const fontSizePx = Math.round(fontSizePt * POINT_TO_PIXEL);
    const previewWidth = size.width;
    const previewHeight = size.height;

    const recipient: { [k: string]: string } = {
      'font-size': `${fontSizePx}px`,
      'font-family': this.fontFamily,
      'line-height': `${lineSpacingNum}em`,
      position: 'absolute'
    };

    if (this.alignment === 'center') {
      recipient['left'] = '50%';
      recipient['transform'] = 'translateX(-50%)';
      recipient['text-align'] = 'center';
    } else {
      const textXOffset = previewWidth / 2 - 50;
      recipient['left'] = `${textXOffset}px`;
      recipient['transform'] = 'none';
      recipient['text-align'] = 'left';
    }

    const baseOffset = previewHeight / 2 - fontSizePx * 1.5;
    recipient['top'] = `${baseOffset}px`;

    this.recipientStyles = recipient;

    // Return address font size:
    // - default: slightly smaller than recipient
    // - if matchReturnFontSize is true: same size as recipient
    const returnFontSizePt = this.matchReturnFontSize
      ? fontSizePt
      : Math.max(fontSizePt - 2, 6);

    const returnFontSizePx = Math.round(returnFontSizePt * POINT_TO_PIXEL);

    this.returnAddressStyles = {
      position: 'absolute',
      left: '40px',
      top: '35px',
      'font-size': `${returnFontSizePx}px`,
      'font-family': this.fontFamily,
      'line-height': `${lineSpacingNum}em`,
    };
  }

  formatRecipientAddress(): string {
    const name = 'Recipient Name';
    const street = 'Street Address';
    const cityLine = 'City, State ZIP';
    return [name, street, cityLine].join('<br>');
  }

  async onGeneratePdf(): Promise<void> {
    if (!this.csvFile) {
      alert('Please select a CSV file.');
      return;
    }

    this.isLoading = true;
    this.loadingMessage = '';

    const formData = new FormData();
    formData.append('file', this.csvFile as File);
    formData.append('size', this.envelopeSize);
    formData.append('font_size', this.fontSize);
    formData.append('alignment', this.alignment);
    formData.append('line_spacing', this.lineSpacing);
    formData.append('font_family', this.fontFamily);
    formData.append('include_return', String(this.includeReturn));
    formData.append('match_return_font_size', String(this.matchReturnFontSize));
    formData.append('return_name', this.returnName || '');
    formData.append('return_street', this.returnStreet || '');
    formData.append('return_city', this.returnCity || '');
    formData.append('return_state', this.returnState || '');
    formData.append('return_zip', this.returnZIP || '');

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
      console.warn('❗ First attempt failed. Retrying after delay...', firstError);
      this.loadingMessage = 'Waking up server... please wait...';

      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const result = await attemptUpload();
        window.open(`${API_BASE_URL}${result.preview_url}`, '_blank');
      } catch (finalError) {
        console.error('❌ Error uploading file:', finalError);
        alert('The server took too long to respond. Please try again.');
      }
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }
}
