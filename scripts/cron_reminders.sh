#!/bin/bash
# Cron: kirim pengingat WhatsApp H-1 untuk kelas besok.
# Dijadwalkan 10:00 UTC = 17:00 WIB (lihat crontab).
cd /opt/pilates || exit 1
TS=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
echo "===== $TS run reminder =====" >> /var/log/pilates-reminders.log
/usr/bin/docker compose -f docker-compose.prod.yml exec -T backend python -m scripts.send_reminders >> /var/log/pilates-reminders.log 2>&1
