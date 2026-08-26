# Reformer Your Body — Handoff

Aplikasi manajemen **studio pilates "Reformer Your Body"** (Coach Ade). Single-studio, **multi-cabang**. Member booking kelas dari HP; staf kelola via back office.

> Terakhir diperbarui: 16 Agustus 2026 — semua MVP + fitur lanjutan **LIVE**; data uji sudah dibersihkan untuk mulai produksi.

---

## 1. URL & Akses

| Alamat | Fungsi |
|---|---|
| https://reformeryourbody.com (+ www) | Landing publik + login/daftar member |
| https://office.reformeryourbody.com | Back office (staf) — sidebar kiri |
| https://wa.reformeryourbody.com | UI gateway WhatsApp (gowa) — basic auth |

- **Owner:** `owner@reformeryourbody.id` / `reformer123` → **GANTI password** (menu kanan atas → Profil).
- **Gateway WA basic-auth:** user `reformer`, password ada di `/opt/pilates/.env` (`WA_BASIC_AUTH`).
- DNS `reformeryourbody.com` di Hostinger (akun sama dgn nexisthub.id). `office`, `wa`, `www`, `@` → A `72.60.43.158`.

## 2. Stack & Struktur

- **Backend:** FastAPI + SQLAlchemy 2 async + asyncpg + Alembic + Postgres 16. JWT (python-jose, passlib/bcrypt).
- **Frontend:** React 18 + Vite + TypeScript + Tailwind + React Query + React Router. Nginx (SPA + proxy `/api`).
- **Gateway WA:** `ghcr.io/aldinokemal/go-whatsapp-web-multidevice` (gowa), image di-pin ke digest `sha256:cdfae0dd…`.

```
/opt/pilates
├─ app/                 # backend
│  ├─ core/             # config, database, security
│  ├─ models/           # user, studio, branch, package, payment, schedule, booking
│  ├─ schemas/          # pydantic
│  ├─ services/         # booking, reminders, whatsapp, purchase, quota
│  └─ api/v1/endpoints/ # auth, members, packages, payments, schedule, bookings,
│                       #   reports, studio, branches, finance, public
├─ alembic/versions/    # migrasi (urut sampai a6b7c8d9e0f1)
├─ frontend/src/        # pages, components, context (Auth, Branch), utils
├─ scripts/             # seed_admin.py, send_reminders.py, cron_reminders.sh
├─ deploy/              # salinan file routing Traefik
├─ brand/               # logo.jpg (di-mount runtime ke nginx /brand/) — GITIGNORED
├─ docker-compose.prod.yml
└─ .env                 # rahasia (GITIGNORED)
```

## 3. Deploy & Operasional

> **★★ PRODUKSI PINDAH VPS (26 Agu 2026):** live di **VPS BARU `72.62.71.1`** (`srv1931251`). VPS LAMA `72.60.43.158` (vps.nadinata.org) **pilates DIMATIKAN** (`down`, volume tetap). Sesi Claude default = VPS lama → deploy ke produksi via SSH: `ssh -i ~/.ssh/nexist_migrate_ed25519 root@72.62.71.1` → `cd /opt/pilates && git pull && docker compose -f docker-compose.prod.yml up -d --build`. VPS baru pull pakai `core.sshCommand`=`/root/.ssh/pilates_pull_key` (key sementara; idealnya daftarkan `github_ed25519.pub` VPS baru sbg deploy key). Atau jalankan `claude` LANGSUNG di VPS baru. ★ Backup harian pilates di VPS lama kini redundan — pastikan VPS baru punya backup pilates.

```bash
cd /opt/pilates
# deploy penuh
docker compose -f docker-compose.prod.yml up -d --build
# hanya backend / frontend
docker compose -f docker-compose.prod.yml up -d --build backend
docker compose -f docker-compose.prod.yml up -d --build frontend
# log
docker compose -f docker-compose.prod.yml logs -f backend
```

- **Migrasi** jalan otomatis (`alembic upgrade head`) saat backend start.
- **Ganti logo:** timpa `/opt/pilates/brand/logo.png` (atau `.jpg`) → refresh browser (tanpa build).
- **Frontend di-build** di dalam image (multi-stage). Perubahan FE butuh `--build frontend`.
- Routing/TLS: file di `/data/coolify/proxy/dynamic/reformer.yaml` & `reformer-wa.yaml` (proxy Coolify/Traefik yang sudah jalan di VPS). Cert Let's Encrypt via DNS-01 (API Hostinger) — **domain harus di akun Hostinger yang sama dgn token Coolify**.

## 4. Model Data & Aturan Bisnis

- **Branch** (cabang): nama, alamat, telepon, `cancellation_window_hours`, `booking_lead_close_hours`, is_default. Jadwal & aturan booking **per cabang**.
- **User**: role (owner/admin/instructor/member), `member_category` (bulanan/private/per_datang), phone (utk reminder WA).
- **Package** (katalog) → **MemberPackage** (saldo kuota snapshot per member, lintas cabang).
- **Payment**: manual; link ke MemberPackage dan/atau Booking (drop-in); `proof_path` (bukti transfer).
- **ClassTemplate** (jadwal berulang mingguan, `branch_id`) → **ClassSession** (sesi konkret, `branch_id`).
- **Booking**: status booked/waitlist/attended/cancelled/no_show; `reminder_sent_at`, `reminder_2h_sent_at`.

