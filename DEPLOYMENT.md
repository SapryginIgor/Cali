# Deployment Guide

This guide covers deploying the backend API and configuring the mobile app to use it.

## Quick Start

### Option 1: Use Local Backend (Development)
1. Start backend: `cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
2. Set environment variable: `EXPO_PUBLIC_BACKEND_URL=http://localhost:8000`
3. Start app: `npm start`

**Note**: For physical devices, use your computer's IP address instead of `localhost`:
- Find your IP: `ip addr show` (Linux) or `ipconfig` (Windows/Mac)
- Use: `EXPO_PUBLIC_BACKEND_URL=http://YOUR_IP:8000`

### Option 2: Deploy Backend (Production)

Choose one of the platforms below, then set `EXPO_PUBLIC_BACKEND_URL` to your deployed URL.

---

## Deployment Platforms

### 🚂 Railway

**Pros**: Simple, good free tier, automatic deployments

1. **Sign up**: Go to [railway.app](https://railway.app)

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo" (or use Railway CLI)

3. **Configure**:
   - Select your repository
   - Root directory: `backend`
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. **Set Environment Variables**:
   - Go to Variables tab
   - Add: `OPENAI_API_KEY` = your OpenAI API key
   - Add: `PORT` = (Railway sets this automatically)

5. **Get your URL**:
   - Railway provides: `https://your-project.up.railway.app`
   - Use this as your `EXPO_PUBLIC_BACKEND_URL`

---

### 🎨 Render

**Pros**: Free tier, simple setup

1. **Sign up**: Go to [render.com](https://render.com)

2. **Create New Web Service**:
   - Connect your GitHub repository
   - Name: `cali-backend`
   - Root Directory: `backend`
   - Environment: `Python`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

3. **Set Environment Variables**:
   - Go to Environment tab
   - Add: `OPENAI_API_KEY` = your OpenAI API key

4. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment

5. **Get your URL**:
   - Render provides: `https://cali-backend.onrender.com`
   - Use this as your `EXPO_PUBLIC_BACKEND_URL`

---

## Frontend Configuration

### For Development (Local Backend)

Create or update `.env` file in project root:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

**For physical devices**, use your computer's IP:
```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:8000
```

### For Production (Deployed Backend)

Create or update `.env` file:

```env
EXPO_PUBLIC_BACKEND_URL=https://your-backend-url.com
```

**Expo Router origin** (for web/production API base URL): set `EXPO_PUBLIC_APP_ORIGIN` so expo-router uses your app URL instead of localhost:

```env
EXPO_PUBLIC_APP_ORIGIN=https://your-app-domain.com
```

Or set in `app.json` (if using Expo config):

```json
{
  "expo": {
    "extra": {
      "backendUrl": process.env.EXPO_PUBLIC_BACKEND_URL
    }
  }
}
```

### Using Environment Variables

1. **Create `.env` file** in project root (same level as `package.json`):
   ```env
   EXPO_PUBLIC_BACKEND_URL=https://your-backend-url.com
   ```

2. **Restart Expo**:
   ```bash
   npm start
   ```

3. **Verify**: Check console logs - backend calls should go to your URL

---

## Supabase (user profiles and auth)

The app can use [Supabase](https://supabase.com) for email/password sign-in and a `profiles` table (display name, avatar URL). Meal logs stay in local storage unless you add sync later.

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings → API** and copy the **Project URL** and **anon public** key.

### 2. Apply the database migration

1. In the Supabase dashboard, open **SQL Editor**.
2. Paste and run the full contents of [`supabase/migrations/20260322120000_profiles.sql`](supabase/migrations/20260322120000_profiles.sql) in this repository.

This creates the `profiles` table, row-level security policies, and a trigger that inserts a profile row when a new user signs up.

### 3. Enable email auth

In **Authentication → Providers**, ensure **Email** is enabled (default). Adjust **Confirm email** if you want immediate sign-in without verifying the inbox.

### 4. Frontend environment variables

Add to the project root `.env` (same file as `EXPO_PUBLIC_BACKEND_URL`):

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Restart Expo (`npm start`) after changing `.env`.

If these variables are missing, the **Profile** screen explains that Supabase is not configured; the rest of the app still runs (guest mode).

### 5. Optional: deep links and OAuth

The app uses the scheme `cali` (see `app.json`). For magic links or OAuth later, add the correct redirect URLs under **Authentication → URL Configuration** in Supabase.

---

## Testing Deployment

### 1. Test Backend Directly

```bash
curl -X POST https://your-backend-url.com/api/analyze-food \
  -H "Content-Type: application/json" \
  -d '{
    "image": "base64-encoded-image-here",
    "description": "Test food"
  }'
```

### 2. Test from App

1. Set `EXPO_PUBLIC_BACKEND_URL` in `.env`
2. Restart Expo: `npm start`
3. Take a photo in the app
4. Check backend logs to confirm requests are received

---

## Troubleshooting

### Backend not responding
- Check environment variables are set correctly
- Verify `OPENAI_API_KEY` is valid
- Check deployment logs for errors

### CORS errors
- Backend CORS is configured for mobile apps
- If issues persist, check CORS settings in `backend/app/main.py`

### Frontend can't connect
- Verify `EXPO_PUBLIC_BACKEND_URL` is set correctly
- Restart Expo after changing `.env`
- Check network connectivity
- For local dev, ensure backend is running

### Rate limiting
- Default: 20 requests per 15 minutes per IP
- Adjust in backend `.env`: `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MS`

---

## Environment Variables Summary

### Backend (`.env` in `backend/` directory)
```env
PORT=3000
OPENAI_API_KEY=sk-your-key-here
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=20
```

### Frontend (`.env` in project root)
```env
EXPO_PUBLIC_BACKEND_URL=https://your-backend-url.com
# For production web / expo-router origin (optional; defaults to https://localhost:8081)
EXPO_PUBLIC_APP_ORIGIN=https://your-app-domain.com
# Supabase (user profiles — optional; see "Supabase" section above)
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## Next Steps

1. ✅ Deploy backend to your chosen platform
2. ✅ Set `EXPO_PUBLIC_BACKEND_URL` in frontend `.env`
3. ✅ Test the app - take a photo and verify it calls backend
4. ✅ Monitor backend logs for any issues
5. ✅ Adjust rate limits if needed

Your backend is now ready to serve your mobile app! 🎉
