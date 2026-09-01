# Panduan Pemakaian Template Pembukuan UMKM (Excel)

Semua file di folder `/app/excel_templates/`:

| File | Untuk siapa | Fungsi |
|---|---|---|
| `Pembukuan-Template.xlsx` | Digandakan Admin | Template kosong untuk setiap UMKM baru |
| `Pembukuan-TokoMaju-Contoh.xlsx` | Belajar | Contoh yang sudah terisi 1 bulan |
| `Rekap-Admin.xlsx` | Admin | Rekap semua UMKM + hitung tagihan jasa |

---

## A. Persiapan (Admin, sekali saja per UMKM)

1. Salin `Pembukuan-Template.xlsx`, ganti namanya jadi `Pembukuan-<NamaUsaha>.xlsx`.
2. Buka sheet **Profil Usaha**, isi nama usaha, pemilik, no. HP, modal awal.
3. Cek sheet **Kategori** — tambah/ubah kategori sesuai jenis usahanya.
4. Unggah file ke Google Drive Anda → klik kanan file → **Buka dengan → Google Spreadsheet** →
   `File → Simpan sebagai Google Spreadsheet`.
5. Klik **Bagikan** → masukkan email pemilik usaha → beri akses **Editor** → kirim tautannya via WhatsApp.
6. Minta pemilik usaha memasang aplikasi **Google Spreadsheet** di HP, lalu buka tautannya sekali dan
   klik ikon bintang supaya mudah dibuka lagi.

> Kalau pemilik usaha tidak mau pakai Google, kirim saja file `.xlsx` dan minta dikirim balik
> setiap akhir minggu lewat WhatsApp.

---

## B. Cara pakai harian (Pemilik Usaha) — 10 detik per transaksi

Buka sheet **Transaksi**, isi baris paling bawah yang masih kosong:

1. **Tanggal** — tulis `30/6` (tanggal hari ini)
2. **Jenis** — pilih `Masuk` atau `Keluar` dari dropdown
3. **Nominal** — tulis angka saja, mis. `150000`
4. **Keterangan** — singkat saja, mis. `beli gula 2 kg`

Kolom **Kategori, Metode Bayar, Status** boleh dibiarkan kosong — itu tugas Admin.
Baris yang kategorinya masih kosong otomatis berwarna kuning.

Kalau punya foto nota: simpan fotonya di folder Google Drive, lalu tempel tautannya
(atau cukup tulis nama filenya) di kolom **Tautan Nota**.

---

## C. Cara pakai Admin (setelah pulang sekolah, ±10 menit per UMKM)

1. Buka file UMKM → sheet **Transaksi**.
2. Lihat baris kuning (kategori masih kosong). Untuk melihat hanya baris kuning:
   klik ikon Filter di kolom **Kategori** → centang `(Kosong)`.
3. Isi **Kategori** dan **Metode Bayar** lewat dropdown, ubah **Status** jadi `Disetujui`.
   Kalau ada yang perlu ditanyakan, pilih Status `Perlu Perbaikan` dan tulis di **Catatan Admin**.
4. Buka sheet **Cek Data** untuk melihat data bermasalah (nominal kosong, tanggal salah, dugaan duplikat).
5. Buka sheet **Dashboard**, atur **Bulan** dan **Tahun** → semua kartu, indikator, dan grafik ikut berubah.

---

## D. Cara baca Dashboard (kartu, indikator, grafik)

Sheet **Dashboard** dibuat supaya sekali lihat langsung paham:

