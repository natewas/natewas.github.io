from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import os
import pandas as pd
from reportlab.pdfgen import canvas
import uuid
from reportlab.lib.pagesizes import landscape
import requests
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from pdf2image import convert_from_path  # ✅ Required for Live Preview Image Conversion

# ✅ Define FastAPI app
app = FastAPI()

def _as_bool(value) -> bool:
    """Robust string/primitive -> bool converter."""
    if value is None:
        return False
    return str(value).strip().lower() in {"true", "1", "yes", "on"}

# ✅ Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "FastAPI is running!"}

# ✅ Define directories
PREVIEW_DIR = "static/previews"
PDF_DIR = "static/generated_pdfs"
FONT_DIR = "fonts"
os.makedirs(PREVIEW_DIR, exist_ok=True)
os.makedirs(PDF_DIR, exist_ok=True)
os.makedirs(FONT_DIR, exist_ok=True)

# ✅ Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# ✅ Envelope sizes
ENVELOPE_SIZES = {
    "A7": (7.25 * 72, 5.25 * 72),
    "10": (9.5 * 72, 4.125 * 72),
    "A2": (5.75 * 72, 4.375 * 72)
}

# ✅ Built-in ReportLab fonts
BUILT_IN_FONTS = {"Helvetica", "Times-Roman", "Courier"}

# ✅ Download & Register Google Fonts

def download_google_font(font_name):
    """Download a font from Google Fonts repository if not available locally."""
    if font_name in BUILT_IN_FONTS:
        print(f"✅ Using built-in font: {font_name}")
        return font_name

    font_variants = [
        f"{font_name.replace(' ', '')}-Regular.ttf",
        f"{font_name.replace(' ', '').lower()}-Regular.ttf",
        f"{font_name.replace(' ', '')}-VariableFont_wght.ttf",
        f"{font_name.replace(' ', '')}[wght].ttf"
    ]

    font_path = None
    font_repos = ["ofl", "apache", "ufl", "ttf"]

    for repo in font_repos:
        for font_variant in font_variants:
            font_url = f"https://github.com/google/fonts/raw/main/{repo}/{font_name.lower().replace(' ', '')}/{font_variant}"
            response = requests.get(font_url)

            if response.status_code == 200:
                font_path = os.path.join(FONT_DIR, font_variant)
                with open(font_path, "wb") as f:
                    f.write(response.content)
                print(f"✅ Downloaded font: {font_variant} → {font_path}")
                break
        if font_path:
            break

    if not font_path:
        print(f"⚠️ Font download failed: {font_name}, defaulting to Helvetica")
        return "Helvetica"

    clean_font_name = font_name.replace(" ", "").replace("[wght]", "").replace("-", "")

    try:
        pdfmetrics.registerFont(TTFont(clean_font_name, font_path))
        print(f"✅ Registered font in ReportLab: {clean_font_name}")
        return clean_font_name
    except Exception as e:
        print(f"❌ Font registration failed, defaulting to Helvetica: {e}")
        return "Helvetica"


