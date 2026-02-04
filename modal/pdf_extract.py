"""
PDF Statement Extractor using PaddleOCR
Deploy to Modal.com: modal deploy modal/pdf_extract.py
"""
import modal
import re
from datetime import datetime
from typing import Optional, List

app = modal.App("expense-tracker-pdf")


def download_models():
    """Download PaddleOCR models during image build."""
    from paddleocr import PaddleOCR
    # Initialize to trigger model download
    PaddleOCR(use_angle_cls=True, lang='en', show_log=False)


# Build image with PaddleOCR dependencies and pre-downloaded models
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0", "libsm6", "libxext6", "libxrender-dev", "poppler-utils")
    .pip_install(
        "numpy<2.0.0",
        "paddlepaddle==2.6.2",
        "paddleocr==2.7.3",
        "pdf2image",
        "Pillow",
        "fastapi",
    )
    .run_function(download_models)
)


def parse_amount(text: str) -> Optional[float]:
    """Extract numeric amount from text."""
    # Remove currency symbols and clean
    cleaned = re.sub(r'[^\d.,\-]', '', text)
    if not cleaned:
        return None

    # Handle different formats
    cleaned = cleaned.replace(',', '')
    try:
        return abs(float(cleaned))
    except ValueError:
        return None


def parse_date(text: str) -> Optional[str]:
    """Parse date string to ISO format."""
    patterns = [
        (r'(\d{4})-(\d{2})-(\d{2})', '%Y-%m-%d'),
        (r'(\d{2})/(\d{2})/(\d{4})', '%d/%m/%Y'),
        (r'(\d{2})-(\d{2})-(\d{4})', '%d-%m-%Y'),
        (r'(\d{2})/(\d{2})/(\d{2})', '%d/%m/%y'),
        (r'(\w{3})\s+(\d{1,2}),?\s+(\d{4})', '%b %d %Y'),
    ]

    for pattern, fmt in patterns:
        match = re.search(pattern, text)
        if match:
            try:
                date_str = match.group(0).replace(',', '')
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue
    return None


def extract_transactions_from_lines(lines: List[str]) -> List[dict]:
    """Extract transactions from OCR text lines."""
    transactions = []

    for line in lines:
        # Try to find date, amount in the line
        date = parse_date(line)
        if not date:
            continue

        # Look for amounts (numbers with decimal points)
        amounts = re.findall(r'[\d,]+\.\d{2}', line)
        if not amounts:
            continue

        # Get the last amount (usually the transaction amount)
        amount = parse_amount(amounts[-1])
        if not amount or amount <= 0:
            continue

        # Extract description (text between date and amount)
        # Remove date and amounts from line to get description
        desc = line
        for amt in amounts:
            desc = desc.replace(amt, '')
        desc = re.sub(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', '', desc)
        desc = re.sub(r'\d{4}[/-]\d{2}[/-]\d{2}', '', desc)
        desc = ' '.join(desc.split()).strip()

        if len(desc) > 3:
            transactions.append({
                'date': date,
                'description': desc[:100],
                'amount': amount,
            })

    return transactions


@app.function(image=image, timeout=300, memory=4096)
@modal.fastapi_endpoint(method="POST")
async def extract(data: dict) -> dict:
    """
    Extract transactions from PDF bank statement.
    Expects: { "pdf_base64": "..." }
    Returns: { "transactions": [...], "error": null }
    """
    import base64
    import tempfile
    import numpy as np
    from pdf2image import convert_from_path
    from paddleocr import PaddleOCR

    try:
        # Decode PDF
        pdf_bytes = base64.b64decode(data.get("pdf_base64", ""))
        if not pdf_bytes:
            return {"transactions": [], "error": "No PDF data provided"}

        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(pdf_bytes)
            pdf_path = f.name

        # Convert PDF pages to images
        images = convert_from_path(pdf_path, dpi=150)

        # Initialize PaddleOCR
        ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)

        all_lines = []

        for img in images:
            # Convert PIL to numpy array
            img_array = np.array(img)

            # Run OCR
            result = ocr.ocr(img_array, cls=True)

            if result and result[0]:
                # Extract text lines
                for line in result[0]:
                    if line and len(line) >= 2:
                        text = line[1][0] if isinstance(line[1], tuple) else str(line[1])
                        all_lines.append(text)

        # Extract transactions from lines
        transactions = extract_transactions_from_lines(all_lines)

        # Deduplicate
        seen = set()
        unique_transactions = []
        for txn in transactions:
            key = f"{txn['date']}_{txn['amount']}_{txn['description'][:20]}"
            if key not in seen:
                seen.add(key)
                unique_transactions.append(txn)

        return {
            "transactions": unique_transactions,
            "error": None,
            "pages_processed": len(images),
        }

    except Exception as e:
        return {
            "transactions": [],
            "error": str(e),
        }


@app.local_entrypoint()
def main():
    """Test locally with: modal run modal/pdf_extract.py"""
    print("PDF Extractor ready!")
    print("Deploy with: modal deploy modal/pdf_extract.py")
