# Perbaikan: "Network Error" saat Tambah UMKM

## Gejala
- Membuka aplikasi dan melihat daftar klien UMKM berjalan normal.
- Saat menekan "Tambah UMKM" lalu "Simpan", muncul notifikasi **Network Error** dan data tidak tersimpan.

## Penyebab
Aplikasi dan servernya berkomunikasi dengan pengaturan keamanan browser (CORS) yang tidak cocok:
server mengizinkan "semua asal" sekaligus "kredensial", dan sisi aplikasi menandai setiap
permintaan sebagai "membawa kredensial". Browser menolak kombinasi ini pada permintaan
menyimpan data (POST), sehingga muncul "Network Error". Permintaan menampilkan daftar (GET)
kebetulan masih lolos, itulah kenapa daftar tetap tampil tetapi menyimpan gagal.

Aplikasi versi sekarang berjalan **tanpa login**, jadi tidak butuh kredensial/cookie sama sekali —
pengaturan tersebut memang tidak diperlukan dan aman untuk dibetulkan.

## Yang akan diperbaiki
- Menyelaraskan pengaturan komunikasi aplikasi ↔ server agar menyimpan data (Tambah UMKM,
  catat transaksi, hapus, export, dll.) tidak lagi diblokir browser.
- Setelah perbaikan: menekan "Tambah UMKM" → "Simpan" akan menambah klien UMKM ke daftar
  tanpa error. Perbaikan yang sama otomatis menyembuhkan operasi tulis lain yang memakai jalur
  serupa (misalnya menyimpan transaksi dan menghapus klien).

## Tidak berubah
- Tampilan, alur, dan fitur lain tetap sama. Tidak ada login yang ditambahkan.
- Data demo dan template Excel tidak terpengaruh.

## Catatan / asumsi
- Diasumsikan masalah dilaporkan pada aplikasi preview. Perbaikan ini juga berlaku untuk versi
  yang nanti di-deploy (Vercel + Koyeb) selama alamat frontend didaftarkan di server. Jika Anda
  melihat error ini pada situs yang sudah di-deploy, sebutkan agar saya sesuaikan juga.