**Aturan kuota** (`services/booking.py`) — ★ **KUOTA DIPOTONG SAAT HADIR (ubah 18 Agu 2026), bukan saat booking:** booking hanya reservasi (dibatasi ≤ sisa kuota via `quota_available`/`committed_reservations`, TIDAK potong kuota). Kuota dipotong saat **Hadir** atau **Tidak-hadir HANGUS** (`consume_one`); dikembalikan saat **Tidak-hadir TETAP** / **undo** / **sesi dibatalkan** (`refund_one`). `Booking.member_package_id` menandai kuota SUDAH dikonsumsi. Kapasitas penuh → waitlist; slot kosong → promosi auto (cek kuota waiter). Unlimited tak dihitung. "Terisi"/`booked_count` = BOOKED+ATTENDED+NO_SHOW (tetap saat absensi ditandai). Absensi: `AttendanceUpdate.forfeit` (no_show), `BookingRow.consumed`.

**Member & paket dibagi seluruh studio** (satu keanggotaan, booking di cabang mana saja). Cuma jadwal yang per-cabang.

### ⭐ Alur Jadwal & Booking (redesign Fase 1–3, LIVE 18 Agu 2026)

Detail lengkap keputusan di memori `reformer-jadwal-redesign-plan.md`.

**Tiket drop-in (per-datang = prepaid 1 sesi):** per-datang bayar lunas 1× DULU → dapat **tiket** = `MemberPackage` 1 sesi (`services/purchase.create_dropin_ticket`). Booking meng-consume tiket seperti kuota biasa → habis. Mau lagi = beli tiket lagi. Beli: `POST /members/me/dropin-ticket` (self-serve, FROZEN+pending → aktif saat bukti diverifikasi lewat flow verify existing) atau `POST /members/{id}/dropin-ticket` (admin catat). ★ Model lama "bayar saat booking" DIHAPUS.

**Jendela booking berjenjang** (`services/booking.py`, dari `StudioSettings`, zona WITA; staf `bypass_window=True`):
- Bulanan/Private: buka **H-2 20:00** (`bulanan_open_days_before`/`_time`).
- Per-datang: buka **H-1 20:00** (`dropin_open_days_before`/`_time`), wajib punya tiket.
- Tutup: **akhir H-1** (H-0 00:00, `booking_close_days_before`/`_time`).
- Kapasitas maks `default_capacity` (14), target min bulanan `min_bulanan` (10). Semua diatur di Pengaturan.
- `SessionResponse` bawa `booking_state` (not_open/open/full/closed/cancelled) + `slots_remaining` + `opens_at`/`closes_at` + `can_book` + `bulanan_count` + `is_underfilled` (badge "Sepi"). FE MemberSchedule tampilkan pill status + tombol sadar-jendela.

**Sesi sepi & Jadwalkan Ulang:** badge "Sepi" (bulanan < min) di tabel jadwal staf. `POST /schedule/sessions/{id}/reschedule` (pindah tanggal/jam, booking ikut, jendela dihitung ulang, opsional WA personal ke peserta). Tombol di RosterModal.

**Broadcast jadwal WA (Fase 2) — ✅ AKTIF & TERUJI (18 Agu 2026):** `wa_broadcast_enabled=true`, grup = **"Reformer"** (`120363410919667002@g.us`), cron jalan. Tes 18 Agu: grup (6 kelas) & per-datang (personal) sama-sama terkirim. `services/broadcast.py` — `announce_bulanan` (1 pesan ke **grup** WA saat H-2) & `notify_dropin` (personal sebut-nama ke per-datang bertiket, jeda acak 3-7s, saat H-1). WA adapter: `send_whatsapp_group(jid,msg)` + `list_wa_groups()`. `StudioSettings.wa_broadcast_enabled` + `wa_group_bulanan` (JID) + `booking_url`. Endpoint `GET /studio/wa-groups` (owner) + `POST /schedule/broadcast` (uji manual). Cron `scripts/send_broadcasts.py` via `cron_broadcasts.sh` — **NO-OP sampai `wa_broadcast_enabled`=on**. Setting FE: kartu Broadcast WA (toggle + Muat/pilih grup + link + tombol Uji). ★ Aktivasi: Pengaturan → Muat grup → pilih grup member → centang → Simpan → Uji. Log `/var/log/pilates-broadcasts.log`. ★ Kirim grup = risiko banned rendah (1 pesan); per-datang personal & kecil = aman. Nomor gateway = nomor studio khusus (beda dari admin).

