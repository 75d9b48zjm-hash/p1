# KasUMKM — Pembukuan Sederhana untuk UMKM Indonesia

## Original Problem Statement
Build a modern multi-tenant bookkeeping SaaS for Indonesian MSMEs (UMKM). Two roles: Admin/Bookkeeper managing many MSMEs, and MSME owners recording money in/out. Philosophy: "as easy as recording in a chat, automatically organized into useful financial reports". Strict tenant isolation, transaction review workflow, simple reports, insights, receipts, exports, audit log, responsive UI in Bahasa Indonesia.

## User Choices
- UI language: Bahasa Indonesia
- Auth: JWT email/password (register, login, logout, forgot/reset password, RBAC, tenant separation)
- Receipts: Emergent object storage (JPG/PNG/PDF)
- Exports: CSV + PDF
- Insights: rule-based from transaction data

## Architecture
- Backend: FastAPI (`/app/backend`): `server.py` (routes), `auth.py` (JWT + bcrypt + RBAC + tenant guard), `storage.py` (object storage), `exports.py` (CSV + reportlab PDF), `seed.py` (demo data), `db.py`
- Frontend: React + Tailwind + shadcn/ui + recharts (`/app/frontend/src`): `context/AuthContext`, `components/Layout` (sidebar + mobile bottom nav), reusable `views/` (Dashboard, Transactions, Reports, Insights, Categories) shared between admin and MSME pages
- DB: MongoDB collections `users, businesses, transactions, categories, receipts, audit_logs, notifications, password_reset_tokens, login_attempts` — uuid string `_id`, every record carries `business_id`

## Personas
1. Admin/Bookkeeper — reviews and corrects transactions across all UMKM, creates UMKM accounts, monitors pending queue.
2. MSME owner — records money in/out in <20 seconds, uploads receipts, checks balance and simple reports.

## Core requirements (static)
Tenant isolation at backend, review workflow (pending → approved / needs_correction), only approved transactions count in reports, IDR formatting, simple non-accounting language, responsive.

## Implemented (2026-06)
- Auth: register (creates business + default categories), login with brute-force lockout, logout, forgot/reset password (dev token), change password, RBAC route guards
- Admin: dashboard (5 metric cards + UMKM table with status Aktif/Perlu Perhatian/Tidak Ada Aktivitas), UMKM CRUD + owner account creation, per-business workspace tabs (dashboard/transaksi/laporan/insight/kategori/profil), global review queue, reports, insights, categories, audit logs, settings
- MSME: dashboard (saldo, uang masuk/keluar/laba, 3 charts, recent transactions, quick actions), transaction CRUD with receipt upload, filters/search/sort, reports, insights, settings (business profile, account, notifications, password, categories)
- Reports: Laba/Rugi, Arus Kas, ringkasan uang masuk & keluar; daily/weekly/monthly/custom range; CSV + PDF export
- Receipts via object storage; audit log; notifications; demo data (5 UMKM + 4 months transactions)

## Implemented (2026-02)
- **Mode Cepat + Saran Kategori Otomatis (Cockpit Kategorisasi)** — reason: user is a student available only after 4pm, wants zero-cost async workflow (Rp 0):
  - Backend: `POST /api/transactions` accepts empty category → defaults to sentinel `"Belum Dikategorikan"` (auto-created per business as needed); `DEFAULT_CATEGORIES` in `auth.py` now includes `UNCATEGORIZED` for both income & expense
  - Backend: `GET /api/categories/suggest?type=&text=&business_id=` — rule-based (last 500 txs of that biz+type, token overlap on description, excludes UNCATEGORIZED); returns `{suggestion, confidence, match_score}` or null
  - Backend: `POST /api/transactions/{id}/review` now accepts optional `category` + `description` — updates during approval, writes `category_changed` audit log
  - Frontend `TransactionDialog.jsx`: `quickMode` toggle (default ON for MSME), hides category select & payment method when active, uses `useAuth` to detect role, debounced (400ms) suggestion chip `data-testid=suggestion-chip` from description → tap to apply → `applied-category` chip
  - Frontend `pages/AdminCockpit.jsx` (new) at `/admin/kategorisasi`: inbox-style two-panel — pending queue on left, detail + suggestion + category pills on right; keyboard shortcuts: **1-9** pick chip, **Enter** approve, **↑↓** navigate; optimistic removal after approval
  - Sidebar `ADMIN_NAV` now includes `Cockpit` (Zap icon) between UMKM and Transaksi; `AdminDashboard` pending banner has "Buka Cockpit" + "Tinjau manual" buttons
  - Tests: `/app/backend/tests/test_quickmode_cockpit.py` (9 pytest) — all pass; iteration_3.json 100%
  - Zero-cost strategy: MongoDB Atlas Free (512MB), Vercel/Netlify Free (frontend), Render/Railway Free (backend, UptimeRobot to prevent sleep), Cloudinary/B2 Free (receipts) → ~Rp 0/bulan for up to ~100 UMKM

