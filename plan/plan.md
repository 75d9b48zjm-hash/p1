# Rencana: Aplikasi KasUMKM — Mode Pemakaian Pribadi (Tanpa Login)

## Tujuan
Mengubah aplikasi web dari sistem multi-user (admin + UMKM login + persetujuan) menjadi
alat kerja pribadi untuk satu orang pembukuan. Anda memasukkan data setiap UMKM sendiri,
lalu hasilnya dikirim ke klien lewat **screenshot dashboard** atau **file Excel**.

## Cara pakai yang dituju
1. Buka aplikasi → langsung masuk (tanpa halaman login).
2. Pilih/ tambah UMKM (klien) yang mau dikelola.
3. Input transaksi masuk/keluar untuk UMKM tersebut.
4. Lihat dashboard yang rapi → screenshot untuk dikirim ke klien.
5. Atau klik "Export Excel" → dapat file yang bisa dikirim ke klien.
6. Bulan depan buka lagi UMKM yang sama, data lama masih ada, tinggal tambah.

## Keputusan yang sudah disepakati
- **Tanpa login sama sekali.** Aplikasi terbuka langsung ke halaman kerja.
- **Data tetap tersimpan** dan bisa dibuka lagi kapan saja (per UMKM, per bulan).
- **Banyak UMKM** tetap didukung — Anda pegang banyak klien dalam satu aplikasi.
- **Tidak ada lagi alur persetujuan/kategorisasi** (approval). Transaksi yang Anda input
  langsung tercatat, tidak perlu di-approve. Halaman "Kategorisasi/Cockpit" dihapus.
- **Sisi login/akun UMKM dihapus** beserta halaman-halaman terkait login.
- **Export Excel = versi sederhana**: tabel transaksi + ringkasan angka (saldo, masuk,
  keluar, laba) + grafik dasar. Bukan template mewah — supaya bisa dibandingkan dengan
  template Excel offline yang terakhir dibuat.
- **Dashboard dibuat enak untuk di-screenshot**: kartu ringkasan + grafik yang rapi,
  nama UMKM dan periode terlihat jelas dalam satu layar.

## Yang tetap ada
- Manajemen UMKM (tambah, edit, hapus klien + profil usaha).
- Input transaksi cepat (masuk/keluar, nominal, kategori opsional, tanggal, catatan).
- Dashboard per UMKM (saldo, pemasukan, pengeluaran, laba + grafik tren & kategori).
- Laporan dan analisis per UMKM.
- Kategori per UMKM (opsional saat input).
- Template Excel offline yang lama tetap bisa diunduh (tidak diubah).

## Yang dihapus / disederhanakan
- Halaman login, register, lupa/reset password.
- Peran "UMKM user" dan seluruh halaman khusus login UMKM.
- Halaman Kategorisasi/Cockpit dan status "pending/approved" pada transaksi.
- Audit log yang berkaitan dengan aktivitas multi-user (jika tidak lagi relevan).

## Hal yang perlu Anda ketahui / bisa Anda tantang
1. **Tanpa login = siapa pun yang punya link aplikasi bisa membuka & mengedit data.**
   Karena ini alat pribadi, ini sesuai permintaan Anda. Kalau nanti Anda ingin sedikit
   pengaman, kita bisa tambah 1 kode/PIN sederhana. (Belum dikerjakan sekarang.)
2. **Data tersimpan di server aplikasi**, bukan sebagai file di komputer Anda. Efeknya
   sama: data tidak hilang saat browser ditutup dan bisa dibuka lagi kapan saja dari
   perangkat mana pun lewat link yang sama. Kalau Anda benar-benar ingin data hanya di
   komputer (tanpa server), beri tahu — pendekatannya beda dan perlu dibahas terpisah.
3. **Export Excel** dibuat versi sederhana dulu (tabel + ringkasan + grafik). Kalau
   setelah membandingkan Anda mau tampilan sekeren template offline, itu bisa jadi
   tahap berikutnya.

## Hasil akhir yang bisa Anda coba
- Buka link → langsung bisa tambah UMKM dan input transaksi tanpa login.
- Dashboard rapi siap di-screenshot.
- Tombol Export menghasilkan file Excel berisi tabel + ringkasan + grafik.
- Data UMKM lama tetap ada saat dibuka kembali.
