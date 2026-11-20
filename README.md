# Cloud File Security System

A full-stack cybersecurity file management platform that encrypts files with **AES-256-GCM**, verifies integrity via **SHA-256** cryptographic hashing, stores ciphertext exclusively in **AWS S3** (with an automatic private local encrypted vault fallback when AWS credentials are unavailable), and provides custom from-scratch implementations of **Linear Search**, **Binary Search**, **Merge Sort**, and **Quick Sort**.

This repository contains:
1. **Live Interactive Full-Stack Web Application** (`server.ts` + `server/` + `src/`) running on Node.js + Express + SQLite + React + Tailwind CSS (port `3000`).
2. **Complete Python / Flask Academic Reference Implementation** (`app.py` + `config.py` + `encryption/` + `algorithms/` + `cloud/` + `database/` + `routes/` + `templates/` + `static/` + `tests/`) structured for Python 3 + Flask + SQLAlchemy + Boto3 + Bootstrap 5.

---

## Project Objectives

- Prevent plaintext exposure in cloud object storage by encrypting all uploaded files before transmission.
- Guarantee confidentiality and ciphertext authenticity using **AES-256-GCM** with a unique 96-bit random nonce per encryption operation.
- Detect accidental corruption or malicious tampering using pre-encryption and post-decryption **SHA-256** digest comparison.
- Enforce strict per-user isolation, secure password hashing, CSRF protection, and sanitized filenames.
- Demonstrate and benchmark **Linear Search**, **Binary Search**, **Merge Sort**, and **Quick Sort** directly over user file metadata without relying on built-in sort helpers.

---

## Features

- **User Authentication & Isolation**: Registration, login, logout, salted password hashing (`scrypt` / `Werkzeug PBKDF2`), signed HTTP-only sessions, CSRF protection, and per-user ownership checks on every file endpoint.
- **AES-256-GCM File Encryption**: Computes SHA-256 of the raw file, generates a fresh 12-byte CSPRNG nonce, encrypts with a 256-bit key loaded from environment variables, and stores only ciphertext + authentication tag.
- **AWS S3 Cloud Storage (with Local Vault Fallback)**: Uploads ciphertext with `ServerSideEncryption='AES256'` to a private S3 bucket under `users/<user_id>/vault/<uuid>.enc`. Automatically switches to `./storage/encrypted` when AWS credentials are unset.
- **SHA-256 Integrity Verification**: Re-downloads ciphertext, decrypts it, recomputes SHA-256, compares against the stored original hash, and reports **Original SHA-256**, **Downloaded SHA-256**, and **Authentic / Modified** status.
- **Searching & Sorting Algorithms**: Interactive workspace showing real comparison counts, swap counts, execution trace, and time complexity for Linear Search, Binary Search, Merge Sort, and Quick Sort.
- **Audit Activity Logs**: Tracks registration, login, upload, encryption, cloud upload, download, decryption, integrity verification, and deletion without ever logging passwords, keys, or file contents.

---

## System Architecture

```
Browser UI (Dashboard / Upload / Files / Search / Sort / Verify / Logs)
        │  HTTPS + Signed HTTP-Only Cookie + X-CSRF-Token
        ▼
Application Server (Express server.ts  /  Flask app.py)
        ├── Auth & Access Control (scrypt/Werkzeug + per-user ownership)
        ├── Crypto Pipeline (SHA-256 pre-hash -> AES-256-GCM + 96-bit nonce)
        ├── Algorithm Engine (Linear Search, Binary Search, Merge Sort, Quick Sort)
        ├── SQLite / SQLAlchemy Metadata DB (users, files, activity_logs)
        └── Cloud Storage Layer (AWS S3 Private Bucket  ──fallback──▶ Local Vault)
```

---

## Folder Structure

