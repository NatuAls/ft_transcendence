#!/bin/sh
# 1. Define the date and create a subfolder to organize each backup
DATE=$(date +"%Y-%m-%d_%H:%M")
BACKUP_DIR="/backups/${DATE}"
mkdir -p $BACKUP_DIR

# 2. PostgreSQL Backup
echo "Starting PostgreSQL backup..."
export PGPASSWORD=$POSTGRES_PASSWORD
# NOTE: We use "-h db" because that is the service name in docker-compose
pg_dump -h db -U $POSTGRES_USER -F c -d $POSTGRES_DB > "${BACKUP_DIR}/database.dump"

# 3. Uploads Backup (Attachments)
echo "Starting uploads compression..."
# Package and compress the folder into a .tar.gz file
tar -czf "${BACKUP_DIR}/uploads.tar.gz" -C / uploads/

echo "Backup successfully completed at: $BACKUP_DIR"