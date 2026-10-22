# Hasil audit & pengujian — 21 Oktober 2026

## Pembaruan: desain prototipe terhubung ke aplikasi utama

`app-ui.js`, `app-savings-ui.js`, dan `app-appearance.js` memakai data/aplikasi produksi, bukan dataset prototipe. Seluruh pengujian berikut tetap memakai profil dan data buatan terpisah serta endpoint `MOCK_ONLY`; Google Sheets aktif tidak diakses.

- **18 uji domain/backend lulus**, termasuk tambahan roundtrip metadata warna/ikon, arsip/salin perjalanan, serta validasi target/harga/riwayat stok.
- Regresi `tests/browser.test.cjs` diperbarui untuk form batch dan tabel empat kolom di semua ukuran. Pemeriksaan lama terhadap CAS dua perangkat, respons palsu, acknowledgement lama, kuota penyimpanan, konflik dua tab, migrasi tanpa reset, snapshot korup, dan impor Excel nyata tetap dipertahankan dan lulus.
- `tests/live-ui.test.cjs` menguji input transaksi berulang + edit, karakter markup tidak dieksekusi, pemilihan warna tersimpan lokal/pembatalan, gelombang produksi/jeda/reduced motion, isi ulang stok sesuai jumlah + riwayat tanpa expense kedua, perjalanan lintas tahun/penjadwalan ulang tanpa ID ganda, konfirmasi sebagian, arsip dan salinan tanpa status bayar, Excel lengkap serta metadata sync tiruan, dan laporan aktual vs masa depan.
- Enam halaman diperiksa pada lebar 320, 375, 430, 768, 844, 1440 px. Tidak ditemukan overflow halaman atau uncaught script error pada skenario tersebut. Screenshot `test-artifacts/live-{dashboard,tabungan,stok,perjalanan,laporan}-{desktop,mobile}.png` ditinjau; ringkasan estimasi laporan pada ponsel dirapikan setelah inspeksi.
- Cadangan v3 menyimpan atribut tambahan pada snapshot lengkap. Backend v3 yang sama mempertahankannya tanpa perubahan protokol. File Apps Script aktif tidak diubah oleh pengujian.

Belum diverifikasi: perangkat iPhone/Android fisik, pembaca layar nyata, performa animasi pada HP lambat, instalasi PWA dan deployment GitHub/Google aktual. Mode server uji memblokir SW; daftar aset SW dan isi paket diperiksa terpisah. Belum ada publikasi otomatis ke GitHub.

Catatan historis di bawah menggambarkan tahap audit sebelum penerapan desain penuh; referensi desktop tujuh kolom sudah digantikan tabel minimal empat kolom dengan disclosure.

## Lingkungan dan batas akses

- Kode lokal workspace Catatan bulanan; Node.js 24; Edge headless melalui Playwright dengan **profil baru** dan port HTTP acak.
- Seluruh alamat eksternal diblokir dalam uji browser. SheetJS dipenuhi dari fixture lokal, dan URL `MOCK_ONLY` mendapat respons tiruan.
- Backend Apps Script diuji dalam VM dengan objek SpreadsheetApp/LockService/ContentService tiruan. Tidak ada pembukaan, pengambilan, atau perubahan Google Sheets aktif.
- Test mode `?test=1` hanya berlaku pada localhost, tidak mendaftarkan SW atau membaca koneksi cloud pengguna.

## Hasil

**16 pengujian domain/backend + 21 skenario browser lulus.** Dua skenario tambahan memeriksa posisi maskot tepat di bawah kotak saldo Dashboard serta tabel ponsel empat kolom (bukan kartu), detail buka-tutup melalui sentuhan/keyboard, dan tombol Edit serta tindakan rencana berfungsi. Membuka detail tidak mengubah data. Pemeriksaan sintaks seluruh JavaScript, termasuk AppsScript.gs dan inline index.html, lulus.

### Direproduksi pada kode sebelum perubahan

`node tests/audit-baseline.cjs` menggunakan snapshot kode awal (`tests/fixtures/before-audit.html`), storage dan fetch tiruan:

1. Tabungan 100 → tarik 150 → hapus riwayat = 150 (keliru).
2. Akun bersaldo awal 50 dihapus dari total 150 → total 100 (keliru).
3. Pengeluaran -10, tanggal 32 diterima dan saldo naik 10 (keliru).
4. HTTP 200 dengan `success:false` diakui sukses; pending hilang (keliru).
5. Copy pasangan transfer 20 kehilangan atribut; income/expense masing-masing 20 (keliru).
6. Menambah Januari kosong sebelum modal April 500.000 → saldo April 0 (keliru).

### Pengujian domain dan backend baru (16)

- Tanggal kalender, tahun kabisat, nominal negatif, dan stok negatif.
- Transfer menjaga total, dikecualikan dari arus kas, copy memakai pasangan ID baru dengan akun tetap.
- Saldo negatif, bulan kosong, lintas tahun, akun baru, penghapusan akun, serta penambahan bulan lebih awal tidak menghilangkan modal awal.
- Konsolidasi duplikat saldo awal legacy mempertahankan modal akun baru, termasuk saat bulan lebih awal sudah ada.
- Penarikan berlebih ditolak; pembatalan penarikan mengembalikan nilai; setoran yang telah dipakai tidak bisa dibatalkan sehingga saldo negatif.
- Pengurangan/penghapusan sumber dana tabungan yang sudah dialokasikan ditolak.
- Jadwal perjalanan lintas bulan/tahun; penjadwalan ulang mempertahankan ID dan jumlah rincian.
- Konfirmasi sebagian mengurangi jumlah terencana dan menambah biaya aktual tepat satu kali; pengulangan ditolak.
- Pembatalan jadwal/penghapusan rencana mempertahankan pengeluaran aktual.
- Penghapusan pengeluaran aktual mempertahankan tombstone; salinan rencana memperoleh ID rincian baru tanpa status pembayaran.
- Kurs eksplisit, presisi kurs kecil, snapshot JSON mempertahankan tautan aktual dan mata uang.
- Backend menolak akses tanpa kunci dan protokol lama, menjalankan pemeriksaan revisi/CAS, mengakui request id yang sama secara idempoten, dan membaca snapshot Unicode multi-sel dengan benar.
- Migrasi `_data` tiruan mempertahankan sumber lama.

