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

**Aturan kuota** (`services/booking.py`): booking **menahan** 1 kuota → check-in mengonsumsi → batal **tepat waktu** (> `cancellation_window_hours` cabang) mengembalikan → no-show/telat menghanguskan. Kapasitas penuh → waitlist; slot kosong → promosi otomatis. Unlimited tak di-decrement.

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

**Broadcast jadwal WA (Fase 2) — ✅ AKTIF & TERUJI (18 Agu 2026):** `wa_broadcast_enabled=true`, grup = **"Reformer"** (`120363410919667002@g.us`), cron jalan. Tes 18 Agu: grup (6 kelas) & per-datang (personal) sama-sama terkirim. `services/broadcast.py` — `announce_bulanan` (1 pesan ke **grup** WA saat H-2) & `notify_dropin` (personal sebut-nama ke per-datang bertiket, jeda acak 3-7s, saat H-1). WA adapter: `send_whatsapp_group(jid,msg)` + `list_wa_groups()`. `StudioSettings.wa_broadcast_enabled` + `wa_group_bulanan` (JID) + `booking_url`. Endpoint `GET /studio/wa-groups` (owner) + `POST /schedule/broadcast` (uji manual). Cron `scripts/send_broadcasts.py` via `cron_broadcasts.sh` @ **12:00 UTC (=20:00 WITA)** utk bulanan+dropin — **NO-OP sampai `wa_broadcast_enabled`=on**. Setting FE: kartu Broadcast WA (toggle + Muat/pilih grup + link + tombol Uji). ★ Aktivasi: Pengaturan → Muat grup → pilih grup member → centang → Simpan → Uji. Log `/var/log/pilates-broadcasts.log`. ★ Kirim grup = risiko banned rendah (1 pesan); per-datang personal & kecil = aman. Nomor gateway = nomor studio khusus (beda dari admin).

**Filter jadwal staf:** tab pipeline **Mendatang / Hari ini / Besok·H-1 / Lusa·H-2 / Rentang** — tanggal lewat TAK ditampilkan (riwayat di tab Kehadiran).

**Keuangan** (`models/finance.py`): `FinancialAccount` (kas/bank + saldo awal) & `Expense` (pengeluaran operasional per kategori). Endpoint `/finance/accounts|expenses|report`. Saldo akun = saldo awal + income LUNAS ter-atribusi + − pengeluaran. Income lunas otomatis masuk akun via **metode** (cash→akun kas, transfer/qris→bank) — `Payment.account_id` diisi saat lunas (`services/finance.resolve_income_account`). Menu FE: **Keuangan** (Pengeluaran + Akun + **Buku Besar**) & **Laporan** (income/expense/laba-rugi + per-kategori + saldo akun). Tab Pengeluaran & Laporan punya **filter tanggal Dari/Sampai** (default awal bulan→hari ini).

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
- **gowa multi-akun**: buat device via `POST /devices` (bukan /api/devices), semua op pakai header `X-Device-Id`, kirim `POST /send/message`. Adapter (`services/whatsapp.py`) **auto-deteksi** device yang `logged_in` (`WA_DEVICE_ID=auto`), jadi tahan re-scan.
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
