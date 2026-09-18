"""phase10_warranty_claims

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-18 02:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'warranty_claims',
        sa.Column('id',              sa.Integer(),  nullable=False),
        sa.Column('business_id',     sa.Integer(),  nullable=False),
        sa.Column('serial_id',       sa.Integer(),  nullable=False),
        sa.Column('customer_id',     sa.Integer(),  nullable=True),
        sa.Column('claim_number',    sa.String(50), nullable=False),
        sa.Column('issue_desc',      sa.Text(),     nullable=False),
        sa.Column('status',          sa.String(20), nullable=False, server_default='OPEN'),
        sa.Column('resolution_note', sa.Text(),     nullable=True),
        sa.Column('claimed_by',      sa.Integer(),  nullable=True),
        sa.Column('resolved_by',     sa.Integer(),  nullable=True),
        sa.Column('resolved_at',     sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at',      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at',      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'],    name='fk_warranty_business',   ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['serial_id'],   ['serial_numbers.id'],name='fk_warranty_serial',     ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'],     name='fk_warranty_customer',   ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['claimed_by'],  ['users.id'],         name='fk_warranty_claimed_by', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.id'],         name='fk_warranty_resolved_by',ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('claim_number', name='uq_warranty_claim_number'),
    )
    op.create_index('ix_warranty_claims_id',          'warranty_claims', ['id'])
    op.create_index('ix_warranty_claims_business_id', 'warranty_claims', ['business_id'])
    op.create_index('ix_warranty_claims_serial_id',   'warranty_claims', ['serial_id'])
    op.create_index('ix_warranty_claims_customer_id', 'warranty_claims', ['customer_id'])
    op.create_index('ix_warranty_claims_status',      'warranty_claims', ['status'])


def downgrade() -> None:
    op.drop_table('warranty_claims')
