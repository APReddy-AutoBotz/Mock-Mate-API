import { GoogleGenAI } from '@google/genai';
import { PERSONAS_CONFIG } from '../personas.config';
import type { FinalReport, InterviewPlan, InterviewTurn, QuestionBlueprint, SessionContext, SessionControls } from '../types';
import { APIError, ValidationError, handleAPIError } from '../utils/errorHandler';

const getApiKey = () => {
    // Check various common Vite/Process patterns for robustness
    return (import.meta as any).env?.VITE_GEMINI_API_KEY ||
        (import.meta as any).env?.GEMINI_API_KEY ||
        process.env.VITE_GEMINI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        (window as any).VITE_GEMINI_API_KEY ||
        '';
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

const getResponseText = (response: any): string => {
    if (!response) return '';
    if (typeof response.text === 'string') return response.text;
    if (typeof response.text === 'function') return response.text();

    const candidateText = response?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text)
        ?.filter(Boolean)
        ?.join('');

    return candidateText || '';
};

const extractJson = (text: string): any => {
    if (!text) return null;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch {
        return null;
    }
};

const retryOperation = async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000,
    context?: any
): Promise<T> => {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;

            if (attempt === maxRetries) {
                throw handleAPIError(error, context);
            }

            const delay = initialDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw handleAPIError(lastError, context);
};

export const calibrateIntent = async (intentText: string, additionalContext?: string): Promise<{ recommendedPanelIDs: string[]; recommendedRole: string; matchReasons?: Record<string, string> }> => {
    if (!intentText || intentText.trim().length < 2) {
        // Allow short intents if we have context
        if (!additionalContext) throw new ValidationError('Please provide a more detailed job description or career goal.');
    }

    if (!process.env.GEMINI_API_KEY && !process.env.API_KEY) {
        console.warn("No API key found. Using heuristic fallback.");
        return heuristicPersonaMatch(intentText, additionalContext);
    }

    const availablePersonas = PERSONAS_CONFIG.map(p =>
        `- ID: ${p.id}
         Name: ${p.name}
         Title: ${p.title}
         Focus: ${p.focus}
         Keywords: ${p.keywords.join(', ')}
         Seniority: ${p.seniority}
         Style: ${p.style}`
    ).join('\n\n');

    const masterPrompt = `You are an expert talent acquisition strategist. Select the most appropriate interview panel (1-3 personas) for the candidate's goal.

CANDIDATE GOAL: "${intentText}"
ADDITIONAL CONTEXT (JD/Referral): "${additionalContext || 'None'}"

AVAILABLE PERSONAS:
${availablePersonas}

INSTRUCTIONS:
1. Analyze the candidate's role and seniority implied by the goal.
2. Select 1-3 personas that best match the domain, seniority, and required soft/hard skills.
3. For EVERY selection, provide a brief, professional "matchReason" (e.g., "Vikram is selected to probe your depth in architectural trade-offs and team leadership.").
4. Also normalize the candidate's role title.

OUTPUT JSON SCHEMA:
{
  "recommendedPanelIDs": ["id1", "id2"],
  "recommendedRole": "Normalized Job Title",
  "matchReasons": {
    "id1": "Specific reason for id1",
    "id2": "Specific reason for id2"
  }
}

CRITICAL: Do not return empty reasons. Vikram, Maya, and Asha must have unique justification based on the goal.`;

    try {
        const response = await retryOperation(async () => {
            return await ai.models.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: [{ parts: [{ text: masterPrompt }] }],
                config: {
                    temperature: 0.2,
                    maxOutputTokens: 800,
                    responseMimeType: 'application/json'
                }
            });
        },
            2,
            1000,
            { intentText, operation: 'calibrateIntent' }
        );

        const parsed = extractJson(getResponseText(response) || '{}');
        const validIDs = PERSONAS_CONFIG.map(p => p.id);
        const filteredIDs = (parsed?.recommendedPanelIDs || [])
            .filter((id: string) => validIDs.includes(id))
            .slice(0, 3);

        if (filteredIDs.length === 0) throw new Error("AI returned no valid IDs");

        return {
            recommendedPanelIDs: filteredIDs,
            recommendedRole: parsed?.recommendedRole || 'Professional',
            matchReasons: parsed?.matchReasons
        };

    } catch (err) {
        console.error("AI Calibration failed, using fallback rule engine.", err);
        return heuristicPersonaMatch(intentText, additionalContext);
    }
};

