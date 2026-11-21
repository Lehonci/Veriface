# 🛡️ Veriface: Pre-Screening Biometrik & 3D Liveness Detection

Sistem **Pre-Screening Identity Gateway** berbasis web untuk mendeteksi pemalsuan identitas (*face spoofing*, foto cetak, dan *screen replay attack*) sebelum kandidat masuk ke sesi **Wawancara Kerja Online (Zoom Meeting)**.

Pemrosesan biometrik berjalan langsung di browser (**Client-Side Edge Computing**) memadukan **MediaPipe Face Landmarker** dan model **CNN MobileNetV3-Small Multi-Head (ONNX)** lewat WebAssembly/WebGL tanpa membutuhkan server GPU, sementara validasi sesi, keamanan API, notifikasi email, dan audit visual ditangani oleh backend Next.js 16 dan Supabase.

---

## 🌟 Fitur Utama

### 1. Sisi Pelamar (Client Gateway)
* **Multi-Frame CNN Liveness + 3D Depth Variance:** Menggabungkan evaluasi model ONNX MobileNetV3 Multi-Head di beberapa *frame* selama 2,5 detik (*median voting*) dan analisis 478 landmark 3D MediaPipe untuk membedakan wajah manusia nyata dari foto cetak atau layar ponsel.
* **Adaptive Illumination & Attribute Gate:**
  * Memeriksa kecerahan wajah menggunakan luminansi **ITU-R BT.601** (`min_mean_luma = 50`). Ruangan terlalu redup dicatat sebagai `POOR_LIGHTING`, bukan `SPOOF_FAILED`.
  * Mendeteksi masker dan kacamata melalui kombinasi `occlusion_logit` ONNX dan heuristik MediaPipe (`facialAccessories.ts`), lalu menahan pemindaian secara lokal hingga atribut dilepas.
* **Virtual Camera Blocker:** Memeriksa daftar perangkat media serta properti `MediaStreamTrack` untuk memblokir driver kamera virtual (OBS Virtual Cam, ManyCam, SplitCam, DroidCam, Iriun, Snap Camera, dll.).
* **Human-in-the-Loop Audit Gate & Banding:**
  * Jika lolos AI (`PASSED`) saat mode manual aktif, kandidat menunggu konfirmasi Host dengan batas waktu *Fail-Safe Auto-Admit* (default 30 detik).
  * Jika ditolak AI (`SPOOF_FAILED` / `POOR_LIGHTING`), kandidat dapat menekan **Ajukan Tinjauan Admin** dengan batas waktu *Fail-Secure* 60 detik (akses tetap ditolak bila tidak disetujui Host).
* **Anti-Replay Scan Challenge & Zoom Pass:** Pengajuan verifikasi diwajibkan melewati token *scan challenge* sekali pakai, verifikasi skor/snapshot di server, dan token akses Zoom bertanda tangan JWT (`HS256`).

### 2. Sisi Host / HR (Admin Audit Dashboard)
* **Audit Visual & Panel Perbandingan Side-by-Side:** Membandingkan *snapshot* saat verifikasi biometrik dengan tangkapan layar langsung dari jendela/tab Zoom (`getDisplayMedia` + MediaPipe auto-crop 1-klik) sebelum menekan **Izinkan** atau **Tolak**.
* **Notifikasi Real-Time Desktop & Email (Gmail SMTP):** Mengirim alert browser (*Web Notifications API + audio chime*) dan email HTML ke HP HR via `nodemailer` ketika ada kandidat menunggu atau memicu indikasi spoofing/banding.
* **Manajemen Kebijakan Dinamis (`/admin/dashboard` & `/admin/settings`):** Mengatur URL Zoom aktif, *passcode*, mode *Auto-Redirect* vs *Manual Gate*, durasi *Auto-Admit Timeout*, penerima email notifikasi, serta mode sensitivitas AI (`Seimbang EER 62.9%` vs `Ketat 70.6%`).
* **Keamanan Portal Admin:** Autentikasi cookie **`HttpOnly` JWT** (`ADMIN_EMAIL`/`ADMIN_PASSWORD` dengan *timing-safe comparison* atau Supabase Auth), proteksi rute via `src/proxy.ts`, guard sesi di setiap API admin, serta *rate limiting* berbasis IP.

---

## 🛠️ Tech Stack

