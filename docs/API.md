# API Reference

Data Dynamo provides a REST API built with FastAPI. All endpoints conform strictly to the specification in [API_CONTRACT.md](../API_CONTRACT.md).

For detailed request payloads, response schemas, and validation rules, refer directly to [API_CONTRACT.md](../API_CONTRACT.md).

---

## Endpoint Catalog

The application exposes 16 endpoints organized by functional domain:

| Method | Path | Access Control | Purpose |
|---|---|---|---|
| `GET` | `/health` | Public | Returns service status, model version, and artifact loading status. |
| `POST` | `/auth/register` | Public | Registers a new user account with email, password, and name. |
| `POST` | `/auth/login` | Public | Authenticates credentials and returns a signed JWT access token. |
| `GET` | `/auth/me` | Logged-in user | Retrieves profile and role details for the authenticated user. |
| `POST` | `/consent` | Logged-in user | Records user agreement to data processing and issues a consent session ID. |
| `POST` | `/predict` | Logged-in user | Evaluates loan application inputs, runs preprocessing, model scoring, and SHAP attribution. |
| `POST` | `/whatif` | Logged-in user | Simulates hypothetical input adjustments without saving and computes the risk score delta. |
| `GET` | `/history` | Logged-in user | Lists previous evaluations submitted by the current user with pagination. |
| `GET` | `/history/{request_id}` | Logged-in user | Retrieves stored application inputs and scoring output for a specific past evaluation. |
| `GET` | `/model-metrics` | Logged-in user | Returns model metadata, training parameters, evaluation metrics, and feature importance. |
| `GET` | `/admin/stats` | Admin | Returns aggregate dashboard metrics including total users, predictions, and band distribution. |
| `GET` | `/admin/predictions` | Admin | Returns filterable and exportable list of all system predictions across users. |
| `GET` | `/admin/users` | Admin | Lists all registered user accounts and their evaluation counts. |
| `GET` | `/admin/fairness` | Admin | Returns disparate impact ratios and acceptance rates across demographic groups. |
| `POST` | `/explain` | Logged-in user | Generates or retrieves cached plain-language explanation summary using Gemini API or template fallback. |
| `POST` | `/chat` | Logged-in user | Educational help chat assistant using TF-IDF RAG retrieval over help notes and Gemini API with fixed answer fallback. |

---

## Authentication & Authorization

- **Public Endpoints**: Can be accessed without credentials.
- **Logged-in User Endpoints**: Require a valid HTTP Authorization header containing a bearer token: `Authorization: Bearer <token>`.
- **Admin Endpoints**: Require a valid bearer token associated with a user account having the role `admin`. Non-admin requests receive HTTP 403 Forbidden.