★★ **JAM KIRIM ikut Pengaturan** (ubah 18 Agu 2026): cron **tiap 15 menit** (`*/15 * * * *` bulanan & dropin, bukan lagi 12:00 UTC hardcoded). `send_broadcasts.py` punya **gerbang-waktu** `_within_window()`: hanya benar-benar mengirim bila jam WITA sekarang berada di slot 15 menit yang dimulai pada **`bulanan_open_time`** (untuk bulanan) / **`dropin_open_time`** (untuk dropin) — jadi **jam kirim = jam BUKA BOOKING**, satu field mengatur dua-duanya (booking + broadcast). `--force` = kirim manual tanpa cek jam (uji). ★ Setelan saat ini: bulanan H-2 **20:00**, per-datang H-1 **07:00** (user set 07:00 di Pengaturan). Teks Settings.tsx diperjelas: *"Jam 'dibuka' juga = jam kirim broadcast jadwal WA"*. Penerima `notify_dropin` = member **kategori Per-Datang** + **tiket aktif** (`MemberPackage` ACTIVE, non-unlimited, `sessions_remaining>0`) + aktif + punya phone; yang belum bayar/tiket habis TIDAK dikirim.

**Filter jadwal staf:** tab pipeline **Mendatang / Hari ini / Besok·H-1 / Lusa·H-2 / Rentang** — tanggal lewat TAK ditampilkan (riwayat di tab Kehadiran). **Jadwal member** (tab Semua kelas): filter tanggal (from/to) + dropdown instruktur (client-side). ★ Member **TIDAK bisa batalkan booking sepihak** — `cancel_booking` require staf; pembatalan via roster admin.

### Paket Bulanan & Reminder Kedaluwarsa (LIVE 18 Agu 2026)

**Paket bulanan** (`Package.monthly_expiry`, centang di katalog; eksklusif dgn "Masa berlaku (hari)"): kedaluwarsa **akhir bulan** pembayaran; perpanjang sebelum habis → sisa sesi **diakumulasi** & berlaku s/d akhir bulan berikutnya (paket lama CANCELLED); telat → **hangus**. Logika `services/purchase.apply_monthly_expiry` (dipanggil saat paket AKTIF: create_purchase mark_paid ATAU payments verify FROZEN→ACTIVE). Semua tanggal WITA (`purchase.TZ`). **Reminder WA** `reminders.run_expiry_reminders(days_before)`: **H-1** semua paket bermasa-berlaku + **H-7** paket panjang (≥`LONG_PACKAGE_DAYS`=60 hari); `send_reminders --kind expiry|expiry7`; cron 02:00 UTC; idempoten `expiry_reminded_at`/`expiry_reminded_7d_at`.

### Lifecycle Pembayaran & Member (LIVE 18 Agu 2026)

- **Batal tagihan**: `DELETE /payments/{id}` (member: tagihan PENDING sendiri → tiket/paket FROZEN ikut terhapus; staf: apa pun). Tombol "Batalkan tagihan" di dashboard member; **Hapus** (Trash) di tabel Pembayaran admin.
- **Riwayat Pembayaran** di dashboard member (nama paket + pagination).
- **Nomor kuitansi** `Payment.receipt_no` (sequence Postgres, format `KW-<tahun>-<5digit>`) + tombol **Cetak Kuitansi** (Printer) di tabel Pembayaran (kop studio, terbilang, ttd).
- **Status sesi**: `packageStatusLabel/Style`+`isPackageAlmostOut` (≤2→"Sesi hampir habis"); used_up="Sesi habis", expired="Paket expired". Di detail member, dashboard member, & daftar member (`UserBrief.session_status`+`package_expires_at`).
- **Non-aktifkan → Per-Datang** (tombol di detail member) ubah kategori → tab Per-Datang (non-destruktif). ★ **Otomatis kembali ke Bulanan** begitu paket **bulanan** aktif lagi: `apply_monthly_expiry` set `member_category=BULANAN` bila kategori saat ini `per_datang`/null; **Private & Bulanan tidak ditimpa**.
- **Accordion pemakaian sesi** per paket: `GET /members/packages/{mp_id}/usage`.
- **Tombol panah Dari↔Sampai** di filter tanggal (jadwal member "Semua kelas" & staf tab "Rentang"): klik → `Sampai = Dari` (lihat 1 hari).

### Login No. WA, Nomor Unik, Transfer Kas, Import Member (LIVE 18 Agu 2026)

