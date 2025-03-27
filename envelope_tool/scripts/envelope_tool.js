const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:5001"
    : `http://${window.location.hostname}:5001`;

function toggleReturnAddress() {
    let checkbox = document.getElementById("includeReturn");
    let returnFields = document.getElementById("returnAddressFields");

    if (checkbox && returnFields) {
        returnFields.style.display = checkbox.checked ? "block" : "none";
    } else {
        console.error("❌ Element not found: includeReturn or returnAddressFields.");
    }
}

// ✅ Function to dynamically update live preview (real-time changes)
function updateLivePreview() {
    const POINT_TO_PIXEL = 1.33; // ✅ Conversion factor for PDF font size to browser display

    const envelopeSizes = {
        "A7": { width: 696, height: 504 },   // A7 Envelope (5.25 x 7.25 inches)
        "10": { width: 912, height: 396 },   // #10 Envelope (4.125 x 9.5 inches)
        "A2": { width: 552, height: 420 }    // A2 Envelope (4.375 x 5.75 inches)
    };

    let envelopeSize = document.getElementById("envelopeSize").value;
    let envelopePreview = document.querySelector(".envelope-preview");

    // ✅ Apply correct scaling to the preview container
    if (envelopeSizes[envelopeSize]) {
        envelopePreview.style.width = `${envelopeSizes[envelopeSize].width}px`;
        envelopePreview.style.height = `${envelopeSizes[envelopeSize].height}px`;
    } else {
        console.error("❌ Envelope size not recognized:", envelopeSize);
        return;
    }

    console.log("🔄 Updated envelope size:", envelopeSize, envelopeSizes[envelopeSize]);

    let recipient = document.getElementById("recipient");
    let returnAddress = document.getElementById("returnAddress");

    if (!recipient || !returnAddress) {
        console.error("❌ Live preview elements not found!");
        return;
    }

    let fontSizePt = parseInt(document.getElementById("fontSize").value, 10);
    let alignment = document.getElementById("alignment").value;
    let lineSpacing = parseFloat(document.getElementById("lineSpacing").value);
    let fontFamily = document.getElementById("fontFamily").value;
    let includeReturn = document.getElementById("includeReturn").checked;

    // ✅ Convert font size from pt (PDF) to px (preview)
    let fontSizePx = Math.round(fontSizePt * POINT_TO_PIXEL);

    recipient.style.fontSize = `${fontSizePx}px`;
    recipient.style.fontFamily = fontFamily;
    recipient.style.lineHeight = `${lineSpacing}em`;
    recipient.style.position = "absolute";

    let previewWidth = envelopePreview.clientWidth;
    let textBlockWidth = previewWidth * 0.4; // ✅ Ensure text block is properly sized

    // ✅ Adjust alignment logic to match `app.py`
    if (alignment === "center") {
        recipient.style.left = "50%";
        recipient.style.transform = "translateX(-50%)";
        recipient.style.textAlign = "center";
    } else {
        // ✅ Apply the same left-aligned text offset as in app.py
        let textXOffset = previewWidth / 2 - 50;
        recipient.style.left = `${textXOffset}px`;
        recipient.style.transform = "none";
        recipient.style.textAlign = "left";
    }

    // ✅ Adjust vertical positioning to match PDF
let baseOffset = (envelopePreview.clientHeight / 2) - (fontSizePx * 1.5);
recipient.style.top = `${baseOffset}px`;


    // ✅ Return Address positioning
    returnAddress.style.display = includeReturn ? "block" : "none";
    returnAddress.style.fontSize = `${Math.round((fontSizePt - 2) * POINT_TO_PIXEL)}px`;
    returnAddress.style.position = "absolute";
    returnAddress.style.left = "40px";
    returnAddress.style.top = "35px";

    console.log(`🔄 Font size adjusted: ${fontSizePt}pt → ${fontSizePx}px`);
    console.log("🔄 Live Preview Updated:", { fontSizePt, alignment, lineSpacing, includeReturn });
}

// ✅ Attach event listeners once DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ DOM fully loaded, attaching event listeners...");

    document.querySelectorAll("select, input").forEach(input => {
        input.addEventListener("change", updateLivePreview);
    });

    updateLivePreview();
});

window.fetchPreviewImage = fetchPreviewImage;
window.uploadCSV = uploadCSV;



// ✅ Function to handle file upload
async function uploadCSV() {
    let fileInput = document.getElementById("csvFile");

    if (!fileInput.files.length) {
        alert("Please select a CSV file.");
        return;
    }

    let formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("size", document.getElementById("envelopeSize").value);
    formData.append("font_size", document.getElementById("fontSize").value);
    formData.append("alignment", document.getElementById("alignment").value);
    formData.append("line_spacing", document.getElementById("lineSpacing").value);
    formData.append("font_family", document.getElementById("fontFamily").value);
    formData.append("include_return", document.getElementById("includeReturn").checked);

    if (document.getElementById("includeReturn").checked) {
        formData.append("return_name", document.getElementById("returnName").value.trim());
        formData.append("return_street", document.getElementById("returnStreet").value.trim());
        formData.append("return_city", document.getElementById("returnCity").value.trim());
        formData.append("return_state", document.getElementById("returnState").value.trim());
        formData.append("return_zip", document.getElementById("returnZIP").value.trim());
    }

    try {
        let response = await fetch(`${API_BASE_URL}/upload`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            let errorText = await response.text();
            console.error("❌ Server error response:", errorText);
            throw new Error(`Server error: ${response.status}`);
        }

        let result = await response.json();
        if (result.preview_url) {
            window.open(`${API_BASE_URL}${result.preview_url}`, "_blank");
        } else {
            alert("PDF generation failed. Please check your file.");
        }
    } catch (error) {
        console.error("❌ Error uploading file:", error);
        alert("Failed to upload. Check console for details.");
    }
}

