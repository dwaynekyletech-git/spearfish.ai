#!/bin/bash

# Supabase Database Backup Script
# Creates automated backups with retention policy and cloud storage upload

set -e  # Exit on any error

# Configuration
BACKUP_DIR="backups"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILENAME="spearfish_backup_${DATE}.sql"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check required environment variables
check_env() {
    if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
        if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
            error "Missing required environment variables:"
            error "Either set SUPABASE_DB_URL or both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
            error ""
            error "Example:"
            error "export SUPABASE_DB_URL='postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres'"
            error "OR"
            error "export NEXT_PUBLIC_SUPABASE_URL='https://[project].supabase.co'"
            error "export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'"
            exit 1
        fi
        
        # Build connection URL from Supabase components
        PROJECT_ID=$(echo "${NEXT_PUBLIC_SUPABASE_URL}" | sed 's/https:\/\/\([^.]*\).*/\1/')
        if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
            warning "SUPABASE_DB_PASSWORD not set. You may be prompted for the database password."
            DB_URL="postgresql://postgres@db.${PROJECT_ID}.supabase.co:5432/postgres"
        else
            DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${PROJECT_ID}.supabase.co:5432/postgres"
        fi
    else
        DB_URL="${SUPABASE_DB_URL}"
    fi
}

# Check if required tools are installed
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v pg_dump &> /dev/null; then
        error "pg_dump is required but not installed."
        error "Install PostgreSQL client tools:"
        error "  macOS: brew install postgresql"
        error "  Ubuntu: sudo apt-get install postgresql-client"
        error "  CentOS: sudo yum install postgresql"
        exit 1
    fi
    
    # Check for optional cloud tools
    if command -v aws &> /dev/null; then
        CLOUD_UPLOAD="aws"
        log "AWS CLI detected - S3 upload available"
    elif command -v gcloud &> /dev/null; then
        CLOUD_UPLOAD="gcp"
        log "Google Cloud CLI detected - GCS upload available"
    else
        CLOUD_UPLOAD="none"
        warning "No cloud CLI tools detected - local backup only"
    fi
    
    success "Dependencies checked"
}

# Create backup directory
setup_backup_dir() {
    log "Setting up backup directory..."
    
    if [[ ! -d "${BACKUP_DIR}" ]]; then
        mkdir -p "${BACKUP_DIR}"
        log "Created backup directory: ${BACKUP_DIR}"
    fi
    
    success "Backup directory ready"
}

# Create database backup
create_backup() {
    log "Starting database backup..."
    log "Backup file: ${BACKUP_PATH}"
    
    # Add timestamp and metadata to backup
    cat > "${BACKUP_PATH}" << EOF
-- Spearfish AI Database Backup
-- Generated: $(date)
-- Database: Supabase Project
-- Backup tool: backup-database.sh
-- 
-- To restore: psql -d your_database -f ${BACKUP_FILENAME}
--

EOF
    
    # Create the backup
    if pg_dump "${DB_URL}" \
        --no-password \
        --verbose \
        --clean \
        --no-acl \
        --no-owner \
        --format=plain \
        --schema=public \
        --exclude-table-data='storage.*' \
        --exclude-table-data='auth.*' \
        --exclude-table-data='realtime.*' \
        --exclude-table-data='supabase_functions.*' \
        >> "${BACKUP_PATH}"; then
        
        success "Database backup created successfully"
        
        # Get backup file size
        BACKUP_SIZE=$(du -h "${BACKUP_PATH}" | cut -f1)
        log "Backup size: ${BACKUP_SIZE}"
        
        # Verify backup integrity
        if grep -q "PostgreSQL database dump complete" "${BACKUP_PATH}"; then
            success "Backup integrity verified"
        else
            warning "Backup may be incomplete - please verify manually"
        fi
        
    else
        error "Database backup failed"
        rm -f "${BACKUP_PATH}"  # Clean up failed backup
        exit 1
    fi
}

