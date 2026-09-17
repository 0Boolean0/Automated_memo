"""
Invoice service — Phase 9.

Generates a PDF invoice for a given sale using WeasyPrint + Jinja2.

Flow:
    1. Load the HTML template from app/templates/invoice.html
    2. Assemble full context (business, sale, customer, items with serials)
    3. Render HTML string via Jinja2
    4. Convert HTML → PDF via WeasyPrint
    5. Save to settings.PDF_DIR / "invoice_{sale_number}.pdf"
    6. Return the Path to the PDF file

The caller (endpoint) wraps the result in a FileResponse.
"""

import math
from datetime import datetime, timezone
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML as WeasyHTML
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.core.config import settings
from app.models.sale import Sale, SaleItem
from app.models.business import Business
from app.models.serial import SerialNumber
from app.services.sale_service import get_sale


# ── Jinja2 environment ────────────────────────────────────────────────────────

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)

def _fmt_amount(value) -> str:
    """Format a Decimal/float as a comma-separated number with 2 dp."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return "0.00"
    # Use locale-style formatting: 1,234.56
    return f"{f:,.2f}"

_jinja_env.filters["fmt_amount"] = _fmt_amount


# ── Currency symbol map ───────────────────────────────────────────────────────

CURRENCY_SYMBOLS: dict[str, str] = {
    "BDT": "৳",
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "INR": "₹",
}


def generate_invoice_pdf(
    db: Session,
    sale_id: int,
    business_id: int,
) -> Path:
    """
    Generate a PDF invoice for the given sale.

    Returns the Path to the generated PDF file.
    Raises HTTPException(404) if the sale is not found.
    """
    # ── Load sale ─────────────────────────────────────────────────────────
    sale: Sale = get_sale(db, sale_id, business_id)

    # ── Load business ────────────────────────────────────────────────────
    business: Business | None = db.query(Business).filter(
        Business.id == business_id
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    currency = business.currency or settings.DEFAULT_CURRENCY
    symbol   = CURRENCY_SYMBOLS.get(currency, currency + " ")

    # ── Assemble items with serials ──────────────────────────────────────
    items_ctx = []
    for item in sale.items:
        variant = item.variant
        product = variant.product if variant else None

        # Collect serial numbers for this item
        serials = [
            sn.serial
            for sn in db.query(SerialNumber)
            .filter(SerialNumber.sale_item_id == item.id)
            .all()
        ]

        items_ctx.append({
            "product_name":  product.name if product else "—",
            "variant_name":  variant.name if variant else "—",
            "sku":           variant.sku  if variant else None,
            "quantity":      item.quantity,
            "unit_price":    item.unit_price,
            "discount_amount": item.discount_amount,
            "total_price":   item.total_price,
            "serials":       serials,
        })

    # ── Customer context ──────────────────────────────────────────────────
    customer = sale.customer
    loyalty_balance = customer.loyalty_points if customer else 0

    # ── Assemble template context ─────────────────────────────────────────
    loyalty_value = round(sale.loyalty_points_redeemed * 0.10, 2)

    ctx = {
        # Business
        "business_name":    business.name,
        "business_address": business.address,
        "business_phone":   business.phone,
        "business_email":   business.email,
        "business_website": business.website,
        "business_tax":     business.tax_number,
        "currency_symbol":  symbol,

        # Sale header
        "sale_number":    sale.sale_number,
        "sale_date":      sale.sale_date.strftime("%d %b %Y"),
        "payment_status": sale.payment_status,
        "notes":          sale.notes,

        # Customer
        "customer_name":    customer.name    if customer else None,
        "customer_phone":   customer.phone   if customer else None,
        "customer_email":   customer.email   if customer else None,
        "customer_address": customer.address if customer else None,

        # Items
        "items": items_ctx,

        # Totals
        "total_amount":     float(sale.total_amount),
        "discount_amount":  float(sale.discount_amount),
        "loyalty_redeemed": sale.loyalty_points_redeemed,
        "loyalty_value":    loyalty_value,
        "loyalty_earned":   sale.loyalty_points_earned,
        "loyalty_balance":  loyalty_balance,
        "net_payable":      sale.net_payable,
        "paid_amount":      float(sale.paid_amount),
        "due_amount":       sale.due_amount,

        # Meta
        "generated_at": datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC"),
    }

    # ── Render HTML ───────────────────────────────────────────────────────
    template = _jinja_env.get_template("invoice.html")
    html_str = template.render(**ctx)

    # ── Generate PDF ──────────────────────────────────────────────────────
    pdf_path = settings.PDF_DIR / f"invoice_{sale.sale_number}.pdf"
    WeasyHTML(string=html_str, base_url=str(TEMPLATES_DIR)).write_pdf(str(pdf_path))

    return pdf_path
