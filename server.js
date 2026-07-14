cat > server.js << 'EOF'
// server.js
//
// Minimal CDS Hooks service:
//  - GET  /cds-services              -> discovery document
//  - POST /cds-services/patient-view -> returns cards for the patient-view hook
//
// Deploy target: Render.com (Web Service)

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors()); // CDS Hooks calls come from a browser-based SMART app on a different origin
app.use(express.json());

const PORT = process.env.PORT || 3000; // Render injects PORT; always bind to it

// ---------------------------------------------------------------------------
// 1. Discovery endpoint - tells CDS clients what services this server offers
// ---------------------------------------------------------------------------
app.get("/cds-services", (req, res) => {
  res.json({
    services: [
      {
        hook: "patient-view",
        id: "patient-view",
        title: "Patient View Advisor",
        description: "Returns informational cards when a patient chart is opened.",
        prefetch: {
          patient: "Patient/{{context.patientId}}",
        },
      },
    ],
  });
});

// ---------------------------------------------------------------------------
// 2. Service endpoint - the actual hook logic
// ---------------------------------------------------------------------------
app.post("/cds-services/patient-view", (req, res) => {
  const { context, prefetch, fhirServer, fhirAuthorization } = req.body || {};

  const patientId = context?.patientId;
  const patient = prefetch?.patient;

  const cards = [];

  if (patientId) {
    cards.push({
      summary: `Loaded context for patient ${patientId}`,
      indicator: "info",
      detail: patient
        ? `Prefetched patient resource available (id: ${patient.id || patientId}).`
        : "No prefetch data was provided; you could fetch the Patient resource " +
          "using fhirServer + fhirAuthorization if you need more detail.",
      source: {
        label: "CDS Hooks Demo Service",
      },
    });
  }

  // Example: you could fetch more FHIR data here using fhirServer + fhirAuthorization.access_token
  // e.g. GET `${fhirServer}/Condition?patient=${patientId}` with an Authorization: Bearer header.

  res.json({ cards });
});

// Health check (useful for Render + uptime monitors)
app.get("/", (req, res) => {
  res.send("CDS Hooks service is running.");
});

app.listen(PORT, () => {
  console.log(`CDS Hooks service listening on port ${PORT}`);
});
