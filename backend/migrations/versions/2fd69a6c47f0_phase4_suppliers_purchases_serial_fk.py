"""phase4_suppliers_purchases_serial_fk

Revision ID: 2fd69a6c47f0
Revises: 80326923b127
Create Date: 2026-09-17 23:16:34.763493

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '2fd69a6c47f0'
down_revision: Union[str, None] = '80326923b127'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create suppliers table
    op.create_table(
        'suppliers',
        sa.Column('id',          sa.Integer(),     nullable=False),
        sa.Column('business_id', sa.Integer(),     nullable=False),
        sa.Column('name',        sa.String(255),   nullable=False),
        sa.Column('company',     sa.String(255),   nullable=True),
        sa.Column('phone',       sa.String(50),    nullable=True),
        sa.Column('email',       sa.String(255),   nullable=True),
        sa.Column('address',     sa.Text(),        nullable=True),
        sa.Column('notes',       sa.Text(),        nullable=True),
        sa.Column('is_active',   sa.Boolean(),     nullable=False, server_default='1'),
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at',  sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], name='fk_suppliers_business', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_suppliers_id',          'suppliers', ['id'])
    op.create_index('ix_suppliers_business_id', 'suppliers', ['business_id'])
    op.create_index('ix_suppliers_name',        'suppliers', ['name'])

    # Create supplier_contacts table
    op.create_table(
        'supplier_contacts',
        sa.Column('id',          sa.Integer(),   nullable=False),
        sa.Column('supplier_id', sa.Integer(),   nullable=False),
        sa.Column('name',        sa.String(255), nullable=False),
        sa.Column('phone',       sa.String(50),  nullable=True),
        sa.Column('email',       sa.String(255), nullable=True),
        sa.Column('role',        sa.String(100), nullable=True),
        sa.Column('is_primary',  sa.Boolean(),   nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], name='fk_supplier_contacts_supplier', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_supplier_contacts_id',          'supplier_contacts', ['id'])
    op.create_index('ix_supplier_contacts_supplier_id', 'supplier_contacts', ['supplier_id'])

    # Create purchases table
    op.create_table(
        'purchases',
        sa.Column('id',              sa.Integer(),      nullable=False),
        sa.Column('business_id',     sa.Integer(),      nullable=False),
        sa.Column('supplier_id',     sa.Integer(),      nullable=True),
        sa.Column('purchase_number', sa.String(100),    nullable=False),
        sa.Column('invoice_number',  sa.String(100),    nullable=True),
        sa.Column('purchase_date',   sa.Date(),         nullable=False),
        sa.Column('total_amount',    sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('paid_amount',     sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('payment_status',  sa.String(20),     nullable=False, server_default='DUE'),
        sa.Column('notes',           sa.Text(),         nullable=True),
        sa.Column('created_by',      sa.Integer(),      nullable=True),
        sa.Column('created_at',      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at',      sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], name='fk_purchases_business',  ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], name='fk_purchases_supplier',   ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by'],  ['users.id'],     name='fk_purchases_created_by', ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('purchase_number', name='uq_purchases_number'),
    )
    op.create_index('ix_purchases_id',              'purchases', ['id'])
    op.create_index('ix_purchases_business_id',     'purchases', ['business_id'])
    op.create_index('ix_purchases_supplier_id',     'purchases', ['supplier_id'])
    op.create_index('ix_purchases_purchase_number', 'purchases', ['purchase_number'])

    # Create purchase_items table
    op.create_table(
        'purchase_items',
        sa.Column('id',          sa.Integer(),      nullable=False),
        sa.Column('purchase_id', sa.Integer(),      nullable=False),
        sa.Column('variant_id',  sa.Integer(),      nullable=False),
        sa.Column('quantity',    sa.Integer(),      nullable=False, server_default='1'),
        sa.Column('unit_cost',   sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('total_cost',  sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('notes',       sa.Text(),         nullable=True),
        sa.ForeignKeyConstraint(['purchase_id'], ['purchases.id'],        name='fk_purchase_items_purchase', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['variant_id'],  ['product_variants.id'], name='fk_purchase_items_variant',  ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_purchase_items_id',          'purchase_items', ['id'])
    op.create_index('ix_purchase_items_purchase_id', 'purchase_items', ['purchase_id'])
    op.create_index('ix_purchase_items_variant_id',  'purchase_items', ['variant_id'])

    # Update serial_numbers: add purchase_item_id FK + index
    with op.batch_alter_table('serial_numbers', schema=None) as batch_op:
        batch_op.create_index('ix_serial_numbers_purchase_item_id', ['purchase_item_id'], unique=False)
        batch_op.create_foreign_key(
            'fk_serial_numbers_purchase_item',
            'purchase_items', ['purchase_item_id'], ['id'],
            ondelete='SET NULL',
        )


def downgrade() -> None:
    with op.batch_alter_table('serial_numbers', schema=None) as batch_op:
        batch_op.drop_constraint('fk_serial_numbers_purchase_item', type_='foreignkey')
        batch_op.drop_index('ix_serial_numbers_purchase_item_id')

    op.drop_table('purchase_items')
    op.drop_table('purchases')
    op.drop_table('supplier_contacts')
    op.drop_table('suppliers')
