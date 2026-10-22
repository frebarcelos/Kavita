#!/bin/sh
# usage: kavita-backup.sh <archive name>
# Reads the configuration volume at /config and writes the archive to /out. kavita.db is copied with the SQLite
# online backup and checked before the archive is written; covers, custom site themes and appsettings go along;
# the cache stays out.
set -eu
name="$1"
work=/tmp/backup
mkdir -p "$work"
sqlite3 /config/kavita.db ".backup '$work/kavita.db'"
result=$(sqlite3 "$work/kavita.db" 'PRAGMA integrity_check')
if [ "$result" != ok ]; then
    echo "integrity_check: $result" >&2
    exit 3
fi
cp /config/appsettings*.json "$work/" 2>/dev/null || true
set -- -C "$work" .
for folder in covers themes; do
    if [ -d "/config/$folder" ]; then set -- "$@" -C /config "$folder"; fi
done
tar -czf "/out/$name.partial" "$@"
mv "/out/$name.partial" "/out/$name"