| Layer | Teknologi |
| :--- | :--- |
| **Framework** | [Next.js 16.4](https://nextjs.org/) (App Router, Proxy Middleware, Route Handlers) |
| **Bahasa & UI** | [TypeScript](https://www.typescriptlang.org/), React 18, [Tailwind CSS v3](https://tailwindcss.com/) |
| **Computer Vision Engine** | [ONNX Runtime Web](https://onnxruntime.ai/) (`veriface_liveness.onnx`), [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) |
| **Database, Auth & Storage** | [Supabase](https://supabase.com/) (`@supabase/supabase-js`, `@supabase/ssr`, PostgreSQL RLS, Storage `snapshots`) |
| **Keamanan & Token** | [Jose](https://github.com/panva/jose) (`HS256` JWT + domain-isolated keys) |
| **Notifikasi Email** | [Nodemailer](https://nodemailer.com/) (Gmail SMTP + Google App Password) |
| **Visualisasi & Ikon** | [Recharts](https://recharts.org/), [Lucide React](https://lucide.dev/), [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti) |

---

## 📁 Struktur Direktori

```text
├── public/
│   ├── logo.svg
│   └── models/                     # Model ONNX MobileNetV3 & konfigurasi threshold (config.json)
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── dashboard/          # Dashboard KPI, Audit Visual, Live Zoom Monitor, Riwayat, Pengaturan
│   │   │   ├── login/              # Halaman login admin & reset password
│   │   │   └── settings/           # Konfigurasi link & passcode Zoom Meeting
│   │   ├── api/
│   │   │   ├── admin/
│   │   │   │   ├── auth/           # login, logout, session, forgot-password
│   │   │   │   ├── settings/       # CRUD konfigurasi Zoom & kebijakan liveness
│   │   │   │   ├── stats/          # Agregasi statistik dashboard
│   │   │   │   └── verifications/  # Daftar, keputusan ADMITTED/REMOVED, Zoom snapshot, hapus
│   │   │   └── verify/
│   │   │       ├── challenge/      # Penerbit one-time scan challenge token
│   │   │       ├── config/         # Ekspos kebijakan threshold publik non-sensitif
│   │   │       ├── fail/           # Pencatatan insiden spoofing, kamera virtual, atau cahaya redup
│   │   │       ├── pass/           # Validasi hasil verifikasi & gate Zoom
│   │   │       ├── status/         # Polling status real-time & pengajuan banding pelamar
│   │   │       └── token/          # Verifikasi token JWT akses Zoom
│   │   └── page.tsx                # Gateway utama pelamar
│   ├── components/                 # Navbar, IdentityForm, CameraView, FailureAlert, WaitingApprovalModal, SuccessModal
│   ├── hooks/                      # useCamera, useFaceLandmarker, useZoomMonitor
│   ├── lib/
│   │   ├── cv/                     # depthVariance, luminance, facialAccessories, virtualCamera, cropFace
│   │   ├── supabase/               # Klien browser & server (service_role + fallback in-memory mockDB)
│   │   ├── adminAuth.ts            # Penandatanganan & verifikasi cookie sesi HttpOnly admin
│   │   ├── adminCredentials.ts     # Validasi kredensial .env & Supabase Auth
│   │   ├── email.ts                # Pengirim alert email HTML via Gmail SMTP
│   │   ├── jwt.ts                  # Utilitas JWT & domain secret isolation
│   │   ├── rateLimit.ts            # Sliding-window IP rate limiter
│   │   ├── verifaceEngine.ts       # Loader & evaluator ONNX Runtime Web
│   │   ├── verifyChallenge.ts      # Challenge nonce, validasi metrik server, & status token pelamar
│   │   └── zoomHelpers.ts          # Manajemen Storage snapshot & payload akses Zoom
│   ├── proxy.ts                    # Proteksi rute halaman & API admin (Next.js 16 Proxy)
│   └── types/                      # Definisi interface TypeScript
└── supabase/
    ├── schema.sql                  # Skema tabel zoom_settings, verifications, ENUM, index, & RLS
    ├── storage.sql                 # Setup bucket Storage 'snapshots'
    ├── migration_audit_zoom.sql    # Migrasi kolom Audit Gate, Zoom snapshot, email & liveness_mode
    └── security_hardening_rls.sql  # Pengetatan policy RLS (menutup akses langsung peran anon)
```

---

## 🚀 Panduan Instalasi & Menjalankan Lokal

### 1. Kloning Repositori & Instalasi Dependensi
```bash
git clone https://github.com/Lehonci/Veriface.git
cd Veriface
npm install
```

### 2. Konfigurasi Lingkungan (`.env.local`)
Salin `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```

Lengkapi `.env.local` sesuai kebutuhan Anda:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_your_key_here
# Wajib diisi sebelum menerapkan supabase/security_hardening_rls.sql
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Security & JWT Token Signing (minimal 16 karakter acak kuat)
JWT_SECRET=ganti_dengan_secret_acak_minimal_32_karakter_produksi

# Kredensial Login Portal Admin
ADMIN_EMAIL=emailpribadianda@gmail.com
ADMIN_PASSWORD=PasswordAdminKuatAnda2026!

# Notifikasi Email (Gmail SMTP + Google App Password 16 digit)
SMTP_USER=emailpribadianda@gmail.com
SMTP_PASS=16digitapppassword
ADMIN_NOTIFY_EMAIL=emailpribadianda@gmail.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
> **Mode Fallback Lokal:** Apabila URL Supabase tidak dikonfigurasi, server memakai **In-Memory Store (`mockDB`)** untuk uji coba cepat tanpa cloud DB (data akan ter-reset saat server dimulai ulang).

### 3. Setup Database & Storage Supabase
1. Buat project di [Supabase](https://supabase.com/).
2. Buka **SQL Editor** dan jalankan secara berurutan:
   * [`supabase/schema.sql`](./supabase/schema.sql) — membuat tipe enum, tabel `zoom_settings` & `verifications`, indeks, dan Realtime.
   * [`supabase/storage.sql`](./supabase/storage.sql) — membuat bucket Storage `snapshots`.
   * [`supabase/migration_audit_zoom.sql`](./supabase/migration_audit_zoom.sql) — memastikan kolom Audit Gate, email, dan `liveness_mode` tersedia pada skema lama.
3. Pastikan `SUPABASE_SERVICE_ROLE_KEY` dari **Project Settings -> API -> `service_role` (secret)** sudah terpasang di `.env.local`, lalu jalankan [`supabase/security_hardening_rls.sql`](./supabase/security_hardening_rls.sql) untuk mengunci akses publik `anon`.

### 4. Menjalankan Server Pengembangan
```bash
npm run dev
```
Buka peramban:
* **Portal Pelamar (Gateway):** [http://localhost:3000](http://localhost:3000)
* **Portal Login Admin:** [http://localhost:3000/admin/login](http://localhost:3000/admin/login) (gunakan `ADMIN_EMAIL` & `ADMIN_PASSWORD` dari `.env.local`)

---

## 🧪 Skenario Pengujian Sistem

| No | Skenario Uji | Prosedur | Ekspektasi Hasil |
| :---: | :--- | :--- | :--- |
| **1** | **Wajah Asli (Normal)** | Isi form, tatap kamera selama 2,5 detik pada ruangan terang | Voting ONNX >= threshold aktif -> masuk Audit Gate atau langsung mendapat akses Zoom & token JWT. |
| **2** | **Foto 2D / Layar HP** | Arahkan foto atau video di layar ponsel ke webcam | Skor liveness di bawah threshold (`SPOOF_FAILED`), modal gagal tampil di tengah layar, tersedia opsi banding admin. |
| **3** | **Kamera Virtual & Cahaya Redup** | Gunakan OBS Virtual Camera atau ruangan gelap (`luma < 50`) | Virtual Cam langsung diblokir (`VIRTUAL_CAM_BLOCKED`); cahaya redup tercatat sebagai `POOR_LIGHTING`. |
| **4** | **Masker / Kacamata** | Pindai wajah dengan masker atau kacamata | Pemindaian ditahan lokal (`HOLD_OCCLUSION`) tanpa mencatat pelanggaran spoofing ke database. |
| **5** | **Audit & Keamanan API** | Akses `/api/admin/*` tanpa login atau `/api/verify/pass` tanpa *challenge* | Ditolak server (`401` untuk API admin, `403` untuk *pass* tanpa challenge valid / *replay token*). |

---

## 📄 Lisensi & Kontributor

Dikembangkan untuk proyek **Computer Vision (TRPL - Semester 5)**.  
*Hak Cipta &copy; 2026 Veriface.*