@app.post("/preview")
async def generate_preview(
    size: str = Form(...),
    font_size: str = Form(...),
    alignment: str = Form(...),
    line_spacing: str = Form(...),
    font_family: str = Form(...),
    include_return: str = Form(...),
    match_return_font_size: str = Form("false"),
    return_name: str = Form(None),
    return_street: str = Form(None),
    return_city: str = Form(None),
    return_state: str = Form(None),
    return_zip: str = Form(None)
):
    try:
        # ✅ Define File Paths
        preview_pdf = os.path.join(PREVIEW_DIR, f"{uuid.uuid4()}.pdf")
        preview_png = os.path.join(PREVIEW_DIR, f"{uuid.uuid4()}.png")

        width, height = ENVELOPE_SIZES.get(size, ENVELOPE_SIZES["A7"])

        # ✅ Convert font_size and line_spacing properly
        try:
            font_size = int(font_size)
        except ValueError:
            print("⚠️ Invalid font_size, resetting to 12")
            font_size = 12

        try:
            line_spacing = float(line_spacing)
        except ValueError:
            print("⚠️ Invalid line_spacing, resetting to 1.5")
            line_spacing = 1.5

        # ✅ Ensure Font is Available
        font_family = download_google_font(font_family)

        # ✅ Generate PDF
        c = canvas.Canvas(preview_pdf, pagesize=landscape((width, height)))
        c.setFont(font_family, font_size)

        text_y = height / 2
        # Match CSS-style spacing: line_spacing * font_size (in points)
        spacing_multiplier = line_spacing * font_size


        if alignment == "center":
            text_x = width / 2
            draw_text = c.drawCentredString
        else:
            text_x = width / 2 - 50
            draw_text = c.drawString

        # Recipient preview
        draw_text(text_x, text_y + spacing_multiplier, "Recipient Name")
        draw_text(text_x, text_y, "Street Address")
        draw_text(text_x, text_y - spacing_multiplier, "City, State ZIP")

        # Return address preview (smaller font, matching line spacing behavior)
        if include_return.lower() == "true":
            if match_return_font_size.lower() == "true":
                return_font_size = font_size
            else:
                return_font_size = max(font_size - 2, 6)

            c.setFont(font_family, return_font_size)

            # line spacing scales with font size (same idea as CSS: line-height * font-size)
            return_spacing = line_spacing * return_font_size


            ry = height - 40  # start near top-left

            # Name
            c.drawString(40, ry, (return_name or "Your Name").strip())
            ry -= return_spacing

            # Street
            c.drawString(40, ry, (return_street or "123 Main St").strip())
            ry -= return_spacing

            # City, State ZIP
            city_parts = []
            if return_city:
                city_parts.append(return_city.strip())
            if return_state:
                # add comma after city if both present
                if city_parts:
                    city_parts[-1] = city_parts[-1] + ","
                city_parts.append(return_state.strip())
            if return_zip:
                city_parts.append(return_zip.strip())

            city_line = " ".join(city_parts) or "City, State ZIP"
            c.drawString(40, ry, city_line)

            # reset font back to main size for anything else
            c.setFont(font_family, font_size)

        c.save()  # ✅ Ensure PDF is completely written before conversion

        # ✅ Convert PDF to PNG
        try:
            images = convert_from_path(preview_pdf, poppler_path=r"C:/poppler-24.08.0/Library/bin")  # ✅ Ensure poppler_path is set
            images[0].save(preview_png, "PNG")
        except Exception as e:
            print(f"❌ Error converting PDF to PNG: {str(e)}")
            return JSONResponse(status_code=500, content={"error": f"PDF to PNG conversion failed: {str(e)}"})

        return {"preview_url": f"/static/previews/{os.path.basename(preview_png)}"}

    except Exception as e:
        print(f"❌ Error generating preview: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})



# ✅ Upload CSV & Generate PDF API
@app.post("/upload")
async def upload_csv(
    file: UploadFile = File(...),
    size: str = Form(...),
    font_size: str = Form(...),
    alignment: str = Form(...),
    line_spacing: str = Form(...),
    font_family: str = Form(...),
    include_return: str = Form(...),
    match_return_font_size: str = Form("false"),
    return_name: str = Form(None),
    return_street: str = Form(None),
    return_city: str = Form(None),
    return_state: str = Form(None),
    return_zip: str = Form(None)
):
    try:
        print(f"✅ Received File: {file.filename}")  # Debugging log
        print(
            f"✅ Size: {size}, Font: {font_family}, Font Size: {font_size}, "
            f"Alignment: {alignment}, Line Spacing: {line_spacing}, "
            f"Include Return: {include_return}, "
            f"Match Return Font Size: {match_return_font_size}"
        )

        # Read and validate CSV
        df = pd.read_csv(file.file)
        df.columns = df.columns.str.strip()

        print(f"📌 CSV Columns: {df.columns.tolist()}")  # Debugging log

        # Ensure required columns exist
        required_columns = {"Recipient Name", "Street Address", "City", "State", "ZIP"}
        if not required_columns.issubset(set(df.columns)):
            print("❌ CSV is missing required columns!")
            return JSONResponse(
                status_code=400,
                content={"error": "CSV is missing required columns!"}
            )

        # Convert line_spacing to float
        try:
            line_spacing = float(line_spacing)
            if line_spacing < 1 or line_spacing > 3:
                print("⚠️ Invalid line spacing range, resetting to default 1.5")
                line_spacing = 1.5
        except ValueError:
            print("⚠️ Invalid line spacing format, resetting to default 1.5")
            line_spacing = 1.5

        # Ensure font size is an integer
        try:
            font_size = int(font_size)
        except ValueError:
            print("⚠️ Invalid font size, resetting to default 12")
            font_size = 12  

        # Convert flags to real booleans
        include_return_flag = _as_bool(include_return)
        match_return_flag = _as_bool(match_return_font_size)

        print(f"🔍 include_return_flag={include_return_flag}, match_return_flag={match_return_flag}")

        # Validate return address fields
        if include_return_flag:
            if not all([return_name, return_street, return_city, return_state, return_zip]):
                print("❌ Missing required return address fields!")
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": "All return address fields must be filled if 'Include Return Address' is checked."
                    }
                )

        # ✅ Register and use the correct font
        font_family = download_google_font(font_family)

        # ✅ Generate PDF
        pdf_filename = f"{uuid.uuid4()}.pdf"
        pdf_path = os.path.join(PDF_DIR, pdf_filename)

        generate_pdf(
            df,
            pdf_path,
            size,
            font_size,
            font_family,
            alignment,
            line_spacing,
            include_return_flag,       # <-- bool now
            match_return_flag,         # <-- bool now
            return_name,
            return_street,
            return_city,
            return_state,
            return_zip,
        )

        return {"preview_url": f"/static/generated_pdfs/{pdf_filename}"}

    except Exception as e:
        print(f"❌ Unexpected Error: {str(e)}")  # Debugging log
        return JSONResponse(status_code=500, content={"error": str(e)})