- **Login pakai email ATAU No. WhatsApp**: `UserLogin.identifier` (`AliasChoices('identifier','email')` — kompatibel key lama), `login` pakai `_find_user_by_identifier` (normalisasi nomor Indonesia). FE: field "Email atau No. WhatsApp". Reset password tetap via WA OTP. ★ Nomor jadi kredensial → wajib unik.
- **No. WA tidak boleh kembar**: `services/whatsapp.phone_taken(db, phone, exclude_id)` (normalisasi lintas format). Dipasang di **register**, **create_user**, **update_user** (exclude diri sendiri). FE Profil: tampilkan No. WA.
- **Form Daftar tanpa email** (25 Agu): field Email DIHAPUS dari halaman Daftar; `MemberRegister.email` opsional, `phone` WAJIB; `register_member` buat email placeholder `62xxx@reformeryourbody.com` bila kosong (login tetap by No. WA). Landing header: **tombol "Daftar" dihapus** (desktop + menu mobile), tinggal "Masuk" (CTA daftar lain di badan halaman tetap ada).
- **Transfer antar kas** (`models/finance.AccountTransfer`, tabel `account_transfers`, migrasi `f7a8b9c0d1e2`): pindah uang antar akun — **bukan** laba/rugi, hanya geser saldo. `account_balance` & `_build_ledger` ikut (keluar di asal, masuk di tujuan). Endpoint `GET/POST/DELETE /finance/transfers` (`require_staff`). Laporan (`/finance/report` + `.xlsx`) memuat `transfers` (net TAK berubah). FE: **tab "Transfer"** di Keuangan (daftar + modal catat + hapus) + seksi Transfer di Laporan.
- **Import Member dari Excel** (`services/member_import.py`; migrasi data lama): `GET /members/import/template` (xlsx: kolom baku + contoh + sheet Petunjuk), `POST /members/import/preview` (dry-run: `analyze` validasi + aksi buat/perbarui, TANPA tulis DB), `POST /members/import/commit` (upsert per No. WA + `default_password` Form). Kolom: Nama·No.WA·Email·Kategori·Nama Paket·Sisa Sesi·Unlimited·Tgl Expired·Tgl Bergabung. Membuat **akun** (+email placeholder `62xxx@reformeryourbody.com` bila kosong, password awal seragam) + **1 paket berjalan** (package_id NULL, price 0 → penanda paket migrasi; sisa+expired+unlimited, `refresh_status`). ★ **Idempoten**: dikenali per No. WA; paket migrasi lama (package_id NULL & price 0 & ACTIVE) diganti tiap re-run. FE: tombol **Import Excel** di halaman Orang → modal 3 langkah (unduh template → pratinjau ringkasan+error per baris → impor); upload FormData header `multipart/form-data`. ★ Rencana pakai: 326 member, backup dulu → user kirim Excel → map kolom → pratinjau → commit.

### Menu Bergrup, Roster, Karyawan & Payroll (LIVE 18 Agu 2026)

- **Sidebar back office BERGRUP** (`components/Layout.tsx`): 2 menu langsung (Dashboard, Jadwal) + grup accordion — **Member** (Data Member, Laporan Member, Paket), **Keuangan** (Pembayaran, Transfer/Kas & Pengeluaran, Laporan Keuangan[owner]), **Karyawan**[owner] (Data Karyawan, Payroll), **Pengaturan** (Cabang, Pengguna Sistem[owner], Pengaturan Studio). Grup auto-expand saat rute anaknya aktif (`STAFF_NAV`/`SidebarGroup`/`roleOk`/`pathActive`). Sidebar **member tetap flat** (`MEMBER_NAV`: Dashboard/Jadwal/Riwayat).
- **Roster (RosterModal di StaffSchedule):** (a) dropdown "Tambah member" kini **hanya member ber-kuota** (`has_unlimited || active_sessions_remaining>0`) & belum di sesi; tampilkan sisa. (b) tombol **Jadwalkan Ulang DIHAPUS**. (c) **Batalkan sesi** → panel dengan opsi WA; `POST /schedule/sessions/{id}/cancel?notify=` → `_notify_cancel` kirim WA "sesi DIBATALKAN" ke peserta booked/waitlist. (d) **Staf pendamping**: dropdown (admin tandai absensi pendamping per sesi) `PATCH /schedule/sessions/{id}/assistant`.
- **Modul Karyawan + Payroll** (`models/employee.py` Employee+PayrollEntry, migrasi `c1d2e3f4a5b6`; `endpoints/employees.py` prefix `/employees`, **require_owner** kecuali `/assistants`): Karyawan = entitas HR terpisah (bisa tanpa akun). **Cara bayar** `pay_type` = `monthly` (gaji pokok) | `per_session` (tarif flat/sesi) — kolom `base_salary`/`session_rate` + `assistant_id` di ClassSession (migrasi `d2e3f4a5b6c7`, enum via `postgresql.ENUM`). **Payroll** per periode (YYYY-MM): `POST /employees/payroll/generate` (draft utk karyawan aktif; per_session dihitung **jumlah sesi didampingi × tarif**, note "N sesi × tarif", skip bila 0), `/pay` (→ **Expense kategori 'gaji'** → laba/rugi + buku besar; hapus payroll berbayar → expense ikut hilang), `/{id}` PATCH (draft) & DELETE. **★ pay→expense, tidak dobel-entry.**
- **Data Karyawan FE** (`pages/Karyawan.tsx`, owner): filter **Semua/Bulanan/Pendamping**; tab Pendamping tampilkan kolom **"Sesi <bulan berjalan>"** (jumlah + estimasi ≈ tarif×sesi, WITA); **klik nama pendamping → modal daftar tanggal** sesi (`GET /employees/{id}/sessions?period`). **Payroll FE** (`pages/Payroll.tsx`): pilih bulan, Buat Payroll, Bayar (modal akun+tgl), Hapus. `GET /employees/assistants` (staff, id+nama) utk dropdown roster. SessionResponse bawa `assistant_id`/`assistant_name`.

