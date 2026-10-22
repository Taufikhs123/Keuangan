# Catatan bulanan — pembaruan integritas & Rencana Perjalanan

PWA pribadi berbahasa Indonesia, identitas hijau dan maskot dipertahankan. Data uji dalam `tests/` dan `test-artifacts/` sepenuhnya buatan. Tidak ada pengujian yang mengubah Google Sheets aktif.

## Yang berubah

- Validasi tanggal kalender dan nominal; saldo per akun/carry lintas bulan/tahun; penghapusan akun mempertahankan modal; copy transfer tetap berpasangan dan memakai ID baru.
- Penarikan tabungan tidak boleh melebihi saldo. Pembatalan setoran yang telah dipakai ditolak. Sumber dana yang sudah dialokasikan tidak boleh dikurangi sebelum alokasinya dibatalkan.
- Cadangan Excel v3 menyimpan seluruh state dalam `_Backup`, termasuk ID, akun, transfer, sumber alokasi, pengaturan, stok, perjalanan dan tautan aktualnya. Sheet lain adalah tampilan baca. Mengedit sheet tampilan tidak mengubah snapshot pemulihan.
- Sync v3: kunci akses, revisi server, lock, pemeriksaan pengakuan snapshot, penolakan konflik, penanda pending atomik. Tidak ada penggabungan konflik otomatis.
- Dashboard dan Rencana Perjalanan memakai aturan desain bersama (`app-design.css`): hijau, panel tenang, tipografi terbaca, nominal utuh, dan kontrol nyaman. Maskot berada tepat di bawah kotak hijau saldo Dashboard. Transaksi ponsel tetap berupa tabel empat kolom (Tgl, Detail, Jumlah, Saldo). Kolom Detail menampilkan keterangan dan kategori; tekan untuk membuka akun, tipe, tautan asal, dan tindakan. Tekan kembali untuk menutup. Label Terencana tetap terlihat di nominal rencana. Tab lain belum mengalami perombakan visual besar.

## Memakai Rencana Perjalanan

1. Buka menu **Rencana Perjalanan → Rencana baru**.
2. Isi nama, tujuan, tanggal perjalanan, tanggal transaksi default, mata uang, dan catatan.
3. Tambahkan rincian: nama, kategori, unit, biaya/unit. Tanggal khusus boleh berbeda dari tanggal perjalanan (misalnya uang muka hotel), lintas bulan/tahun. Tanggal kosong mengikuti default.
4. Untuk mata uang berbeda, isi kurs: **1 mata uang perjalanan = berapa mata uang pencatatan**. Kurs disimpan; pembulatan nominal terjadi setelah subtotal dikonversi, kurs tetap presisi.
5. **Simpan** menyimpan draf; **Jadwalkan transaksi** menampilkan rincian di Dashboard bulan terkait dengan label **Terencana**. Rincian ini dihitung terpisah, tidak mengubah saldo.
6. Pilih **Catat sebagai pengeluaran**, konfirmasi tanggal, nominal aktual dalam mata uang pencatatan, kategori, dan akun. Hanya satu transaksi dibuat untuk satu rincian.
7. Mengubah tanggal/harga lalu menyimpan memperbarui jadwal rincian yang sama. Perubahan estimasi tidak mengubah transaksi aktual yang sudah dicatat.
8. **Batalkan jadwal** menghapus tampilan terencana; **Hapus rencana** menghapus draf/jadwal. Keduanya mempertahankan pengeluaran aktual. Transaksi aktual tetap memiliki nama/ID asal.
9. Menghapus transaksi aktual mempertahankan penanda pembatalan rincian, sehingga tidak otomatis dibuat ulang. Jika benar-benar perlu transaksi pengganti, buat rincian baru (riwayat asal tetap jelas).

## Sebelum memperbarui GitHub Pages

