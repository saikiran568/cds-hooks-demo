cat > README.md << 'EOF'
# cerner-cds-hooks

A minimal CDS Hooks service exposing:

- `GET /cds-services` — discovery document
- `POST /cds-services/patient-view` — returns cards for the `patient-view` hook

This is the server your `cdsHooksClient.js` (in the SMART app) calls at
`https://cerner-cds-hooks.onrender.com/cds-services/patient-view`.

## Run locally

npm install
npm start

## Deploy on Render

1. Push this repo to GitHub.
2. Render dashboard -> New + -> Web Service -> connect this repo.
3. Build command: npm install
4. Start command: npm start
5. Service name must be "cerner-cds-hooks" to get that subdomain.
EOF