# Compress backup
compress_backup() {
    log "Compressing backup..."
    
    if command -v gzip &> /dev/null; then
        gzip "${BACKUP_PATH}"
        BACKUP_PATH="${BACKUP_PATH}.gz"
        BACKUP_FILENAME="${BACKUP_FILENAME}.gz"
        
        COMPRESSED_SIZE=$(du -h "${BACKUP_PATH}" | cut -f1)
        success "Backup compressed: ${COMPRESSED_SIZE}"
    else
        warning "gzip not available - backup stored uncompressed"
    fi
}

# Upload to cloud storage
upload_to_cloud() {
    case "${CLOUD_UPLOAD}" in
        "aws")
            upload_to_s3
            ;;
        "gcp")
            upload_to_gcs
            ;;
        "none")
            log "Skipping cloud upload (no CLI tools available)"
            ;;
    esac
}

# Upload to AWS S3
upload_to_s3() {
    if [[ -n "${AWS_S3_BACKUP_BUCKET:-}" ]]; then
        log "Uploading to S3 bucket: ${AWS_S3_BACKUP_BUCKET}"
        
        S3_PATH="s3://${AWS_S3_BACKUP_BUCKET}/spearfish-db-backups/${BACKUP_FILENAME}"
        
        if aws s3 cp "${BACKUP_PATH}" "${S3_PATH}"; then
            success "Backup uploaded to S3: ${S3_PATH}"
        else
            error "S3 upload failed"
        fi
    else
        log "AWS_S3_BACKUP_BUCKET not set - skipping S3 upload"
    fi
}

# Upload to Google Cloud Storage
upload_to_gcs() {
    if [[ -n "${GCS_BACKUP_BUCKET:-}" ]]; then
        log "Uploading to GCS bucket: ${GCS_BACKUP_BUCKET}"
        
        GCS_PATH="gs://${GCS_BACKUP_BUCKET}/spearfish-db-backups/${BACKUP_FILENAME}"
        
        if gcloud storage cp "${BACKUP_PATH}" "${GCS_PATH}"; then
            success "Backup uploaded to GCS: ${GCS_PATH}"
        else
            error "GCS upload failed"
        fi
    else
        log "GCS_BACKUP_BUCKET not set - skipping GCS upload"
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    # Local cleanup
    local deleted_count=0
    
    while IFS= read -r -d '' file; do
        log "Deleting old backup: $(basename "$file")"
        rm -f "$file"
        ((deleted_count++))
    done < <(find "${BACKUP_DIR}" -name "spearfish_backup_*.sql*" -type f -mtime +${RETENTION_DAYS} -print0 2>/dev/null)
    
    if [[ ${deleted_count} -gt 0 ]]; then
        success "Deleted ${deleted_count} old local backup(s)"
    else
        log "No old local backups to delete"
    fi
    
    # Cloud cleanup (optional)
    cleanup_cloud_backups
}

# Clean up old cloud backups
cleanup_cloud_backups() {
    case "${CLOUD_UPLOAD}" in
        "aws")
            if [[ -n "${AWS_S3_BACKUP_BUCKET:-}" ]]; then
                log "Cleaning up old S3 backups..."
                
                # List and delete backups older than retention period
                CUTOFF_DATE=$(date -d "${RETENTION_DAYS} days ago" +%Y-%m-%d)
                
                aws s3api list-objects-v2 \
                    --bucket "${AWS_S3_BACKUP_BUCKET}" \
                    --prefix "spearfish-db-backups/" \
                    --query "Contents[?LastModified<='${CUTOFF_DATE}'].{Key: Key}" \
                    --output text | while read -r key; do
                    
                    if [[ -n "$key" && "$key" != "None" ]]; then
                        log "Deleting old S3 backup: $key"
                        aws s3api delete-object --bucket "${AWS_S3_BACKUP_BUCKET}" --key "$key"
                    fi
                done
            fi
            ;;
        "gcp")
            if [[ -n "${GCS_BACKUP_BUCKET:-}" ]]; then
                log "Cleaning up old GCS backups..."
                
                # GCS lifecycle policies are recommended for automatic cleanup
                # This is a manual approach for immediate cleanup
                CUTOFF_DATE=$(date -d "${RETENTION_DAYS} days ago" +%Y-%m-%d)
                
                gcloud storage ls "gs://${GCS_BACKUP_BUCKET}/spearfish-db-backups/" \
                    --format="value(name,timeCreated)" | while read -r name created; do
                    
                    if [[ $(date -d "$created" +%Y-%m-%d) < "$CUTOFF_DATE" ]]; then
                        log "Deleting old GCS backup: $name"
                        gcloud storage rm "$name"
                    fi
                done
            fi
            ;;
    esac
}