1. Simpan cadangan dari perangkat lama yang memiliki data paling lengkap. Jangan reset penyimpanan browser.
2. Tinjau `AUDIT.md`, `TEST-RESULTS.md`, dan pratinjau dalam `test-artifacts/`.
3. Upload **semua file aplikasi** di paket terbaru `catatan-bulanan-calm-update.zip`, bukan hanya `index.html`. Paket tidak menyertakan data uji, dependensi test, prototipe, ataupun kunci akses. Paket lama `catatan-bulanan-update.zip` dipertahankan sebagai versi sebelumnya.
4. File yang diperlukan: `index.html`, `finance-core.js`, `app-integrity.js`, `trips.js`, `app-boot.js`, `app-design.css`, `app-shell.css`, `app-panels.css`, `app-appearance.css`, `app-live.css`, `app-appearance.js`, `app-savings-ui.js`, `app-ui.js`, `AppsScript.gs`, `sw.js`, `manifest.json`, tiga ikon, dan lima PNG maskot.
5. Tutup/buka ulang PWA pada setiap perangkat. Jangan menghapus cache/localStorage secara massal karena data pending bisa hilang.

## Memperbarui Apps Script (dilakukan oleh pemilik setelah meninjau)

1. Pada spreadsheet yang sama, buka Extensions → Apps Script. Simpan salinan kode lama.
2. Ganti kode dengan `AppsScript.gs` di paket. Jangan menyisakan `doGet`/`doPost` lama yang duplikat.
3. Di Project Settings → Script Properties, tambahkan properti **SYNC_TOKEN** dengan nilai acak panjang yang hanya diketahui pengguna. Jangan taruh nilai ini di GitHub.
4. Deploy → Manage deployments → Edit deployment → New version → Deploy. Pertahankan URL `/exec` yang dipakai aplikasi bila memungkinkan.
5. Di aplikasi baru, buka Pengaturan, masukkan kunci akses dan tekan **Gunakan kunci**. Kunci disimpan dalam sessionStorage (sesi tab), tidak diekspor atau disinkronkan.
6. Jika perangkat memiliki perubahan lokal pending, ekspor cadangan baru dahulu. Pilihan Upload akan memeriksa revisi; server yang lebih baru menyebabkan penolakan tanpa menimpa data.
7. Bila migrasi pertama menemukan data cloud tetapi belum memiliki revisi dasar lokal, upload diblokir. Simpan backup lokal terlebih dahulu, lalu pilih **Muat dari Sheets** hanya setelah memastikan ingin memakai salinan server. Tidak ada tombol overwrite paksa.
8. Backend baru membaca `_data` lama untuk migrasi, tidak menghapusnya. Snapshot baru memakai `_snapshots_v3`, dipecah beberapa sel agar tidak bergantung pada batas satu sel. Revision pointer hanya berubah setelah seluruh potongan ditulis.

## Batasan yang disengaja

- File Excel dari versi lama tidak memiliki semua atribut untuk memulihkan transfer, akun, serta sumber alokasi secara pasti. Impor aman menolak file tanpa `_Backup` v3. Gunakan perangkat yang masih memiliki data asli untuk membuat backup baru. Tidak ada rekonstruksi spekulatif.
- Riwayat penarikan lama tanpa ID dari saldo nol bisa berasal dari bug penarikan berlebih. Pembalikannya ditolak bila ambigu; saldo sebenarnya harus diperiksa pengguna. Data lama tidak dikoreksi diam-diam.
- Mata uang pencatatan tidak dapat diganti pada dataset yang sudah berisi data keuangan; perubahan simbol saja akan mencampur satuan. Mata uang berbeda didukung khusus rencana dengan kurs eksplisit.
- Tabungan terpisah dari ledger kas; setor/tarik manual tidak otomatis membuat transaksi kas Dashboard. Alokasi dari kategori tabungan adalah pemindahan pencatatan ke tujuan, bukan pengeluaran kas kedua.
- Backup Excel memerlukan koneksi agar SheetJS CDN termuat (versi dipin dan diperiksa SRI). Aplikasi inti dan maskot tersedia dari cache PWA setelah instalasi.
- Backend menyimpan snapshot lama sebagai riwayat; pantau kapasitas spreadsheet saat dataset/snapshot tumbuh. Tidak ada pembersihan riwayat otomatis.
- Tidak ada pengujian live terhadap izin Google, perilaku deploy, perangkat iOS/Android fisik, atau screen reader nyata. Konflik diuji memakai backend tiruan; deployment perlu pemeriksaan pemilik.

## Pengujian lokal

Node.js dan Playwright yang tersedia pada lingkungan pengujian:

```
node tests/audit-baseline.cjs
node --test tests/finance.test.cjs tests/backend.test.cjs
node tests/browser.test.cjs
```