## Implemented (2026-08)
- **Foto Nota Pintar (OCR gratis, Tesseract)** — user chose free Option A (may upgrade to LLM Vision later):
  - `/app/backend/ocr.py`: Tesseract 5.3 (ind+eng), preprocessing (grayscale/upscale/autocontrast), amount parser (prioritizes TOTAL/JUMLAH lines, skips SUBTOTAL, handles Rp 25.000 / 12.500,00 formats), date parser (dd/mm/yyyy, yyyy-mm-dd, "15 Januari 2026")
  - `POST /api/receipts/{id}/extract` (tenant-guarded, threadpool, PDF → 400, OCR fail → 422)
  - TransactionDialog auto-fills amount & date after JPG/PNG upload, "Membaca nota..." state, ocr-hint text
  - System deps recorded in `.emergent/system_deps.txt` (tesseract-ocr, tesseract-ocr-ind)
- **Ingatkan Otomatis (inactivity reminder)** — in-app option (chosen by user):
  - `GET /api/reminders/status` (threshold 3 days since last recorded transaction); creates in-app notification kind `inactivity_reminder` max once/day (idempotent)
  - Blue banner `inactivity-reminder-banner` on MSME dashboard with "Catat Sekarang" button
- Tested: iteration_2.json — backend 9/9, frontend 4/4 PASS. Pytest regression suite at `/app/backend/tests/test_new_features.py`
- Note: kedai.nusantara demo transactions intentionally backdated 5 days so reminder banner is demo-able

## Implemented (2026-06, deploy gratis tanpa kartu kredit)
- User tidak punya kartu kredit → Render tidak dipakai. Stack final: **MongoDB Atlas + Koyeb (backend) + Vercel (frontend)**
- `/app/backend/storage.py` di-refactor jadi multi-provider dengan API sama (`init_storage/put_object/get_object/delete_object`):
  - `cloudinary` (kalau CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET ada) — simpan via SDK, `path` = secure_url
  - `mongo` (DEFAULT) — GridFS collection `receipt_files` di MongoDB Atlas, tanpa layanan tambahan
  - `emergent` — hanya kalau `STORAGE_PROVIDER=emergent` (preview lama)
  - `get_object` mengenali path berupa URL http(s) → tetap bisa baca nota lama/Cloudinary
- `cloudinary==1.46.2` ditambahkan (requirements.txt + requirements.prod.txt)
- File deploy baru: `/app/backend/Dockerfile` (python3.11-slim + tesseract-ocr-ind, port dari `$PORT`), `/app/backend/requirements.prod.txt` (ramping, tanpa emergentintegrations/litellm), `/app/backend/.dockerignore`, `/app/frontend/vercel.json` (SPA rewrite), `/app/DEPLOY.md` (panduan langkah demi langkah Bahasa Indonesia)
- Diuji manual (curl, provider mongo/GridFS): upload nota 200, download 200 (2098 bytes), OCR extract `{amount:150000, date:2026-08-30}`

