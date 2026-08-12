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

## Backlog
- P1: notification read state per user, admin ability to disable MSME category management, email delivery for reset link (Resend)
- P2: OCR receipt reading, AI financial assistant, invoices, inventory, WhatsApp reminders, subscription payments, tax estimates
