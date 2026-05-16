# 🤖 Aura-Agent Backend

> **Autonomous AI Customer Support Backend** — Mengotomasi resolusi klaim e-commerce menggunakan Gemini AI, Firestore, dan Google Cloud Storage.

[![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green?logo=fastapi)](https://fastapi.tiangolo.com)
[![GCP](https://img.shields.io/badge/Google_Cloud-Run-orange?logo=googlecloud)](https://cloud.google.com/run)

---

## 📖 Bagaimana Program Ini Bekerja

Aura-Agent adalah backend yang menerima **klaim kerusakan produk** dari pembeli, lalu menganalisisnya secara otomatis menggunakan AI — tanpa perlu intervensi manual dari seller di tahap awal.

### Alur Kerja Utama

```
Pembeli upload bukti (foto/video)
        ↓
Backend simpan file ke Google Cloud Storage
        ↓
Gemini AI menganalisis gambar bukti
        ↓
Forensic validation (cek EXIF, manipulasi file)
        ↓
Confidence score dihitung (0.0 – 1.0)
        ↓
Keputusan otomatis: Approved / Rejected / Manual Review
        ↓
Seller bisa lihat hasil di dashboard
```

### Komponen Utama

| Komponen | Fungsi |
|---|---|
| `main.py` | Entry point FastAPI — mendaftarkan semua router dan middleware |
| `api/routers/` | Endpoint HTTP untuk `users`, `claims`, `upload`, `seller`, `auth` |
| `services/firebase_service.py` | Baca/tulis data ke Firestore (database utama) |
| `services/storage_service.py` | Upload/download file bukti ke Google Cloud Storage |
| `services/workflows/analysis_workflow.py` | Pipeline AI: orchestrate Gemini + forensic + scoring |
| `services/skills/multimodal_reasoning.py` | Skill Gemini — analisis gambar/video bukti |
| `services/skills/forensic_validation.py` | Skill forensik — validasi integritas file |
| `core/config.py` | Semua konfigurasi dibaca dari `.env` |

---

## 🛠️ Tech Stack

| Teknologi | Kegunaan |
|---|---|
| **FastAPI** | Web framework — REST API |
| **Uvicorn** | ASGI server — menjalankan FastAPI |
| **Gemini 1.5 Flash** | Analisis multimodal (teks + gambar) via Vertex AI |
| **Firestore** | Database NoSQL — menyimpan klaim dan profil user |
| **Google Cloud Storage** | Menyimpan file bukti (foto/video) |
| **Firebase Auth** | Verifikasi token JWT dari frontend |
| **BigQuery** | Analitik trust score pengguna |
| **Midtrans** | Proses refund otomatis |

---

## ⚙️ Cara Setup (Local Development)

### Prasyarat

Pastikan sudah terinstall:
- [Python 3.10+](https://www.python.org/downloads/)
- [Git](https://git-scm.com/)
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) *(untuk mode real GCP)*

---

### Langkah 1 — Clone & Install Dependencies

```bash
# Clone repository
git clone https://github.com/arguspermono/backend-aura-agent.git
cd backend-aura-agent

# Buat virtual environment
python -m venv venv

# Install semua dependencies
venv/Scripts/pip install -r requirements.txt   # Windows
# atau
venv/bin/pip install -r requirements.txt       # Mac/Linux
```

---

### Langkah 2 — Buat File Konfigurasi `.env`

```bash
# Copy template konfigurasi
copy .env.example .env    # Windows
# atau
cp .env.example .env      # Mac/Linux
```

Lalu buka file `.env` dan sesuaikan nilainya:

```env
# ── Mode Utama ─────────────────────────────────────────────────────────────────
# true  → Jalankan tanpa GCP (simulasi — cocok untuk frontend team)
# false → Jalankan dengan GCP sungguhan (butuh kredensial di bawah)
MOCK_MODE=true

# ── GCP / Firebase (isi jika MOCK_MODE=false) ──────────────────────────────────
GCP_PROJECT_ID="aura-agent-495809"
GCS_BUCKET_NAME="aura-agent-495809.firebasestorage.app"
FIREBASE_DATABASE_URL="https://aura-agent-495809-default-rtdb.asia-southeast1.firebasedatabase.app/"

# Path ke service account JSON (atau biarkan kosong jika pakai gcloud login)
GOOGLE_APPLICATION_CREDENTIALS=""

# ── Gemini AI ──────────────────────────────────────────────────────────────────
VERTEX_AI_LOCATION="us-central1"
GEMINI_MODEL_ID="gemini-1.5-flash"

# ── CORS — domain frontend yang diizinkan ──────────────────────────────────────
FRONTEND_ORIGINS="http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173"
```

> **💡 Untuk frontend team:** Cukup set `MOCK_MODE=true`. Tidak perlu kredensial GCP apapun. Semua response AI/storage akan disimulasikan.

---

### Langkah 3 — Jalankan Server

**Cara tercepat (Windows PowerShell):**
```powershell
.\start.ps1
```

**Cara tercepat (Bash / Git Bash):**
```bash
bash start.sh
```

**Cara manual:**
```bash
venv/Scripts/python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

> ⚠️ Selalu gunakan `--host 0.0.0.0` agar bisa diakses dari Android emulator (`10.0.2.2`) dan perangkat fisik di jaringan yang sama.

---

### Langkah 4 — Verifikasi Server Berjalan

Buka browser dan akses:

| URL | Keterangan |
|---|---|
| http://localhost:8000 | Health check — menampilkan info versi |
| http://localhost:8000/health | Status server |
| http://localhost:8000/docs | **Swagger UI** — coba semua endpoint interaktif |
| http://localhost:8000/redoc | ReDoc — dokumentasi API alternatif |

---

## 🌐 Koneksi dari Frontend

Gunakan `VITE_API_BASE_URL` di frontend sesuai environment:

| Environment | URL |
|---|---|
| **Local** | `http://localhost:8000/api/v1` |
| **Android Emulator** | `http://10.0.2.2:8000/api/v1` |
| **Production (Cloud Run)** | `https://aura-agent-backend-474525252501.asia-southeast2.run.app/api/v1` |

---

## 🚀 Deploy ke Google Cloud Run

### Prasyarat Deploy
1. Install [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
2. Login ke gcloud:
   ```bash
   gcloud auth login
   gcloud config set project aura-agent-495809
   ```

### Deploy
```bash
gcloud run deploy aura-agent-backend \
  --source . \
  --region asia-southeast2 \
  --allow-unauthenticated
```

### Set Environment Variables di Cloud Run
Setelah deploy, set env vars agar backend berjalan dengan GCP sungguhan:
```bash
gcloud run services update aura-agent-backend \
  --region asia-southeast2 \
  --set-env-vars "MOCK_MODE=false,GCP_PROJECT_ID=aura-agent-495809,GCS_BUCKET_NAME=aura-agent-495809.firebasestorage.app,FIREBASE_DATABASE_URL=https://aura-agent-495809-default-rtdb.asia-southeast1.firebasedatabase.app/,VERTEX_AI_LOCATION=us-central1,GEMINI_MODEL_ID=gemini-1.5-flash,FRONTEND_ORIGINS=*"
```

---

## 📡 Endpoint API Utama

### Authentication
| Method | Endpoint | Keterangan |
|---|---|---|
| `POST` | `/api/v1/users/register` | Daftarkan profil user baru setelah registrasi Firebase |
| `POST` | `/api/v1/users/role` | Set role user (`buyer` / `seller`) |
| `GET` | `/api/v1/users/me` | Ambil profil user yang sedang login |

### Klaim
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
Semua endpoint mengembalikan format yang konsisten:
```json
{
  "status": "ok",
  "data": { ... },
  "message": "Deskripsi hasil",
  "timestamp": "2026-05-16T10:00:00Z"
}
```

---

## 🧪 Mode Simulasi (MOCK_MODE=true)

Ketika `MOCK_MODE=true`, backend mensimulasikan semua layanan GCP:

| Layanan | Perilaku Mock |
|---|---|
| **Gemini AI** | Mengembalikan hasil analisis "approved" dengan confidence 0.92 |
| **Forensic** | Mengembalikan skor bersih (1.0) — tidak ada manipulasi |
| **Firestore** | Menyimpan data ke memori (hilang saat server restart) |
| **GCS** | Menyimpan file ke memori, URL palsu |
| **Midtrans** | Mensimulasikan refund berhasil |

> **⚡ Tidak perlu kredensial apapun untuk mode ini!**

---

## 🔐 Autentikasi

Semua endpoint (kecuali `GET /` dan `GET /health`) membutuhkan token Firebase:

```
Authorization: Bearer <firebase-id-token>
```

Token ini diperoleh dari Firebase Auth di sisi frontend secara otomatis.

---

## 🗂️ Struktur Direktori

```
backend-aura-agent/
├── main.py                      # Entry point FastAPI
├── requirements.txt             # Daftar dependencies Python
├── start.sh / start.ps1         # Script untuk menjalankan server
├── .env.example                 # Template konfigurasi
├── Dockerfile                   # Build image untuk Cloud Run
│
├── api/
│   ├── routers/
│   │   ├── auth.py              # Endpoint autentikasi
│   │   ├── users.py             # Profil dan role user
│   │   ├── claims.py            # CRUD klaim + trigger AI
│   │   ├── upload.py            # Upload/download file bukti
│   │   └── seller.py            # Dashboard seller
│   └── dependencies/
│       └── auth.py              # Validasi token Firebase
│
├── services/
│   ├── firebase_service.py      # Operasi Firestore
│   ├── storage_service.py       # Operasi GCS
│   ├── skills/
│   │   ├── multimodal_reasoning.py  # Analisis Gemini AI
│   │   └── forensic_validation.py   # Validasi integritas file
│   └── workflows/
│       └── analysis_workflow.py     # Pipeline analisis AI
│
├── models/
│   └── schemas.py               # Pydantic models / schema request-response
│
└── core/
    └── config.py                # Konfigurasi dari environment variables
```

---

## 🛑 Troubleshooting

### Server tidak bisa diakses dari Android emulator
```
SocketException: Software caused connection abort (errno = 103)
```
**Fix:** Jalankan server dengan `--host 0.0.0.0`, bukan default `127.0.0.1`.

---

### Error `403 Missing or insufficient permissions` (Firestore/GCS)
**Fix:** Pastikan service account yang digunakan memiliki role:
- `roles/datastore.user` — untuk Firestore
- `roles/storage.admin` — untuk GCS
- `roles/firebase.admin` — untuk Firebase Auth verification

---

### Error `you need a private key to sign credentials`
**Fix:** Ini terjadi di Cloud Run karena Compute Engine credentials tidak punya private key. Backend sudah dikonfigurasi untuk menggunakan proxy URL (`/api/v1/upload/{id}/view`) sebagai pengganti signed URL GCS.

---

### Error `ModuleNotFoundError: No module named 'services.skills'`
**Fix:** Pastikan file `.gcloudignore` tidak mengandung kata `skills` (tanpa `/` di depan) — itu akan mengecualikan folder `services/skills/` juga. Gunakan `/skills/` untuk hanya mengecualikan folder `skills/` di root.

---

## 📝 Lisensi

Internal project — Aura-Agent Team © 2026
