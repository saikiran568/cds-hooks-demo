const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────────────────────
// Helper: fetch a FHIR resource with bearer token (fallback path,
// used only if Cerner did NOT prefetch the data for us)
// ─────────────────────────────────────────────────────────────
async function fetchFhir(fhirServer, token, path) {
  try {
    const res = await fetch(`${fhirServer}/${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/fhir+json',
      },
    });
    if (!res.ok) {
      console.error(`FHIR fetch failed [${res.status}] for ${path}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`FHIR fetch error for ${path}:`, err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 🔹 CDS Hooks Discovery Endpoint
// Cerner calls this once to learn what services you offer and
// what FHIR data to prefetch before calling each hook.
// ─────────────────────────────────────────────────────────────
app.get('/cds-services', (req, res) => {
  res.json({
    services: [
      {
        id: 'patient-view',
        hook: 'patient-view',
        title: 'Patient Summary & Risk Alerts',
        description:
          'Greets the practitioner and surfaces active conditions and medications for the patient',
        prefetch: {
          patient: 'Patient/{{context.patientId}}',
          conditions: 'Condition?patient={{context.patientId}}&clinical-status=active',
          medications: 'MedicationRequest?patient={{context.patientId}}&status=active',
          allergies: 'AllergyIntolerance?patient={{context.patientId}}',
        },
      },
    ],
  });
});

// ─────────────────────────────────────────────────────────────
// 🔹 CDS Hooks Main Logic (patient-view)
// Reads prefetched FHIR data when available; falls back to a
// live authenticated fetch if Cerner didn't prefetch a resource.
// ─────────────────────────────────────────────────────────────
app.post('/cds-services/patient-view', async (req, res) => {
  const cards = [];

  try {
    const { context, fhirServer, fhirAuthorization, prefetch = {} } = req.body || {};
    const patientId = context?.patientId;
    const token = fhirAuthorization?.access_token;

    console.log('Incoming CDS Hooks request:', JSON.stringify(req.body, null, 2));

    if (!patientId) {
      return res.json({ cards: [] });
    }

    // ── Resolve Patient resource ──────────────────────────────
    let patient = prefetch.patient;
    if (!patient && fhirServer && token) {
      patient = await fetchFhir(fhirServer, token, `Patient/${patientId}`);
    }
    const name = patient?.name?.[0]?.given?.[0] || 'Patient';

    cards.push({
      summary: `Hello, viewing chart for ${name}`,
      indicator: 'info',
      source: { label: 'Cerner CDS Service' },
    });

    // ── Resolve active Conditions ─────────────────────────────
    let conditionsBundle = prefetch.conditions;
    if (!conditionsBundle && fhirServer && token) {
      conditionsBundle = await fetchFhir(
        fhirServer,
        token,
        `Condition?patient=${patientId}&clinical-status=active`
      );
    }
    const activeConditions = (conditionsBundle?.entry || [])
      .map((e) => e.resource?.code?.text || e.resource?.code?.coding?.[0]?.display)
      .filter(Boolean);

    if (activeConditions.length > 0) {
      cards.push({
        summary: `Active conditions: ${activeConditions.join(', ')}`,
        indicator: 'warning',
        source: { label: 'Cerner CDS Service' },
      });
    }

    // ── Resolve active Medications ─────────────────────────────
    let medsBundle = prefetch.medications;
    if (!medsBundle && fhirServer && token) {
      medsBundle = await fetchFhir(
        fhirServer,
        token,
        `MedicationRequest?patient=${patientId}&status=active`
      );
    }
    const activeMeds = (medsBundle?.entry || [])
      .map(
        (e) =>
          e.resource?.medicationCodeableConcept?.text ||
          e.resource?.medicationCodeableConcept?.coding?.[0]?.display
      )
      .filter(Boolean);

    if (activeMeds.length > 0) {
      cards.push({
        summary: `Active medications: ${activeMeds.join(', ')}`,
        indicator: 'info',
        source: { label: 'Cerner CDS Service' },
      });
    }

    // ── Resolve Allergies ────────────────────────────────────
    let allergyBundle = prefetch.allergies;
    if (!allergyBundle && fhirServer && token) {
      allergyBundle = await fetchFhir(fhirServer, token, `AllergyIntolerance?patient=${patientId}`);
    }
    const allergies = (allergyBundle?.entry || [])
      .map((e) => e.resource?.code?.text || e.resource?.code?.coding?.[0]?.display)
      .filter(Boolean);

    if (allergies.length > 0) {
      cards.push({
        summary: `Known allergies: ${allergies.join(', ')}`,
        indicator: 'critical',
        source: { label: 'Cerner CDS Service' },
      });
    }
  } catch (error) {
    console.error('Error processing patient-view hook:', error);
    cards.push({
      summary: 'CDS service encountered an error retrieving patient data',
      indicator: 'info',
      source: { label: 'Cerner CDS Service' },
    });
  }

  res.json({ cards });
});

// ─────────────────────────────────────────────────────────────
// 🔹 Health Check (also useful for Render health checks)
// ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('CDS Service Running');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Cerner CDS Hooks Service', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────
// 🔹 404 Handler
// ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    available: ['GET /', 'GET /health', 'GET /cds-services', 'POST /cds-services/patient-view'],
  });
});

// ─────────────────────────────────────────────────────────────
// 🔹 Start Server
// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CDS Hooks discovery: http://localhost:${PORT}/cds-services`);
});