## Implemented (2026-06, versi Excel / non-aplikasi)
- User minta template pembukuan berbasis Excel (tanpa macro) sebagai pelengkap aplikasi web. Aplikasi web TIDAK diubah.
- Generator: `/app/tools/generate_excel_templates.py` (openpyxl) → jalankan `python3 tools/generate_excel_templates.py`
- Output di `/app/excel_templates/`:
  - `Pembukuan-Template.xlsx` (kosong, untuk digandakan per UMKM)
  - `Pembukuan-TokoMaju-Contoh.xlsx` (terisi ±141 transaksi Mei–Jun 2026)
  - `Rekap-Admin.xlsx` (Salin Data 2000 baris, Rekap 20 UMKM, Tagihan Jasa)
  - `Panduan-Pemakaian.md`
- Sheet per UMKM: Petunjuk, Profil Usaha, Transaksi (500 baris, dropdown, kolom bantu J=yyyy-mm, conditional formatting kuning utk kategori kosong), Dashboard (pilih bulan/tahun + 3 grafik), Laba Rugi (siap PDF), Arus Kas Harian (saldo berjalan), Kategori, Cek Data, Contoh Pengisian
- Meniru Mode Cepat: kategori/metode/status boleh kosong → baris kuning → admin melengkapi lewat dropdown
- Diverifikasi dengan LibreOffice headless (recalc + render PDF→PNG): semua rumus SUMIFS/COUNTIFS/saldo berjalan/rekap/tagihan menghasilkan angka benar, 0 sel error, grafik tampil, format Rupiah & tanggal benar, nama bulan Bahasa Indonesia (CHOOSE)

## Implemented (2026-06, tampilan Excel dirombak + grafik indikator)
- Permintaan user: "buat tampilannya lebih menarik, modern, simple, rapi, praktis, juga berikan grafik sebagai indikator". Pilihan user: yang dipercantik = **file Excel**; dipakai **campur HP + laptop**; indikator = **kartu KPI + panah vs bulan lalu, tren garis, top kategori pengeluaran**; gaya = **bersih-profesional (agen bebas memilih detail)**; brand = KasUMKM.
- `/app/tools/generate_excel_templates.py` ditulis ulang (design tokens NAVY/GREEN/RED/BLUE/AMBER/SLATE, helper `no_grid/page_head/section/card/mini/block/month_picker/table_head`), semua sheet: gridline dimatikan, judul eyebrow + judul besar, tabel zebra, border tipis.
- Sheet baru **Data Grafik** (tab abu, terproteksi) = sumber angka kartu & grafik: ringkasan bulan ini vs bulan lalu, tabel 12 bulan, pengeluaran per kategori (kolom "nilai unik" untuk tie-break LARGE), Top 5 + "Lainnya & belum dikategorikan" (= total keluar − top5, jadi donat = 100% pengeluaran).
- Dashboard UMKM baru: kendali Bulan `C6` / Tahun `F6`, kunci bulan `C8`, kunci bulan lalu `F8` (baris 8 disembunyikan, juga berisi cermin H8:O8 supaya conditional formatting tidak lintas-sheet → aman di Google Sheets); 4 kartu KPI 2×2 (Uang Masuk/Keluar/Laba/Saldo) dengan delta `▲/▼ x% vs bulan lalu` (warna dibalik untuk Uang Keluar), lampu status ● SEHAT/IMBANG/WASPADA, Ringkasan Cepat 2×2, Top 5 pengeluaran dengan balok `█` (REPT) supaya tetap terbaca di HP.
- 3 grafik bawaan (tanpa macro): BarChart 12 bulan (hijau/merah), LineChart tren harian (sumber Arus Kas kolom H = nomor hari), DoughnutChart komposisi pengeluaran (label persen saja, warna per slice).
- Laba Rugi: kolom "% dari Pemasukan", total ber-tint hijau/merah, baris LABA/RUGI BERSIH navy, kotak Catatan Admin (tidak terkunci).
- Arus Kas Harian: kolom Grafik Masuk/Keluar (balok █ hijau/merah), saldo minus otomatis merah, kolom bantu Hari.
- Rekap-Admin: Rekap dapat 4 kartu (total masuk/keluar/laba gabungan + jumlah UMKM perlu diingatkan, delta vs bulan lalu dari helper H8:J8), tabel detail pindah ke baris 19-39 + total baris 41, kolom **Status** ● hijau/kuning/merah, kolom **Grafik Laba** (█), 2 bar chart (masuk vs keluar per UMKM, laba per UMKM). Tagihan Jasa: kartu Total Pendapatan & Belum Dibayar, CF status bayar.
- Semua referensi sel lintas-sheet diperbarui (Profil Usaha `C7`/`C14`, Kategori kolom B/C/D/E/F/G baris 7+, Dashboard `C6/F6/C8`).
- Verifikasi: LibreOffice headless recalc (`--convert-to xlsx`) → **0 sel error** di 3 file; angka dicek silang (Laba Rugi = Dashboard = Arus Kas = Rp 12.740.000 laba Juni; top5 + Lainnya = total keluar Rp 7.604.000); render PDF→PNG untuk cek visual; endpoint `/api/excel/list` + 4 download → 200 dengan ukuran file terbaru.
- `Panduan-Pemakaian.md` ditambah bagian **D. Cara baca Dashboard** (tabel arti kartu/panah/lampu/balok/grafik) dan penjelasan sheet Data Grafik.