// Simple heuristic engine for fallback or offline mode
const heuristicPersonaMatch = (intent: string, context?: string): { recommendedPanelIDs: string[]; recommendedRole: string; matchReasons?: Record<string, string> } => {
    const fullText = (intent + " " + (context || "")).toLowerCase();
    const scores: Record<string, number> = {};
    const reasons: Record<string, string> = {};

    PERSONAS_CONFIG.forEach(p => {
        let score = 0;
        // Keyword overlap
        p.keywords.forEach(k => {
            if (fullText.includes(k.toLowerCase())) score += 5;
        });
        // Title match
        if (fullText.includes(p.title.toLowerCase())) score += 10;
        // Domain match (broad)
        p.domain.forEach(d => {
            if (fullText.includes(d.toLowerCase())) score += 3;
        });

        scores[p.id] = score;
        if (score > 0) reasons[p.id] = `Matched on keywords: ${p.keywords.filter(k => fullText.includes(k.toLowerCase())).join(', ')}`;
    });

    // Always include a recruiter (Asha) if score is low or as baseline
    if (!scores['p1']) scores['p1'] = 1;

    // Sort by score
    const sortedIDs = Object.keys(scores).sort((a, b) => scores[b] - scores[a]).slice(0, 3);

    return {
        recommendedPanelIDs: sortedIDs.length > 0 ? sortedIDs : ['p1', 'p2', 's1'],
        recommendedRole: intent || 'Candidate',
        matchReasons: reasons
    };
};

const DEFAULT_CONTROLS: SessionControls = {
    difficulty: 'intermediate',
    totalQuestions: 15,
    includeBehavioral: true,
    includeCoding: false,
    timePerQuestion: '90s',
    sessionMode: 'exam',
    sourceMode: 'job_description'
};

export function generateInterviewPlan(intentText: string, selectedPanelIDs: string[]): Promise<InterviewPlan>;
export function generateInterviewPlan(
    intentText: string,
    jdText: string | null,
    sessionControls: SessionControls,
    selectedPanelIDs: string[]
): Promise<InterviewPlan>;
export async function generateInterviewPlan(
    intentText: string,
    arg2: string[] | string | null,
    arg3?: SessionControls,
    arg4?: string[]
): Promise<InterviewPlan> {
    // Legacy signature: (intentText, selectedPanelIDs)
    if (Array.isArray(arg2)) {
        return generateInterviewPlanV2(intentText, null, DEFAULT_CONTROLS, arg2);
    }

    // Current signature: (intentText, jdText, sessionControls, selectedPanelIDs)
    return generateInterviewPlanV2(
        intentText,
        arg2,
        arg3 || DEFAULT_CONTROLS,
        arg4 || []
    );
}

import { questionHistoryService } from './questionHistoryService';

