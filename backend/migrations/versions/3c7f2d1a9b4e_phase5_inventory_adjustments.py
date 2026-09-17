"""phase5_inventory_adjustments

Revision ID: 3c7f2d1a9b4e
Revises: 2fd69a6c47f0
Create Date: 2026-09-17 23:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '3c7f2d1a9b4e'
down_revision: Union[str, None] = '2fd69a6c47f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create inventory_adjustments table
    op.create_table(
        'inventory_adjustments',
        sa.Column('id',              sa.Integer(),     nullable=False),
        sa.Column('business_id',     sa.Integer(),     nullable=False),
        sa.Column('variant_id',      sa.Integer(),     nullable=False),
        sa.Column('adjustment_type', sa.String(50),    nullable=False),  # PHYSICAL_COUNT, DAMAGE, LOSS, TRANSFER, RETURN, CORRECTION
        sa.Column('quantity_change', sa.Integer(),     nullable=False),  # positive or negative
        sa.Column('reason',          sa.Text(),        nullable=False),  # mandatory explanation
        sa.Column('adjusted_by',     sa.Integer(),     nullable=True),   # user_id
        sa.Column('notes',           sa.Text(),        nullable=True),   # optional additional context
        sa.Column('created_at',      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at',      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'],        name='fk_inventory_adjustments_business', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['variant_id'],  ['product_variants.id'],  name='fk_inventory_adjustments_variant',  ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['adjusted_by'], ['users.id'],             name='fk_inventory_adjustments_adjusted_by', ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inventory_adjustments_id',              'inventory_adjustments', ['id'])
    op.create_index('ix_inventory_adjustments_business_id',     'inventory_adjustments', ['business_id'])
    op.create_index('ix_inventory_adjustments_variant_id',      'inventory_adjustments', ['variant_id'])
    op.create_index('ix_inventory_adjustments_adjustment_type', 'inventory_adjustments', ['adjustment_type'])
    op.create_index('ix_inventory_adjustments_adjusted_by',     'inventory_adjustments', ['adjusted_by'])


def downgrade() -> None:
    op.drop_table('inventory_adjustments')
