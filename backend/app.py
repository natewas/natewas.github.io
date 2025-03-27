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
from fastapi import FastAPI
import os
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from fastapi import FastAPI
from reportlab.pdfbase import pdfmetrics


# Print registered fonts for debugging
print("📌 Available Fonts:", pdfmetrics.getRegisteredFontNames())

app = FastAPI(root_path="/api")  # ✅ Add this back!
#app = FastAPI(root_path="/api")  # 👈 Fix FastAPI pathing issue

@app.get("/")
def read_root():
    return {"message": "FastAPI is running through Apache!"}


# Define the font directory
FONT_DIR = "C:/Apache24/htdocs/backend/fonts"


@app.get("/fonts")
def get_available_fonts():
    """Returns a list of registered fonts."""
    fonts = pdfmetrics.getRegisteredFontNames()
    print(f"📢 Available Fonts: {fonts}")
    return {"fonts": fonts}


def register_local_fonts():
    """Registers all .ttf fonts in the fonts/ directory with ReportLab."""
    if not os.path.exists(FONT_DIR):
        os.makedirs(FONT_DIR)

    for font_file in os.listdir(FONT_DIR):
        if font_file.lower().endswith(".ttf"):
            font_name = os.path.splitext(font_file)[0]  # Remove .ttf extension
            font_path = os.path.join(FONT_DIR, font_file)
            try:
                pdfmetrics.registerFont(TTFont(font_name, font_path))
                print(f"✅ Registered font: {font_name}")
            except Exception as e:
                print(f"❌ Failed to register font {font_name}: {e}")


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


# Register fonts at startup
register_local_fonts()

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
            print(f"🔗 Checking URL: {font_url}")  # Print the URL being checked
            
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
        print(f"📝 Registering font: {clean_font_name} from {font_path}")
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
        spacing_multiplier = line_spacing * 14

        if alignment == "center":
            text_x = width / 2
            draw_text = c.drawCentredString
        else:
            text_x = width / 2 - 50
            draw_text = c.drawString

        draw_text(text_x, text_y + spacing_multiplier, "Recipient Name")
        draw_text(text_x, text_y, "Street Address")
        draw_text(text_x, text_y - spacing_multiplier, "City, State ZIP")

        if include_return.lower() == "true":
            c.drawString(40, height - 40, return_name or "Your Name")
            c.drawString(40, height - 60, return_street or "123 Main St")
            c.drawString(40, height - 80, f"{return_city or 'City'}, {return_state or 'State'} {return_zip or '00000'}")

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
    return_name: str = Form(None),
    return_street: str = Form(None),
    return_city: str = Form(None),
    return_state: str = Form(None),
    return_zip: str = Form(None)
):
    try:
        print(f"📢 Received request at /upload")
        print(f"📢 Received file: {file.filename}, Content-Type: {file.content_type}")

        contents = await file.read()
        print(f"📢 File size: {len(contents)} bytes")

        # ✅ Save the uploaded file
        csv_path = os.path.join(PDF_DIR, file.filename)
        with open(csv_path, "wb") as f:
            f.write(contents)
        print(f"📢 Saved CSV to {csv_path}")

        # ✅ Generate unique PDF filename
        pdf_filename = f"{uuid.uuid4()}.pdf"
        pdf_path = os.path.abspath(os.path.join(PDF_DIR, pdf_filename))

        print(f"📢 Generating PDF at {pdf_path}...")

        # ✅ Read CSV into DataFrame
        try:
            df = pd.read_csv(csv_path)
            print(f"📌 CSV loaded: {df.head()}")
        except Exception as e:
            print(f"❌ Error reading CSV: {e}")
            return JSONResponse(status_code=400, content={"error": f"CSV read error: {e}"})

        # ✅ Ensure necessary columns exist
        required_columns = {"Recipient Name", "Street Address", "City", "State", "ZIP"}
        if not required_columns.issubset(set(df.columns)):
            print(f"❌ CSV missing required columns! Found: {df.columns}")
            return JSONResponse(status_code=400, content={"error": "CSV is missing required columns!"})

        # ✅ Convert parameters
        try:
            font_size = int(font_size)
            line_spacing = float(line_spacing)
        except ValueError:
            print("⚠️ Invalid font size or line spacing, using defaults.")
            font_size = 12
            line_spacing = 1.5

        # ✅ Generate PDF
        generate_pdf(
            df, pdf_path, size, font_size, font_family, alignment, line_spacing, include_return,
            return_name, return_street, return_city, return_state, return_zip
        )

        print(f"✅ PDF successfully generated at {pdf_path}")

        return {"preview_url": f"/static/generated_pdfs/{pdf_filename}"}

    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

def generate_pdf(data, filename, envelope_size, font_size, font_family, alignment, line_spacing, include_return,
                 return_name, return_street, return_city, return_state, return_zip):
    width, height = ENVELOPE_SIZES.get(envelope_size, ENVELOPE_SIZES["A7"])
    c = canvas.Canvas(filename, pagesize=landscape((width, height)))

    print(f"📌 Generating PDF at {filename}")
    print(f"📌 Requested Font: {font_family} at {font_size}pt")

    # Check if font is registered
    if font_family not in pdfmetrics.getRegisteredFontNames():
        print(f"❌ Font '{font_family}' is NOT registered! Defaulting to Helvetica.")
        font_family = "Helvetica"

    try:
        c.setFont(font_family, font_size)
    except Exception as e:
        print(f"❌ Font error: {e}, defaulting to Helvetica.")
        c.setFont("Helvetica", font_size)

    text_y = height / 2
    spacing_multiplier = line_spacing * 12

    for index, (_, row) in enumerate(data.iterrows()):
        if alignment == "center":
            text_x = width / 2
            draw_text = c.drawCentredString
        else:
            text_x = width / 2 - 50
            draw_text = c.drawString

        draw_text(text_x, text_y + spacing_multiplier, str(row["Recipient Name"]))
        draw_text(text_x, text_y, str(row["Street Address"]))
        draw_text(text_x, text_y - spacing_multiplier, f"{row['City']}, {row['State']} {row['ZIP']}")

        if include_return.lower() == "true":
            c.drawString(40, height - 40, return_name)
            c.drawString(40, height - 60, return_street)
            c.drawString(40, height - 80, f"{return_city}, {return_state} {return_zip}")

        if index < len(data) - 1:
            c.showPage()
            try:
                c.setFont(font_family, font_size)
            except Exception:
                c.setFont("Helvetica", font_size)

    c.save()
    print(f"✅ PDF successfully saved at {filename}")

