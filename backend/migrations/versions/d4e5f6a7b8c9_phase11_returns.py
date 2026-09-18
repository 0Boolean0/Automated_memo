"""phase11_returns

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-18 03:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── returns ──────────────────────────────────────────────────────────
    op.create_table(
        'returns',
        sa.Column('id',            sa.Integer(),      nullable=False),
        sa.Column('business_id',   sa.Integer(),      nullable=False),
        sa.Column('sale_id',       sa.Integer(),      nullable=True),
        sa.Column('customer_id',   sa.Integer(),      nullable=True),
        sa.Column('return_number', sa.String(50),     nullable=False),
        sa.Column('return_date',   sa.Date(),         nullable=False),
        sa.Column('reason',        sa.Text(),         nullable=False),
        sa.Column('return_type',   sa.String(30),     nullable=False, server_default='CUSTOMER_RETURN'),
        sa.Column('refund_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('refund_status', sa.String(20),     nullable=False, server_default='PENDING'),
        sa.Column('notes',         sa.Text(),         nullable=True),
        sa.Column('created_by',    sa.Integer(),      nullable=True),
        sa.Column('created_at',    sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at',    sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], name='fk_returns_business',   ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sale_id'],     ['sales.id'],      name='fk_returns_sale',       ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'],  name='fk_returns_customer',   ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'],  ['users.id'],      name='fk_returns_created_by', ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('return_number', name='uq_return_number'),
    )
    op.create_index('ix_returns_id',          'returns', ['id'])
    op.create_index('ix_returns_business_id', 'returns', ['business_id'])
    op.create_index('ix_returns_sale_id',     'returns', ['sale_id'])
    op.create_index('ix_returns_customer_id', 'returns', ['customer_id'])

    # ── return_items ──────────────────────────────────────────────────────
    op.create_table(
        'return_items',
        sa.Column('id',         sa.Integer(), nullable=False),
        sa.Column('return_id',  sa.Integer(), nullable=False),
        sa.Column('variant_id', sa.Integer(), nullable=False),
        sa.Column('serial_id',  sa.Integer(), nullable=True),
        sa.Column('quantity',   sa.Integer(), nullable=False, server_default='1'),
        sa.Column('condition',  sa.String(20), nullable=False, server_default='GOOD'),
        sa.Column('notes',      sa.Text(),    nullable=True),
        sa.ForeignKeyConstraint(['return_id'],  ['returns.id'],            name='fk_return_items_return',  ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['variant_id'], ['product_variants.id'],   name='fk_return_items_variant', ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['serial_id'],  ['serial_numbers.id'],     name='fk_return_items_serial',  ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_return_items_id',        'return_items', ['id'])
    op.create_index('ix_return_items_return_id', 'return_items', ['return_id'])


def downgrade() -> None:
    op.drop_table('return_items')
    op.drop_table('returns')