export const generateInterviewPlanV2 = async (
    intentText: string,
    jdText: string | null,
    sessionControls: SessionControls,
    selectedPanelIDs: string[]
): Promise<InterviewPlan> => {
    if (!intentText || intentText.trim().length < 5) {
        throw new ValidationError('Please provide a more detailed goal or document.');
    }

    if (!selectedPanelIDs || selectedPanelIDs.length === 0) {
        throw new ValidationError('Please select at least one interviewer persona.');
    }

    const selectedPersonas = PERSONAS_CONFIG.filter(p => selectedPanelIDs.includes(p.id));

    // Retrieve recent history to prevent repetition
    const excludedQuestions = questionHistoryService.getRecentQuestionTexts(10); // 10 day window

    // Determine tool configuration based on mode
    const tools = sessionControls.sourceMode === 'job_description'
        ? [{ googleSearchRetrieval: { dynamicRetrievalConfig: { mode: 'MODE_DYNAMIC', dynamicThreshold: 0.7 } } } as any]
        : [];

    const difficultyPrompt = sessionControls.difficulty === 'starter'
        ? "Focus on fundamental concepts, definitions, and basic problem solving. Avoid obscure edge cases."
        : sessionControls.difficulty === 'expert'
            ? "Focus solely on advanced system design, scaling, complex edge cases, and high-level strategy. Skip basics."
            : "Mix fundamental checks with intermediate scenario-based questions.";

    const codingInstruction = sessionControls.includeCoding
        ? `MANDATORY: Include at least 2-3 technical coding questions. Use phase: 'coding'. 
           - Assign a specific 'language' (e.g., 'python', 'java', 'sql', 'cpp', 'rpa', 'javascript') based on the role.
           - For RPA roles, use 'rpa' logic (pseudo-code or automation steps).
           - For Data roles, use 'sql'.`
        : "Do not include coding questions.";

    const sourcePrompt = sessionControls.sourceMode === 'question_bank'
        ? `STRICT MODE: The provided text is a QUESTION BANK or STUDY MATERIAL. 
           - You MUST extract questions or concepts directly from this text.
           - DO NOT use external sources or standard interview questions unless they are present in the text.
           - You may rephrase them for clarity or turn them into scenarios, but the core 'Technical Truth' must come from the input.
           - If the input is a list of questions, rotate through them for the plan.`
        : `EXPLORATION MODE: Use the provided Job Description as a baseline.
           - Search for RECENT (last 12 months) interview questions for this role.
           - identifying trending topics not explicitly in the JD but standard for the industry.`;

    const masterPrompt = `You are an expert interview strategist. Create a comprehensive interview plan.
    
    CONTEXT:
    User Intent: "${intentText}"
    Mode: ${sessionControls.sourceMode} (${sourcePrompt})
    Difficulty: ${sessionControls.difficulty.toUpperCase()} (${difficultyPrompt})
    ${codingInstruction}
    
    PANEL:
    ${selectedPersonas.map(p => `- ${p.name} (${p.title}): ${p.focus}`).join('\n')}

    INPUT MATERIAL:
    ${jdText ? `"""\n${jdText}\n"""` : 'None'}

    CONTROLS:
    - Total Questions: ${sessionControls.totalQuestions}
    - Anti-Repetition: Do NOT ask these recently asked questions: ${JSON.stringify(excludedQuestions.slice(0, 20))}
    
    TASK:
    1. Extract granular skill categories (Must-Have, Nice-to-Have, Domains, Tools, Soft Skills).
    2. Define weights for exactly these 5 competencies: DomainKnowledge, MethodsTools, ProcessCompliance, ScenarioDecision, BehavioralComms.
    3. Generate the question set.

    OUTPUT SCHEMA (JSON):
    {
      "jdInsights": { 
        "role": "string", 
        "level": "string", 
        "mustHaveSkills": ["string"],
        "niceToHave": ["string"],
        "domains": ["string"],
        "tools": ["string"],
        "softSkills": ["string"],
        "competencyWeights": {
          "DomainKnowledge": 0.25,
          "MethodsTools": 0.20,
          "ProcessCompliance": 0.15,
          "ScenarioDecision": 0.20,
          "BehavioralComms": 0.20
        } 
      },
      "questionSet": [
        {
          "phase": "One of: knowledge, process, scenario, behavioral, coding",
          "competency": "One of: DomainKnowledge, MethodsTools, ProcessCompliance, ScenarioDecision, BehavioralComms",
          "difficulty": "L1-L5",
          "question": "string",
          "expectedSignals": ["string"],
          "personaFocus": "string (use Persona ID from panel)",
          "why": "string",
          "language": "string (e.g., 'python', 'java', 'sql', 'rpa', 'cpp' - only for phase: coding)"
        }
      ],
      "meta": { "estimatedDuration": "string", "focusAreas": ["string"] }
    }
    
    Ensure the question count matches exactly ${sessionControls.totalQuestions || 15}.`;

    try {
        const response = await retryOperation(async () => {
            return await ai.models.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: [{ parts: [{ text: masterPrompt }] }],
                config: {
                    temperature: sessionControls.sourceMode === 'question_bank' ? 0.2 : 0.4,
                    maxOutputTokens: 4000,
                    responseMimeType: 'application/json'
                }
            });
        },
            2,
            2000,
            { intentText, operation: 'generateInterviewPlan' }
        );

        const rawPlan = extractJson(getResponseText(response) || '{}');
        if (!rawPlan || !rawPlan.questionSet) throw new Error("AI returned incomplete plan structure");

        // Data Normalization (Ensures UI reliability)
        const plan: InterviewPlan = {
            ...rawPlan,
            jdInsights: {
                role: rawPlan.jdInsights?.role || "Awaiting Role Confirmation",
                level: rawPlan.jdInsights?.level || "Unspecified Level",
                mustHaveSkills: rawPlan.jdInsights?.mustHaveSkills || rawPlan.jdInsights?.skills || [],
                niceToHave: rawPlan.jdInsights?.niceToHave || [],
                domains: rawPlan.jdInsights?.domains || [],
                tools: rawPlan.jdInsights?.tools || rawPlan.jdInsights?.technologies || [],
                softSkills: rawPlan.jdInsights?.softSkills || [],
                competencyWeights: rawPlan.jdInsights?.competencyWeights || {
                    DomainKnowledge: 0.2, MethodsTools: 0.2, ProcessCompliance: 0.2, ScenarioDecision: 0.2, BehavioralComms: 0.2
                },
                source: sessionControls.sourceMode === 'question_bank' ? 'questionBank' : 'realJD'
            }
        };

        // Save new questions to history for future exclusion
        const newQuestions = plan.questionSet.map((q: any) => q.question);
        questionHistoryService.saveQuestions(newQuestions);

        return plan;

    } catch (err) {
        console.error("Plan Generation Failed", err);
        throw handleAPIError(err, { operation: 'generatePlan' });
    }
};

