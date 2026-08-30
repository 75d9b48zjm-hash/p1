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

## Backlog
- P1: notification read state per user, admin ability to disable MSME category management, email delivery for reset link (Resend)
- P1 (refactor): split server.py (833 lines) into routers (transactions/receipts/reminders/reports)
- P2: upgrade OCR to LLM Vision (Emergent LLM key) if user wants higher accuracy, AI financial assistant, invoices, inventory, WhatsApp reminders, subscription payments, tax estimates
