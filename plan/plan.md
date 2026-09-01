# Rencana: Template Pembukuan UMKM berbasis Excel

## Ringkas
Membuat file Excel siap pakai (.xlsx) untuk pembukuan UMKM, menggantikan/melengkapi aplikasi web KasUMKM. Satu file per UMKM, plus satu file rekap untuk Admin. Semua rumus otomatis, tanpa macro (VBA), supaya tetap bisa dibuka di Excel, WPS, LibreOffice, maupun Google Sheets di HP.

Jawaban singkat atas pertanyaan Anda: ya, file Excel-nya bisa dibuat, dan untuk skala 5–20 UMKM cara ini realistis serta biaya Rp 0. Yang hilang: multi-user real-time, foto nota otomatis (OCR), dan pengingat otomatis.

## Isi file per UMKM (`Pembukuan-<NamaUsaha>.xlsx`)
1. **Petunjuk** — cara pakai 1 halaman, bahasa sederhana, untuk pemilik usaha.
2. **Profil Usaha** — nama, pemilik, jenis usaha, no. HP, modal awal, bulan mulai.
3. **Transaksi** — tabel utama tempat mencatat:
   - Tanggal | Jenis (Masuk/Keluar) | Nominal | Keterangan | Kategori | Metode Bayar | Status | Catatan Admin
   - Kolom Kategori & Metode Bayar boleh **dikosongkan** oleh UMKM (meniru "Mode Cepat"); Admin mengisinya belakangan.
   - Dropdown (data validation) untuk Jenis, Kategori, Metode Bayar, Status — jadi tidak ada salah tulis.
   - Baris dengan Kategori kosong otomatis diberi warna kuning (conditional formatting) supaya mudah dilihat Admin.
   - Nominal berformat Rupiah, tanggal berformat dd/mm/yyyy.
4. **Kategori** — daftar kategori pemasukan & pengeluaran yang bisa diubah sendiri; jadi sumber dropdown.
5. **Dashboard** — otomatis dari sheet Transaksi:
   - Total uang masuk, uang keluar, laba/rugi, saldo kas bulan terpilih (ada pilihan bulan/tahun)
   - Tabel ringkasan per kategori (pengeluaran terbesar)
   - Grafik batang uang masuk vs keluar per bulan (12 bulan) dan grafik komposisi pengeluaran
6. **Laba Rugi** — laporan bulanan rapi siap dicetak/di-PDF.
7. **Arus Kas Harian** — saldo berjalan per hari untuk bulan terpilih.
8. **Cek Data** — daftar baris yang perlu perhatian: kategori kosong, nominal kosong/negatif, tanggal di luar bulan, duplikat.

## File Admin (`Rekap-Admin.xlsx`)
- Sheet **Salin Data**: tempat menempelkan (paste) transaksi dari tiap file UMKM.
- Sheet **Rekap**: perbandingan semua UMKM — uang masuk, keluar, laba, jumlah transaksi, jumlah baris belum dikategorikan, tanggal transaksi terakhir (untuk tahu UMKM yang mulai malas mencatat).
- Sheet **Tagihan Jasa**: hitung biaya jasa pembukuan per UMKM per bulan (tarif bisa diatur).

## Cara kerja harian (menggantikan alur aplikasi)
- UMKM: buka file di HP (Google Sheets / Excel mobile) atau laptop, catat tanggal + nominal + keterangan saja. Selesai ±10 detik per transaksi.
- Admin (setelah pulang sekolah): buka file tiap UMKM, filter baris kuning (kategori kosong), isi kategori pakai dropdown, ubah Status jadi "Disetujui". Dashboard langsung ikut berubah.
- Akhir bulan: cetak sheet Laba Rugi ke PDF, kirim ke pemilik usaha via WhatsApp.

## Yang tidak akan dibuat (batasan yang perlu diketahui sebelum setuju)
- **Tidak ada macro/VBA** — supaya file aman dibuka di HP dan tidak diblokir Excel. Konsekuensinya tidak ada tombol otomatis; semua lewat rumus, dropdown, dan filter.
- **Tidak ada baca nota otomatis (OCR)**. Foto nota disimpan manual di folder Google Drive; di sheet Transaksi hanya ada kolom tautan/nama file.
- **Tidak ada pengingat otomatis**. Sheet Rekap Admin menampilkan "sudah X hari tidak mencatat", tapi Admin yang mengirim pesan sendiri.
- **Multi-user**: satu file diedit satu orang pada satu waktu. Kalau butuh UMKM & Admin mengedit bersamaan, file harus ditaruh di Google Drive dan dibuka sebagai Google Sheets.
- Grafik Excel akan tampil pada Excel dan LibreOffice; saat file dibuka di Google Sheets tampilan grafik bisa sedikit berbeda.

## Keputusan yang sudah diasumsikan (silakan koreksi)
1. **Satu file per UMKM** + satu file rekap Admin — bukan satu file berisi semua UMKM. Alasan: privasi antar UMKM dan file tetap ringan.
2. Kategori awal disiapkan untuk UMKM dagang/kuliner umum (mis. Penjualan Tunai, Penjualan Online, Bahan Baku, Gaji, Sewa, Listrik & Air, Transport, Kemasan, Lain-lain) dan bisa diubah sendiri.
3. Format .xlsx tanpa proteksi password; hanya sel rumus yang dikunci agar tidak tertimpa (tanpa password, bisa dibuka kembali).
4. Data contoh 1 bulan disertakan di file, di sheet terpisah, agar terlihat cara pengisian — dan mudah dihapus.
5. Bahasa isi file: Bahasa Indonesia.
6. Disediakan juga panduan singkat (PDF/README) berisi cara menaruh file di Google Drive agar bisa diisi dari HP.

## Nasib aplikasi web yang sudah dibuat
Aplikasi web tidak dihapus dan tidak diubah dalam rencana ini. Aplikasi tetap ada di preview dan bisa dipakai/dideploy nanti bila diperlukan. Kalau Anda ingin aplikasi web dihentikan atau justru ditambah fitur "unduh template Excel" dari dalam aplikasi, itu perlu dikatakan sekarang.

## Hasil akhir yang diserahkan
- `Pembukuan-Template.xlsx` (template kosong siap digandakan untuk UMKM baru)
- `Pembukuan-TokoMaju-Contoh.xlsx` (contoh terisi, untuk belajar)
- `Rekap-Admin.xlsx`
- `Panduan-Pemakaian.md` (langkah pemakaian untuk Anda dan untuk pemilik usaha)
Semua file bisa diunduh dari folder proyek.