### Diskon Perpanjangan + Fix Jual Paket Admin (LIVE 18 Agu 2026)

- **★ FIX PENTING — `sell_package` (POST `/members/{id}/purchase`) kini pakai `create_purchase`** (dulu inline, versi lama). Jadi jual paket **oleh admin** akhirnya menerapkan: aturan **bulanan** (GOLD 1 → expired **akhir bulan** + **carryover** sisa), **atribusi pembayaran ke akun** kas/bank, & **update kategori** per_datang→bulanan. `create_purchase` dapat param baru `purchased_at` (backdating tetap didukung). GOLD 1=bulanan(monthly_expiry), GOLD 2=validity 60 hari.
- **Diskon perpanjangan** (`Package.renewal_discount` Rp, migrasi `e3f4a5b6c7d8`): potongan flat saat **admin** jual paket ke member yang **masih pegang paket SAMA yang belum expired** (helper `services/purchase.eligible_renewal_discount` — cocok by `package_id` **ATAU nama sama** case-insensitive, agar member impor ber-package_id NULL juga dapat). Diterapkan otomatis di `sell_package` **bila harga tak di-override manual**. `GET /members/{id}/purchase-quote?package_id` = pratinjau {base_price, renewal_discount, eligible, total}. **Hanya jalur admin**. FE: field **"Diskon perpanjangan"** di katalog Paket + rincian harga di modal Jual Paket. ★ GOLD 1 & GOLD 2 = Rp50.000.
- **Filter member per paket** (halaman Orang): dropdown "Paket" → `GET /members?package_name=` (cocok **case-insensitive** among paket AKTIF). `GET /members/package-names` = daftar nama paket aktif yang dipegang, **dikelompokkan case-insensitive** + jumlah member (mis. "GOLD 1 (229)" menggabung "Gold 1"+"GOLD 1"). ★ data impor casing tak seragam ("Gold 1" vs "GOLD 1", "hut couple") & package_id NULL — filter & diskon sudah menangani via nama, tapi normalisasi nama + tautan katalog masih PR opsional.
- **Upgrade Paket** (`Package.upgrade_price` Rp flat, migrasi `f4a5b6c7d8e9`): harga khusus (mengGANTI harga normal) saat member **yang sudah pernah bayar & belum pegang paket target** naik ke paket itu. Helper `services/purchase.eligible_upgrade` (belum pegang aktif/pending target + ada Payment PAID) & `price_quote` terpadu → `kind` = **renewal** (potongan) | **upgrade** (harga flat) | **normal**. Dipakai di `sell_package` (admin) & `GET /members/{id}/purchase-quote`. **Self-service**: `GET /members/me/upgrade-options` + `POST /members/me/upgrade` (paket FROZEN + tagihan PENDING → aktif setelah admin verifikasi bukti; tiket/sisa lama DIBIARKAN; kategori per_datang→bulanan otomatis saat aktif — `create_purchase` recategorize utk bulanan via apply_monthly_expiry & non-bulanan via cabang activate). FE: field **"Harga upgrade"** di katalog Paket; modal Jual Paket tampilkan rincian (renewal ATAU upgrade); seksi **"Upgrade Paket"** di dashboard member. ★ GOLD 1 upgrade_price = Rp300.000.

### Migrasi 326 member & Bersih Data Uji (21 Agu 2026)

- **Impor 326 member LIVE** — 311 masuk (4 error dilewati). Member impor: email placeholder `62xxx@reformeryourbody.com`, login pakai No. WA, pegang paket "Paket Migrasi"/nama-teks (package_id NULL).
- **Bersih data uji (21 Agu)**: hapus 4 member uji (Indra/Dinda/daffa/Rizal `@gmail.com`) + booking/bayar/paket; hapus semua pengeluaran + transfer uji; reset saldo awal Kas & Bank ke 0. Sisa 307 member (306 impor + **Alifia Dwasty** = member asli daftar-sendiri, dipertahankan). ★ **Owner** `owner@reformeryourbody.id` aman (yg dihapus akun member `rizal@gmail.com`). (22 Agu: hapus lagi 1 akun uji `rizal@gmail.com`/0811111111 yg dibuat ulang saat testing.) ★ Prosedur hapus member: backup `pg_dump` dulu → hapus Booking+Payment+MemberPackage+User by id. Owner tak boleh terhapus.
- **★ Backup harian kini mencakup PILATES**: `/opt/backups/db-backup.sh` ditambah baris `dump_db pilates_db pilates_user pilates_db pilates` (dulu hanya nexisthub+pos). Cron 02:30 harian, retensi 14 hari lokal + MinIO bucket `db-backups/pilates/`. Backup manual pra-hapus: `/opt/backups/pilates_manual_20260821_164352.sql.gz`. Restore: `gunzip -c <file> | docker exec -i pilates_db psql -U pilates_user -d pilates_db`.
- **Normalisasi nama paket + tautan katalog (21 Agu)**: 302 paket member impor ditautkan ke katalog & casing diseragamkan (GOLD 1 236, Hut Couple 37, GOLD 2 16, PREMIUM 13) — `MemberPackage.package_id` di-set + `package_name` = nama katalog. Dibiarkan: 'hut 10 sesi' (4) & 'Tiket Drop-in' (1). Backup pra-ubah `pilates_prelink_20260821_165251.sql.gz`.

