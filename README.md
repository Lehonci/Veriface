# 🛡️ Identity Gateway: Pre-Screening Biometrik & 3D Liveness Detection

Sistem **Pre-Screening Identity Gateway** berbasis web untuk deteksi *spoofing* dan pemalsuan identitas (*face spoofing / screen replay attacks*) pada proses **Wawancara Kerja Online (Online Job Recruitment)**. 

Dibangun dengan arsitektur **Client-Side Edge Computing** menggunakan Google MediaPipe Face Mesh (WASM/WebGL) sehingga pemrosesan biometrik berjalan **100% gratis, privat, dan tanpa beban GPU server**, dipadukan dengan desain modern bertema **Dark Maroon Glassmorphism**.

---

## 🌟 Fitur Utama

### 1. Sisi Pelamar (Client Gateway)
* **Passive 3D Liveness Detection:** Mengambil 478 titik koordinat *face mesh* secara real-time dan menghitung variansi kedalaman $\sigma^2(z)$ pada kontur wajah (hidung, pipi, dahi). Foto 2D, cetakan kertas, atau layar smartphone akan terdeteksi sebagai permukaan datar (*flat surface*) dan langsung ditandai sebagai indikasi *spoofing*.
* **Virtual Camera Blocker:** Memindai label perangkat webcam via `navigator.mediaDevices.enumerateDevices()` dan menolak driver kamera virtual (OBS Virtual Cam, ManyCam, SplitCam, DroidCam, dll.).
* **Adaptive Luminance Pre-Check:** Mengukur intensitas pencahayaan ruangan secara otomatis dengan formula standar ITU-R BT.601 ($Y = 0.299R + 0.587G + 0.114B$) untuk mencegah kegagalan verifikasi akibat ruangan gelap.
* **Smart Auto-Redirect & Zoom Guide:** Memberikan panduan resmi pengubahan nama tampilan Zoom: `[Posisi/Kode Undangan] - [Nama Lengkap]`, tombol salin instan, serta hitung mundur pengalihan ke URL Zoom Meeting aktif.

### 2. Sisi Host / HR (Admin Audit Dashboard)
* **Visual Face Matching Panel:** Menampilkan foto *snapshot* resolusi tinggi pelamar yang terverifikasi (atau bukti anomali *spoofing*) agar Host dapat mencocokkannya dengan peserta di *Waiting Room Zoom* sebelum menekan tombol **Admit** atau **Remove**.
* **Real-time Live Feed:** Terkoneksi via WebSocket Supabase Realtime—data verifikasi baru masuk seketika tanpa perlu me-refresh halaman.
* **Analisis & Metrik KPI:** Statistik total pelamar, rasio kelulusan (*pass rate* %), jumlah *spoofing* terdeteksi, serta diagram distribusi visual (Recharts).
* **Manajemen Link Zoom Dinamis:** Formulir konfigurasi URL meeting, passcode, dan judul sesi wawancara yang dapat diubah kapan saja tanpa *redeploy* aplikasi.
* **Role-Based Security:** Portal admin terlindungi *auth guard* khusus; pelamar kerja tidak perlu membuat akun/login sehingga proses berjalan cepat (*frictionless*).

---

## 🛠️ Tech Stack

