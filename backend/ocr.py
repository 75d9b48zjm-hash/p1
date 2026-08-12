"""Foto Nota Pintar - OCR gratis berbasis Tesseract untuk membaca nominal & tanggal dari nota."""
import io
import re
from datetime import datetime, timezone

import pytesseract
from PIL import Image, ImageOps

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "mei": 5, "may": 5, "jun": 6,
    "jul": 7, "agu": 8, "ags": 8, "aug": 8, "sep": 9, "okt": 10, "oct": 10,
    "nov": 11, "des": 12, "dec": 12,
}

# baris dengan kata kunci ini kemungkinan besar berisi total belanja
KEYWORD_SCORES = [
    ("grand total", 6),
    ("total belanja", 5),
    ("total bayar", 5),
    ("total", 4),
    ("jumlah", 3),
    ("tagihan", 3),
    ("bayar", 2),
    ("tunai", 1),
    ("cash", 1),
]

NUM_RE = re.compile(r"\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?")


def _preprocess(img: Image.Image) -> Image.Image:
    img = ImageOps.exif_transpose(img)
    img = img.convert("L")
    if max(img.size) < 1200:
        scale = 1200 / max(img.size)
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
    return ImageOps.autocontrast(img)


def _to_number(tok: str):
    tok = tok.strip()
    if re.fullmatch(r"\d{1,3}(?:[.,]\d{3})+", tok):  # 25.000 / 1,250,000
        return float(re.sub(r"[.,]", "", tok))
    m = re.fullmatch(r"(\d{1,3}(?:[.,]\d{3})+)[.,](\d{2})", tok)  # 12.500,00
    if m:
        return float(re.sub(r"[.,]", "", m.group(1)))
    if re.fullmatch(r"\d+", tok):
        return float(tok)
    m = re.fullmatch(r"(\d+)[.,](\d{2})", tok)  # 12500,00
    if m:
        return float(m.group(1))
    return None


def _line_amounts(line: str):
    out = []
    # abaikan token yang bagian dari tanggal (12/05/2026) atau jam (14:30)
    cleaned = re.sub(r"\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}", " ", line)
    for tok in NUM_RE.findall(cleaned):
        n = _to_number(tok)
        if n is not None and 100 <= n <= 1_000_000_000:
            out.append(n)
    return out


def parse_amount(text: str):
    lines = text.splitlines()
    best_score, best_amount = 0, None
    for line in lines:
        low = line.lower()
        if "subtotal" in low or "sub total" in low:
            continue
        score = 0
        for kw, s in KEYWORD_SCORES:
            if kw in low:
                score = s
                break
        if score <= 0:
            continue
        nums = _line_amounts(line)
        if nums and (score > best_score or (score == best_score and max(nums) > (best_amount or 0))):
            best_score, best_amount = score, max(nums)
    if best_amount:
        return best_amount
    # fallback: angka terbesar di seluruh teks
    all_nums = []
    for line in lines:
        all_nums.extend(_line_amounts(line))
    return max(all_nums) if all_nums else None


def _valid_date(y: int, m: int, d: int):
    if y < 100:
        y += 2000
    now = datetime.now(timezone.utc)
    if not (2010 <= y <= now.year + 1 and 1 <= m <= 12 and 1 <= d <= 31):
        return None
    try:
        return datetime(y, m, d).date().isoformat()
    except ValueError:
        return None


def parse_date(text: str):
    for m in re.finditer(r"(\d{4})-(\d{2})-(\d{2})", text):
        iso = _valid_date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        if iso:
            return iso
    for m in re.finditer(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})", text):
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if mo > 12 and d <= 12:
            d, mo = mo, d
        iso = _valid_date(y, mo, d)
        if iso:
            return iso
    for m in re.finditer(r"(\d{1,2})\s+([a-zA-Z]{3,9})\s+(\d{2,4})", text):
        mo = MONTHS.get(m.group(2).lower()[:3])
        if mo:
            iso = _valid_date(int(m.group(3)), mo, int(m.group(1)))
            if iso:
                return iso
    return None


def extract_receipt_data(data: bytes) -> dict:
    img = Image.open(io.BytesIO(data))
    text = pytesseract.image_to_string(_preprocess(img), lang="ind+eng")
    return {
        "amount": parse_amount(text),
        "date": parse_date(text),
        "raw_text": text.strip()[:2000],
    }