```
Cloud-File-Security-System/
├── server.ts                  # Node.js + Express live full-stack entry point
├── server/                    # Live backend modules (config, db, crypto, storage, algorithms, auth)
├── src/                       # React + Tailwind CSS cybersecurity dashboard frontend
├── app.py                     # Python Flask entry point
├── config.py                  # Flask configuration via environment variables
├── requirements.txt           # Python dependencies
├── .env.example               # Environment variable template (no secrets)
├── encryption/
│   ├── __init__.py
│   ├── encrypt.py             # AES-256-GCM encrypt & decrypt
│   └── hashing.py             # SHA-256 digest & constant-time verification
├── algorithms/
│   ├── __init__.py
│   ├── searching.py           # Linear Search & Binary Search
│   └── sorting.py             # Merge Sort & Quick Sort
├── cloud/
│   ├── __init__.py
│   └── s3_storage.py          # Boto3 AWS S3 + local fallback
├── database/
│   ├── __init__.py
│   └── models.py              # User, FileMetadata, ActivityLog ORM models
├── routes/
│   ├── __init__.py
│   ├── auth.py                # Register, login, logout, password change
│   ├── files.py               # Upload, list, download, verify, delete
│   └── dashboard.py           # Dashboard, search, sort, logs, profile
├── templates/                 # Bootstrap 5 Jinja2 HTML templates
├── static/                    # Custom dark-navy CSS & drag-drop JS
└── tests/                     # Python unittest & TypeScript E2E security tests
```

---

## Algorithms & Time Complexities

| Algorithm | Purpose | Best Case | Average Case | Worst Case | Space |
|---|---|---|---|---|---|
| **Linear Search** | Search by filename, extension, or MIME type | `O(1)` | `O(n)` | `O(n)` | `O(1)` |
| **Binary Search** | Search alphabetically sorted filenames (pre-sorted via Merge Sort) | `O(1)` | `O(log n)` | `O(log n)` | `O(n)` |
| **Merge Sort** | Stable sort by filename, upload date, or file size (Asc/Desc) | `O(n log n)` | `O(n log n)` | `O(n log n)` | `O(n)` |
| **Quick Sort** | In-place partition sort by file size or filename (Asc/Desc) | `O(n log n)` | `O(n log n)` | `O(n²)` | `O(log n)` |

---

## Installation & Running

### Option A: Live Full-Stack App (Node.js + Express + React)

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

### Option B: Python / Flask Academic App

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Generate a 32-byte hex ENCRYPTION_KEY and SECRET_KEY in .env:
# python3 -c "import secrets; print(secrets.token_hex(32))"
python3 app.py
```

Open `http://localhost:5000`.

---

## AWS S3 Configuration

1. Create a **private** S3 bucket (Block Public Access enabled).
2. Create an IAM user with least-privilege permissions scoped only to that bucket (`s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket`).
3. Populate `.env`:

```env
AWS_ACCESS_KEY_ID="YOUR_IAM_ACCESS_KEY"
AWS_SECRET_ACCESS_KEY="YOUR_IAM_SECRET_KEY"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="your-private-encrypted-vault-bucket"
SECRET_KEY="64_hex_char_session_secret"
ENCRYPTION_KEY="64_hex_char_aes256_key"
```

When AWS credentials are omitted, the system automatically uses the private local encrypted vault (`./storage/encrypted`) while keeping the exact same AES-256-GCM and SHA-256 pipeline.

---

## Running Tests

### TypeScript Full-Stack Security & Algorithm Suite
```bash
node --experimental-strip-types --test tests/e2e_security.test.ts
```

### Python Unit Tests
```bash
python3 -m unittest discover -s tests -p "test_*.py" -v
```

---

## Security Implementation Summary

- **No Plaintext at Rest**: Plaintext files are never written to S3 or local disk; only AES-256-GCM ciphertext is stored.
- **Unique Nonce Guarantee**: Every encryption operation generates a fresh 12-byte random nonce (`os.urandom(12)` / `crypto.randomBytes(12)`).
- **Authenticated Encryption**: GCM auth tags detect any bit flip or truncation in ciphertext prior to hash comparison.
- **CSRF & XSS Protections**: Signed CSRF tokens on state-changing routes, HTTP-only cookies, sanitized filenames (`basename` + allowlist), and parameterized SQL queries.
- **Least-Privilege Logging**: Audit logs never record raw passwords, encryption keys, or file contents.

## Future Enhancements

- Envelope encryption using AWS KMS Customer Managed Keys (CMK).
- Client-side WebCrypto zero-knowledge key wrapping before upload.
- Time-limited pre-signed encrypted sharing links with MFA step-up.
