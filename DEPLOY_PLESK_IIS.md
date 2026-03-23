# Plesk IIS Deployment

This repository is split into:

- `client`: Vite/React frontend
- `server`: Express API

For a single-domain Windows IIS/Plesk deployment, build the frontend and copy its output into `server/public`. The Express app is already configured to serve that folder in production.

## 1. Build the frontend

From `client`:

```powershell
npm install
npm run build
```

Copy the contents of `client/dist` into `server/public`.

## 2. Install backend dependencies

From `server`:

```powershell
npm install --omit=dev
```

## 3. Configure production env

Create `server/.env.production` from `server/.env.production.example`.

Important:

- Do not commit the real `.env.production`.
- Use strong JWT secrets.
- Set `CORS_ORIGIN` to your real HTTPS domain(s).
- Leave `PORT` unset unless your host explicitly requires it.

## 4. Files to deploy

Deploy the `server` folder as the IIS site root, including:

- `server.js`
- `app.js`
- `src/`
- `uploads/` if you need existing uploads
- `public/` containing the built frontend
- `package.json`
- `package-lock.json`
- `web.config`
- `.env.production`

## 5. Plesk / IIS settings

- Node.js mode: `production`
- Application startup file: `server.js`
- Node.js version: `20.x` or newer
- Document root / application root: the deployed `server` directory
- Enable IISNode support in Plesk

## 6. Health checks

After deployment:

- `https://yourdomain.com/healthz`
- `https://yourdomain.com/readyz`
- `https://yourdomain.com/`

## 7. Frontend API base URL

The frontend now defaults to same-origin API paths:

- `client/src/api/axios.ts` -> `/api`
- `client/src/services/api.ts` -> `/api/v1`

That means production will work on one domain without hardcoded localhost URLs.