## Implemented (2026-06, PIVOT: Aplikasi web → Alat Pembukuan Pribadi TANPA LOGIN)
- Permintaan user: ubah aplikasi web dari SaaS multi-tenant (admin + login UMKM + approval) menjadi **alat kerja pribadi satu orang pembukuan tanpa login**. User input data setiap UMKM sendiri, lalu kirim hasil ke klien via screenshot dashboard atau file Excel.
- **Tanpa login**: `auth.py` `get_current_user()` sekarang selalu mengembalikan admin ter-seed (ADMIN_EMAIL) tanpa token. Semua endpoint bisa dipanggil tanpa Authorization. Halaman login/register/reset/cockpit dihapus dari frontend.
- **Tanpa approval**: transaksi yang dibuat langsung berstatus `approved` (jalur admin). Startup migration `db.transactions.update_many(status!=approved → approved)` (idempotent) supaya semua data lama ikut terhitung. UI status/approve/reject/pending banner dihapus.
- **Manajemen klien**: `POST /api/businesses` kini pakai `BusinessInput` (tanpa akun/email/password); tambah `DELETE /api/businesses/{id}` (soft delete + transaksinya).
- **Export Excel sederhana**: `GET /api/businesses/{id}/export` → `excel_export.build_business_excel` menghasilkan .xlsx: sheet **Ringkasan** (KPI saldo/masuk/keluar/laba/saldo akhir + BarChart 6 bulan) + sheet **Transaksi** (tabel zebra). Tombol di workspace header (`export-excel-button`) & dashboard (`quick-export-excel`).
- **Dashboard enak di-screenshot**: header gelap (`dashboard-header`) berisi nama UMKM + periode + Saldo Saat Ini, lalu 4 kartu KPI + 3 grafik.
- **Frontend baru**: `App.js` hanya 2 route — `/` (AdminBusinesses = daftar klien) & `/umkm/:businessId` (AdminBusinessDetail = workspace 6 tab). `AuthContext` statik (admin, tanpa token). `Layout` nav = Klien UMKM + link Template Excel (buka `/api/excel/list`), tanpa logout/notifikasi. `TransactionDialog` disederhanakan (kategori opsional, tanpa Mode Cepat/msme). `TransactionsView` tanpa kolom status/approve/reject. File mati dihapus: Login/Register/PasswordPages/MsmePages/AdminCockpit/AdminDashboard/AdminPages/AuditLogs/Settings/BusinessPicker.
- Template Excel offline lama TETAP ada & bisa diunduh (`/api/excel/*`) — tidak diubah.
- Diuji: iteration_4.json — frontend 100% (12 flow: no-login home, tambah/hapus klien tanpa field login, workspace 6 tab, dashboard+grafik, catat cepat kategori kosong, tabel tanpa status, Export Excel HTTP 200 xlsx). Backend flow diverifikasi via curl (list/dashboard/create/export/delete) + xlsx valid (2 sheet + chart).

