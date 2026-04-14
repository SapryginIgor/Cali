# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cali is a meal-tracking mobile app that uses AI (OpenAI GPT-4 Vision) to analyze food photos and estimate nutritional information. It has an Expo/React Native frontend and a FastAPI Python backend.

## Commands

### Frontend (from project root)
- `bun i` — install dependencies
- `bun run start` — start Expo dev server (tunnel mode, for physical devices)
- `bun run start-web` — start web preview
- `bun run lint` — run ESLint
- `bun run e2e:web` — run Playwright e2e tests (`tests/e2e/`)

### Backend (from `backend/`)
- `uv sync` — install Python dependencies (uses `pyproject.toml` + `uv.lock`)
- `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` — run dev server
- `pytest` — run backend tests (`backend/tests/`)

### Docker
- `docker compose up` — runs backend + singbox proxy (for OpenAI region restrictions)

## Architecture

### Frontend (Expo Router, TypeScript)
- **Routing**: File-based via Expo Router in `app/`. Three route groups:
  - `(auth)/` — login/signup screens
  - `(main)/` — main app screens (food log index, profile)
  - Root `_layout.tsx` handles auth gating: redirects to `(auth)` or `(main)` based on session state
- **State**: React Query for server state, Zustand for client state
- **Auth**: Supabase email/password auth via `contexts/AuthContext.tsx`, session stored in AsyncStorage
- **Contexts**: `AuthContext` (auth state), `AppContext` (food entries), `SubscriptionContext` (RevenueCat purchases)
- **AI integration**: `lib/ai.ts` sends food photos (base64) to the backend API (`EXPO_PUBLIC_BACKEND_URL`), falls back to mock estimation if backend unavailable
- **Supabase client**: `lib/supabase.ts` — gracefully degrades if env vars not set (`isSupabaseConfigured` flag)

### Backend (FastAPI, Python)
- **Entry point**: `backend/app/main.py` — FastAPI app with CORS, rate limiting (slowapi), error handlers
- **Routes**: `app/routes/analyze.py` (food analysis), `app/routes/images.py` (image handling)
- **Services**: `app/services/openai.py` (GPT-4 Vision calls), `app/services/prompts.py`, `app/services/s3.py`
- **Auth middleware**: `app/middleware/auth.py` — validates Supabase JWT tokens
- **Models**: Pydantic models in `app/models/` (requests, responses, API schemas)

### Database
- Supabase Postgres with migrations in `supabase/migrations/`
- `profiles` table with RLS policies, auto-created on user signup via trigger

## Environment Variables

### Frontend (`.env` in project root)
- `EXPO_PUBLIC_BACKEND_URL` — backend API URL (e.g., `http://localhost:8000`)
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase config (optional, app works in guest mode without)
- `EXPO_PUBLIC_APP_ORIGIN` — production web origin for expo-router

### Backend (`.env` in `backend/`)
- `OPENAI_API_KEY` — required
- `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` — rate limit config (defaults: 900000ms / 20 requests)

## Key Patterns
- The `@/` import alias maps to project root (configured in tsconfig)
- Context providers use `@nkzw/create-context-hook` for concise context+hook creation
- Backend uses `patch-package` for dependency patches (see `postinstall` script)
- E2E tests use Playwright against the web build; `EXPO_PUBLIC_E2E=1` enables mock mode in `lib/ai.ts`
