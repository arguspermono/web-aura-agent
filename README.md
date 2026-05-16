# 🤖 Aura-Agent — AI-Powered E-Commerce Claim Resolution

> **Platform otomatis untuk resolusi klaim e-commerce** — Pembeli mengajukan klaim kerusakan produk, AI menganalisis bukti, dan seller meninjau hasilnya melalui dashboard. Didukung oleh Gemini AI, Firebase, dan Google Cloud.

[![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green?logo=fastapi)](https://fastapi.tiangolo.com)
[![Vite](https://img.shields.io/badge/Vite-8.x-purple?logo=vite)](https://vitejs.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Auth+Firestore-orange?logo=firebase)](https://firebase.google.com)
[![GCP](https://img.shields.io/badge/Google_Cloud-Run-4285F4?logo=googlecloud)](https://cloud.google.com/run)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-F7DF1E?logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

---

## 📑 Daftar Isi

- [Gambaran Umum](#-gambaran-umum)
- [Alur Kerja Sistem](#-alur-kerja-sistem)
- [Tech Stack](#️-tech-stack)
- [Arsitektur Proyek](#-arsitektur-proyek)
- [Quick Start](#-quick-start)
  - [Prasyarat](#prasyarat)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Setup Backend](#2-setup-backend)
  - [3. Setup Frontend](#3-setup-frontend)
- [Konfigurasi Environment](#-konfigurasi-environment)
- [Menjalankan Aplikasi](#-menjalankan-aplikasi)
- [API Reference](#-api-reference)
- [Mode Simulasi (Mock Mode)](#-mode-simulasi-mock-mode)
- [Autentikasi & Role Pengguna](#-autentikasi--role-pengguna)
- [Deploy ke Production](#-deploy-ke-production)
- [Troubleshooting](#-troubleshooting)
- [Lisensi](#-lisensi)

---

## 🌟 Gambaran Umum

**Aura-Agent** adalah platform full-stack yang mengotomasi proses penanganan klaim kerusakan produk di e-commerce. Sistem ini menggabungkan kecerdasan buatan (Gemini AI) dengan validasi forensik untuk memberikan keputusan yang cepat, akurat, dan transparan.

### Fitur Utama

| Fitur | Deskripsi |
|---|---|
| 🧠 **Analisis AI Otomatis** | Gemini 1.5 Flash menganalisis foto/video bukti kerusakan secara multimodal |
| 🔬 **Validasi Forensik** | Pengecekan metadata EXIF dan deteksi manipulasi file |
| 📊 **Confidence Scoring** | Skor kepercayaan 0.0–1.0 untuk setiap klaim |
| 🛒 **Dual Dashboard** | Dashboard terpisah untuk pembeli (buyer) dan penjual (seller) |
| 🔐 **Firebase Auth** | Autentikasi aman dengan JWT token |
| 💰 **Refund Otomatis** | Integrasi Midtrans untuk proses refund |
| ☁️ **Cloud Native** | Deploy ke Google Cloud Run dengan satu perintah |

---

## 🔄 Alur Kerja Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vite + Vanilla JS)             │
│                                                                 │
│   Buyer                              Seller                    │
│   ┌──────────┐                       ┌──────────────────┐      │
│   │ Register │──→ Pilih Role ──→     │ Seller Dashboard │      │
│   │ / Login  │    (Buyer)            │ Lihat Semua Klaim│      │
│   └──────────┘                       └────────┬─────────┘      │
│        ↓                                      ↓                │
│   ┌──────────┐                       ┌──────────────────┐      │
│   │ Dashboard│                       │ Detail Klaim +   │      │
│   │ (Hub)    │                       │ Hasil AI         │      │
│   └────┬─────┘                       └────────┬─────────┘      │
│        ↓                                      ↓                │
│   ┌──────────┐                       ┌──────────────────┐      │
│   │ Upload   │                       │ Approve / Reject │      │
│   │ Bukti    │                       └──────────────────┘      │
│   └────┬─────┘                                                  │
│        ↓                                                        │
│   ┌──────────┐                                                  │
│   │ Tunggu   │                                                  │
│   │ Hasil AI │                                                  │
│   └────┬─────┘                                                  │
│        ↓                                                        │
│   ┌──────────┐                                                  │
│   │ Lihat    │                                                  │
│   │ Keputusan│                                                  │
│   └──────────┘                                                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP + JWT Token
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI + Uvicorn)                │
│                                                                 │
│   ┌──────────┐    ┌───────────┐    ┌──────────────────┐        │
│   │ Upload   │──→ │ Simpan ke │──→ │ Gemini AI        │        │
│   │ Bukti    │    │ GCS       │    │ Analisis Gambar  │        │
│   └──────────┘    └───────────┘    └────────┬─────────┘        │
│                                             ↓                   │
│                                    ┌──────────────────┐        │
│                                    │ Forensic Check   │        │
│                                    │ (EXIF + Integritas)│       │
│                                    └────────┬─────────┘        │
│                                             ↓                   │
│                                    ┌──────────────────┐        │
│                                    │ Confidence Score │        │
│                                    │ + Keputusan      │        │
│                                    └──────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend

| Teknologi | Kegunaan |
|---|---|
| **Python 3.10+** | Bahasa pemrograman utama |
| **FastAPI** | Web framework — REST API |
| **Uvicorn** | ASGI server |
| **Gemini 1.5 Flash** | Analisis multimodal (teks + gambar) via Vertex AI |
| **Firestore** | Database NoSQL — menyimpan klaim dan profil user |
| **Google Cloud Storage** | Menyimpan file bukti (foto/video) |
| **Firebase Auth** | Verifikasi token JWT |
| **BigQuery** | Analitik trust score pengguna |
| **Midtrans** | Proses refund otomatis |

### Frontend

| Teknologi | Kegunaan |
|---|---|
| **Vanilla JavaScript** | Logika aplikasi — tanpa framework besar (React/Vue) |
| **Vite 8.x** | Build tool & development server dengan hot reload |
| **Firebase SDK** | Autentikasi client-side (email & password) |
| **Capacitor** | Build ke Android (opsional) |

---

## 📂 Arsitektur Proyek

```
web_final_aura_agent_app/
│
├── 📄 README.md                          ← Anda di sini
│
├── 🔧 web_backend_aura_agent_app/        ← Backend (FastAPI)
│   ├── main.py                           # Entry point FastAPI
│   ├── requirements.txt                  # Dependencies Python
│   ├── start.sh / start.ps1              # Script untuk menjalankan server
│   ├── .env.example                      # Template konfigurasi backend
│   ├── Dockerfile                        # Build image untuk Cloud Run
│   │
│   ├── api/
│   │   ├── routers/
│   │   │   ├── auth.py                   # Endpoint autentikasi
│   │   │   ├── users.py                  # Profil dan role user
│   │   │   ├── claims.py                 # CRUD klaim + trigger AI
│   │   │   ├── upload.py                 # Upload/download file bukti
│   │   │   └── seller.py                 # Dashboard seller
│   │   └── dependencies/
│   │       └── auth.py                   # Validasi token Firebase
│   │
│   ├── services/
│   │   ├── firebase_service.py           # Operasi Firestore
│   │   ├── storage_service.py            # Operasi Google Cloud Storage
│   │   ├── bigquery_service.py           # Analitik trust score
│   │   ├── skills/
│   │   │   ├── multimodal_reasoning.py   # Analisis Gemini AI
│   │   │   └── forensic_validation.py    # Validasi integritas file
│   │   └── workflows/
│   │       └── analysis_workflow.py      # Pipeline analisis AI
│   │
│   ├── models/
│   │   └── schemas.py                    # Pydantic models / schema
│   │
│   └── core/
│       └── config.py                     # Konfigurasi dari .env
│
└── 🌐 web_frontend_aura_agent_app/       ← Frontend (Vite + Vanilla JS)
    ├── index.html                        # Entry point HTML
    ├── package.json                      # Dependencies & scripts
    ├── .env.example                      # Template environment variables
    │
    └── src/
        ├── main.js                       # Router utama & state management
        ├── style.css                     # Styling global
        │
        ├── screens/                      # Semua halaman aplikasi
        │   ├── auth.js                   # Login & Register
        │   ├── onboarding.js             # Pilih role (buyer/seller)
        │   ├── hub.js                    # Dashboard pembeli
        │   ├── evidence.js               # Form klaim + upload bukti
        │   ├── ai_analysis.js            # Loading analisis AI
        │   ├── decision.js               # Hasil keputusan AI
        │   ├── user_claims.js            # Riwayat klaim pembeli
        │   ├── user_claim_detail.js      # Detail klaim (buyer view)
        │   ├── seller_dashboard.js       # Dashboard seller
        │   ├── seller_claim_detail.js    # Detail klaim (seller view)
        │   └── notifications.js          # Notifikasi
        │
        ├── services/
        │   ├── api_service.js            # HTTP request ke backend
        │   ├── auth_service.js           # Firebase Authentication
        │   └── notification_state.js     # State notifikasi lokal
        │
        └── config/
            └── demo.js                   # Konfigurasi demo & persistence
```

---

## 🚀 Quick Start

### Prasyarat

Pastikan sudah terinstall di komputer Anda:

| Software | Versi | Keterangan |
|---|---|---|
| [Python](https://www.python.org/downloads/) | 3.10+ | Untuk menjalankan backend |
| [Node.js](https://nodejs.org/) | 18+ | Untuk menjalankan frontend (npm sudah termasuk) |
| [Git](https://git-scm.com/) | Terbaru | Version control |
| [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) | Terbaru | *Opsional — hanya untuk mode real GCP* |

---

### 1. Clone Repository

```bash
git clone https://github.com/arguspermono/web-aura-agent.git
cd web-aura-agent
```

---

### 2. Setup Backend

```bash
# Masuk ke folder backend
cd web_backend_aura_agent_app

# Buat virtual environment
python -m venv venv

# Aktifkan virtual environment
venv\Scripts\activate          # Windows (PowerShell/CMD)
# atau
source venv/bin/activate       # Mac/Linux

# Install semua dependencies
pip install -r requirements.txt

# Copy template konfigurasi
copy .env.example .env         # Windows
# atau
cp .env.example .env           # Mac/Linux
```

> 💡 **Untuk frontend developer:** Cukup set `MOCK_MODE=true` di file `.env`. Tidak perlu kredensial GCP — semua response AI/storage akan disimulasikan.

---

### 3. Setup Frontend

```bash
# Dari root folder, masuk ke folder frontend
cd web_frontend_aura_agent_app

# Install semua package
npm install

# Copy template konfigurasi
copy .env.example .env.local   # Windows
# atau
cp .env.example .env.local     # Mac/Linux
```

Buka file `.env.local` dan sesuaikan nilainya (lihat bagian [Konfigurasi Environment](#-konfigurasi-environment)).

---

## 🔧 Konfigurasi Environment

### Backend (`web_backend_aura_agent_app/.env`)

```env
# ── Mode Utama ─────────────────────────────────────────────────
# true  → Simulasi tanpa GCP (cocok untuk development)
# false → Menggunakan GCP sungguhan (butuh kredensial)
MOCK_MODE=true

# ── GCP / Firebase (isi jika MOCK_MODE=false) ──────────────────
GCP_PROJECT_ID="your-gcp-project-id"
GCS_BUCKET_NAME="your-project.firebasestorage.app"
FIREBASE_DATABASE_URL="https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app/"

# Path ke service account JSON (kosongkan jika pakai gcloud auth login)
GOOGLE_APPLICATION_CREDENTIALS=""

# ── Gemini AI ──────────────────────────────────────────────────
VERTEX_AI_LOCATION="us-central1"
GEMINI_MODEL_ID="gemini-1.5-flash"

# ── CORS — domain frontend yang diizinkan ──────────────────────
FRONTEND_ORIGINS="http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173"
```

### Frontend (`web_frontend_aura_agent_app/.env.local`)

```env
# ── URL Backend ────────────────────────────────────────────────
VITE_API_BASE_URL=http://localhost:8000/api/v1

# ── Firebase Configuration ─────────────────────────────────────
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
```

> 💡 **Tip:** Nilai Firebase bisa ditemukan di [Firebase Console](https://console.firebase.google.com/) → Project Settings → Web App → SDK Configuration.

---

## ▶️ Menjalankan Aplikasi

### Menjalankan Backend

**Cara tercepat (Windows PowerShell):**
```powershell
cd web_backend_aura_agent_app
.\start.ps1
```

**Cara tercepat (Bash / Git Bash):**
```bash
cd web_backend_aura_agent_app
bash start.sh
```

**Cara manual:**
```bash
cd web_backend_aura_agent_app
venv/Scripts/python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

> ⚠️ Selalu gunakan `--host 0.0.0.0` agar bisa diakses dari Android emulator (`10.0.2.2`) dan perangkat di jaringan yang sama.

Setelah berjalan, akses URL berikut untuk verifikasi:

| URL | Keterangan |
|---|---|
| http://localhost:8000 | Health check — info versi |
| http://localhost:8000/health | Status server |
| http://localhost:8000/docs | **Swagger UI** — coba semua endpoint secara interaktif |
| http://localhost:8000/redoc | ReDoc — dokumentasi API alternatif |

---

### Menjalankan Frontend

```bash
cd web_frontend_aura_agent_app
npm run dev
```

Buka browser di `http://localhost:5173` — setiap perubahan kode akan langsung terlihat (hot reload).

**Untuk build production:**
```bash
npm run build      # Build
npm run preview    # Preview di http://localhost:4173
```

---

## 📡 API Reference

### Authentication & Users

| Method | Endpoint | Keterangan |
|---|---|---|
| `POST` | `/api/v1/users/register` | Daftarkan profil user baru setelah registrasi Firebase |
| `POST` | `/api/v1/users/role` | Set role user (`buyer` / `seller`) |
| `GET` | `/api/v1/users/me` | Ambil profil user yang sedang login |

### Klaim (Claims)

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/v1/claims?user_id={uid}` | Ambil semua klaim milik user |
| `POST` | `/api/v1/claims/` | Buat klaim baru |
| `GET` | `/api/v1/claims/{id}` | Detail satu klaim |
| `POST` | `/api/v1/claims/{id}/analyze` | Trigger analisis AI (async) |

### Upload Bukti

| Method | Endpoint | Keterangan |
|---|---|---|
| `POST` | `/api/v1/upload/` | Upload file bukti (gambar/video) |
| `GET` | `/api/v1/upload/{file_id}/view` | Lihat/download file bukti |

### Seller Dashboard

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/v1/seller/claims` | Semua klaim yang masuk ke seller |
| `GET` | `/api/v1/seller/claims/{id}` | Detail klaim untuk seller |
| `POST` | `/api/v1/seller/claims/{id}/decision` | Approve atau reject klaim |

### Format Response Standar

```json
{
  "status": "ok",
  "data": { "..." },
  "message": "Deskripsi hasil",
  "timestamp": "2026-05-16T10:00:00Z"
}
```

Semua endpoint (kecuali `GET /` dan `GET /health`) membutuhkan header autentikasi:
```
Authorization: Bearer <firebase-id-token>
```

---

## 🎭 Mode Simulasi (Mock Mode)

Ketika `MOCK_MODE=true` di backend, semua layanan GCP disimulasikan — **tidak perlu kredensial apapun!**

| Layanan | Perilaku Mock |
|---|---|
| **Gemini AI** | Mengembalikan hasil analisis "approved" dengan confidence 0.92 |
| **Forensic** | Mengembalikan skor bersih (1.0) — tidak ada manipulasi terdeteksi |
| **Firestore** | Menyimpan data ke memori (hilang saat server restart) |
| **GCS** | Menyimpan file ke memori dengan URL palsu |
| **Midtrans** | Mensimulasikan refund berhasil |

> ⚡ **Mode ini ideal untuk frontend development dan demo!** Cukup jalankan backend tanpa setup GCP sama sekali.

---

## 🔐 Autentikasi & Role Pengguna

### Cara Kerja Autentikasi

```
1. User login/register → Firebase Authentication (email & password)
2. Firebase memberikan ID Token (JWT) — berlaku 1 jam
3. Setiap request ke backend → api_service.js menambahkan header:
   Authorization: Bearer <firebase-id-token>
4. Backend memverifikasi token menggunakan Firebase Admin SDK
5. Token expired → Firebase auto-refresh di background
```

### Role Pengguna

| Role | Akses |
|---|---|
| **Buyer** | Dashboard klaim, buat klaim baru, upload bukti, lihat riwayat, lihat hasil AI |
| **Seller** | Dashboard seller, lihat semua klaim masuk, review detail + bukti + hasil AI, approve/reject |

Role dipilih saat onboarding pertama kali dan disimpan di Firestore. Login berikutnya otomatis redirect ke dashboard yang sesuai.

---

## ☁️ Deploy ke Production

### Backend → Google Cloud Run

```bash
# 1. Login ke Google Cloud
gcloud auth login
gcloud config set project aura-agent-495809

# 2. Deploy
gcloud run deploy aura-agent-backend \
  --source ./web_backend_aura_agent_app \
  --region asia-southeast2 \
  --allow-unauthenticated

# 3. Set environment variables
gcloud run services update aura-agent-backend \
  --region asia-southeast2 \
  --set-env-vars "MOCK_MODE=false,GCP_PROJECT_ID=aura-agent-495809,GCS_BUCKET_NAME=aura-agent-495809.firebasestorage.app,VERTEX_AI_LOCATION=us-central1,GEMINI_MODEL_ID=gemini-1.5-flash,FRONTEND_ORIGINS=*"
```

### Frontend → Hosting (Vite Build)

```bash
cd web_frontend_aura_agent_app

# Update .env.local dengan URL Cloud Run production
# VITE_API_BASE_URL=https://aura-agent-backend-474525252501.asia-southeast2.run.app/api/v1

npm run build
# Output di folder dist/ — deploy ke hosting pilihan Anda
```

### URL Koneksi per Environment

| Environment | Backend URL |
|---|---|
| **Local Development** | `http://localhost:8000/api/v1` |
| **Android Emulator** | `http://10.0.2.2:8000/api/v1` |
| **Production (Cloud Run)** | `https://aura-agent-backend-474525252501.asia-southeast2.run.app/api/v1` |

---

## 🛑 Troubleshooting

### Frontend

| Masalah | Penyebab | Solusi |
|---|---|---|
| **"Belum tersambung" / "Cannot reach backend"** | `VITE_API_BASE_URL` belum diisi atau backend belum berjalan | Pastikan backend berjalan di `localhost:8000`, cek `.env.local`, lalu restart `npm run dev` |
| **Seller diarahkan ke dashboard buyer** | Role belum terbaca dari backend | Pastikan `GET /api/v1/users/me` mengembalikan `role: "seller"` |
| **Firebase error: "Missing or invalid API key"** | Nilai `VITE_FIREBASE_*` salah | Salin ulang dari [Firebase Console](https://console.firebase.google.com/) → Project Settings → Web App |
| **Video bukti tidak tampil** | Format tidak didukung browser | Gunakan format `.mp4` (H.264) |

### Backend

| Masalah | Penyebab | Solusi |
|---|---|---|
| **Android emulator tidak bisa akses server** | Server hanya bind ke `127.0.0.1` | Jalankan dengan `--host 0.0.0.0` |
| **`403 Missing or insufficient permissions`** | Service account kurang role | Tambahkan role: `roles/datastore.user`, `roles/storage.admin`, `roles/firebase.admin` |
| **`you need a private key to sign credentials`** | Cloud Run Compute Engine credentials tidak punya private key | Backend sudah dikonfigurasi menggunakan proxy URL (`/api/v1/upload/{id}/view`) sebagai pengganti signed URL |
| **`ModuleNotFoundError: No module named 'services.skills'`** | `.gcloudignore` mengecualikan folder `skills` | Pastikan `.gcloudignore` menggunakan `/skills/` (dengan `/` di depan) agar hanya exclude folder di root |

---

## 👥 Tim

**Aura-Agent Team** — Internal Project © 2026

---

## 📝 Lisensi

Internal project — Aura-Agent Team © 2026