# Test backup integrity
test_backup() {
    log "Testing backup integrity..."
    
    if [[ "${BACKUP_PATH}" == *.gz ]]; then
        # Test gzipped backup
        if gzip -t "${BACKUP_PATH}"; then
            success "Compressed backup integrity test passed"
        else
            error "Compressed backup integrity test failed"
            exit 1
        fi
    else
        # Test uncompressed SQL backup
        if grep -q "PostgreSQL database dump complete" "${BACKUP_PATH}"; then
            success "SQL backup integrity test passed"
        else
            error "SQL backup integrity test failed"
            exit 1
        fi
    fi
}

# Send notification (if configured)
send_notification() {
    local status="$1"
    local message="$2"
    
    # Slack webhook notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🗄️ Spearfish DB Backup ${status}: ${message}\"}" \
            "${SLACK_WEBHOOK_URL}" 2>/dev/null || true
    fi
    
    # Email notification (requires mailutils or similar)
    if [[ -n "${NOTIFICATION_EMAIL:-}" ]] && command -v mail &> /dev/null; then
        echo "${message}" | mail -s "Spearfish DB Backup ${status}" "${NOTIFICATION_EMAIL}" 2>/dev/null || true
    fi
}

# Main execution
main() {
    log "🗄️ Starting Spearfish AI Database Backup"
    log "========================================="
    
    # Load environment variables from .env if it exists
    if [[ -f ".env" ]]; then
        log "Loading environment variables from .env"
        set -a  # automatically export all variables
        source .env
        set +a
    fi
    
    check_env
    check_dependencies
    setup_backup_dir
    
    # Start backup process
    create_backup
    compress_backup
    test_backup
    upload_to_cloud
    cleanup_old_backups
    
    success "✅ Database backup completed successfully!"
    success "Local backup: ${BACKUP_PATH}"
    
    # Send success notification
    send_notification "SUCCESS" "Database backup completed. File: ${BACKUP_FILENAME}"
    
    log "========================================="
    log "Backup process finished"
}

# Handle script arguments
case "${1:-}" in
    "--dry-run")
        log "DRY RUN MODE - No actual backup will be created"
        check_env
        check_dependencies
        setup_backup_dir
        log "Dry run completed - everything looks good!"
        ;;
    "--test")
        log "TEST MODE - Creating backup but not uploading to cloud"
        CLOUD_UPLOAD="none"
        main
        ;;
    "--help")
        cat << EOF
Spearfish AI Database Backup Script

Usage: $0 [options]

Options:
  --dry-run    Check configuration and dependencies without creating backup
  --test       Create backup locally but skip cloud upload
  --help       Show this help message

Environment Variables:
  Required (choose one):
    SUPABASE_DB_URL              Full PostgreSQL connection string
    OR
    NEXT_PUBLIC_SUPABASE_URL     Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY    Service role key (for auth)
    SUPABASE_DB_PASSWORD         Database password

  Optional:
    AWS_S3_BACKUP_BUCKET         S3 bucket for backup upload
    GCS_BACKUP_BUCKET            GCS bucket for backup upload
    SLACK_WEBHOOK_URL            Slack webhook for notifications
    NOTIFICATION_EMAIL           Email for backup notifications

Examples:
  # Basic backup
  ./scripts/backup-database.sh

  # Test configuration
  ./scripts/backup-database.sh --dry-run

  # Backup with environment variables
  SUPABASE_DB_URL="postgresql://..." ./scripts/backup-database.sh

  # Scheduled backup (crontab example)
  0 2 * * * cd /path/to/spearfish && ./scripts/backup-database.sh

EOF
        ;;
    *)
        main
        ;;
esac