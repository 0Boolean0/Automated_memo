"""add_warranty_to_sale_items

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-20 22:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('sale_items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('warranty_period', sa.String(100), nullable=True))
        batch_op.add_column(sa.Column('warranty_months', sa.Integer(), nullable=True, server_default='0'))


def downgrade() -> None:
    with op.batch_alter_table('sale_items', schema=None) as batch_op:
        batch_op.drop_column('warranty_months')
        batch_op.drop_column('warranty_period')