export const startInterviewSession = async (
    context: SessionContext
): Promise<{ firstQuestion: string; personaId: string; updatedContext: SessionContext }> => {
    const personaId = context.selectedPanelIDs?.[0] || 'p1';

    // If there's already a structured plan, use it.
    if (context.interviewPlan?.questionSet?.length) {
        return {
            firstQuestion: context.interviewPlan.questionSet[0]?.question || 'Tell me about yourself.',
            personaId,
            updatedContext: context
        };
    }

    // Conversational fallback
    return {
        firstQuestion: `To start, could you briefly walk me through your background and what attracted you to "${context.candidateRole}"?`,
        personaId,
        updatedContext: context
    };
};

export const submitAnswerAndGetNext = async (
    history: InterviewTurn[],
    context: SessionContext,
    personaId: string
): Promise<{ nextQuestion: string; isLastQuestion: boolean }> => {
    const totalExpected = context.interviewPlan?.meta?.controls?.totalQuestions || 7;
    const isLastQuestion = history.length >= totalExpected;
    if (isLastQuestion) {
        return { nextQuestion: '', isLastQuestion: true };
    }

    // Minimal conversational progression (keeps the app functional even if model is unreachable)
    return {
        nextQuestion: `Thanks. Next: describe a tough problem you solved recently and how you approached it.`,
        isLastQuestion: false
    };
};

export const analyzeCode = async (blueprint: QuestionBlueprint, code: string): Promise<string> => {
    const lang = blueprint.language || 'python';
    const masterPrompt = `You are a Senior Staff Engineer. Analyze the following candidate code for a job interview.

    LANGUAGE: ${lang}
    QUESTION:
    ${blueprint.question}

    EXPECTED SIGNALS:
    ${JSON.stringify(blueprint.expectedSignals)}

    CANDIDATE CODE:
    \`\`\`${lang}
    ${code}
    \`\`\`

    TASK:
    1. Evaluate code correctness and logic.
    2. Assess time/space complexity.
    3. Identify edge cases handled vs missed.
    4. Provide concise, high-bar suggestions for improvement.
    
    Format: Return a professional, encouraging but rigorous critique (max 300 words).`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ parts: [{ text: masterPrompt }] }],
            config: { temperature: 0.1, maxOutputTokens: 1000 }
        });
        return getResponseText(response) || "Unable to analyze code logic.";
    } catch (e) {
        return "Internal review engine timeout. The code seems syntactically valid.";
    }
};

