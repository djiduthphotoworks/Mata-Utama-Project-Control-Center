# Mata Utama — tahap awal integrasi Firebase

## Yang sudah ditambahkan
- `firebase-config.js`: konfigurasi Web SDK dari project Firebase yang diberikan.
- `auth.js`: login Email/Password dan Google; setelah login, aplikasi memeriksa `users/{uid}`. Tanpa role aktif, akses UI ditolak.
- `firestore.rules`: aturan awal role-based. Audit dan uji rules wajib dilakukan sebelum produksi.
- `index.html` dan `style.css`: overlay login minimal.

## Langkah wajib di Firebase Console
1. Authentication → Sign-in method: aktifkan Email/Password dan Google.
2. Authentication → Settings → Authorized domains: tambahkan domain GitHub Pages yang digunakan (misalnya `djiduthphotoworks.github.io`).
3. Authentication → Users: buat akun awal Admin Kantor Pusat.
4. Firestore → Rules: salin `firestore.rules`, lalu Publish. Jangan publish sebelum memeriksa ulang aturan dan menguji dengan Rules Playground/emulator.
5. Firestore → Data: buat koleksi `users`, dengan document ID persis UID akun admin. Isi field: `name` (string), `email` (string), `role` = `admin_pusat` (nilai role: `admin_pusat`, `kepala_divisi`, `supervisor`, `tim_lapangan`), `active` = `true`.
6. Uji login email dan Google. Google login dengan email yang belum mempunyai dokumen `users/{uid}` harus ditolak.

## Batas tahap ini
- Dashboard membaca proyek + `scopes` dari Firestore saat login (baca saja, tidak realtime). Chat, notifikasi, laporan, dan penulisan data belum terhubung; perubahan di UI dibatalkan. Proyek perlu field `assignedUsers` (array UID) agar terlihat oleh supervisor/tim lapangan. Login gate bukan bukti bahwa data demo lokal telah menjadi database bersama.
- Saat ini admin membuat akun pertama secara manual melalui Firebase Console. Membuat akun pengguna lain dari dalam aplikasi memerlukan backend tepercaya (misalnya Cloud Functions/Admin SDK) agar sesi admin tidak terganti dan pengguna tidak dapat memberi dirinya sendiri role admin. Periksa kebutuhan billing sebelum mengaktifkan layanan tersebut.
- Rules adalah baseline awal, belum merupakan rules produksi final untuk chat, lampiran, penugasan proyek, atau audit lokasi.
- Firebase web config bukan service-account private key. Jangan pernah memasukkan service-account JSON atau private key ke repository.
