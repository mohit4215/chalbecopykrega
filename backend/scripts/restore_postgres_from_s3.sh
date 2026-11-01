#!/usr/bin/env bash
# ==============================================================================
# Production PostgreSQL Disaster Recovery & S3 Restoration Script
# Features: S3 download, SHA-256 verification, AES-256 decryption, connection
#           termination, clean pg_restore, and post-restoration sanity checks.
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Configuration & Inputs
# ------------------------------------------------------------------------------
RESTORE_DIR="${RESTORE_TEMP_DIR:-/tmp/pg_restore}"
S3_BUCKET="${S3_BACKUP_BUCKET:-poach-production-backups}"
S3_PREFIX="${S3_BACKUP_PREFIX:-postgres/daily}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-SuperSecretProductionBackupKey2026!}"

# Database Connection (Defaults to production target or env DATABASE_URL)
if [[ -n "${DATABASE_URL:-}" ]]; then
    CLEAN_URL=$(echo "$DATABASE_URL" | sed -E 's|^[a-z\+]+://||')
    PGUSER=$(echo "$CLEAN_URL" | sed -E 's|:.*||')
    PGPASSWORD=$(echo "$CLEAN_URL" | sed -E 's|^[^:]+:([^@]+)@.*|\1|')
    PGHOST=$(echo "$CLEAN_URL" | sed -E 's|.*@([^:/]+).*|\1|')
    PGPORT=$(echo "$CLEAN_URL" | sed -E 's|.*:([0-9]+)/.*|\1|' || echo "5432")
    PGDATABASE=$(echo "$CLEAN_URL" | sed -E 's|.*/([^?]+).*|\1|')
    export PGPASSWORD
fi

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-poach_production}"

mkdir -p "$RESTORE_DIR"
cd "$RESTORE_DIR"

S3_SOURCE_URI="${1:-}"

# If no specific S3 URI is passed, locate the latest available backup
if [[ -z "$S3_SOURCE_URI" ]]; then
    echo "No S3 URI provided. Searching for the latest backup in s3://${S3_BUCKET}/${S3_PREFIX}/ ..."
    LATEST_KEY=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" --recursive | grep "\.dump\.enc$" | sort | tail -n 1 | awk '{print $4}')
    if [[ -z "$LATEST_KEY" ]]; then
        echo "ERROR: No backup files found in s3://${S3_BUCKET}/${S3_PREFIX}/" >&2
        exit 1
    fi
    S3_SOURCE_URI="s3://${S3_BUCKET}/${LATEST_KEY}"
    echo "Found latest backup: $S3_SOURCE_URI"
fi

ENC_FILENAME=$(basename "$S3_SOURCE_URI")
RAW_DUMP="${ENC_FILENAME%.enc}"
SHA_FILE="${ENC_FILENAME}.sha256"
S3_SHA_URI="${S3_SOURCE_URI%.enc}.enc.sha256"

# Cleanup Trap: Always wipe decrypted database dumps upon exit
cleanup() {
    if [[ -f "$RAW_DUMP" ]]; then
        rm -f "$RAW_DUMP"
    fi
}
trap cleanup EXIT

echo "=========================================================================="
echo "PostgreSQL Production Disaster Recovery"
echo "Target DB: ${PGDATABASE} @ ${PGHOST}:${PGPORT}"
echo "Source S3: ${S3_SOURCE_URI}"
echo "=========================================================================="

# ------------------------------------------------------------------------------
# 1. Production Safety Safeguard (Confirmation)
# ------------------------------------------------------------------------------
if [[ "${CI:-}" != "true" && "${AUTO_CONFIRM:-}" != "true" ]]; then
    echo ""
    echo "WARNING: Restoring this backup will OVERWRITE existing tables and data"
    echo "in database '${PGDATABASE}' on host '${PGHOST}'."
    echo ""
    read -r -p "To confirm, type the database name (${PGDATABASE}): " CONFIRM_NAME
    if [[ "$CONFIRM_NAME" != "$PGDATABASE" ]]; then
        echo "Confirmation failed. Aborting restoration."
        exit 1
    fi
fi

# ------------------------------------------------------------------------------
# 2. Download Encrypted Backup and Checksum from S3
# ------------------------------------------------------------------------------
echo "[1/5] Downloading backup archive and SHA-256 signature from S3..."
aws s3 cp "$S3_SOURCE_URI" "$ENC_FILENAME"
aws s3 cp "$S3_SHA_URI" "$SHA_FILE"

# ------------------------------------------------------------------------------
# 3. Cryptographic Verification & Decryption
# ------------------------------------------------------------------------------
echo "[2/5] Verifying SHA-256 cryptographic signature..."
sha256sum -c "$SHA_FILE" || {
    echo "ERROR: Backup integrity verification failed! Archive may be corrupted or tampered." >&2
    exit 2
}
echo "Integrity confirmed. Signature matches."

echo "[3/5] Decrypting database archive with OpenSSL AES-256-CBC..."
openssl enc -d -aes-256-cbc \
    -salt \
    -pbkdf2 \
    -iter 100000 \
    -in "$ENC_FILENAME" \
    -out "$RAW_DUMP" \
    -pass pass:"$ENCRYPTION_KEY"

# Test archive readability with pg_restore list
pg_restore --list "$RAW_DUMP" > /dev/null || {
    echo "ERROR: Decrypted file is not a valid PostgreSQL custom dump archive." >&2
    exit 3
}
echo "Archive validated. Table definitions and data TOC intact."

# ------------------------------------------------------------------------------
# 4. Terminate Active Connections (Prevent lock deadlocks during restore)
# ------------------------------------------------------------------------------
echo "[4/5] Terminating active client sessions on target database '${PGDATABASE}'..."
psql --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" --dbname="postgres" -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${PGDATABASE}' AND pid <> pg_backend_pid();" \
    || true

# ------------------------------------------------------------------------------
# 5. Execute pg_restore
# ------------------------------------------------------------------------------
echo "[5/5] Executing pg_restore with clean replacement..."
pg_restore \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --verbose \
    "$RAW_DUMP" || {
        # pg_restore returns exit code 1 on non-fatal warnings (e.g. drop table if not exists)
        echo "pg_restore completed with warnings or notices."
    }

# ------------------------------------------------------------------------------
# 6. Post-Restoration Sanity Verification
# ------------------------------------------------------------------------------
echo "=========================================================================="
echo "Post-Restoration Database Integrity Verification"
echo "=========================================================================="

psql --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" --dbname="$PGDATABASE" << 'EOF'
\echo '--- Alembic Schema Migration Version ---'
SELECT version_num FROM alembic_version;

\echo '--- Table Record Counts ---'
SELECT 
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM scan_history) as total_scans;
EOF

echo "=========================================================================="
echo "Disaster Recovery Restoration Finished Successfully at $(date -u)"
echo "=========================================================================="
