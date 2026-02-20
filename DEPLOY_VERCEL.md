# Deploy Guide (Vercel + Public Backend)

This project should be deployed as:
- `frontend` on **Vercel**
- `backend` on a persistent host (Render/Railway/Fly/VM), not Vercel serverless

Reason: backend uses Flask-SocketIO + background simulation, which needs a long-running process.

## 1) Deploy Backend (first)

Deploy `backend` to a host that supports long-lived processes and WebSockets.

Set backend environment variables:

- `JWT_SECRET_KEY`
- `DATABASE_URL`
- `OSRM_BASE_URL`
- `FRONTEND_BASE_URL=https://<your-vercel-domain>`
- `FRONTEND_ORIGINS=https://<your-vercel-domain>,https://www.<your-vercel-domain>`
- `SMTP_*` (if email required)
- `TWILIO_*` (if SMS required)

After deploy, verify:
- `GET https://<backend-domain>/` returns healthy JSON.

## 2) Deploy Frontend on Vercel

In Vercel:
- Import repo
- Set **Root Directory** to `frontend`
- Framework preset: `Create React App`

Set frontend env variables in Vercel project:
- `REACT_APP_API_BASE_URL=https://<backend-domain>`
- `REACT_APP_SOCKET_URL=https://<backend-domain>`

`frontend/vercel.json` already includes SPA rewrites so React routes work on refresh.

## 3) Post-deploy checks

1. Open app from phone/laptop.
2. Submit emergency.
3. Authority assigns unit.
4. Confirm:
- realtime map/socket updates
- public tracking link opens correctly
- SMS flow works if configured