| Bagian | Cara baca |
|---|---|
| 4 kartu besar | Uang Masuk, Uang Keluar, Laba/Rugi, Saldo Kas bulan terpilih |
| Tulisan ▲ / ▼ di kartu | Pembanding dengan bulan lalu. ▲ hijau = membaik, ▼ merah = menurun. Khusus kartu **Uang Keluar** warnanya dibalik (naik = merah, karena boros) |
| Lampu status (kanan atas) | ● hijau **SEHAT** (laba positif), ● kuning **IMBANG**, ● merah **WASPADA** (pengeluaran lebih besar) |
| Ringkasan Cepat | Jumlah transaksi, berapa yang belum dikategorikan, belum disetujui, dan kapan terakhir mencatat |
| Uang Paling Banyak Keluar | 5 kategori terbesar bulan ini + balok █ (makin panjang = makin besar) |
| Grafik 12 Bulan | Batang hijau/merah: uang masuk vs uang keluar sepanjang tahun |
| Grafik Tren Harian | Garis naik-turun penjualan & pengeluaran per tanggal pada bulan terpilih |
| Grafik Donat | Komposisi uang keluar bulan ini per kategori |

Sheet **Arus Kas Harian** juga punya balok █ hijau/merah per tanggal, dan saldo berjalan
otomatis berwarna merah kalau kas minus.

> Di HP: buka sheet Dashboard, kartu-kartunya tersusun 2×2 supaya tetap terbaca tanpa
> menggeser layar. Balok █ sengaja dipakai karena selalu tampil di semua aplikasi,
> termasuk Google Spreadsheet versi HP.

---

## E. Akhir bulan

1. Sheet **Laba Rugi** → atur bulan di Dashboard → `File → Cetak → Simpan sebagai PDF`.
2. Kirim PDF-nya ke pemilik usaha via WhatsApp. Contoh pesan:

```
Assalamualaikum Pak/Bu [Nama],
Laporan keuangan bulan [Bulan] sudah selesai.
Uang masuk: Rp ...
Uang keluar: Rp ...
Laba bersih: Rp ...
Pengeluaran terbesar: [Kategori]
Laporan lengkap saya lampirkan ya. Terima kasih 🙏
```

3. Buka `Rekap-Admin.xlsx` → sheet **Salin Data**: dari setiap file UMKM, salin kolom
   Tanggal–Status di sheet Transaksi, tempel ke bawah, dan tulis **Nama Usaha** di kolom A.
4. Sheet **Rekap** langsung menampilkan kartu total (uang masuk, uang keluar, laba gabungan,
   UMKM yang perlu diingatkan), kolom **Status** berlampu ● hijau/kuning/merah, kolom
   **Grafik Laba** dengan balok █, serta 2 grafik perbandingan antar UMKM.
5. Sheet **Tagihan Jasa** → atur tarif → dapat rincian biaya jasa per UMKM bulan itu,
   lengkap dengan kartu total pendapatan dan sisa yang belum dibayar.

---

## F. Hal penting

- File **tanpa macro/VBA**, jadi aman dibuka di HP, Excel, WPS, LibreOffice, dan Google Spreadsheet.
- Sel yang berisi rumus dikunci agar tidak tertimpa. Untuk membukanya:
  `Review → Unprotect Sheet` (tanpa password).
- Setiap file menampung **500 baris transaksi** (±1–2 tahun untuk UMKM kecil).
  Kalau penuh, buat file baru untuk tahun berikutnya.
- Jangan menghapus **kolom** atau **memindahkan sheet**, karena rumus mengacu ke posisi kolom.
  Menambah/menghapus **baris di dalam tabel Transaksi** aman.
- Kolom **Bulan** (kolom J di sheet Transaksi) dan sheet **Data Grafik** adalah pembantu rumus —
  biarkan saja, jangan dihapus. Sheet Data Grafik itulah yang mengisi kartu dan grafik Dashboard.
- Isi seluruh nominal dengan angka saja, tanpa `Rp` dan tanpa titik.

## G. Yang tidak ada di versi Excel ini

- Baca nota otomatis (OCR) — foto nota disimpan manual di Drive.
- Pengingat otomatis — sheet Rekap menunjukkan siapa yang lama tidak mencatat, pesannya Anda kirim sendiri.
- Beberapa orang mengedit sekaligus — hanya bisa kalau file dibuka sebagai Google Spreadsheet.

Aplikasi web KasUMKM tetap ada dan tidak diubah; bisa dipakai kapan pun bila nanti butuh
foto nota otomatis, pengingat otomatis, dan banyak pengguna sekaligus.
