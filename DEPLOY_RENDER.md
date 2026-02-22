# Deploy on Render

## What this repo now includes
- `render.yaml` with:
  - `eros-backend` (Python web service)
  - `eros-frontend` (React static site)
  - `eros-postgres` (managed PostgreSQL)

## Deploy steps
1. Push latest code to GitHub.
2. In Render, click **New +** -> **Blueprint**.
3. Connect your GitHub repo and select this repo.
4. Render reads `render.yaml` and shows 3 resources.
5. Click **Apply** to create/deploy.

## After deploy
1. Open backend service in Render.
2. Set extra env vars if you use these features:
   - `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `FROM_EMAIL`, `FROM_NAME`, `ADMIN_EMAIL`
   - `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
   - For Mailjet email API:
     - `EMAIL_PROVIDER=mailjet`
     - `MAILJET_API_KEY=<your-mailjet-api-key>`
     - `MAILJET_API_SECRET=<your-mailjet-api-secret>`
     - optional: `MAILJET_API_BASE=https://api.mailjet.com`
   - For Sender email API:
     - `EMAIL_PROVIDER=sender`
     - `SENDER_API_KEY=<your-sender-api-key>`
     - optional: `SENDER_API_BASE=https://api.sender.net`
   - For Resend email instead of SMTP:
     - `EMAIL_PROVIDER=resend`
     - `RESEND_API_KEY=<your-resend-api-key>`
     - `FROM_EMAIL=<verified-sender@yourdomain.com>`
     - optional: `RESEND_API_BASE=https://api.resend.com`
3. Update URL env vars to your real generated Render domains:
   - Backend:
     - `FRONTEND_BASE_URL=https://<your-frontend>.onrender.com`
     - `FRONTEND_ORIGINS=https://<your-frontend>.onrender.com`
   - Frontend:
     - `REACT_APP_API_BASE_URL=https://<your-backend>.onrender.com`
     - `REACT_APP_SOCKET_URL=https://<your-backend>.onrender.com`
4. Redeploy backend and frontend once after URL updates.

## Notes
- First request on free plan may be slow (cold start).
- Backend uses Socket.IO + simulation, so keep it as a web service (not serverless).
