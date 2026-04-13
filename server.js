const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

app.use(cors());
app.use(express.json());

/**
 * 🔹 CDS Hooks Discovery Endpoint
 */
app.get('/cds-services', (req, res) => {
    res.json({
        services: [
            {
                id: "patient-view",
                hook: "patient-view",
                title: "Patient Greeting Service",
                description: "Returns greeting message with patient name"
            }
        ]
    });
});

/**
 * 🔹 CDS Hooks Main Logic (patient-view)
 */
app.post('/cds-services/patient-view', async (req, res) => {
    let name = "Patient";

    try {
        const patientId = req.body.context?.patientId;
        const fhirServer = req.body?.fhirServer || "https://launch.smarthealthit.org/v/r2/fhir";

        console.log("Incoming request:", req.body);

        if (patientId && fhirServer) {
            const response = await fetch(`${fhirServer}/Patient/${patientId}`);
            const data = await response.json();

            name = data?.name?.[0]?.given?.[0] || "Patient";
        }
    } catch (error) {
        console.log("Error fetching patient:", error);
    }

    res.json({
        cards: [
            {
                summary: `Hello ${name}`,
                indicator: "info",
                source: {
                    label: "Demo CDS Service"
                }
            }
        ]
    });
});

/**
 * 🔹 Health Check
 */
app.get('/', (req, res) => {
    res.send("CDS Service Running");
});

/**
 * 🔹 Start Server
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});