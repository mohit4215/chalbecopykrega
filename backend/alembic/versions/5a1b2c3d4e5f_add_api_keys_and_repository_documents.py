"""add_api_keys_and_repository_documents

Revision ID: 5a1b2c3d4e5f
Revises: 3570cd7878a2
Create Date: 2026-11-26 23:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a1b2c3d4e5f'
down_revision: Union[str, Sequence[str], None] = '3570cd7878a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: provision api_keys and repository_documents tables."""
    # 1. API Keys Table
    op.create_table(
        'api_keys',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('key_prefix', sa.String(length=16), nullable=False),
        sa.Column('hashed_key', sa.String(length=64), nullable=False),
        sa.Column('rate_limit_per_minute', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_api_keys_hashed_key'), 'api_keys', ['hashed_key'], unique=True)
    op.create_index(op.f('ix_api_keys_key_prefix'), 'api_keys', ['key_prefix'], unique=False)
    op.create_index(op.f('ix_api_keys_user_id'), 'api_keys', ['user_id'], unique=False)

    # 2. Repository Documents Table
    op.create_table(
        'repository_documents',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('author', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('institution', sa.String(length=255), nullable=False),
        sa.Column('full_text', sa.Text(), nullable=False),
        sa.Column('chunk_count', sa.Integer(), nullable=False),
        sa.Column('word_count', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_repository_documents_author'), 'repository_documents', ['author'], unique=False)
    op.create_index(op.f('ix_repository_documents_category'), 'repository_documents', ['category'], unique=False)
    op.create_index(op.f('ix_repository_documents_created_at'), 'repository_documents', ['created_at'], unique=False)
    op.create_index(op.f('ix_repository_documents_is_active'), 'repository_documents', ['is_active'], unique=False)
    op.create_index(op.f('ix_repository_documents_title'), 'repository_documents', ['title'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_repository_documents_title'), table_name='repository_documents')
    op.drop_index(op.f('ix_repository_documents_is_active'), table_name='repository_documents')
    op.drop_index(op.f('ix_repository_documents_created_at'), table_name='repository_documents')
    op.drop_index(op.f('ix_repository_documents_category'), table_name='repository_documents')
    op.drop_index(op.f('ix_repository_documents_author'), table_name='repository_documents')
    op.drop_table('repository_documents')

    op.drop_index(op.f('ix_api_keys_user_id'), table_name='api_keys')
    op.drop_index(op.f('ix_api_keys_key_prefix'), table_name='api_keys')
    op.drop_index(op.f('ix_api_keys_hashed_key'), table_name='api_keys')
    op.drop_table('api_keys')
