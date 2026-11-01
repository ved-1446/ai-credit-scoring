# Contributing to Data Dynamo

Thank you for your interest in contributing to Data Dynamo!

## Getting Started & Running Locally

Please see the [README.md](README.md) for local installation instructions, environment configuration, and instructions on running with Docker or standard Python/Node virtual environments.

## Branch Naming Conventions

Use descriptive branch names with appropriate prefixes:
- `feature/<short-description>`: New functionality
- `fix/<short-description>`: Bug fixes
- `docs/<short-description>`: Documentation changes
- `chore/<short-description>`: Maintenance or tooling updates

## Commit Messages

We adhere to conventional commit conventions:
- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation changes only
- `chore:` Maintenance, dependency, or configuration tasks
- `test:` Adding or refactoring tests
- `ci:` Continuous integration configuration changes

## Pre-PR Checklist

Before opening a pull request, run the local verification suite:
1. **Backend Tests & Linting**:
   ```powershell
   cd backend
   pytest -q
   pyflakes app
   ```
2. **Frontend Build & Linting**:
   ```powershell
   cd frontend
   npm run build
   npx oxlint src
   ```
3. **Secrets & Data Protection**:
   - **Never commit `.env` files** or any actual API keys, tokens, or database passwords.
   - **Never commit dataset files** (the `data/` folder must remain gitignored).

## Checks

Our GitHub Actions Continuous Integration pipeline automatically validates all pushes and pull requests against `main` across three jobs:
- **Backend Job**: Sets up Python 3.14, installs dependencies from `backend/requirements.txt` and `backend/requirements-dev.txt`, runs `pyflakes` static analysis on `backend/app`, and executes the `pytest` test suite with in-memory SQLite fixtures.
- **Frontend Job**: Sets up Node.js 20, runs clean install (`npm ci`), tests production bundling (`npm run build`), and checks for code issues using `oxlint`.
- **Docker Job**: Builds Docker container images for both backend (`backend/Dockerfile`) and frontend (`frontend/Dockerfile`) using repository root context to prevent containerization regressions.