## Backlog
- P1 (Excel): sheet "Rekap WhatsApp" di `Rekap-Admin.xlsx` — teks laporan harian/bulanan siap copy-paste ke klien
- P2 (Excel): landing page publik untuk menawarkan jasa pembukuan + tombol unduh template
- P1: notification read state per user, admin ability to disable MSME category management, email delivery for reset link (Resend)
- P1 (refactor): split server.py (833 lines) into routers (transactions/receipts/reminders/reports)
- P2: upgrade OCR to LLM Vision (Emergent LLM key) if user wants higher accuracy, AI financial assistant, invoices, inventory, WhatsApp reminders, subscription payments, tax estimates

## Implemented (2026-07, PIVOT Tahap 1: Aplikasi web online -> Alat OFFLINE 100% di komputer)
- Permintaan user: pakai aplikasi 100% offline, dobel-klik shortcut di komputer Windows, data tersimpan lokal di 1 komputer. Tahap 1 = ubah jadi aplikasi client-side murni + hapus semua fitur online. (Tahap 2 = bungkus Electron .exe, ditunda atas permintaan user.)
- **Arsitektur baru: TANPA backend/MongoDB.** Semua logika + data pindah ke frontend (React). Data disimpan di IndexedDB via localforage (instance name "kasumkm").
  - `frontend/src/lib/store.js`: penyimpanan (getAll/setAll businesses|categories|transactions), uuid (crypto.randomUUID), helper hitung (monthBounds, shiftMonth, monthLabel, dayBefore, approvedTotals, byCategory), DEFAULT_CATEGORIES, UNCATEGORIZED.
  - `frontend/src/lib/api.js` DITULIS ULANG jadi router LOKAL meniru axios ({data}) untuk semua endpoint yang dipakai UI: businesses CRUD, categories CRUD + suggest, transactions CRUD, dashboard/business, reports, insights. Semua logika agregasi backend direplikasi persis. `downloadFile` kini membuat file di browser. Export `apiError`, `BACKEND_URL=""`, `API=""` (kompat).
  - `frontend/src/lib/exporters.js`: Excel via **exceljs** (sheet Ringkasan KPI + 6 bulan + sheet Transaksi zebra; tanpa chart karena exceljs tak dukung chart), CSV (transaksi & laporan, format sama exports.py), PDF via **jspdf + jspdf-autotable**.
- **Fitur online DIHAPUS:**
  - Foto Nota + OCR (Tesseract) dihapus total dari `TransactionDialog.jsx` (state/fungsi/UI upload & scan) dan indikator/tombol nota di `TransactionsView.jsx`.
  - Link "Template Excel" (buka /api/excel/list) dihapus dari `Layout.jsx` (desktop + mobile) + import BACKEND_URL.
  - Google Fonts (Inter/Plus Jakarta Sans/JetBrains Mono via CDN) diganti font BUNDEL LOKAL `@fontsource/plus-jakarta-sans` + `@fontsource/jetbrains-mono` (diimpor di `index.js`); `@import` Google dihapus dari `index.css`.
  - Skrip analitik Emergent (`assets.emergent.sh/scripts/emergent-main.js`) + blok PostHog (`ap.emergent.sh`) dihapus dari `public/index.html`; title -> "KasUMKM — Pembukuan UMKM".
- **Data mulai KOSONG** (tidak ada seed demo). Default kategori dibuat otomatis saat UMKM baru ditambahkan.
- Backend FastAPI + MongoDB masih ada di repo tapi TIDAK DIPAKAI lagi oleh aplikasi (akan dilepas saat packaging Electron).
- Diverifikasi (Playwright manual oleh main agent): tambah UMKM -> persisten setelah reload (IndexedDB) -> buka workspace -> catat pemasukan Rp250.000 -> Saldo Rp1.250.000 (saldo awal 1.000.000 + 250.000), Uang Masuk Rp250.000, grafik tampil. Lint bersih, webpack compiled successfully.
- Backlog: Tahap 2 = Electron wrapper + electron-builder untuk installer Windows (.exe + shortcut). Opsi: ekspor Excel dengan chart (butuh pendekatan lain karena exceljs tak dukung chart).
