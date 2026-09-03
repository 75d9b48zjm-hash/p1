# KasUMKM — Cara Menjadikan Aplikasi Windows (.exe) di Komputer Anda

Aplikasi ini sudah **100% offline**. Ikuti langkah di bawah untuk mengubahnya menjadi
aplikasi Windows biasa (punya ikon shortcut, tinggal dobel-klik).

> Ringkas: **Ambil kode dari GitHub → pasang Node.js sekali → jalankan 3 perintah → dapat file .exe.**
> Perlu internet **hanya saat membangun** (sekali). Setelah aplikasi jadi, pemakaian 100% offline.

---

## LANGKAH 1 — Ambil kode aplikasi ke komputer

1. Di Emergent, klik tombol **"Save to GitHub"** (di kolom chat), pilih/buat branch, lalu **Push**.
   (Catatan: fitur Save to GitHub memerlukan langganan berbayar Emergent.)
2. Buka repository GitHub Anda di browser.
3. Klik tombol hijau **"Code" → "Download ZIP"**.
4. **Extract** ZIP-nya, misalnya ke **Desktop**. Anda akan punya folder project (mis. `kasumkm`).

---

## LANGKAH 2 — Pasang Node.js (cukup sekali seumur hidup)

1. Buka https://nodejs.org → unduh versi **LTS** → pasang (klik Next sampai selesai).
2. Cek berhasil: buka **Command Prompt** (tekan tombol Windows, ketik `cmd`, Enter), lalu ketik:
   ```
   node -v
   ```
   Kalau muncul angka versi (mis. `v20.x.x`), berarti sudah siap.

---

## LANGKAH 3 — Bangun aplikasi .exe

1. Buka **Command Prompt**.
2. Masuk ke folder **frontend** di dalam project hasil extract. Contoh (sesuaikan lokasinya):
   ```
   cd Desktop\kasumkm\frontend
   ```
   > Tips: di File Explorer, buka folder `frontend`, klik bar alamat, ketik `cmd`, tekan Enter —
   > Command Prompt langsung terbuka di folder itu.
3. Pasang Yarn (sekali saja), lalu pasang bahan aplikasi:
   ```
   npm install -g yarn
   yarn install
   ```
   (Proses ini mengunduh komponen aplikasi + Electron, agak besar — butuh internet, tunggu sampai selesai.)
4. Bangun file aplikasinya:
   ```
   yarn dist
   ```
   Tunggu hingga selesai.

---

## LANGKAH 4 — Pasang & pakai

Setelah `yarn dist` selesai, buka folder baru bernama **`dist`** (di dalam `frontend`). Ada 2 pilihan:

- **KasUMKM Setup x.x.x.exe** → ini **installer**. Dobel-klik → pasang → otomatis membuat
  **shortcut "KasUMKM" di Desktop & Start Menu**. Selanjutnya tinggal dobel-klik ikonnya.
- **KasUMKM x.x.x.exe** (versi *portable*) → tanpa perlu dipasang, langsung dobel-klik untuk jalan.
  Bisa Anda pindah/salin ke mana saja (mis. flashdisk).

Selesai! Aplikasi kini berjalan **100% offline** di komputer Anda. Data tersimpan di komputer itu.

---

## Catatan penting

- **Peringatan Windows SmartScreen / antivirus.** Karena aplikasi belum bertanda tangan digital
  berbayar, Windows mungkin menampilkan "Windows protected your PC". Klik **"More info" → "Run anyway"**.
  Ini normal untuk aplikasi buatan sendiri.
- **Data tersimpan lokal** di komputer tempat aplikasi dijalankan (tidak terkirim ke mana pun,
  tidak sinkron antar komputer). Untuk pindah komputer, nanti bisa kita tambahkan fitur
  **Cadang & Pulihkan Data** (ekspor/impor satu file).
- **Update aplikasi:** kalau nanti ada perubahan di Emergent, ulangi Langkah 1, lalu jalankan lagi
  `yarn install` (kalau ada bahan baru) dan `yarn dist`, lalu pasang installer yang baru.
- **Hanya perlu folder `frontend`.** Folder `backend` tidak dipakai lagi (aplikasi sudah tanpa server).

---

## Ingin coba dulu tanpa membuat .exe? (opsional, untuk mengetes)

Di dalam folder `frontend`, setelah `yarn install`, jalankan:
```
yarn build
yarn electron
```
Aplikasi akan langsung terbuka sebagai jendela desktop (tanpa perlu dipasang). Untuk membuat
file .exe yang bisa dibagikan/dipasang, gunakan `yarn dist` seperti Langkah 3.

---

Kalau Anda **tidak ingin memasang Node.js / menjalankan perintah**, beri tahu saya — kita bisa
bahas opsi lain (mis. saya bantu siapkan agar prosesnya lebih otomatis).
