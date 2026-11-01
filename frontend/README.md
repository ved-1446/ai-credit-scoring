# Data Dynamo Frontend

Single-page web client for Data Dynamo credit risk intelligence. Built with React 19, Vite, Tailwind CSS, and React Router.

## Quick Start

- `npm ci` — Install locked project dependencies cleanly
- `npm run dev` — Start the local development server with HMR (defaults to `http://localhost:5173`)
- `npm run build` — Compile and bundle the production assets into `dist/`

## Configuration

The backend endpoint is configured via `VITE_API_URL` (defaults to `http://localhost:8000` in `frontend/src/api.js`). Because Vite bakes `import.meta.env` values into static JavaScript bundles, `VITE_API_URL` is set at build time (configured via build argument in `frontend/Dockerfile` and `docker-compose.yml`).

## Documentation

For full architecture details, local setup, Docker Compose deployment, and API contracts, see the root [README.md](../README.md).
