# Data Dynamo — AI Credit-Scoring System

Data Dynamo is a full-stack, machine-learning-powered credit scoring web application built around a pre-trained XGBoost model trained on a sample of the Home Credit Default Risk dataset. It estimates the chance that an applicant will default, explains why in plain language, and gives an administrator tools to monitor the model and its fairness.

> **Educational demo. Not a real lending decision.**

---

## Live Demo

- **Application URL**: [https://ai-credit-scoring-theta.vercel.app](https://ai-credit-scoring-theta.vercel.app)
- **Free hosting notice**: The application runs on free-tier hosting (Vercel for frontend, Render for backend). The first sign-in or request after a quiet period can take up to about a minute while the server instance wakes up.
- **Educational demo**: This site is an educational demonstration. Please enter made-up details only.
- **Admin console access**: The administrator console is private and not public.

---

## How AI Is Used

- **Explanation summaries and help chat**: Explanation summaries (`/explain`) and the interactive help assistant (`/chat`) use Google's Gemini API (default model: `gemini-3.5-flash-lite`, configurable via `GEMINI_MODEL`).
- **Data sent for explanations**: Only safe, high-level summary facts are transmitted to the Gemini API: the assessed risk level (`low`, `medium`, `high`, `very high`), the rounded risk score percentage, and plain reason names with their direction (`increases_risk` or `decreases_risk`). Raw inputs, personal information, financial amounts, gender, age, and SHAP mathematical values are never sent.
- **Data sent for help chat**: The user's chat question text is sent to the Gemini API alongside grounded knowledge notes retrieved via TF-IDF search.
- **Free-tier data privacy**: On Google's free tier, text sent to the Gemini API may be used by Google to improve its products. Users are reminded never to enter personal details.
- **Template fallback**: Without a `GEMINI_API_KEY`, or when the service is unreachable or rate limited, the application automatically falls back to fixed template text (deterministic headlines for explanations and standard help notes for chat) without failing.

---

## Honest Limits

- **The model is weak**: On the held-out test set, the model achieves a test ROC-AUC of 0.6974, PR-AUC of 0.1553, precision of 0.168, and recall of 0.4175 at threshold 0.1315. In real terms, about 17 of every 100 flagged people actually default, and about 42 of every 100 defaulters are caught.
- **Small, noisy test set**: The test set has only about 103 defaulters (out of 1,350 test instances), making the metric estimates noisy.
- **Score ranking vs true probability**: Because SMOTE was applied during training to balance the classes, the model output is a ranking risk score rather than a true calibrated probability of default. The honest numbers are the empirical default rates of the risk bands measured on a validation sample:
  - **LOW**: 2.84%
  - **MEDIUM**: 7.56%
  - **HIGH**: 18.28%
  - **VERY HIGH**: 30.88%
- **Website form vs full model**: These metrics are evaluated from the full 226-column model. The website asks 27 questions and fills the remaining 87 columns with typical (median) values, so website-style precision and recall were never measured separately.
- **Gender disparity**: Gender is an explicit model input (`CODE_GENDER_F`, `CODE_GENDER_M`). The gender flagged-rate ratio is 0.516, which falls below the common 0.8 four-fifths fairness guideline; this disparity is shown openly on the admin Fairness page.
- **In-memory rate limits**: API rate-limit counters are kept in process memory, supporting only a single server process.
- **Unconverted amounts**: Monetary figures are uncalibrated plain numbers (displayed as rupees without currency conversion). Multilingual explanations (Hindi, Marathi) translate narrative text while technical reason names remain in English.

---

## How It Works

### Frontend
The frontend is a single-page React application built with Vite, Tailwind CSS, and Recharts. Applicants register, give consent, and fill in a multi-category application form (27 fields). A "Fill with a sample applicant" button fills the form for quick demos, and pressing Enter moves to the next field instead of submitting. The result page shows the estimated default risk on a colored risk scale, an AI-assisted summary (English, Hindi or Marathi), the main factors with a strength word, a donut chart of other factors that also counted, an interactive What-If simulator, and a downloadable PDF report (jsPDF). Every result is saved in a History page. A help assistant ("Ask for help") is available on every logged-in page, and the whole site has a light and dark theme.

### Backend
The backend is a REST API built with FastAPI and Pydantic v2 conforming to the frozen `API_CONTRACT.md`. It has 16 endpoints covering JWT-based authentication, consent tracking, preprocessing, probability calculation, SHAP explanations, prediction history, the AI summary (`/explain`), the help assistant (`/chat`), model metrics, and admin monitoring.

### Model & Explainability
The prediction engine uses an imbalanced-learn Pipeline containing a tuned XGBoost classifier trained with SMOTE. Preprocessing follows a frozen 7-step pipeline (categorical encoding, age/employment days mapping, ratio calculations, and median imputation). The form's 27 fields become 139 of the model's 226 columns; the other 87 are filled with typical (median) values. Local explainability is computed with SHAP TreeExplainer, linking the probability to the factors that moved it.

Risk levels are relative to the review cut-off (13.15%): Low is below half of it, Medium up to the cut-off, High up to twice the cut-off, Very high above that.

### AI Summary and Help Assistant
- The reasons shown to the user come from fixed rules. The AI (Google Gemini) only writes a short summary from safe facts: the main application factors and the risk percentage. Gender, age, weekday and hour are never sent.
- The help assistant finds the best match among 20 help notes (TF-IDF search) and answers only from them. Off-topic questions get a fixed answer. Each question is answered on its own and chat text is not saved.
- If the AI is unavailable, slow, or rate limited, the app falls back to standard text instead of showing an error.
- Free-tier Gemini text may be used by Google to improve its products, so users are told not to type personal details.

### Database
The application uses SQLAlchemy 2 for persistence, supporting SQLite for local development and PostgreSQL for containerized and cloud use. It has four tables: `users` (bcrypt password hashing and roles), `consents` (time-stamped consent records), `predictions` (inputs, probability, risk level and demographic fields for fairness tracking), and `explanations` (cached AI summaries).

### Docker Architecture
The containerized deployment consists of three services orchestrated via Docker Compose: a PostgreSQL 16 database with health checks, a Python 3.14-slim backend image bundling the ML artifacts and system libraries (`libgomp1`), and a multi-stage NGINX image serving the React build on port 3000 with client-side routing.

---

## Deployment

The application is architected for deployment across Vercel, Render, and Neon Postgres:

- **Frontend on Vercel**: Hosted as a single-page application. Set the **Root Directory** to `frontend`. The environment variable `VITE_API_URL` must be set at build time to point to the live backend URL.
- **Backend on Render**: Deployed as a Docker web service using `backend/Dockerfile` with the repository root as the build context.
- **Database on Neon Postgres**: Cloud serverless PostgreSQL database. Connection credentials are provided via `DATABASE_URL`.

### Critical Deployment Configuration

- **DATABASE_URL format**: Must start with `postgresql+psycopg://` so SQLAlchemy 2 uses the modern `psycopg` (v3) driver (e.g. `postgresql+psycopg://<user>:<password>@<host>/<dbname>?sslmode=require`).
- **CORS_ORIGINS setting**: Must contain the exact Vercel frontend address (e.g. `https://ai-credit-scoring-theta.vercel.app`) without trailing slashes so the browser allows API requests.

### Environment Variables

All environment variable names configured for the application are described below (taken from `.env.example`). Set these in your hosting platforms or local environment:

| Variable Name | Description |
|---|---|
| `SECRET_KEY` | Secret key used for signing JWT access tokens (must be a strong random string in production). |
| `DATABASE_URL` | Database connection URL (PostgreSQL in Docker/Neon, sqlite:///./dev.db for local development). |
| `CORS_ORIGINS` | Comma-separated list of allowed CORS origins for browser frontend requests. |
| `ADMIN_EMAIL` | Email address for the initial admin account seeded at database startup. |
| `ADMIN_PASSWORD` | Password for the initial admin account seeded at database startup. |
| `ARTIFACTS_DIR` | Filesystem path to trained ML model and preprocessor artifacts directory (/app/artifacts in Docker). |
| `POSTGRES_USER` | PostgreSQL container database username used by Docker Compose. |
| `POSTGRES_PASSWORD` | PostgreSQL container database password used by Docker Compose. |
| `POSTGRES_DB` | PostgreSQL container database name used by Docker Compose. |
| `GEMINI_API_KEY` | Google Gemini API key (optional; without it the app uses fixed template text and fallback explanations). |
| `GEMINI_MODEL` | Gemini model identifier for LLM explanation generation and chat assistance. |
| `GEMINI_TIMEOUT` | Timeout in seconds for Gemini API generation requests before falling back. |
| `GEMINI_MAX_CALLS_PER_USER_HOUR` | Maximum /explain LLM API calls permitted per user per hour. |
| `GEMINI_MAX_CHAT_PER_USER_HOUR` | Maximum /chat LLM API calls permitted per user per hour. |
| `GEMINI_MAX_CALLS_PER_MINUTE` | Global maximum Gemini API calls allowed across all users per minute. |
| `GEMINI_MAX_CALLS_PER_DAY` | Global maximum Gemini API calls allowed across all users per day. |
| `RAG_MIN_SCORE` | Minimum cosine similarity score for TF-IDF RAG note retrieval in /chat (below this returns NOT_SURE). |
| `GEMINI_TEMPERATURE` | Sampling temperature for Gemini text generation (lower values produce more deterministic responses). |
| `GEMINI_MAX_OUTPUT_TOKENS` | Maximum output token limit for Gemini generation responses. |
| `GEMINI_THINKING_LEVEL` | Optional Gemini thinking level config (e.g. LOW, HIGH; left empty by default to disable thinking config). |
| `VITE_API_URL` | Base URL for backend API baked into the frontend build (used during docker build or local development). |

---

## Default Ports & URLs

- **Frontend App**: `http://localhost:3000` (Docker) or `http://localhost:5173` (Vite dev)
- **Backend API**: `http://localhost:8000`
- **Interactive API Docs (Swagger)**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`
- **PostgreSQL Database**: `localhost:5432`

---

## Default Admin Credentials

An administrator user is automatically seeded on backend startup:
- **Email**: Set via `ADMIN_EMAIL` (default: `admin@datadynamo.com`).
- **Password**: Configured via `ADMIN_PASSWORD` in the environment. Never commit passwords or `.env` files into source control.
- **Role**: `admin` (grants access to the Admin console: Overview, Predictions, Users, Fairness, Model details, and Test lab).

Applicants create their own account with **Register**.

---

## Running with Docker Compose

Ensure Docker Desktop is running on your machine.

### 1. Create Environment File (first time only)

In PowerShell from repository root:

```powershell
Copy-Item .env.example .env
```

Open `.env` and set `SECRET_KEY`, `ADMIN_PASSWORD` and (optional) `GEMINI_API_KEY`. Without a Gemini key the app still works and uses the standard-text fallbacks.

### 2. Start All Containers

The first time (builds the images, takes a few minutes):

```powershell
docker compose up --build -d
```

Every later time:

```powershell
docker compose up -d
```

### 3. Check That It Is Ready

All three services should be up (the database healthy):

```powershell
docker compose ps
```

The backend needs a few seconds to load the model. Run this until `model_loaded` shows `True`:

```powershell
Invoke-RestMethod "http://localhost:8000/health"
```

Then open `http://localhost:3000`.

### 4. Stop Containers (keeps all data)

```powershell
docker compose stop
```

> **Warning:** never run `docker compose down -v`. The `-v` flag deletes the database volume.

After editing `.env`, recreate the backend (a plain restart is not enough):

```powershell
docker compose up -d --force-recreate backend
```

---

## Demo Walkthrough

**Before you start:** start Docker Desktop, run `docker compose up -d`, wait until the health check shows `model_loaded: True`, keep `.env` closed, make sure you are online (the AI summary and assistant need internet), and press Ctrl+F5 in the browser. The summary and assistant share a small AI request limit per user per hour, so avoid rehearsing the assistant many times beforehand.

**Guided tour (about 6 minutes):**
1. **Landing page:** the title types and erases in a loop; the sun/moon button switches the theme.
2. **Log in as an applicant, then Assessment:** accept the consent, choose **Fill with a sample applicant**, press Enter in a field (it moves to the next field), then click **Submit & Evaluate Risk**.
3. **Result page:** risk number and risk scale, AI-assisted summary with the English / Hindi / Marathi switch, hover a factor row to expand it, look at the donut of other factors, try What-If, the PDF button and **Ask for help**.
4. **History:** open an old result. **How reliable?** explains the accuracy in plain words.
5. **Log out, log in as admin:** Overview (click a number card or donut slice to jump to filtered Predictions), Predictions (filters, CSV export), Fairness, Model details, Test lab (runs are saved under the admin account), and **View user site** to switch back.
6. **Tests (optional):** run the backend tests (see below).

**Design decisions worth pointing out:** reasons come from fixed rules and the AI only writes a short summary; gender is a model input by choice and the Fairness page shows its effect openly; the model is modest (see Honest Limits).

**If something goes wrong:**

| Problem | What to do |
|---|---|
| Page does not load | `docker compose ps`, then `docker compose up -d` |
| Login fails right after starting | The model is still loading; repeat the health check until `model_loaded` is `True` |
| Old version of the site shows | Press Ctrl+F5 (after frontend changes: `docker compose up --build -d frontend`) |
| Summary says "Standard summary" | No internet, no Gemini key, or the AI limit was reached; the fallback is intended |
| Backend errors | `docker compose logs backend --tail 30` |

---

## Running Locally Without Docker

### Prerequisites & Datasets
- **Python**: Python 3.14 installed.
- **Node.js**: Node.js 20 or newer & npm installed.
- **Dependencies**: Backend application requirements are in `backend/requirements.txt`. The root `requirements.txt` was renamed to `requirements-notebook.txt` for Jupyter notebook workflows.
- **Dataset**: The `data\` folder is not included in the repository (it is gitignored). To run data preparation or notebooks, download the Home Credit Default Risk dataset files directly from Kaggle and place them into the `data\` folder.

### 1. Setup & Run Backend

In PowerShell from repository root:

```powershell
cd backend
& ".\.venv\Scripts\Activate.ps1"
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

*Note: The backend will use local SQLite database `backend/dev.db` automatically. Without the Gemini variables from `.env.example`, the AI parts use their fallbacks.*

### 2. Setup & Run Frontend

In a separate PowerShell terminal from repository root:

```powershell
cd frontend
npm install
npm run dev
```

The frontend will start at `http://localhost:5173`.

---

## Running Backend Tests

In PowerShell from repository root (124 tests: endpoints, preprocessing, parity with the training notebook, SHAP consistency, risk levels, the retriever, and failure modes of the AI parts). Automated tests run directly via pytest and Python (the four `.ps1` test scripts no longer exist):

```powershell
cd backend
& ".\.venv\Scripts\python.exe" -m pytest -q
```

Static check of the backend code:

```powershell
& ".\.venv\Scripts\python.exe" -m pyflakes app
```

To run end-to-end integration verification against a running server:

```powershell
& ".\.venv\Scripts\python.exe" verify_flow.py
```

---

## Running Frontend Build Test

In PowerShell from repository root:

```powershell
cd frontend
npm run build
```

```powershell
npx oxlint src
```

The frontend has no automated unit tests yet; it is checked by build, lint and manual walkthroughs.
