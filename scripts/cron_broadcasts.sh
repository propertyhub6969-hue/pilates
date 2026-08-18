#!/bin/bash
# Cron: broadcast jadwal WhatsApp — jalan TIAP 15 MENIT.
#   Jam kirim sesungguhnya ditentukan di Pengaturan (bulanan_open_time / dropin_open_time);
#   script hanya mengirim saat jam WITA masuk slot 15 menit di jam setting itu.
#   $1 = jenis: bulanan (post grup, H-2) | dropin (personal per-datang, H-1)
KIND="${1:-bulanan}"
cd /opt/pilates || exit 1
TS=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
echo "===== $TS run broadcast ($KIND) =====" >> /var/log/pilates-broadcasts.log
/usr/bin/docker compose -f docker-compose.prod.yml exec -T backend \
  python -m scripts.send_broadcasts --kind "$KIND" >> /var/log/pilates-broadcasts.log 2>&1
