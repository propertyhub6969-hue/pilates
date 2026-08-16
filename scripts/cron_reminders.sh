#!/bin/bash
# Cron: kirim pengingat WhatsApp.
#   $1 = jenis: h1 (H-1, harian 17:00 WIB) | h2 (±2 jam sebelum, tiap 15 menit)
KIND="${1:-h1}"
cd /opt/pilates || exit 1
TS=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
echo "===== $TS run reminder ($KIND) =====" >> /var/log/pilates-reminders.log
/usr/bin/docker compose -f docker-compose.prod.yml exec -T backend \
  python -m scripts.send_reminders --kind "$KIND" >> /var/log/pilates-reminders.log 2>&1