### Laporan Member (LIVE 18 Agu 2026)

Menu **Laporan Member** (staf) — TAB + tabel paginasi:
- **Ringkasan**: KPI (aktif/non-aktif/baru bln ini/perlu-perpanjang) + per kategori.
- **Perlu Perpanjang**: `GET /reports/members?within_days` (staf) — coverage paket aktif habis ≤ now+within_days, urut kedaluwarsa + follow-up WA. Retensi/churn.
- **Pendapatan** (OWNER saja): `GET /reports/member-revenue` (`require_owner`) — total LUNAS + jml transaksi + terakhir bayar per member, urut total desc.
- Sisi **member**: **menu Riwayat** tersendiri (`/riwayat`, nav `roles:'member'`; ringkasan Hadir/Tidak-hadir + daftar). `GET /bookings/me/history` = sesi lampau ATAU sudah ditandai hadir/tidak-hadir. Nav item `roles:'member'` tampil di MemberShell saja.

**Keuangan** (`models/finance.py`): `FinancialAccount` (kas/bank + saldo awal) & `Expense` (pengeluaran operasional per kategori). Endpoint `/finance/accounts|expenses|report`. Saldo akun = saldo awal + income LUNAS ter-atribusi + − pengeluaran. Income lunas otomatis masuk akun via **metode** (cash→akun kas, transfer/qris→bank) — `Payment.account_id` diisi saat lunas (`services/finance.resolve_income_account`). Menu FE: **Keuangan** (Pengeluaran + **Transfer** + Akun + **Buku Besar**) & **Laporan** (income/expense/laba-rugi + per-kategori + saldo akun + transfer). ★ Saldo akun kini juga ± **transfer** (masuk/keluar). Tab Pengeluaran & Laporan punya **filter tanggal Dari/Sampai** (default awal bulan→hari ini).

**Buku Besar** (tab di Keuangan): `GET /finance/accounts/{id}/ledger?from&to` (JSON) — mutasi masuk (pembayaran LUNAS ter-atribusi) & keluar (pengeluaran) + saldo berjalan, dihitung dari SELURUH riwayat sejak saldo awal → saldo akhir selalu cocok dgn kartu akun (`_build_ledger`). Saldo awal periode + total masuk/keluar + saldo akhir.

**Ekspor Excel** (`openpyxl`, helper `_new_workbook`/`_xlsx_response`): `GET /finance/accounts/{id}/ledger.xlsx`, `/finance/expenses.xlsx` (ikut filter), `/finance/report.xlsx` (Laba/Rugi). FE unduh via **blob berautentikasi** (bukan link biasa — perlu JWT). Tombol Excel + Cetak.

**Kategori pengeluaran DINAMIS** (`models/finance.ExpenseCategoryDef`, tabel `expense_categories`: key/label/is_active/is_builtin/sort_order): CRUD `/finance/expense-categories`. `Expense.category` kini **String** (key), bukan enum lagi. 8 kategori bawaan (is_builtin) tak bisa hapus/nonaktif — **hanya rename**; non-bawaan yg dipakai expense tak bisa dihapus (nonaktif saja). Validasi kategori aktif saat create/update expense. Label resolusi via `_category_labels(db)` (fallback `CATEGORY_LABEL` → key). FE: dropdown kategori dari API + modal **Kelola Kategori** (tambah/ubah-nama/nonaktif/hapus, tombol ✓ Simpan). ★ Migrasi konversi kolom enum→varchar: `ALTER COLUMN category TYPE varchar USING lower(category::text)` lalu `DROP TYPE expensecategory`.

**Riwayat edit pengeluaran** (`models/finance.ExpenseEdit`, tabel `expense_edits`): tiap `PATCH /finance/expenses/{id}` mencatat editor (nama+id, denormalisasi), waktu, & ringkasan **sebelum→sesudah** per field. `GET /finance/expenses/{id}/history`; `ExpenseRow.edit_count` → badge. UI Keuangan: tombol **Ubah** + **Riwayat** (timeline) per baris.

**Foto profil** (`users.avatar_path`): `POST/DELETE /auth/me/avatar` (unggah/hapus sendiri) & `GET /auth/users/{id}/avatar` (**publik** utk tag `<img>`). File di volume `pilates_uploads/avatars`. Komponen FE `Avatar` (foto / fallback inisial) di Profil & header; cache-bust pakai `updated_at`. `AuthContext.refreshUser()` sinkron header.

