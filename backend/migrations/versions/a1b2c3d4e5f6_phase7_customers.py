"""phase7_customers

Revision ID: a1b2c3d4e5f6
Revises: 3c7f2d1a9b4e
Create Date: 2026-09-18 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '3c7f2d1a9b4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'customers',
        sa.Column('id',             sa.Integer(),     nullable=False),
        sa.Column('business_id',    sa.Integer(),     nullable=False),
        sa.Column('name',           sa.String(255),   nullable=False),
        sa.Column('phone',          sa.String(50),    nullable=True),
        sa.Column('email',          sa.String(255),   nullable=True),
        sa.Column('address',        sa.Text(),        nullable=True),
        sa.Column('customer_type',  sa.String(20),    nullable=False, server_default='RETAIL'),
        sa.Column('loyalty_points', sa.Integer(),     nullable=False, server_default='0'),
        sa.Column('notes',          sa.Text(),        nullable=True),
        sa.Column('is_active',      sa.Boolean(),     nullable=False, server_default='1'),
        sa.Column('created_at',     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at',     sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], name='fk_customers_business', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_customers_id',          'customers', ['id'])
    op.create_index('ix_customers_business_id', 'customers', ['business_id'])
    op.create_index('ix_customers_name',        'customers', ['name'])
    op.create_index('ix_customers_phone',       'customers', ['phone'])


def downgrade() -> None:
    op.drop_table('customers')
