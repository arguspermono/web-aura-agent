# 🌐 Aura-Agent Frontend

> **Aplikasi web untuk manajemen klaim e-commerce** — Pembeli bisa mengajukan klaim, seller bisa meninjaunya, dan AI menganalisis bukti secara otomatis.

[![Vite](https://img.shields.io/badge/Vite-5.x-purple?logo=vite)](https://vitejs.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Auth-orange?logo=firebase)](https://firebase.google.com)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-yellow?logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

---

## 📖 Bagaimana Program Ini Bekerja

Aura-Agent Frontend adalah Single Page Application (SPA) berbasis Vanilla JS + Vite. Tidak ada framework besar seperti React atau Vue — navigasi antar halaman dikelola sendiri melalui sistem routing internal di `main.js`.

### Alur Pengguna — Pembeli (Buyer)

```
Login / Register (Firebase Auth)
        ↓
Pilih role: Buyer
        ↓
Dashboard (Hub) — lihat ringkasan klaim
        ↓
Buat klaim baru → Upload foto/video bukti
        ↓
Tunggu hasil analisis AI (real-time polling)
        ↓
Lihat keputusan: Approved / Rejected / Manual Review
        ↓
Riwayat klaim tersimpan di "History"
```

### Alur Pengguna — Seller

```
Login / Register (Firebase Auth)
        ↓
Pilih role: Seller
        ↓
Dashboard Seller — lihat semua klaim masuk
        ↓
Klik klaim → Lihat detail + bukti + hasil AI
        ↓
Approve atau Reject klaim secara manual
```

### Arsitektur Layar (Screens)

| File | Fungsi |
|---|---|
| `auth.js` | Halaman login & registrasi |
| `onboarding.js` | Pilih role (buyer/seller) setelah registrasi pertama |
| `hub.js` | Dashboard pembeli — ringkasan dan klaim terbaru |
| `evidence.js` | Form pengajuan klaim + upload bukti foto/video |
| `ai_analysis.js` | Tampilan loading saat AI menganalisis klaim |
| `decision.js` | Hasil akhir keputusan AI |
| `user_claims.js` | Riwayat semua klaim milik pembeli |
| `user_claim_detail.js` | Detail satu klaim dari sisi pembeli |
| `seller_dashboard.js` | Dashboard seller — semua klaim yang masuk |
| `seller_claim_detail.js` | Detail klaim + keputusan dari sisi seller |
| `notifications.js` | Notifikasi update status klaim |

### Komunikasi dengan Backend

Semua request ke backend melalui `src/services/api_service.js`. File ini:
1. Membaca `VITE_API_BASE_URL` dari environment
2. Menambahkan `Authorization: Bearer <token>` otomatis dari Firebase Auth
3. Mengkonversi semua response ke format standar

---

## 🛠️ Prasyarat

Pastikan sudah terinstall:
- [Node.js v18+](https://nodejs.org/) — runtime JavaScript
- [npm](https://www.npmjs.com/) — package manager (sudah include dalam Node.js)
- Backend Aura-Agent yang sedang berjalan (lokal atau Cloud Run)
- Project Firebase yang sudah dikonfigurasi

---

## ⚙️ Cara Setup

### Langkah 1 — Install Dependencies

```bash
# Masuk ke folder project frontend
cd web_frontend_aura_agent_app

# Install semua package
npm install
```

### Langkah 2 — Buat File Konfigurasi `.env.local`

```bash
# Copy template konfigurasi
cp .env.example .env.local    # Mac/Linux
# atau
copy .env.example .env.local  # Windows
```

Buka `.env.local` dan isi nilainya:

```env
# ── URL Backend ────────────────────────────────────────────────────────────────
# Untuk development lokal:
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Untuk production (Cloud Run):
# VITE_API_BASE_URL=https://aura-agent-backend-474525252501.asia-southeast2.run.app/api/v1

# ── Firebase Configuration ─────────────────────────────────────────────────────
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
```

> **💡 Tip:** Nilai Firebase bisa ditemukan di [Firebase Console](https://console.firebase.google.com/) → Project Settings → Web App → SDK Configuration.

---

## 🚀 Cara Menjalankan Program

### Mode Development (Dengan Hot Reload)

```bash
npm run dev
```

Server akan berjalan di `http://localhost:5173`. Setiap perubahan kode akan langsung terlihat di browser tanpa perlu refresh manual.

### Mode Production Build

```bash
# Build untuk production
npm run build

# Preview hasil build secara lokal
npm run preview
```

Preview akan berjalan di `http://localhost:4173`.

---

## 🗂️ Struktur Direktori

```
web_frontend_aura_agent_app/
├── index.html                   # Entry point HTML
├── vite.config.js               # Konfigurasi Vite
├── package.json                 # Dependencies & scripts
├── .env.example                 # Template environment variables
│
└── src/
    ├── main.js                  # Router utama & state management global
    ├── style.css                # Styling global
    │
    ├── screens/                 # Semua halaman aplikasi
    │   ├── auth.js              # Login & Register
    │   ├── onboarding.js        # Pilih role (buyer/seller)
    │   ├── hub.js               # Dashboard pembeli
    │   ├── evidence.js          # Form klaim + upload bukti
    │   ├── ai_analysis.js       # Loading analisis AI
    │   ├── decision.js          # Hasil keputusan AI
    │   ├── user_claims.js       # Riwayat klaim pembeli
    │   ├── user_claim_detail.js # Detail klaim (buyer view)
    │   ├── seller_dashboard.js  # Dashboard seller
    │   ├── seller_claim_detail.js # Detail klaim (seller view)
    │   └── notifications.js     # Notifikasi
    │
    ├── services/                # Komunikasi dengan backend & Firebase
    │   ├── api_service.js       # Semua HTTP request ke backend
    │   ├── auth_service.js      # Firebase Authentication
    │   └── notification_state.js # State notifikasi lokal
    │
    └── config/
        └── demo.js              # Konfigurasi draft klaim & persistence
```

---

## 🔗 Endpoint Backend yang Digunakan

Frontend berkomunikasi dengan backend melalui base URL yang dikonfigurasi di `.env.local`:

| Aksi | Endpoint |
|---|---|
| Login/Register | Firebase Auth (client-side) |
| Simpan profil user | `POST /api/v1/users/register` |
| Set role user | `POST /api/v1/users/role` |
| Ambil profil | `GET /api/v1/users/me` |
| Daftar klaim | `GET /api/v1/claims?user_id={uid}` |
| Buat klaim | `POST /api/v1/claims/` |
| Upload bukti | `POST /api/v1/upload/` |
| Lihat bukti | `GET /api/v1/upload/{id}/view` |
| Analisis AI | `POST /api/v1/claims/{id}/analyze` |
| Dashboard seller | `GET /api/v1/seller/claims` |
| Keputusan seller | `POST /api/v1/seller/claims/{id}/decision` |

---

## 🔑 Cara Kerja Autentikasi

1. User login/register melalui **Firebase Authentication** (email & password)
2. Firebase memberikan **ID Token** (JWT) yang berlaku 1 jam
3. Setiap request ke backend, `api_service.js` otomatis menambahkan header:
   ```
   Authorization: Bearer <firebase-id-token>
   ```
4. Backend memverifikasi token menggunakan Firebase Admin SDK
5. Jika token expired, Firebase secara otomatis me-refresh token di background

---

## 🎭 Role Pengguna

| Role | Akses |
|---|---|
| **Buyer** | Dashboard klaim, buat klaim, lihat history, lihat hasil AI |
| **Seller** | Dashboard seller, lihat semua klaim masuk, approve/reject |

Role dipilih saat onboarding pertama kali dan disimpan di Firestore. Setiap login berikutnya, aplikasi otomatis redirect ke dashboard yang sesuai.

---

## 🛑 Troubleshooting

### "Belum tersambung" / "Cannot reach backend"
**Penyebab:** `VITE_API_BASE_URL` belum dikonfigurasi atau backend belum berjalan.  
**Fix:**
1. Pastikan backend sudah berjalan di `http://localhost:8000`
2. Periksa file `.env.local` — pastikan `VITE_API_BASE_URL` sudah diisi
3. Setelah mengubah `.env.local`, restart server dengan `npm run dev`

---

### Seller diarahkan ke dashboard buyer setelah login
**Penyebab:** Profile role belum terbaca dari backend saat login.  
**Fix:** Pastikan backend sudah berjalan dan endpoint `GET /api/v1/users/me` mengembalikan `role: "seller"`.

---

### Firebase error: "Missing or invalid API key"
**Penyebab:** Nilai `VITE_FIREBASE_*` di `.env.local` belum diisi dengan benar.  
**Fix:** Salin konfigurasi Firebase dari [Firebase Console](https://console.firebase.google.com/) → Project Settings → Web App.

---

### Video bukti tidak tampil di preview
**Penyebab:** Browser tidak mendukung format video atau MIME type tidak dikenali.  
**Fix:** Gunakan format `.mp4` (H.264) untuk kompatibilitas terbaik lintas browser.

---

## 📝 Lisensi

Internal project — Aura-Agent Team © 2026
