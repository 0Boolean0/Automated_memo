"""
Sales endpoints — Phase 8.

POST /sales/            → create sale (POS transaction)
GET  /sales/            → paginated list
GET  /sales/{id}        → full sale detail with items
GET  /sales/{id}/serials → all serials sold in a sale
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.models.user import User
from app.models.serial import SerialNumber
from app.schemas.sale import SaleCreate, SaleResponse, PaginatedSales
from app.services import sale_service
from app.services import invoice_service

router = APIRouter()


@router.post("/", response_model=SaleResponse, status_code=201)
def create_sale(
    data: SaleCreate,
    current_user: User = Depends(require_permission("create_sale")),
    db: Session = Depends(get_db),
):
    """
    Create a POS sale. Atomically:
    - Validates stock/serials
    - Creates Sale + SaleItems
    - Decrements stock / transitions serials to SOLD
    - Updates customer loyalty points
    """
    sale = sale_service.sell(db, current_user.business_id, current_user.id, data)
    return sale_service._build_response(db, sale)


@router.get("/", response_model=dict)
def list_sales(
    customer_id:    Optional[int] = Query(None),
    payment_status: Optional[str] = Query(None),
    page:           int           = Query(1,  ge=1),
    per_page:       int           = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("view_sales")),
    db: Session = Depends(get_db),
):
    return sale_service.list_sales(
        db, current_user.business_id,
        customer_id=customer_id, payment_status=payment_status,
        page=page, per_page=per_page,
    )


@router.get("/{sale_id}", response_model=SaleResponse)
def get_sale(
    sale_id: int,
    current_user: User = Depends(require_permission("view_sales")),
    db: Session = Depends(get_db),
):
    sale = sale_service.get_sale(db, sale_id, current_user.business_id)
    return sale_service._build_response(db, sale)


@router.get("/{sale_id}/serials")
def list_sale_serials(
    sale_id: int,
    current_user: User = Depends(require_permission("view_sales")),
    db: Session = Depends(get_db),
):
    """List all serial numbers sold in a sale."""
    sale = sale_service.get_sale(db, sale_id, current_user.business_id)
    serials = []
    for item in sale.items:
        item_serials = (
            db.query(SerialNumber)
            .filter(SerialNumber.sale_item_id == item.id)
            .all()
        )
        for sn in item_serials:
            serials.append({
                "id":           sn.id,
                "serial":       sn.serial,
                "status":       sn.status,
                "variant_id":   sn.variant_id,
                "variant_name": item.variant.name if item.variant else None,
                "sold_at":      sn.sold_at.isoformat() if sn.sold_at else None,
            })
    return {"sale_id": sale_id, "serial_count": len(serials), "serials": serials}


@router.get("/{sale_id}/invoice")
def download_invoice(
    sale_id: int,
    current_user: User = Depends(require_permission("generate_invoice")),
    db: Session = Depends(get_db),
):
    """
    Generate and download a PDF invoice for the given sale.

    The PDF is generated on-demand, cached to pdfs/invoice_{sale_number}.pdf,
    and returned as a file download.
    """
    pdf_path = invoice_service.generate_invoice_pdf(
        db, sale_id, current_user.business_id
    )
    sale = sale_service.get_sale(db, sale_id, current_user.business_id)
    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=f"invoice_{sale.sale_number}.pdf",
        headers={"Content-Disposition": f'attachment; filename="invoice_{sale.sale_number}.pdf"'},
    )