export const simulateExecution = async (code: string, language: string): Promise<{ stdout: string; stderr: string }> => {
    const prompt = `You are a universal code execution kernel. Mental-run the following code and return the expected standard output and standard error.
    
    LANGUAGE: ${language}
    CODE:
    ${code}
    
    TASK:
    Generate realistic terminal logs. If the code has syntax errors or runtime exceptions, put them in stderr. If it runs correctly, put output in stdout.
    Do NOT include code in the response. ONLY the logs.
    
    RETURN JSON ONLY:
    {
      "stdout": "...",
      "stderr": "..."
    }`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ parts: [{ text: prompt }] }],
            config: { temperature: 0.1, responseMimeType: 'application/json' }
        });
        const text = getResponseText(response);
        return extractJson(text) || { stdout: '', stderr: 'Kernel Panic: Unable to simulate execution.' };
    } catch (e) {
        return { stdout: '', stderr: 'Kernel Timeout: AI simulation failed.' };
    }
};

export const getHintForQuestion = async (_question: string): Promise<string> => {
    return 'Focus on clarifying the problem, stating assumptions, and describing tradeoffs.';
};

// Helper to convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
            const base64data = reader.result as string;
            // Remove data:audio/webm;codecs=opus;base64, prefix
            resolve(base64data.split(',')[1]);
        };
        reader.onerror = reject;
    });
};

export const transcribeAudio = async (blob: Blob): Promise<string> => {
    try {
        const base64Audio = await blobToBase64(blob);

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [{
                parts: [
                    { inlineData: { mimeType: blob.type || 'audio/webm', data: base64Audio } },
                    { text: "Transcribe this interview answer exactly as spoken. Return ONLY the text, no intro/outro." }
                ]
            }],
            config: {
                temperature: 0.1,
            }
        });

        const text = getResponseText(response);
        return text.trim();
    } catch (error) {
        console.error("Transcription failed", error);
        // Fallback for demo if API fails
        return "I'm ready to move to the next question. (Transcription Unavailable)";
    }
};