def generate_pdf(
    data,
    filename,
    envelope_size,
    font_size,
    font_family,
    alignment,
    line_spacing,
    include_return: bool,
    match_return_font_size: bool,
    return_name,
    return_street,
    return_city,
    return_state,
    return_zip,
):
    width, height = ENVELOPE_SIZES.get(envelope_size, ENVELOPE_SIZES["A7"])
    c = canvas.Canvas(filename, pagesize=landscape((width, height)))

    print(f"🎯 Using font: {font_family} with size {font_size}pt")  # Debugging

    # make sure these are numeric
    try:
        font_size = int(font_size)
    except ValueError:
        font_size = 12

    try:
        line_spacing = float(line_spacing)
    except ValueError:
        line_spacing = 1.5

    for index, (_, row) in enumerate(data.iterrows()):
        # --- Recipient address ---
        try:
            c.setFont(font_family, font_size)
        except Exception as e:
            print(f"❌ Font {font_family} not found! Defaulting to Helvetica. Error: {e}")
            c.setFont("Helvetica", font_size)

        text_y = height / 2
        # Match CSS-style spacing: line_spacing * font_size (in points)
        spacing_multiplier = line_spacing * font_size

        if alignment == "center":
            text_x = width / 2
            draw_text = c.drawCentredString
        else:
            text_x = width / 2 - 50
            draw_text = c.drawString

        draw_text(text_x, text_y + spacing_multiplier, str(row["Recipient Name"]))
        draw_text(text_x, text_y, str(row["Street Address"]))
        draw_text(
            text_x,
            text_y - spacing_multiplier,
            f"{str(row['City'])}, {str(row['State'])} {str(row['ZIP'])}"
        )

        # --- Return address (respects match_return_font_size) ---
        if include_return:
            if match_return_font_size:
                # exactly match the recipient font size
                return_font_size = font_size
            else:
                # slightly smaller, like before
                return_font_size = max(font_size - 2, 6)

            try:
                c.setFont(font_family, return_font_size)
            except Exception:
                c.setFont("Helvetica", return_font_size)

            # line spacing scaled with return font size
            return_spacing = line_spacing * return_font_size
            ry = height - 40  # start near top-left

            # Name
            c.drawString(40, ry, (return_name or "Your Name").strip())
            ry -= return_spacing

            # Street
            c.drawString(40, ry, (return_street or "123 Main St").strip())
            ry -= return_spacing

            # City, State ZIP
            city_parts = []
            if return_city:
                city_parts.append(return_city.strip())
            if return_state:
                if city_parts:
                    city_parts[-1] = city_parts[-1] + ","
                city_parts.append(return_state.strip())
            if return_zip:
                city_parts.append(return_zip.strip())

            city_line = " ".join(city_parts) or "City, State ZIP"
            c.drawString(40, ry, city_line)

            # reset back to recipient font for the next things / pages
            try:
                c.setFont(font_family, font_size)
            except Exception:
                c.setFont("Helvetica", font_size)

        # --- new page if more rows ---
        if index < len(data) - 1:
            c.showPage()

    c.save()