**Notif in-app (lonceng)**: `GET /notifications` (staf) agregasi = bukti-transfer perlu-verifikasi + pembayaran menunggu + booking 24 jam + member baru 48 jam. FE `NotificationBell` di topbar: badge unread via localStorage last-seen, polling 60 dtk, **bunyi "ding"** (Web Audio) saat ada item lebih baru.

**Auto-refresh & idle-logout** (`context/AuthContext`, aktif saat login): invalidate semua React-Query tiap **15 menit**; **auto-logout** bila **12 jam** tanpa aktivitas (mouse/keyboard/scroll/touch).

**Lupa password (WA OTP)** (`models/password_reset.PasswordResetOTP`, tabel `password_reset_otps`): kode 6 digit **sha256**, TTL 10 mnt, maks 5 percobaan, sekali pakai. `POST /auth/forgot-password` (cari user by nomor/email → `_find_user_by_identifier` pakai `normalize_phone`; respons **generik** anti-enumerasi; log hasil kirim WA) & `POST /auth/reset-password`. Admin cadangan: `POST /members/{id}/set-password` (tombol 🔑 di detail member). FE: halaman `/lupa-password` 2 langkah + link di Login. ★ **OTP dikirim ke nomor yang terdaftar di AKUN yang di-reset** (bukan ke HP admin) — utk uji, reset akun yang nomornya bisa kamu buka.

**Peran & akses (RBAC sederhana)**: peran tetap `owner/admin/instructor/member` (`require_staff`=owner+admin, `require_owner`=owner). ★ **Admin bisa ENTRY keuangan** (Pengeluaran + Akun Kas/Bank) tapi **Laporan, Buku Besar, & KPI Pendapatan = OWNER saja** — guard `require_owner` di `/finance/report(.xlsx)` & `/finance/accounts/{id}/ledger(.xlsx)`; `/reports/dashboard` set `revenue_month=null` utk non-owner. FE: `isOwner()` + `navFor(role)` di `Layout` (nav sadar-peran: item `roles:'owner'`), Keuangan sembunyikan tab Buku Besar dari admin, Dashboard sembunyikan KPI Pendapatan, route `/laporan` & `/pengguna` owner-only. Tab "Akun" (dgn saldo) masih terlihat admin (perlu utk pilih akun saat entry). **Pengguna Sistem** (`/pengguna`, owner-only, `GET /members/staff`): buat/edit **Admin & Instruktur** (nama/email-unik/WA/peran), reset password, aktif/nonaktif. `UserUpdate` + `email`&`role` (pengaman: owner/diri-sendiri tak bisa ganti peran, tak bisa jadi owner via `_can_manage_role`). Instruktur juga masih dikelola via tab di halaman Member.

## 5. Reminder WhatsApp

- Dua jenis: **h1** (H-1, semua kelas besok) & **h2** (±2 jam sebelum kelas mulai; `REMINDER_HOURS_BEFORE`).
- Cron (host `crontab -l`):
  ```
  0 9 * * *  /opt/pilates/scripts/cron_reminders.sh h1     # 17:00 WITA
  */15 * * * * /opt/pilates/scripts/cron_reminders.sh h2    # tiap 15 menit
  0 12 * * * /opt/pilates/scripts/cron_broadcasts.sh bulanan # 20:00 WITA — post grup H-2 (no-op sampai diaktifkan)
  0 12 * * * /opt/pilates/scripts/cron_broadcasts.sh dropin  # 20:00 WITA — personal per-datang H-1
  ```
- Log: `/var/log/pilates-reminders.log`. Kirim manual: `docker compose -f docker-compose.prod.yml exec -T backend python -m scripts.send_reminders --kind h1`.
- **gowa multi-akun**: buat device via `POST /devices` (bukan /api/devices), semua op pakai header `X-Device-Id`, kirim `POST /send/message`. Adapter (`services/whatsapp.py`) **auto-deteksi** device yang `logged_in` (`WA_DEVICE_ID=auto`). ★ **`resolve_device_id` TIDAK lagi cache id device** (25 Agu) — dulu cache id lama → `DEVICE_NOT_FOUND` setelah gateway re-pair (id UUID berubah tiap scan). Kini selalu ambil device logged_in terbaru dari `/devices`.
- **★ Diagnosa error gateway (25 Agu):** `DEVICE_NOT_FOUND` = id device lama ter-cache (sudah difix); `"you're not participating in that group"` = nomor gateway BUKAN anggota `wa_group_bulanan` tersimpan (grup stale / nomor ganti) → **Muat grup → pilih grup yg nomor gateway ADA di dalamnya → Simpan**; `"server returned error 401"` = sesi baru pair (belum sinkron, tunggu 1-2 mnt) ATAU nomor tak berhak kirim di grup itu. ★ AKAR MASALAH operasional: gateway sempat di-scan ulang berkali-kali dgn nomor BERBEDA (628156225000 ↔ 6287837763692), 25 re-pair/2 jam → sesi flapping. **SOLUSI: kunci 1 nomor + 1 HP stabil, scan SEKALI, jangan scan ulang.** Cek stabil: `docker compose ... logs whatsapp --since 10m | grep -cE "LOGIN_SUCCESS|REMOTE_LOGOUT"` (harus 0).
- **Ganti nomor WA studio:** buka wa.reformeryourbody.com (login basic-auth) → Devices → buat/pilih device → scan QR nomor baru. Auto-deteksi otomatis ikut.
- Zona = **WITA** (Asia/Makassar); label pesan via `settings.TZ_LABEL`. Reminder skip member tanpa nomor HP. Gateway kini pakai **nomor studio khusus** (beda dari admin) — user sudah menyiapkan 2 nomor terpisah (18 Agu 2026).
- **Broadcast jadwal (Fase 2):** lihat blok "Alur Jadwal & Booking" di §4. Cron sudah terpasang tapi no-op sampai `wa_broadcast_enabled` diaktifkan di Pengaturan. Log `/var/log/pilates-broadcasts.log`.
- **Notif bukti bayar ke admin** (saat member upload bukti): kirim ke `StudioSettings.admin_whatsapp` (fallback owner). ★ Bila admin_whatsapp = nomor gateway (nomor SAMA) → WA anggap **pesan-ke-diri-sendiri**, tak ada notif/bunyi. Nomor gateway **harus beda** dari admin (pakai nomor studio khusus). Kirim ke member (reminder/OTP) tak kena masalah ini karena beda nomor.

