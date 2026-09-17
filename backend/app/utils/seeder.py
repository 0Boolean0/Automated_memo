"""
Database seeder — runs on first startup.

Creates:
1. Default business record
2. Default roles with permissions
3. Default admin user (admin / admin123)

This only runs if no business exists yet (safe to call every startup).
After first run, nothing changes.

IMPORTANT: Change the admin password immediately after first login!
"""

import logging
from sqlalchemy.orm import Session
from app.models.business import Business
from app.models.user import User, Role, UserRole
from app.auth.security import hash_password
from app.core.config import settings

logger = logging.getLogger(__name__)

# ─── Permission definitions ───────────────────────────────────────────────────
# These are the permission strings checked by require_permission() in every endpoint.
# They mirror the permission matrix from the architecture document.

ROLE_PERMISSIONS = {
    "ADMIN": [
        "manage_users", "manage_roles", "view_settings", "edit_settings",
        "create_product", "edit_product", "delete_product", "view_products",
        "manage_suppliers", "view_suppliers",
        "receive_stock", "adjust_inventory", "view_inventory",
        "create_sale", "cancel_sale", "view_sales",
        "manage_customers", "view_customers",
        "view_invoices", "generate_invoice",
        "manage_returns", "view_returns",
        "view_reports", "export_data",
        "manage_backup", "restore_backup",
        "view_audit_logs",
        "manage_warranty", "view_warranty",
        "scan_products",
        "change_prices",
        "manage_purchases", "view_purchases",
    ],
    "MANAGER": [
        "view_settings",
        "create_product", "edit_product", "view_products",
        "manage_suppliers", "view_suppliers",
        "receive_stock", "adjust_inventory", "view_inventory",
        "create_sale", "cancel_sale", "view_sales",
        "manage_customers", "view_customers",
        "view_invoices", "generate_invoice",
        "manage_returns", "view_returns",
        "view_reports", "export_data",
        "view_audit_logs",
        "manage_warranty", "view_warranty",
        "scan_products",
        "change_prices",
        "manage_purchases", "view_purchases",
    ],
    "STAFF": [
        "view_products",
        "receive_stock", "view_inventory",
        "view_customers",
        "view_invoices",
        "view_warranty",
        "scan_products",
        "view_purchases",
    ],
    "SELLER": [
        "view_products",
        "view_inventory",
        "create_sale", "view_sales",
        "manage_customers", "view_customers",
        "view_invoices", "generate_invoice",
        "manage_warranty", "view_warranty",
        "scan_products",
    ],
    "VIEWER": [
        "view_products",
        "view_inventory",
        "view_customers",
        "view_suppliers",
        "view_sales",
        "view_invoices",
        "view_reports",
        "view_warranty",
        "scan_products",
        "view_purchases",
    ],
}


def seed_database(db: Session) -> None:
    """
    Idempotent seed function — safe to call on every startup.
    Only creates records if they don't exist yet.
    """
    # Check if already seeded
    existing_business = db.query(Business).first()
    if existing_business:
        return  # Already seeded, nothing to do

    logger.info("First run detected — seeding database with defaults...")

    # ── 1. Create default business ────────────────────────────────────────────
    business = Business(
        name=settings.DEFAULT_BUSINESS_NAME,
        slug="my-gadget-shop",
        currency=settings.DEFAULT_CURRENCY,
        is_active=True,
    )
    db.add(business)
    db.flush()  # get business.id without committing
    logger.info(f"Created business: {business.name} (id={business.id})")

    # ── 2. Create default roles ───────────────────────────────────────────────
    roles: dict[str, Role] = {}
    for role_name, permissions in ROLE_PERMISSIONS.items():
        role = Role(
            business_id=business.id,
            name=role_name,
            permissions=permissions,
        )
        db.add(role)
        roles[role_name] = role
        logger.info(f"Created role: {role_name} ({len(permissions)} permissions)")

    db.flush()  # get role IDs

    # ── 3. Create default admin user ──────────────────────────────────────────
    admin = User(
        business_id=business.id,
        username="admin",
        hashed_password=hash_password("admin123"),
        full_name="Administrator",
        is_active=True,
    )
    db.add(admin)
    db.flush()  # get admin.id

    admin_user_role = UserRole(user_id=admin.id, role_id=roles["ADMIN"].id)
    db.add(admin_user_role)

    db.commit()

    logger.info("=" * 50)
    logger.info("Database seeded successfully!")
    logger.info(f"  Business: {business.name}")
    logger.info("  Default login:")
    logger.info("    Username: admin")
    logger.info("    Password: admin123")
    logger.info("  ⚠ CHANGE THE PASSWORD AFTER FIRST LOGIN!")
    logger.info("=" * 50)
