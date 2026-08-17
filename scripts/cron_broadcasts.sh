#!/bin/bash
# Cron: broadcast jadwal WhatsApp (harian 20:00 WITA = 12:00 UTC).
#   $1 = jenis: bulanan (post grup, H-2) | dropin (personal per-datang, H-1)
KIND="${1:-bulanan}"
cd /opt/pilates || exit 1
TS=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
echo "===== $TS run broadcast ($KIND) =====" >> /var/log/pilates-broadcasts.log
/usr/bin/docker compose -f docker-compose.prod.yml exec -T backend \
  python -m scripts.send_broadcasts --kind "$KIND" >> /var/log/pilates-broadcasts.log 2>&1