## 6. Environment (`.env`)

`APP_NAME, ENVIRONMENT, DEBUG, SECRET_KEY, POSTGRES_*, TIMEZONE=Asia/Makassar`,
`WA_ENABLED=true, WA_GATEWAY_URL=http://whatsapp:3000, WA_BASIC_AUTH=reformer:…, WA_DEVICE_ID=auto, REMINDER_HOUR_LOCAL=17, REMINDER_HOURS_BEFORE=2, STUDIO_WA_SIGNATURE`.
`.env.example` ada sebagai template. `.env` & `brand/` & `alembic` migrasi ikut repo (kecuali .env).

## 7. Catatan / Pelajaran

- Enum SQLAlchemy menyimpan **NAMA** (uppercase) di Postgres → migrasi enum pakai label uppercase (`create_type=False` + `checkfirst`).
- `EmailStr` menolak domain `.local`.
- `psql -c "stmt1; stmt2;"` = satu transaksi; 1 error → semua rollback.
- Sticky header butuh konten cukup panjang utk terlihat (bukan bug).
- Coolify Traefik: label container inert; routing via **file dynamic**, cert via **DNS-01 Hostinger**.
- **OTP lupa-password** dikirim ke nomor di **akun yang di-reset**, bukan HP admin (bukan bug — uji pakai akun bernomor yang bisa kamu buka). Gateway balas "terkirim" walau nomor bukan WA asli.
- Tes HTTP dari host `localhost:8000` kena proxy Coolify ("Not found") — uji dari dalam container: `docker exec pilates_backend python3 -c "..."`.
- `get_db` **commit on success** (rollback on error); endpoint cukup `db.flush()`.
- ★ **ZONA WAKTU**: container OS = **UTC**, tapi studio **WITA** (UTC+8). `date.today()` (backend) & `toISOString().slice(0,10)` (frontend) → salah 1 hari di dekat tengah malam WITA. Selalu pakai `app.services.booking.today_local()` (backend) & `Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar'})` (frontend) untuk "hari ini". Sudah diterapkan di Jadwal, Keuangan, Laporan.
- `from x import Y` **lokal di dalam fungsi** yang sudah memakai `Y` (impor modul-level) → `UnboundLocalError`: Python menandai `Y` lokal utk SELURUH fungsi. Jangan re-import di dalam fungsi bila sudah ada di atas.

## 8. Belum Dikerjakan / Ide Lanjut

- **Payment gateway asli** (QRIS/Midtrans/Xendit) — member bayar online otomatis (sekarang manual/konfirmasi staf). Butuh API key dari user.
- **Strategi jualan/peluncuran** (ICP, momen aha, paket pembuka) — belum dibahas.
- Reminder: quiet-hours utk h2 (kelas subuh), reminder saat naik dari waitlist, konfirmasi booking via WA.
- Nomor WhatsApp khusus studio (skrg pakai nomor pribadi).

## 9. Git

- Remote: `github.com/propertyhub6969-hue/pilates`, branch `main`, helper `store` aktif.
- **Push SUDAH jalan** (token valid tersimpan) — commit & push tiap tugas beres. Bila token expired lagi:
  ```bash
  echo "https://propertyhub6969-hue:GHP_TOKEN_BARU@github.com" > /root/.git-credentials
  cd /opt/pilates && git push -u origin main
  ```

## 10. Checklist Mulai Produksi

1. Ganti password owner.
2. Pengaturan: alamat, telepon, tagline, harga drop-in.
3. Katalog Paket: sesuaikan (2 paket contoh masih ada).
4. Cabang: sesuaikan/ tambah.
5. Daftarkan instruktur & member (atau member daftar sendiri via web).
6. Buat Template kelas → Generate jadwal.