Uji browser memakai profil baru, port HTTP acak, service worker diblokir, dan semua alamat eksternal ditolak kecuali endpoint sync bernama MOCK_ONLY yang dipenuhi respons tiruan. Salinan SheetJS pada `tests/fixtures` digunakan untuk menguji berkas Excel sebenarnya tanpa akses cloud.

## Desain Calm — diterapkan pada aplikasi utama

Lapisan `app-ui.js` menyambungkan komponen prototipe yang disetujui ke `Finance`, snapshot v3, serta CAS sync yang sama. Tidak ada data contoh dimasukkan ke aplikasi. Pengaturan lama (akun, kategori, mata uang, maskot, backup, sinkronisasi) tetap tersedia. Sidebar desktop menampilkan enam menu; ponsel mempunyai Dashboard/Tabungan/Belanja/Perjalanan/Lainnya, dengan Laporan dan Pengaturan pada Lainnya.

- Dashboard: saldo bertanda minus, maskot tepat di bawah kotak hijau, tabel empat kolom pada desktop maupun ponsel; keterangan/kategori ringkas, akun/tipe/edit/hapus dibuka lewat disclosure. Form Catat transaksi tetap terbuka untuk input berulang. Hanya keterangan dan nominal dikosongkan setelah pencatatan berhasil. Notifikasi lokal tidak menyatakan terunggah; pesan Google Sheets hanya muncul setelah acknowledgement snapshot yang sesuai dan tidak ada perubahan pending.
- Tabungan: target total, dana tersedia vs estimasi, diagram progres bersegmen dengan air mint–teal dan pengisian awal. Gelombang pelan berkelanjutan dapat dijeda, berhenti di luar layar/tab tersembunyi, dan dinonaktifkan oleh Kurangi gerakan. Tidak memakai sensor HP. Dua belas warna bernama dan 20 ikon disimpan per tujuan; warna lama dipertahankan sampai pengguna memilih penggantinya. Alokasi/setor/tarik/pembatalan tetap memakai perlindungan integritas produksi. Dana belum dialokasikan tidak mengisi progres; kelebihan satu tujuan tidak menutup kekurangan tujuan lain secara otomatis.
- Perjalanan: daftar sebelum rincian, aktif/arsip, tampilan daftar/kartu, pencarian, delapan rencana per halaman, delapan warna sampul, konfirmasi biaya sekali, serta salin tanpa status pembayaran/arsip. Arsip membatalkan jadwal yang belum dibayar tanpa menghapus transaksi aktual. Salinan mempertahankan tanggal agar dapat ditinjau ulang; tidak otomatis dijadwalkan. Editor tetap mendukung unit, kurs dan tanggal khusus lintas bulan/tahun.
- Belanja: kebutuhan otomatis vs semua barang, pencarian, ikon, kategori, stok/minimum/target/satuan/harga per satuan. Isi ulang meminta jumlah aktual dan mencatat riwayat stok, tanpa membuat pengeluaran kas otomatis. Barang lama tanpa jumlah tetap memerlukan pengguna mengisi jumlah melalui Edit; tidak ditebak.
- Laporan: Januari–Desember, aktual terpisah dari transaksi mendatang dan biaya perjalanan terencana, grafik dan rincian bulan, ringkasan serta kategori dengan rata-rata/count yang bisa dibuka.

Warna/ikon tujuan, sampul/arsip perjalanan, target/harga/kategori/riwayat stok semuanya bagian record dalam snapshot lengkap; ikut localStorage, Excel `_Backup`, dan sync v3. Apps Script v3 yang sudah digunakan tidak perlu diubah untuk menyimpan atribut ini karena menyimpan snapshot utuh; tabel terlihat tetap merupakan ringkasan, bukan sumber pemulihan. Jika backend masih versi lama, ikuti migrasi v3 di atas sebelum memakai sync.

Uji tambahan: `node tests/live-ui.test.cjs` dengan profil, data, SheetJS lokal, dan endpoint tiruan. Preview aman pada `http://127.0.0.1:4187/index.html?test=1` (jika server lokal berjalan): tidak memuat koneksi/cloud pengguna dan tidak mengisi data contoh. Tampilan produksi masih perlu dicoba pemilik pada perangkat iPhone/Android fisik. Perubahan lokal ini belum dipublikasikan ke GitHub.
