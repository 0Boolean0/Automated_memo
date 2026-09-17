"""phase8_sales

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-18 01:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Create sales table ────────────────────────────────────────────────
    op.create_table(
        'sales',
        sa.Column('id',                      sa.Integer(),      nullable=False),
        sa.Column('business_id',             sa.Integer(),      nullable=False),
        sa.Column('customer_id',             sa.Integer(),      nullable=True),
        sa.Column('sale_number',             sa.String(100),    nullable=False),
        sa.Column('sale_date',               sa.Date(),         nullable=False),
        sa.Column('total_amount',            sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('discount_amount',         sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('loyalty_points_redeemed', sa.Integer(),      nullable=False, server_default='0'),
        sa.Column('loyalty_points_earned',   sa.Integer(),      nullable=False, server_default='0'),
        sa.Column('paid_amount',             sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('payment_status',          sa.String(20),     nullable=False, server_default='DUE'),
        sa.Column('notes',                   sa.Text(),         nullable=True),
        sa.Column('created_by',              sa.Integer(),      nullable=True),
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at',  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], name='fk_sales_business',  ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'],  name='fk_sales_customer',  ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'],  ['users.id'],      name='fk_sales_created_by',ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sale_number', name='uq_sales_number'),
    )
    op.create_index('ix_sales_id',          'sales', ['id'])
    op.create_index('ix_sales_business_id', 'sales', ['business_id'])
    op.create_index('ix_sales_customer_id', 'sales', ['customer_id'])
    op.create_index('ix_sales_sale_number', 'sales', ['sale_number'])
    op.create_index('ix_sales_sale_date',   'sales', ['sale_date'])

    # ── Create sale_items table ───────────────────────────────────────────
    op.create_table(
        'sale_items',
        sa.Column('id',              sa.Integer(),      nullable=False),
        sa.Column('sale_id',         sa.Integer(),      nullable=False),
        sa.Column('variant_id',      sa.Integer(),      nullable=False),
        sa.Column('quantity',        sa.Integer(),      nullable=False, server_default='1'),
        sa.Column('unit_price',      sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('discount_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('total_price',     sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('notes',           sa.Text(),         nullable=True),
        sa.ForeignKeyConstraint(['sale_id'],    ['sales.id'],            name='fk_sale_items_sale',    ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['variant_id'], ['product_variants.id'], name='fk_sale_items_variant', ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sale_items_id',       'sale_items', ['id'])
    op.create_index('ix_sale_items_sale_id',  'sale_items', ['sale_id'])
    op.create_index('ix_sale_items_variant_id','sale_items', ['variant_id'])

    # ── Promote serial_numbers.sale_item_id from plain int to real FK ────
    with op.batch_alter_table('serial_numbers', schema=None) as batch_op:
        batch_op.create_index('ix_serial_numbers_sale_item_id', ['sale_item_id'], unique=False)
        batch_op.create_foreign_key(
            'fk_serial_numbers_sale_item',
            'sale_items', ['sale_item_id'], ['id'],
            ondelete='SET NULL',
        )


def downgrade() -> None:
    with op.batch_alter_table('serial_numbers', schema=None) as batch_op:
        batch_op.drop_constraint('fk_serial_numbers_sale_item', type_='foreignkey')
        batch_op.drop_index('ix_serial_numbers_sale_item_id')

    op.drop_table('sale_items')
    op.drop_table('sales')
