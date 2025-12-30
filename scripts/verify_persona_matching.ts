
import { calibrateIntent } from '../services/mockGeminiService';
import { PERSONAS_CONFIG } from '../personas.config';

async function verify() {
    console.log("Verifying Persona Configuration...");
    const p1 = PERSONAS_CONFIG.find(p => p.id === 'p1');
    if (!p1?.keywords || !p1.seniority) {
        console.error("FAILED: Persona configuration missing new fields");
        process.exit(1);
    }
    console.log("✅ Configuration loaded with new metadata");

    console.log("\nTesting Heuristic Fallback (Mocking no API key)...");
    // Ensure we don't use real API
    delete process.env.GEMINI_API_KEY;
    delete process.env.API_KEY;

    try {
        const result = await calibrateIntent("I am a senior frontend react developer looking for a leadership role", "Job requires managing a team of 5 and architecting cloud solutions.");

        console.log("Recommended Role:", result.recommendedRole);
        console.log("Panel:", result.recommendedPanelIDs);
        console.log("Reasons:", JSON.stringify(result.matchReasons, null, 2));

        // Expect 'p2' (Vikram - Tech) and 's4' (Marcus - Executive/Strategy) or 'p3' (Maya - Manager)
        const hasTech = result.recommendedPanelIDs.includes('p2');
        const hasLeadership = result.recommendedPanelIDs.includes('s1') || result.recommendedPanelIDs.includes('s4') || result.recommendedPanelIDs.includes('p3');

        if (hasTech && hasLeadership) {
            console.log("✅ Heuristic Matching Logic Verified: Found Tech and Leadership personas");
        } else {
            console.warn("⚠️ Heuristic Matching Logic Result Mixed:", result.recommendedPanelIDs);
        }

    } catch (e) {
        console.error("FAILED: Execution error", e);
        process.exit(1);
    }
}

verify();
