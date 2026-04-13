const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());

app.use(express.json());

// CDS Hooks endpoint
app.post('/cds-services/patient-view', (req, res) => {
    const patient = req.body.prefetch?.patient;
    const name = patient?.name?.[0]?.given?.[0] || "Patient";

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

// Discovery endpoint (IMPORTANT for sandbox)
app.get('/cds-services', (req, res) => {
    res.json({
        services: [
            {
                id: "patient-view",
                hook: "patient-view",
                title: "Patient Greeting Service"
            }
        ]
    });
});

// Health check
app.get('/', (req, res) => {
    res.send("CDS Service Running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});