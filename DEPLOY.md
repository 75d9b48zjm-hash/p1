# Panduan Deploy KasUMKM — 100% Gratis, Tanpa Kartu Kredit

Stack: **MongoDB Atlas** (database) + **Koyeb** (backend FastAPI) + **Vercel** (frontend React).
Penyimpanan foto nota: **MongoDB GridFS** (default, tanpa layanan tambahan) atau **Cloudinary** (opsional).

---

## Langkah 1 — Database: MongoDB Atlas (gratis M0)

1. Daftar di https://cloud.mongodb.com → Create Cluster → pilih **M0 Free**.
2. Menu **Database Access** → Add New Database User (catat username & password).
3. Menu **Network Access** → Add IP Address → **0.0.0.0/0** (Allow access from anywhere).
4. Klik **Connect → Drivers** → copy connection string, lalu ganti `<password>`:

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

Itulah nilai untuk `MONGO_URL`.

> Catatan: foto nota disimpan di GridFS pada database yang sama. Kuota Atlas gratis 512 MB,
> cukup untuk ribuan foto nota ukuran biasa. Kalau mau lebih lega, pakai Cloudinary (Langkah 4).

---

## Langkah 2 — Backend: Koyeb (gratis, tanpa kartu, tidak tidur)

1. Push kode ke GitHub (pakai tombol **Save to GitHub** di Emergent).
2. Daftar di https://www.koyeb.com (login pakai GitHub).
3. **Create Web Service** → **GitHub** → pilih repo Anda.
4. Konfigurasi:
   - **Builder**: Dockerfile
   - **Dockerfile location**: `backend/Dockerfile`
   - **Work directory / Build context**: `backend`
   - **Port**: `8000` (protocol HTTP)
   - **Instance**: Free (Eco nano)
   - **Health check**: biarkan default (TCP port 8000)
5. **Environment variables** (tab Environment):

| Key | Nilai |
|---|---|
| `MONGO_URL` | connection string dari Langkah 1 |
| `DB_NAME` | `kasumkm` |
| `JWT_SECRET` | teks acak panjang, mis. hasil `openssl rand -hex 32` |
| `ADMIN_EMAIL` | email login admin Anda |
| `ADMIN_PASSWORD` | password admin Anda |
| `CORS_ORIGINS` | URL frontend Vercel, mis. `https://kasumkm.vercel.app` |
| `STORAGE_PROVIDER` | `mongo` (atau `cloudinary`, lihat Langkah 4) |

6. Deploy. Setelah hijau, catat URL-nya, mis. `https://kasumkm-xxxx.koyeb.app`.
7. Uji: buka `https://kasumkm-xxxx.koyeb.app/docs` (dokumentasi API otomatis).

---

## Langkah 3 — Frontend: Vercel

1. https://vercel.com → **Add New Project** → import repo GitHub yang sama.
2. Konfigurasi:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Create React App
   - **Build Command**: `yarn build`
   - **Output Directory**: `build`
3. **Environment Variables**:

| Key | Nilai |
|---|---|
| `REACT_APP_BACKEND_URL` | `https://kasumkm-xxxx.koyeb.app` (URL Koyeb, tanpa `/` di akhir) |

4. Deploy. Setelah dapat URL Vercel, kembali ke Koyeb dan set `CORS_ORIGINS` = URL Vercel tersebut, lalu redeploy backend.

File `frontend/vercel.json` sudah disiapkan agar refresh halaman (routing React) tidak 404.

---

## Langkah 4 (Opsional) — Cloudinary untuk foto nota

Kalau nanti foto nota makin banyak dan mau menghemat kuota Atlas:

1. Daftar gratis di https://cloudinary.com (tanpa kartu kredit).
2. Di Dashboard, copy: **Cloud Name**, **API Key**, **API Secret**.
3. Tambahkan env var di Koyeb:

| Key | Nilai |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | dari dashboard |
| `CLOUDINARY_API_KEY` | dari dashboard |
| `CLOUDINARY_API_SECRET` | dari dashboard |
| `STORAGE_PROVIDER` | `cloudinary` |

4. Redeploy. Nota baru akan tersimpan di Cloudinary; nota lama tetap terbaca dari GridFS.

---

## Checklist setelah deploy

- [ ] Login admin berhasil di URL Vercel.
- [ ] Tambah usaha (UMKM) baru + buat akun pemilik usaha.
- [ ] Catat transaksi lewat Mode Cepat.
- [ ] Kockpit Admin: kategorikan & setujui transaksi.
- [ ] Upload foto nota, lalu buka kembali notanya (memastikan penyimpanan jalan).
- [ ] Ekspor Excel/PDF.

## Biaya

Semuanya Rp 0: Atlas M0, Koyeb free instance, Vercel Hobby, Cloudinary free tier.
Tidak ada yang meminta kartu kredit.
