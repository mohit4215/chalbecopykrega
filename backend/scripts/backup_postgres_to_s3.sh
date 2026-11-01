#!/usr/bin/env bash
# ==============================================================================
# Production PostgreSQL Automated Backup to AWS S3
# Features: pg_dump custom compressed format, AES-256 encryption, S3 upload,
#           SHA-256 integrity verification, flock concurrency lock, and alerts.
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Configuration & Environment
# ------------------------------------------------------------------------------
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
DATE_DAY=$(date -u +"%Y-%m-%d")
BACKUP_DIR="${BACKUP_TEMP_DIR:-/tmp/pg_backups}"
S3_BUCKET="${S3_BACKUP_BUCKET:-poach-production-backups}"
S3_PREFIX="${S3_BACKUP_PREFIX:-postgres/daily}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
LOCK_FILE="/tmp/poach_pg_backup.lock"
HEALTHCHECK_URL="${BACKUP_HEALTHCHECK_URL:-}" # e.g. https://hc-ping.com/uuid

# Database Connection Resolution (Supports DATABASE_URL or individual PG* vars)
if [[ -n "${DATABASE_URL:-}" ]]; then
    # Strip protocol prefix (postgresql+asyncpg:// or postgresql://)
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
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-SuperSecretProductionBackupKey2026!}"

mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

# ------------------------------------------------------------------------------
# Concurrency Lock (Prevent overlapping backup jobs)
# ------------------------------------------------------------------------------
exec 200>"$LOCK_FILE"
flock -n 200 || {
    echo "[$(date -u)] ERROR: Another PostgreSQL backup job is currently running. Exiting." >&2
    exit 1
}

# ------------------------------------------------------------------------------
# Cleanup Trap for Temporary Files
# ------------------------------------------------------------------------------
RAW_BACKUP="poach_db_${PGDATABASE}_${TIMESTAMP}.dump"
ENC_BACKUP="${RAW_BACKUP}.enc"
SHA_FILE="${ENC_BACKUP}.sha256"

cleanup() {
    local exit_code=$?
    if [[ -f "$RAW_BACKUP" ]]; then
        rm -f "$RAW_BACKUP"
    fi
    if [[ $exit_code -ne 0 ]]; then
        echo "[$(date -u)] ERROR: Backup pipeline failed with exit code $exit_code." >&2
        if [[ -n "$HEALTHCHECK_URL" ]]; then
            curl -fsS --retry 3 "${HEALTHCHECK_URL}/fail" || true
        fi
    fi
}
trap cleanup EXIT

echo "=========================================================================="
echo "Starting PostgreSQL Automated Backup: ${PGDATABASE} @ ${PGHOST}:${PGPORT}"
echo "Timestamp: ${TIMESTAMP}"
echo "=========================================================================="

# ------------------------------------------------------------------------------
# 1. Run pg_dump (Custom format with maximum gzip compression & BLOBs)
# ------------------------------------------------------------------------------
echo "[1/4] Running pg_dump with custom compressed archive format..."
pg_dump \
    --host="$PGHOST" \
    --port="$PGPORT" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --format=custom \
    --compress=9 \
    --blobs \
    --no-owner \
    --no-privileges \
    --file="$RAW_BACKUP"

DUMP_SIZE=$(du -h "$RAW_BACKUP" | cut -f1)
echo "pg_dump completed successfully. Raw Archive Size: $DUMP_SIZE"

# ------------------------------------------------------------------------------
# 2. Encrypt Backup with OpenSSL AES-256-CBC (PBKDF2 with 100k iterations)
# ------------------------------------------------------------------------------
echo "[2/4] Encrypting database archive with OpenSSL AES-256-CBC..."
openssl enc -aes-256-cbc \
    -salt \
    -pbkdf2 \
    -iter 100000 \
    -in "$RAW_BACKUP" \
    -out "$ENC_BACKUP" \
    -pass pass:"$ENCRYPTION_KEY"

# Compute cryptographic hash for tamper detection
sha256sum "$ENC_BACKUP" > "$SHA_FILE"
echo "Encryption complete. Checksum: $(cat "$SHA_FILE")"

# Remove unencrypted dump immediately
rm -f "$RAW_BACKUP"

# ------------------------------------------------------------------------------
# 3. Stream Upload to AWS S3 Bucket with Server-Side Encryption
# ------------------------------------------------------------------------------
S3_TARGET_URI="s3://${S3_BUCKET}/${S3_PREFIX}/${DATE_DAY}/${ENC_BACKUP}"
S3_CHECKSUM_URI="s3://${S3_BUCKET}/${S3_PREFIX}/${DATE_DAY}/${SHA_FILE}"

echo "[3/4] Uploading encrypted archive to AWS S3: $S3_TARGET_URI ..."
aws s3 cp "$ENC_BACKUP" "$S3_TARGET_URI" \
    --sse AES256 \
    --storage-class STANDARD_IA

aws s3 cp "$SHA_FILE" "$S3_CHECKSUM_URI" \
    --sse AES256

echo "S3 Upload successful!"

# ------------------------------------------------------------------------------
# 4. Enforce Retention Rotation (Prune local & S3 backups older than N days)
# ------------------------------------------------------------------------------
echo "[4/4] Enforcing backup retention policy (${RETENTION_DAYS} days)..."

# Local cleanup: purge local files older than 3 days to conserve disk
find "$BACKUP_DIR" -name "poach_db_*.enc*" -mtime +3 -delete || true

# Remote S3 cleanup: remove backup directories older than RETENTION_DAYS
CUTOFF_DATE=$(date -u -d "${RETENTION_DAYS} days ago" +"%Y-%m-%d" 2>/dev/null || date -u -v-${RETENTION_DAYS}d +"%Y-%m-%d")
aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" | while read -r line; do
    DIR_NAME=$(echo "$line" | awk '{print $NF}' | tr -d '/')
    if [[ "$DIR_NAME" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        if [[ "$DIR_NAME" < "$CUTOFF_DATE" ]]; then
            echo "Pruning expired S3 backup directory: s3://${S3_BUCKET}/${S3_PREFIX}/${DIR_NAME}/"
            aws s3 rm "s3://${S3_BUCKET}/${S3_PREFIX}/${DIR_NAME}/" --recursive
        fi
    fi
done

# Ping healthcheck monitor on success
if [[ -n "$HEALTHCHECK_URL" ]]; then
    curl -fsS --retry 3 "$HEALTHCHECK_URL" || true
fi

echo "=========================================================================="
echo "Backup Pipeline Completed Successfully at $(date -u)"
echo "S3 Object: $S3_TARGET_URI"
echo "=========================================================================="
