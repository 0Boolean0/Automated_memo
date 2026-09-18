"""
Invoice service — Phase 9.

Generates a PDF invoice using fpdf2 (pure Python, no system libs needed).

Flow:
    1. Query Business + Sale + Customer + SerialNumbers
    2. Build the PDF with fpdf2
    3. Save to settings.PDF_DIR / "invoice_{sale_number}.pdf"
    4. Return the Path to the PDF

The caller (endpoint) wraps the result in a FileResponse.
"""

from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException
from fpdf import FPDF

from app.core.config import settings
from app.models.sale import Sale
from app.models.business import Business
from app.models.serial import SerialNumber
from app.services.sale_service import get_sale


# ── Currency symbol map ───────────────────────────────────────────────────────

CURRENCY_SYMBOLS: dict[str, str] = {
    "BDT": "BDT",   # fpdf2 core fonts don't support Bengali Unicode glyph
    "USD": "USD",
    "EUR": "EUR",
    "GBP": "GBP",
    "INR": "INR",
}


def _fmt(value) -> str:
    try:
        return f"{float(value):,.2f}"
    except (TypeError, ValueError):
        return "0.00"


def _clean(text) -> str:
    if text is None:
        return ""
    text = str(text)
    replacements = {
        "\u2014": "-",   # em dash
        "\u2013": "-",   # en dash
        "\u2022": "|",   # bullet
        "\u2018": "'",   # left single quote
        "\u2019": "'",   # right single quote
        "\u201c": '"',   # left double quote
        "\u201d": '"',   # right double quote
        "\u09f3": "BDT", # Bengali Taka sign
        "\u2026": "...", # ellipsis
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text.encode("latin-1", "replace").decode("latin-1")


class InvoicePDF(FPDF):
    def __init__(self, business_name: str, currency: str):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.business_name = _clean(business_name)
        self.currency = _clean(currency)
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(14, 14, 14)

    def header(self):
        # Navy top bar
        self.set_fill_color(15, 23, 42)
        self.rect(0, 0, 210, 11, "F")
        self.set_text_color(255, 255, 255)
        self.set_font("Helvetica", "B", 9.5)
        self.set_xy(14, 2)
        self.cell(0, 7, f"{self.business_name} | Sales Invoice & Official Memo", ln=False)
        self.set_text_color(0, 0, 0)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(130, 130, 130)
        self.cell(0, 5, f"Gizmo Crave Memo | Page {self.page_no()} | Thank you for choosing Gizmo Crave!", align="C")
        self.set_text_color(0, 0, 0)


def generate_invoice_pdf(
    db: Session,
    sale_id: int,
    business_id: int,
) -> Path:
    """
    Generate a PDF invoice for the given sale.
    Returns the Path to the generated PDF file.
    """
    # ── Load data ─────────────────────────────────────────────────────────
    sale: Sale = get_sale(db, sale_id, business_id)

    business: Business | None = db.query(Business).filter(
        Business.id == business_id
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    currency = CURRENCY_SYMBOLS.get(business.currency or "BDT", business.currency or "BDT")
    customer = sale.customer

    # Collect serials per sale_item
    item_serials: dict[int, list[str]] = {}
    for item in sale.items:
        sns = db.query(SerialNumber).filter(
            SerialNumber.sale_item_id == item.id
        ).all()
        item_serials[item.id] = [sn.serial for sn in sns]

    # ── Build PDF ─────────────────────────────────────────────────────────
    pdf = InvoicePDF(business_name=business.name or "Gizmo Crave", currency=currency)
    pdf.add_page()
    W = 182   # usable width (210 - 14*2)

    # ── Logo on Left ──────────────────────────────────────────────────────
    logo_path = settings.STATIC_DIR / "gizmocrave_badge.png"
    if not logo_path.exists():
        logo_path = settings.STATIC_DIR / "gizmocrave_logo.png"
    if not logo_path.exists():
        app_static = Path(__file__).resolve().parent.parent / "static" / "gizmocrave_badge.png"
        if app_static.exists():
            logo_path = app_static
        else:
            app_static = Path(__file__).resolve().parent.parent / "static" / "gizmocrave_logo.png"
            if app_static.exists():
                logo_path = app_static

    if logo_path.exists():
        # Square badge logo: 28mm x 28mm
        pdf.image(str(logo_path), x=14, y=14, w=28)
    else:
        pdf.set_xy(14, 15)
        pdf.set_font("Helvetica", "B", 18)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(60, 8, business.name or "Gizmo Crave", ln=True)

    # ── Invoice title + number on Right ───────────────────────────────────
    pdf.set_y(14)
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(37, 99, 235)
    pdf.cell(W, 8, "INVOICE / MEMO", ln=False, align="R")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(8)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(W, 5.5, sale.sale_number, ln=True, align="R")
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(W, 4.5, f"Date: {sale.sale_date.strftime('%d %b %Y')}   Status: {sale.payment_status}", ln=True, align="R")
    pdf.set_text_color(0, 0, 0)

    # ── From / Bill To ───────────────────────────────────────────────────
    col = W // 2
    y_addr = 46
    pdf.set_y(y_addr)

    # FROM
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(100, 116, 139)
    pdf.set_xy(14, y_addr)
    pdf.cell(col, 4.5, "ISSUED BY", ln=True)
    pdf.set_text_color(15, 23, 42)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_x(14)
    pdf.cell(col, 5, business.name or "Gizmo Crave", ln=True)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(71, 85, 105)
    from_lines = [
        business.address if business.address else None,
        f"Phone: {business.phone}" if business.phone else None,
        f"Email: {business.email}" if business.email else "Email: gizmocrave@gmail.com",
        f"TIN: {business.tax_number}" if business.tax_number else None,
    ]
    for line in from_lines:
        if line:
            pdf.set_x(14)
            pdf.cell(col, 3.8, str(line), ln=True)

    # BILL TO
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(100, 116, 139)
    pdf.set_xy(14 + col, y_addr)
    pdf.cell(col, 4.5, "BILL TO (CUSTOMER)", ln=False)
    pdf.set_y(y_addr + 4.5)
    pdf.set_text_color(15, 23, 42)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_x(14 + col)
    pdf.cell(col, 5, customer.name if customer else "Walk-in Customer", ln=True)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(71, 85, 105)
    if customer:
        bill_lines = [
            f"Phone: {customer.phone}" if customer.phone else None,
            f"Email: {customer.email}" if customer.email else None,
            f"Address: {customer.address}" if customer.address else None,
            f"Loyalty Balance: {customer.loyalty_points} pts" if customer.loyalty_points else None,
        ]
        for line in bill_lines:
            if line:
                pdf.set_x(14 + col)
                pdf.cell(col, 3.8, str(line), ln=True)

    pdf.set_y(max(pdf.get_y() + 4, 60))

    # ── Items table header ───────────────────────────────────────────────
    pdf.set_fill_color(30, 58, 138)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 9)
    col_w = [W - 72, 14, 24, 20, 14]   # Item, Qty, Unit Price, Discount, Total
    headers = ["Item", "Qty", f"Unit ({currency})", f"Disc ({currency})", f"Total ({currency})"]
    aligns = ["L", "C", "R", "R", "R"]
    for i, h in enumerate(headers):
        pdf.cell(col_w[i], 7, h, border=0, fill=True, align=aligns[i])
    pdf.ln()

    # ── Items rows ───────────────────────────────────────────────────────
    pdf.set_text_color(0, 0, 0)
    row_fill = False
    for item in sale.items:
        variant = item.variant
        product = variant.product if variant else None
        product_name = _clean(product.name) if product else "-"
        variant_name = _clean(variant.name) if variant else "-"
        sku = _clean(variant.sku) if (variant and variant.sku) else None
        serials = [_clean(s) for s in item_serials.get(item.id, [])]

        pdf.set_fill_color(249, 250, 251) if row_fill else pdf.set_fill_color(255, 255, 255)
        row_fill = not row_fill

        row_y = pdf.get_y()
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(col_w[0], 5, product_name[:40], fill=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(col_w[1], 5, str(item.quantity), fill=True, align="C")
        pdf.cell(col_w[2], 5, _fmt(item.unit_price), fill=True, align="R")
        pdf.cell(col_w[3], 5, _fmt(item.discount_amount) if float(item.discount_amount) > 0 else "-", fill=True, align="R")
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(col_w[4], 5, _fmt(item.total_price), fill=True, align="R", ln=True)

        # Variant + SKU sub-line
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(100, 100, 100)
        sub = variant_name + (f"  SKU: {sku}" if sku else "")
        pdf.set_fill_color(249, 250, 251) if not row_fill else pdf.set_fill_color(255, 255, 255)
        pdf.cell(col_w[0], 4, sub[:50], fill=True)
        pdf.cell(sum(col_w[1:]), 4, "", fill=True, ln=True)

        # Serial numbers
        if serials:
            pdf.set_font("Helvetica", "", 7.5)
            serial_line = "  ".join(serials)
            # Wrap if too long
            max_chars = 95
            while serial_line:
                chunk = serial_line[:max_chars]
                serial_line = serial_line[max_chars:]
                pdf.set_x(14)
                pdf.set_text_color(30, 64, 175)
                pdf.cell(W, 4, chunk, ln=True)

        pdf.set_text_color(0, 0, 0)

        # Divider
        pdf.set_draw_color(229, 231, 235)
        pdf.line(14, pdf.get_y(), 14 + W, pdf.get_y())

    pdf.ln(4)

    # ── Totals block (right-aligned) ─────────────────────────────────────
    label_x = 14 + W - 80
    val_x   = 14 + W - 30

    def total_row(label: str, value: str, bold: bool = False, color=(0, 0, 0)):
        pdf.set_font("Helvetica", "B" if bold else "", 9)
        pdf.set_text_color(*color)
        pdf.set_x(label_x)
        pdf.cell(50, 6, label, align="L")
        pdf.set_x(val_x)
        pdf.cell(30, 6, value, align="R", ln=True)
        pdf.set_text_color(0, 0, 0)

    total_row("Subtotal", f"{currency} {_fmt(sale.total_amount)}")
    if float(sale.discount_amount) > 0:
        total_row("Discount", f"- {currency} {_fmt(sale.discount_amount)}", color=(5, 150, 105))
    if sale.loyalty_points_redeemed > 0:
        loyalty_val = sale.loyalty_points_redeemed * 0.10
        total_row(f"Loyalty ({sale.loyalty_points_redeemed} pts)", f"- {currency} {_fmt(loyalty_val)}", color=(5, 150, 105))

    # Separator line
    pdf.set_draw_color(209, 213, 219)
    pdf.line(label_x, pdf.get_y(), 14 + W, pdf.get_y())
    pdf.ln(1)

    total_row("Net Payable", f"{currency} {_fmt(sale.net_payable)}", bold=True)
    total_row("Paid", f"{currency} {_fmt(sale.paid_amount)}", color=(5, 150, 105))
    if sale.due_amount > 0:
        total_row("Balance Due", f"{currency} {_fmt(sale.due_amount)}", bold=True, color=(220, 38, 38))

    pdf.ln(4)

    # ── Loyalty earned notice ────────────────────────────────────────────
    if sale.loyalty_points_earned > 0:
        pdf.set_fill_color(254, 252, 232)
        pdf.set_draw_color(253, 230, 138)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(146, 64, 14)
        pts = sale.loyalty_points_earned
        msg = f"  * {pts} loyalty point{'s' if pts != 1 else ''} earned on this purchase!"
        if customer:
            msg += f"  |  Balance: {customer.loyalty_points} pts"
        pdf.cell(W, 7, msg, border=1, fill=True, ln=True)
        pdf.set_text_color(0, 0, 0)
        pdf.ln(3)

    # ── Notes ────────────────────────────────────────────────────────────
    if sale.notes:
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(W, 5, "NOTES", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(55, 65, 81)
        pdf.multi_cell(W, 5, sale.notes)
        pdf.set_text_color(0, 0, 0)
        pdf.ln(2)

    # ── Thank you ────────────────────────────────────────────────────────
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(30, 58, 138)
    pdf.cell(W, 7, "Thank you for your business!", align="C", ln=True)
    pdf.set_text_color(0, 0, 0)

    # ── Save ─────────────────────────────────────────────────────────────
    settings.PDF_DIR.mkdir(parents=True, exist_ok=True)
    pdf_path = settings.PDF_DIR / f"invoice_{sale.sale_number}.pdf"
    pdf.output(str(pdf_path))
    return pdf_path
