# Legal Assistant — AI-Powered Document RAG

A self-hosted, multi-tenant legal document assistant that combines OCR extraction, semantic vector search, and Gemini-powered conversational AI into a single-page web application. Upload contracts, court transcripts, legal bills, or scanned documents; the system extracts, chunks, and indexes their content automatically, then lets you ask natural-language questions with source-cited answers streamed in real time.

---

## Features

| Category | Details |
|---|---|
| **Document Ingestion** | Drag-and-drop or file-picker upload of PDF, TXT, PNG, JPG, JPEG, TIFF, and BMP files (up to 25 MB each) |
| **Intelligent OCR** | Native text extraction for digital PDFs with automatic fallback to Tesseract OCR for scanned/image-based documents. Memory-safe page-by-page processing. |
| **Semantic Search** | Documents are chunked with sliding-window overlap, embedded via Google's `gemini-embedding-001` model, and stored in a persistent ChromaDB vector database |
| **Conversational AI** | Streaming RAG responses powered by Gemini, with source citations (filename and page number) |
| **Multi-Tenant Isolation** | Each user's documents are indexed under their identity; queries and document listings are strictly scoped to the authenticated user |
| **Authentication** | Secure registration and login with bcrypt-hashed passwords, JWT session tokens, and configurable expiry |
| **Device Fingerprinting** | Detects logins from unrecognized devices and sends security alert emails |
| **Email Notifications** | Registration welcome emails and unknown-device alerts via configurable SMTP, with a local file-based fallback for development |
| **CSRF Protection** | Double-submit cookie pattern protecting all state-changing requests |
| **Rate Limiting** | Per-IP, sliding-window rate limits on authentication (10 req/min) and query (30 req/min) endpoints |
| **Dark/Light Theme** | Client-side theme toggle with `localStorage` persistence and server-side cookie sync |
| **Docker-Ready** | Production Dockerfile and `docker-compose.yml` with named volumes for persistent data |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Web Framework** | [FastAPI](https://fastapi.tiangolo.com/) 0.111 with [Uvicorn](https://www.uvicorn.org/) ASGI server |
| **Frontend** | Server-rendered [Jinja2](https://jinja.palletsprojects.com/) templates + [HTMX](https://htmx.org/) 1.9 for dynamic updates + vanilla JavaScript |
| **LLM / Embeddings** | [Google Generative AI SDK](https://ai.google.dev/) — `gemini-2.5-flash` (chat), `gemini-embedding-001` (embeddings) |
| **Vector Database** | [ChromaDB](https://www.trychroma.com/) 0.5 with persistent local storage |
| **User Database** | [SQLite](https://www.sqlite.org/) with WAL mode, managed via `db_manager.py` |
| **OCR** | [pdfplumber](https://github.com/jsvine/pdfplumber) (native PDF text) → [Tesseract](https://github.com/tesseract-ocr/tesseract) + [pdf2image](https://github.com/Belval/pdf2image) (scanned PDF/image fallback) |
| **Auth** | [bcrypt](https://github.com/pyca/bcrypt) password hashing, [PyJWT](https://pyjwt.readthedocs.io/) session tokens |
| **Email** | Python `smtplib` with TLS/SSL, local file-log fallback |
| **Containerization** | Docker (Python 3.11-slim) + Docker Compose |


---

## Getting Started

### Prerequisites

- **Google AI API Key** — Obtain one from [Google AI Studio](https://aistudio.google.com/apikey). Required for embeddings and chat.
- **Docker** _(recommended)_ — or Python 3.10+ with system packages for native mode.

### Quick Start — Docker (Recommended)

Docker handles all system dependencies (Tesseract, Poppler, C++ compilers) automatically.

```bash
# 1. Clone and enter the project directory
cd Legal_Assistant

# 2. Create your environment file
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY (required) and JWT_SECRET

# 3. Build and run
docker compose up --build -d

# 4. Open the application
#    → http://localhost:8000
```

**Persistent Data:** The `docker-compose.yml` uses named Docker volumes (`legal_db`, `legal_uploads`) so your user database and uploaded documents survive container rebuilds.

### Quick Start — Native / Local

#### Windows

A convenience batch script is provided:

```cmd
cd Legal_Assistant
run_local.bat
```

This script checks for Python, creates `.env` from the template if missing, installs dependencies, and starts the server.


## Configuration Reference

All configuration is managed through environment variables, typically set in a `.env` file at the project root.

---

## Usage Guide

### Authentication

1. Navigate to `http://localhost:8000`.
2. Click the **Register** tab and fill in your first name, last name, company, phone number, email, and password (minimum 6 characters).
3. On successful registration, the form switches to the **Login** tab with a confirmation message.
4. Enter your credentials and click **Login**. You are redirected to the dashboard.
5. Click **Logout** in the header to end your session.

### Uploading Documents

1. In the sidebar, drag and drop files onto the upload zone, or click to browse.
2. Supported formats: **PDF**, **TXT**, **PNG**, **JPG/JPEG**, **TIFF**, **BMP** (max 25 MB per file).
3. A status badge appears, self-polling every 2 seconds. Stages: `Queued` → `Extracting Text` → `Indexing` → `Completed`.
4. Indexed documents appear in the **Indexed Documents** list. Click the trash icon to remove a document and all its indexed data.
5. Re-uploading a file with the same name replaces the previous version.

### Querying Documents

1. Type a natural-language question in the chat input and press Enter or click the send button.
2. The system retrieves the top-5 most semantically similar chunks from your indexed documents.
3. The Gemini model streams a response in real time, citing source filenames and page numbers.
4. Click **Clear Chat** or **New Consultation** to reset the conversation thread (documents remain indexed).

---

## API Reference

All requests and responses use JSON. HTMX-triggered endpoints return HTML fragments.

### Key Endpoints

| Category | Endpoint | Method | Description |
|---|---|---|---|
| **Auth** | `/register` | `POST` | Registers a new user account |
| | `/login` | `POST` | Authenticates a user and sets the JWT session cookie |
| | `/logout` | `POST` | Clears the session cookie and redirects to home |
| **Documents** | `/upload` | `POST` | Uploads a document (PDF, TXT, images) up to 25 MB for indexing |
| | `/status/{file}` | `GET` | Retrieves real-time document processing status |
| | `/documents` | `GET` | Lists all indexed documents for the authenticated user |
| | `/documents/{file}` | `DELETE` | Removes a document and its chunks from the vector store |
| **Chat/RAG** | `/query` | `POST` | Streams a Gemini-powered answer based on indexed documents |
| **App** | `/` | `GET` | Renders the single-page application (Auth page / Dashboard) |

> **Note:** All document management and query endpoints require a valid session cookie or an `Authorization: Bearer <token>` header.

---

## Security Model

The system implements robust security practices:

- **Authentication & Sessions:** Passwords are hashed using **bcrypt** (capped at 72 bytes) and stored in SQLite. Session tokens are signed **JWTs** (`HS256`) with a 10-hour expiry, stored in `HttpOnly` and `Secure` cookies.
- **CSRF Protection:** Non-safe requests (non-GET/HEAD/OPTIONS) are validated against a **Double-Submit Cookie** pattern via custom middleware (bypassed for Bearer authenticated API clients).
- **Multi-Tenant Isolation:** Documents and vector database chunks are tagged with the user's identifier (`owner` metadata filters in ChromaDB), isolating data and logs per tenant.
- **Rate Limiting:** Protects endpoints using sliding-window rate limits (10 req/min for Auth, 30 req/min for Query).
- **Device Fingerprinting:** Hashes client IP and User-Agent; logins from unrecognized devices trigger asynchronous **security alert emails** via SMTP.

---




## OCR & Text Extraction Pipeline

The extraction pipeline in `ocr.py` handles multiple document types with a two-stage PDF strategy:

```
Input File
    │
    ├── .txt → Read as UTF-8 text
    │
    ├── .png/.jpg/.jpeg/.tiff/.bmp → Tesseract OCR (single-page)
    │
    └── .pdf → Stage 1: pdfplumber (native text extraction, page-by-page)
                  │
                  ├── > 100 chars extracted? → Return native text ✓
                  │
                  └── ≤ 100 chars? → Stage 2: Tesseract OCR fallback
                                       (pdf2image → one page at a time to limit memory)
```

**Key design decisions:**
- **Page-by-page OCR**: Scanned PDFs are converted to images one page at a time (not all at once) to avoid memory exhaustion on large documents.
- **Poppler auto-detection**: On Windows, the system scans common installation directories for `pdftoppm.exe` if `POPPLER_PATH` is not explicitly set.
- **Text normalization**: Extracted text is cleaned of excessive whitespace and blank lines before indexing.

---

## Vector Store & RAG Pipeline

The retrieval-augmented generation pipeline in `vector_store.py`:

1. **Chunking** — Document pages are split into ~1,000-character chunks with 150-character sliding overlap to preserve context across boundaries.
2. **Embedding** — Chunks are embedded in batches of 20 using Google's `gemini-embedding-001` model with `retrieval_document` task type.
3. **Indexing** — Chunks are stored in ChromaDB with metadata: `filename`, `page`, `chunk_index`, and `owner`.
4. **Querying** — User queries are embedded with `retrieval_query` task type. ChromaDB returns the top-5 nearest chunks filtered by owner.
5. **Generation** — Retrieved chunks are assembled into a context prompt. Gemini generates a streamed response with instructions to cite sources by filename and page number.

---

## Testing

An end-to-end test suite is provided in `test_e2e.py`. It requires a running server instance.

```bash
# Start the server first (in another terminal or container)
python main.py

# Run the tests
python test_e2e.py
```

**Test coverage includes:**
- User registration and duplicate email rejection
- Registration welcome email verification (via `db/emails.log`)
- Login with device fingerprinting and unknown-device alert emails
- Known-device re-login (no spurious alert)
- Multi-device alert verification
- Cross-user document isolation (upload, status, query)
- Document upload, processing status polling, and indexing verification
- RAG query isolation (User A cannot see User B's data)

> **Note:** Query assertion tests gracefully skip if `GEMINI_API_KEY` is not configured or the API returns an error, since the tests validate isolation logic independently of the LLM.

---


