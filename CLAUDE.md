# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

PulsarConsole is a modern web-based management console for Apache Pulsar.

## Structure

- `/` - React 19 frontend (Vite + TypeScript)
- `/backend` - FastAPI backend (Python 3.12)

## Development

```bash
# Frontend
npm install
npm run dev

# Backend
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

## Versioning

This project uses [release-please](https://github.com/googleapis/release-please) for automated semantic versioning.

- Use conventional commits: `feat:`, `fix:`, `chore:`, etc.
- Releases are automated via GitHub Actions