| Layer | Teknologi |
| :--- | :--- |
| **Framework** | [Next.js 14](https://nextjs.org/) (App Router, Server Actions, API Routes) |
| **Bahasa** | [TypeScript](https://www.typescriptlang.org/) |
| **Computer Vision Engine** | [Google MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) (Face Landmarker / Face Mesh) |
| **Styling & UI** | [Tailwind CSS v3](https://tailwindcss.com/) (Custom Dark Maroon Glassmorphism Design Tokens) |
| **Database & Realtime** | [Supabase](https://supabase.com/) (PostgreSQL DDL, Realtime WebSocket Channels, Storage) |
| **Keamanan & Token** | [Jose](https://github.com/panva/jose) (Signed JWT Token HMAC-SHA256) |
| **Visualisasi & Ikon** | [Recharts](https://recharts.org/), [Lucide React](https://lucide.dev/), [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti) |

---

## 📁 Struktur Direktori

```text
├── public/                 # Aset statis & logo vektor (logo.svg)
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── dashboard/  # Dashboard audit visual & face matching host
│   │   │   ├── login/      # Halaman otentikasi admin/host
│   │   │   └── settings/   # Manajemen dinamis URL & passcode Zoom
│   │   ├── api/
│   │   │   ├── admin/      # Endpoint stats, logs, & zoom settings
│   │   │   └── verify/     # Endpoint pemrosesan liveness pass & fail
│   │   ├── globals.css     # Theme layers, frosted glass, & ambient glow
│   │   ├── layout.tsx      # Root layout & dark mode provider
│   │   └── page.tsx        # Gateway utama pelamar (macOS 2-Column Split)
│   ├── components/         # Navbar, IdentityForm, CameraView, Modals
│   ├── hooks/              # useCamera & useFaceLandmarker (MediaPipe Engine)
│   ├── lib/
│   │   ├── cv/             # Perhitungan Z-depth variance, luminance, crop WebP
│   │   ├── supabase/       # Klien Supabase (Client, Server, & In-Memory Store)
│   │   └── jwt.ts          # Generator signed JWT token
│   └── types/              # Definisi interface TypeScript
└── supabase/
    └── schema.sql          # Skrip DDL PostgreSQL, ENUM, RLS, & Realtime
```

---

## 🚀 Panduan Instalasi & Menjalankan Lokal

### 1. Kloning Repositori
```bash
git clone https://github.com/Lehonci/viskom.git
cd viskom
```

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Konfigurasi Lingkungan (`.env.local`)
Salin file `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```

Isi file `.env.local`:
```env
# Supabase Configuration (Opsional untuk cloud DB permanen)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Keamanan JWT
JWT_SECRET=identity_gateway_super_secret_jwt_key_2026_xyz

# Kredensial Login Admin Default
ADMIN_EMAIL=admin@company.com
ADMIN_PASSWORD=adminpassword123
```
> 💡 **Catatan Mode Hybrid:** Jika kunci Supabase dikosongkan, sistem secara otomatis menggunakan **In-Memory Store**. Anda tetap dapat menguji coba aplikasi secara lokal tanpa kendala!

### 4. Menjalankan Server Pengembangan
```bash
npm run dev
```
Buka peramban pada alamat:
* **Halaman Pelamar (Gateway):** [http://localhost:3000](http://localhost:3000)
* **Portal Host / Admin:** [http://localhost:3000/admin/login](http://localhost:3000/admin/login)  
  *(Email: `admin@company.com` | Password: `adminpassword123`)*

---

## 🗄️ Setup Database Supabase Cloud (Permanen)

Jika ingin menyimpan riwayat audit dan snapshot secara permanen di cloud:
1. Buat project baru di [Supabase](https://supabase.com/).
2. Buka menu **SQL Editor** pada dashboard Supabase Anda.
3. Buka file [`supabase/schema.sql`](./supabase/schema.sql), salin seluruh kodenya, lalu klik **Run**.
4. Masuk ke **Project Settings $\to$ API**, salin `Project URL`, `anon key`, dan `service_role key` ke file `.env.local`.
5. Buat bucket baru bernama `snapshots` di menu **Storage** dengan akses *Public Read*.
6. Restart server (`npm run dev`).

---

## 🧪 Skenario Pengujian Sistem

| No | Skenario Uji | Prosedur | Ekspektasi Hasil |
| :---: | :--- | :--- | :--- |
| **1** | **Wajah Asli (Normal)** | Lengkapi form, tatap kamera secara wajar selama 2-3 detik | Verifikasi `PASSED`, modal sukses muncul, auto-redirect ke link Zoom. |
| **2** | **Foto 2D / Layar HP (Spoofing)** | Arahkan foto wajah di smartphone ke arah webcam | Variansi kedalaman pipih, status `SPOOF_FAILED`, snapshot terkirim ke dashboard audit. |
| **3** | **Driver Kamera Virtual** | Buka kamera menggunakan OBS Virtual Camera / VCam | Akses langsung diblokir (*VIRTUAL_CAM_BLOCKED*). |
| **4** | **Pencahayaan Gelap** | Uji coba di ruangan dengan sumber cahaya redup (< 40 Lux) | Muncul peringatan pencahayaan redup, pemindaian ditahan demi akurasi. |
| **5** | **Real-time Live Feed** | Buka tab admin dan tab pelamar berdampingan | Log pelamar langsung bertambah seketika tanpa perlu refresh browser. |

---

## 📄 Lisensi & Kontributor

Dikembangkan sebagai bagian dari riset tugas besar **Computer Vision (TRPL - Semester 5)**.  
*Hak Cipta &copy; 2026 Pre-Screening Identity Gateway Research.*
