#!/bin/bash
set -e

# Database backup and restore utilities
# Usage: ./scripts/db-backup.sh [backup|restore] [environment]

ACTION=${1:-backup}
ENVIRONMENT=${2:-production}
BACKUP_DIR="./db/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="club_operations"
DB_USER="clubops"

mkdir -p "$BACKUP_DIR"

case "$ACTION" in
    backup)
        echo "💾 Creating database backup for $ENVIRONMENT..."
        
        BACKUP_FILE="$BACKUP_DIR/db_${ENVIRONMENT}_${TIMESTAMP}.sql.gz"
        
        # Get database connection info
        if [ "$ENVIRONMENT" = "local" ] || [ "$ENVIRONMENT" = "dev" ]; then
            DB_HOST="localhost"
            DB_PORT="5433"
        else
            # Use docker-compose to get the container
            CONTAINER_ID=$(docker-compose -p club-ops-$ENVIRONMENT ps -q db 2>/dev/null || echo "")
            if [ -z "$CONTAINER_ID" ]; then
                echo "❌ Database container not found for $ENVIRONMENT"
                exit 1
            fi
        fi
        
        if [ -n "$CONTAINER_ID" ]; then
            docker exec "$CONTAINER_ID" pg_dump -U $DB_USER $DB_NAME | gzip > "$BACKUP_FILE"
        else
            PGPASSWORD="${DB_PASSWORD}" pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME | gzip > "$BACKUP_FILE"
        fi
        
        echo "✅ Backup created: $BACKUP_FILE"
        ls -lh "$BACKUP_FILE"
        
        # Keep only last 7 backups
        find "$BACKUP_DIR" -name "db_${ENVIRONMENT}_*.sql.gz" -type f | sort -r | tail -n +8 | xargs -r rm
        echo "🧹 Cleanup: Kept last 7 backups"
        ;;
    
    restore)
        echo "♻️  Restoring database for $ENVIRONMENT..."
        
        if [ ! -d "$BACKUP_DIR" ]; then
            echo "❌ No backups found in $BACKUP_DIR"
            exit 1
        fi
        
        # Find latest backup
        LATEST_BACKUP=$(find "$BACKUP_DIR" -name "db_${ENVIRONMENT}_*.sql.gz" -type f | sort -r | head -1)
        
        if [ -z "$LATEST_BACKUP" ]; then
            echo "❌ No backup found for $ENVIRONMENT"
            exit 1
        fi
        
        echo "📂 Using backup: $LATEST_BACKUP"
        read -p "⚠️  This will overwrite the current database. Continue? (yes/no): " -r
        
        if [[ $REPLY != "yes" ]]; then
            echo "Cancelled."
            exit 0
        fi
        
        CONTAINER_ID=$(docker-compose -p club-ops-$ENVIRONMENT ps -q db 2>/dev/null || echo "")
        if [ -z "$CONTAINER_ID" ]; then
            echo "❌ Database container not found for $ENVIRONMENT"
            exit 1
        fi
        
        # Drop and recreate database
        docker exec "$CONTAINER_ID" psql -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;"
        docker exec "$CONTAINER_ID" psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;"
        
        # Restore from backup
        gunzip < "$LATEST_BACKUP" | docker exec -i "$CONTAINER_ID" psql -U $DB_USER $DB_NAME
        
        echo "✅ Database restored from: $LATEST_BACKUP"
        ;;
    
    *)
        echo "Usage: $0 [backup|restore] [environment]"
        echo ""
        echo "Examples:"
        echo "  $0 backup production      # Create production backup"
        echo "  $0 restore staging        # Restore from latest staging backup"
        exit 1
        ;;
esac
