import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

const API_BASE_URL =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:5001'
    : `http://${window.location.hostname}:5001`;

const POINT_TO_PIXEL = 1.33; // same as envelope_tool.js

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'] // or use global styles
})
export class AppComponent implements OnInit {
  // Step 1
  envelopeSize: 'A7' | '10' | 'A2' = 'A7';

  // Step 3: settings
  fontSize = '12';                // PDF font size in pt
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

  // Preview styles (bound with [ngStyle])
  envelopePreviewStyles: { [k: string]: string } = {};
  recipientStyles: { [k: string]: string } = {};
  returnAddressStyles: { [k: string]: string } = {};

  ngOnInit(): void {
    this.updateLivePreview();
  }

  // Called when size/font/alignment/etc change
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
      A7: { width: 696, height: 504 },  // 5.25 x 7.25
      '10': { width: 912, height: 396 },// #10
      A2: { width: 552, height: 420 }   // 4.375 x 5.75
    };

    const size = envelopeSizes[this.envelopeSize];
    if (!size) {
      console.error('❌ Envelope size not recognized:', this.envelopeSize);
      return;
    }

    // Preview container size
    this.envelopePreviewStyles = {
      width: `${size.width}px`,
      height: `${size.height}px`,
      position: 'relative' // make sure absolutely positioned children work
    };

    const fontSizePt = parseInt(this.fontSize, 10);
    const lineSpacingNum = parseFloat(this.lineSpacing);
    const fontSizePx = Math.round(fontSizePt * POINT_TO_PIXEL);
    const previewWidth = size.width;
    const previewHeight = size.height;

    // Recipient styles
    const recipient: { [k: string]: string } = {
      'font-size': `${fontSizePx}px`,
      'font-family': this.fontFamily,
      'line-height': `${lineSpacingNum}em`,
      position: 'absolute'
    };

    if (this.alignment === 'center') {
      recipient.left = '50%';
      recipient.transform = 'translateX(-50%)';
      recipient['text-align'] = 'center';
    } else {
      const textXOffset = previewWidth / 2 - 50;
      recipient.left = `${textXOffset}px`;
      recipient.transform = 'none';
      recipient['text-align'] = 'left';
    }

    const baseOffset = previewHeight / 2 - fontSizePx * 1.5;
    recipient.top = `${baseOffset}px`;

    this.recipientStyles = recipient;

    // Return address styles
    const returnFontSizePx = Math.round((fontSizePt - 2) * POINT_TO_PIXEL);
    this.returnAddressStyles = {
      position: 'absolute',
      left: '40px',
      top: '35px',
      'font-size': `${returnFontSizePx}px`
    };
  }

  // === Text formatting for preview ===

  formatReturnAddress(): string {
    const lines: string[] = [];

    if (this.returnName)   { lines.push(this.returnName); }
    if (this.returnStreet) { lines.push(this.returnStreet); }

    const cityStateZip = [
      this.returnCity,
      this.returnState ? `${this.returnState}${this.returnZIP ? ' ' + this.returnZIP : ''}` : this.returnZIP
    ]
      .filter(Boolean)
      .join(', ');

    if (cityStateZip) {
      lines.push(cityStateZip);
    }

    return lines.join('<br>');
  }

  formatRecipientAddress(): string {
    // You were using placeholder text in the HTML; keeping that behavior.
    const name = 'Recipient Name';
    const street = 'Street Address';
    const cityLine = 'City, State ZIP';

    return [name, street, cityLine].join('<br>');
  }

  // === PDF generation (ported from uploadCSV) ===

  async onGeneratePdf(): Promise<void> {
    if (!this.csvFile) {
      alert('Please select a CSV file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', this.csvFile);
    formData.append('size', this.envelopeSize);
    formData.append('font_size', this.fontSize);
    formData.append('alignment', this.alignment);
    formData.append('line_spacing', this.lineSpacing);
    formData.append('font_family', this.fontFamily);
    formData.append('include_return', String(this.includeReturn));

    if (this.includeReturn) {
      formData.append('return_name', this.returnName.trim());
      formData.append('return_street', this.returnStreet.trim());
      formData.append('return_city', this.returnCity.trim());
      formData.append('return_state', this.returnState.trim());
      formData.append('return_zip', this.returnZIP.trim());
    }

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