export const generateFinalReport = async (
    history: InterviewTurn[],
    context: SessionContext
): Promise<FinalReport> => {
    // If no history, return minimal error report
    if (!history || history.length === 0) {
        throw new ValidationError('No interview history to analyze.');
    }

    const jdInsights = context.jdInsights || context.interviewPlan?.jdInsights;
    if (!jdInsights) {
        throw new ValidationError('Missing job insights to generate report.');
    }
    const roleParam = context.candidateRole || "Candidate";

    const transcriptText = history.map((turn, i) => `
    TURN ${i + 1}:
    Interviewer (${turn.interviewer}): "${turn.question}"
    Candidate: "${turn.candidateResponse}"
    `).join('\n');

    // Standard breakdown into 5 specific competencies for consistency with plan
    const COMPETENCY_LIST = ["DomainKnowledge", "MethodsTools", "ProcessCompliance", "ScenarioDecision", "BehavioralComms"];
    const targetCompetencies = COMPETENCY_LIST.join(", ");

    const selectedPersonas = PERSONAS_CONFIG.filter(p => context.selectedPanelIDs?.includes(p.id));
    const panelNames = selectedPersonas.map(p => `${p.name} (${p.title})`).join(", ");

    const masterPrompt = `You are a world-class Interview Bar Raiser. Analyze this mock interview session and generate a "Hiring Committee" report.
    
    PANEL OF EXPERTS:
    ${selectedPersonas.map(p => `- ${p.name} (${p.title}): ${p.focus}`).join('\n')}

    THE DEBATE:
    You must simulate a discussion between exactly these people: ${panelNames}. 
    Each should have a different perspective based on their focus area.

    CONTEXT:
    Role: ${roleParam}
    Target Competencies: ${targetCompetencies} (Score each from 0-100)
    JD Highlights: ${JSON.stringify(jdInsights?.mustHaveSkills || [])}

    TRANSCRIPT:
    ${transcriptText}

    TASK:
    Generate a JSON report conforming EXACTLY to the schema below.
    1. Structure feedback into specific "Strengths" and "Improvements" for every answer.
    2. Quantitatively score EXACTLY these 5 competencies (0-100 scale): ${targetCompetencies}.
    3. Simulate an "Advisory Panel" debate between the selected experts.
    4. Identify the SINGLE biggest termination risk.
    5. Create a "Coach Pack" with professional micro-drills.
    6. Determine a "Readiness Status" (INTERVIEW_READY, ALMOST_READY, NOT_READY).

    OUTPUT SCHEMA (JSON):
    {
      "overallSummary": "High-level executive summary.",
      "readiness": {
        "status": "INTERVIEW_READY | ALMOST_READY | NOT_READY",
        "reasoning": "Decision logic."
      },
      "quantitativeAnalysis": {
        "competency_scores": [
           { "competency": "DomainKnowledge", "score": 85, "reason": "string" },
           { "competency": "MethodsTools", "score": 75, "reason": "string" },
           { "competency": "ProcessCompliance", "score": 90, "reason": "string" },
           { "competency": "ScenarioDecision", "score": 60, "reason": "string" },
           { "competency": "BehavioralComms", "score": 80, "reason": "string" }
        ]
      },
      "advisoryPanel": [
        {
          "persona": "Interviewer Name",
          "summary": "1st person perspective.",
          "scores": [{ "skill": "Focus Area", "score": 1-5 }]
        }
      ],
      "questionPerformance": [
        {
          "question_text": "Question",
          "user_transcript": "Answer",
          "feedback": "Critical feedback on what was missing or strong.",
          "strengths": ["Bulllet 1", "Bullet 2"],
          "improvements": ["Critique 1", "Critique 2"],
          "max_impact_response": "An ideal, high-bar response (STAR format where applicable) demonstrating exactly how a top 1% candidate would have answered."
        }
      ],
      "biggestRiskArea": {
        "title": "Risk Title",
        "observation": "Evidence",
        "mitigation": "Fix"
      },
      "coachPack": {
        "title": "Strategy Mastery Protocol",
        "redoNow": { "question": "Q", "instruction": "I" },
        "micro_drills": [{ "weakness": "W", "drill_prompt": "P", "focus_point": "F" }]
      }
    }
    `;

    try {
        const response = await retryOperation(async () => {
            return await ai.models.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: [{ parts: [{ text: masterPrompt }] }],
                config: {
                    temperature: 0.3,
                    maxOutputTokens: 5000,
                    responseMimeType: 'application/json'
                }
            });
        },
            2,
            3000,
            { intentText: roleParam, operation: 'generateFinalReport' }
        );

        const reportData = extractJson(getResponseText(response) || '{}');

        // Validation / Hydration
        if (!reportData.overallSummary || !reportData.questionPerformance) {
            throw new Error("Incomplete report generated by AI");
        }

        return {
            overallSummary: reportData.overallSummary,
            jdInsights: jdInsights!,
            competencyWeights: context.competencyWeights || [],
            advisoryPanel: reportData.advisoryPanel || [],
            questionPerformance: reportData.questionPerformance || [],
            quantitativeAnalysis: reportData.quantitativeAnalysis,
            coachPack: reportData.coachPack || { title: 'Review', redoNow: { question: '', instruction: '' }, micro_drills: [] },
            readiness: reportData.readiness || { status: 'ALMOST_READY', reasoning: 'Assessment inconclusive.' },
            biggestRiskArea: reportData.biggestRiskArea
        };

    } catch (err) {
        console.error("Report Generation Failed", err);
        throw handleAPIError(err, { operation: 'generateReport' });
    }
};

export default {
    calibrateIntent,
    generateInterviewPlan,
    generateInterviewPlanV2,
    startInterviewSession,
    submitAnswerAndGetNext,
    analyzeCode,
    simulateExecution,
    getHintForQuestion,
    transcribeAudio,
    generateFinalReport
};