### Pengujian browser (19)

Rincian mesin dalam `test-artifacts/browser-results.json`:

1. Teks berbentuk markup pada transaksi ditampilkan sebagai teks; handler tidak berjalan.
2. Form perjalanan menjadwalkan hotel Desember 2026 dan transport Januari 2027.
3. Konfirmasi satu rincian menghasilkan satu transaksi aktual; rincian lainnya tetap terencana.
4. Workbook XLSX sebenarnya ditulis/dibaca dan memulihkan state lengkap yang sama.
5. Potongan backup tidak valid ditolak tanpa mengubah state.
6. Dua profil dengan revisi dasar sama: penulis kedua ditolak, data lokal pending tetap ada.
7. Respons aplikasi gagal mempertahankan pending.
8. Edit saat kirim berjalan tidak dihapus oleh ack snapshot lama.
9. Pemeriksaan overflow pada Dashboard, Perjalanan, Tabungan, Stok, dan Laporan pada 375px, 430px, serta landscape 844px.
10. Dialog memiliki semantik, fokus awal, dan penutupan Escape.
11. Tidak ada error JavaScript browser yang tidak tertangani pada alur utama.
12. Konfirmasi offline mempertahankan nilai form dan langsung menyimpan pending.
13. Kegagalan kuota localStorage ditampilkan, snapshot sebelumnya tetap tersedia.
14. Perubahan pada tab lain memblokir penulis lokal yang stale.
15. Laporan Januari mendahului April walaupun urutan objek sebaliknya.
16. Pemasukan tahun mendatang ditampilkan sebagai estimasi, terpisah dari aktual.
17. Migrasi legacy mempertahankan saldo dan kunci lama walau penanda reset tidak ada.
18. Snapshot rusak tetap dipertahankan, tidak diganti data kosong, dan edit diblokir.
19. Alur **impor berkas Excel melalui input file** memulihkan seluruh state ke profil browser kosong.

## Tinjauan UI

UI UX Pro Max digunakan sebagai acuan aksesibilitas, fokus dialog, label input, keterbacaan, kontrol sentuh, dan jarak. Hasil pencarian desain generik yang mengarah ke storytelling/Aurora tidak diterapkan karena tidak cocok untuk ledger finansial. Pencarian terfokus `error summary validation` memberi pola ringkasan error yang dapat difokuskan, tautan ke kolom invalid, dan pesan dekat input.

Dashboard dan Perjalanan memakai token/komponen bersama berinspirasi arah Apple yang diminta, tanpa mengganti identitas hijau atau maskot. Transaksi desktop mendapat lebar penuh; ponsel tetap memakai tabel empat kolom. Detail awal hanya keterangan dan kategori, sementara akun, tipe, tautan asal, dan tindakan muncul ketika dibuka. Label Terencana tetap terlihat pada nominal rencana. Maskot berada tepat di bawah kotak hijau saldo sebagai pendukung dan tetap bisa dinonaktifkan/diatur ukurannya per perangkat.

Pratinjau data buatan:

- `test-artifacts/dashboard-desktop.png`
- `test-artifacts/dashboard-phone.png`
- `test-artifacts/trips-desktop.png`
- `test-artifacts/perjalanan-phone.png`
- `test-artifacts/trip-editor-phone.png`

## Risiko berdasarkan kode yang masih relevan

- Backup Excel lama tidak cukup untuk rekonstruksi tepat semua atribut; sekarang ditolak alih-alih diterapkan sebagian. Tidak ada klaim pemulihan informasi yang tidak pernah disimpan.
- Riwayat penarikan lama yang pernah terkena clamp ke nol tidak selalu dapat direkonstruksi. Kasus ambigu diblokir dan harus dicocokkan dengan saldo nyata pengguna.
- Konflik cloud tidak digabung otomatis; ekspor lokal sebelum memilih mengambil salinan server. Revisi mencegah overwrite, bukan menentukan data mana yang benar.
- Penambahan snapshot backend memerlukan pemantauan kapasitas spreadsheet; belum ada pemangkasan otomatis.
- Pustaka XLSX eksternal tetap bergantung jaringan saat belum termuat, dengan versi tetap dan SRI. Audit internal seluruh kode dependensi pihak ketiga belum dilakukan.
- Desain baru baru diterapkan pada Dashboard dan Perjalanan. Perombakan keterbacaan semua tab lain menunggu penilaian pengguna.

## Belum diverifikasi

Deployment Apps Script aktif, izin akun Google, perbedaan CORS/redirect di deployment nyata, perubahan simultan melalui dua perangkat fisik, safe area iPhone/Android nyata, VoiceOver/TalkBack, mode teks sistem terbesar, dan kegagalan jaringan Google asli. SW ditinjau melalui kode dan sintaks; siklus update/install PWA pada perangkat fisik belum diuji. Semua itu tidak boleh disimpulkan lulus dari simulasi lokal.
