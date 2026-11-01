# Data Dynamo — AI Credit-Scoring System

Data Dynamo is a full-stack, machine-learning-powered credit scoring web application built around a pre-trained XGBoost model trained on a sample of the Home Credit Default Risk dataset. It estimates the chance that an applicant will default, explains why in plain language, and gives an administrator tools to monitor the model and its fairness.

> **Educational demo. Not a real lending decision.**

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
The application uses SQLAlchemy 2 for persistence, supporting SQLite for local development and PostgreSQL for containerized use. It has four tables: `users` (bcrypt password hashing and roles), `consents` (time-stamped consent records), `predictions` (inputs, probability, risk level and demographic fields for fairness tracking), and `explanations` (cached AI summaries).

### Docker Architecture
The containerized deployment consists of three services orchestrated via Docker Compose: a PostgreSQL 16 database with health checks, a Python 3.14-slim backend image bundling the ML artifacts and system libraries (`libgomp1`), and a multi-stage NGINX image serving the React build on port 3000 with client-side routing.

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
- **Email**: `admin@datadynamo.com`
- **Password**: The admin password is set with ADMIN_PASSWORD in the .env file. Never commit .env.
- **Role**: `admin` (opens the separate Admin console: Overview, Predictions, Users, Fairness, Model details and Test lab)

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

**Design decisions worth pointing out:** reasons come from fixed rules and the AI only writes a short summary; gender is a model input by choice and the Fairness page shows its effect openly; the model is modest (see Known Limitations).

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

### Prerequisites
- Python 3.14 installed
- Node.js 20 or newer & npm installed

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

In PowerShell from repository root (124 tests: endpoints, preprocessing, parity with the training notebook, SHAP consistency, risk levels, the retriever, and failure modes of the AI parts):

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

## Running Frontend Build Test

In PowerShell from repository root:

```powershell
cd frontend
npm run build
```

```powershell
npx oxlint src
```

The frontend has no automated tests yet; it was checked by build, lint and manual walkthroughs.

---

## Known Limitations

- **The model is modest:** about 17 of every 100 flagged people really default, and about 42 of every 100 defaulters are caught (test ROC-AUC 0.697, PR-AUC 0.155). It demonstrates the full system and is not a lending tool.
- **Small training sample** (9,000 rows). The website asks fewer details than the model uses (87 of 226 columns are filled with typical values), so real accuracy through the website is likely lower than the figures on the "How reliable?" page. This has not been measured separately.
- **Gender is a model input** by choice. The flagged-rate ratio between genders is 0.516, below the common 0.8 rule of thumb, and the Fairness page shows it openly.
- **Amounts are plain numbers:** the interface shows Indian rupees, but the dataset's currency is not stated and no conversion is done.
- **Hindi and Marathi** answers are less polished than English, and reason names stay in English.
- **AI rate limits** are kept in memory and work for a single running backend only.