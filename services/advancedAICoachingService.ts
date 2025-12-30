import { GoogleGenAI } from '@google/genai';
import type { SessionContext, InterviewTurn, QuestionBlueprint, CompetencyWeight } from '../types';
import { sessionService } from './sessionService';
import { APIError, ValidationError } from '../utils/errorHandler';

interface PersonalityProfile {
    openness: number;      // 0-1: Open to new experiences
    conscientiousness: number; // 0-1: Organized, detail-oriented
    extraversion: number;  // 0-1: Outgoing vs reserved
    agreeableness: number; // 0-1: Cooperative vs competitive
    neuroticism: number;   // 0-1: Anxiety-prone vs confident
    communicationStyle: 'direct' | 'diplomatic' | 'enthusiastic' | 'analytical';
    learningPreference: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
    stressResponse: 'calm' | 'moderate' | 'high';
}

interface CoachingStyle {
    tone: 'supportive' | 'challenging' | 'mentoring' | 'formal';
    feedbackFrequency: 'immediate' | 'periodic' | 'summary';
    questionComplexity: 'simple' | 'moderate' | 'complex';
    encouragementLevel: number; // 0-1
    constructiveCriticism: number; // 0-1
}

interface AdaptiveQuestion {
    question: string;
    difficulty: number; // 0-1
    category: string;
    personalityAdjustment: string;
    expectedResponseStyle: string;
    coachingHints: string[];
}

interface PersonalityAnalysis {
    profile: PersonalityProfile;
    confidence: number; // 0-1
    indicators: string[];
    recommendations: string[];
}

class AdvancedAICoachingService {
    private ai: GoogleGenAI;
    private readonly model = 'gemini-1.5-flash';

    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new APIError('Advanced AI coaching requires GEMINI_API_KEY');
        }
        this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    // Analyze user personality from interview responses
    async analyzePersonality(userId: string, sessionId: string): Promise<PersonalityAnalysis> {
        try {
            const session = await sessionService.getSession(sessionId);
            if (!session || !session.turns.length) {
                throw new ValidationError('Insufficient data for personality analysis');
            }

            const prompt = `
As an expert psychologist and career coach, analyze the personality traits based on these interview responses:

Session Context: ${session.context.candidateRole}
Responses:
${session.turns.map((turn, i) => 
    `Q${i+1}: ${turn.question}\nA${i+1}: ${turn.candidateResponse}`
).join('\n\n')}

Provide a comprehensive personality analysis in this JSON format:
{
    "profile": {
        "openness": 0.7,
        "conscientiousness": 0.8,
        "extraversion": 0.6,
        "agreeableness": 0.7,
        "neuroticism": 0.3,
        "communicationStyle": "direct",
        "learningPreference": "visual",
        "stressResponse": "moderate"
    },
    "confidence": 0.8,
    "indicators": ["Uses structured responses", "Shows analytical thinking", "Demonstrates confidence"],
    "recommendations": ["Provide more examples", "Work on conciseness", "Develop storytelling skills"]
}

Focus on:
1. Big Five personality traits (0-1 scale)
2. Communication patterns
3. Learning preferences
4. Stress indicators
5. Specific behavioral indicators
6. Actionable improvement recommendations
`;

            const model = (this.ai as any).getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new APIError('Invalid AI response format');
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('Error analyzing personality:', error);
            throw new APIError('Failed to analyze personality');
        }
    }

    // Generate adaptive coaching style based on personality
    async generateCoachingStyle(profile: PersonalityProfile): Promise<CoachingStyle> {
        const prompt = `
Based on this personality profile, determine the optimal coaching style:

Personality Profile:
${JSON.stringify(profile, null, 2)}

Generate coaching recommendations in this JSON format:
{
    "tone": "supportive",
    "feedbackFrequency": "periodic",
    "questionComplexity": "moderate",
    "encouragementLevel": 0.7,
    "constructiveCriticism": 0.5
}

Consider:
1. High neuroticism needs more encouragement
2. Low openness benefits from simpler questions
3. High extraversion responds well to challenging tone
4. High conscientiousness appreciates detailed feedback
5. Communication style matching
6. Stress response adaptation
`;

        try {
            const model = (this.ai as any).getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new APIError('Invalid AI response format');
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('Error generating coaching style:', error);
            // Return default style
            return {
                tone: 'supportive',
                feedbackFrequency: 'periodic',
                questionComplexity: 'moderate',
                encouragementLevel: 0.7,
                constructiveCriticism: 0.5
            };
        }
    }

    // Generate personality-adapted questions
    async generateAdaptiveQuestions(
        profile: PersonalityProfile,
        coachingStyle: CoachingStyle,
        context: SessionContext,
        previousQuestions: string[]
    ): Promise<AdaptiveQuestion[]> {
        const prompt = `
Generate 3 personality-adapted interview questions based on:

User Personality:
${JSON.stringify(profile, null, 2)}

Coaching Style:
${JSON.stringify(coachingStyle, null, 2)}

Target Role: ${context.candidateRole}
Competency Focus: ${(context.competencyWeights || []).map(c => c.competency).join(', ')}
Previous Questions: ${previousQuestions.slice(-3).join(', ')}

Generate questions in this JSON format:
{
    "questions": [
        {
            "question": "Specific question text",
            "difficulty": 0.6,
            "category": "behavioral",
            "personalityAdjustment": "Framed for analytical thinkers",
            "expectedResponseStyle": "Structured, data-driven response",
            "coachingHints": ["Provide specific metrics", "Use STAR method"]
        }
    ]
}

Adaptation Guidelines:
1. For high openness: Include creative, scenario-based questions
2. For high conscientiousness: Include detail-oriented, process questions
3. For high extraversion: Include interactive, opinion-based questions
4. For high agreeableness: Include collaborative, team-focused questions
5. For high neuroticism: Include supportive, confidence-building questions
6. Match communication style (direct/diplomatic/enthusiastic/analytical)
7. Consider learning preferences
8. Adjust complexity based on stress response
`;

        try {
            const model = (this.ai as any).getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new APIError('Invalid AI response format');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            return parsed.questions || [];
        } catch (error) {
            console.error('Error generating adaptive questions:', error);
            throw new APIError('Failed to generate adaptive questions');
        }
    }

    // Provide personality-aware feedback
    async generatePersonalityAwareFeedback(
        response: string,
        question: string,
        profile: PersonalityProfile,
        coachingStyle: CoachingStyle
    ): Promise<{
        feedback: string;
        score: number;
        improvements: string[];
        encouragement: string;
    }> {
        const prompt = `
Provide personality-aware feedback for this interview response:

Question: ${question}
Response: ${response}

User Personality:
${JSON.stringify(profile, null, 2)}

Coaching Style:
${JSON.stringify(coachingStyle, null, 2)}

Generate feedback in this JSON format:
{
    "feedback": "Specific feedback tailored to personality",
    "score": 75,
    "improvements": ["Specific improvement 1", "Specific improvement 2"],
    "encouragement": "Personalized encouragement message"
}

Feedback Guidelines:
1. Match tone to personality (supportive/challenging/mentoring/formal)
2. Adjust encouragement level based on neuroticism
3. Consider communication style preferences
4. Provide constructive criticism at appropriate level
5. Include learning-preference-specific suggestions
6. Address stress response patterns
7. Focus on competency development
8. Maintain motivation and confidence
`;

        try {
            const model = (this.ai as any).getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new APIError('Invalid AI response format');
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('Error generating personality-aware feedback:', error);
            throw new APIError('Failed to generate personality-aware feedback');
        }
    }

    // Track personality development over time
    async trackPersonalityDevelopment(userId: string): Promise<{
        traits: string[];
        progress: Record<string, number>;
        recommendations: string[];
    }> {
        try {
            const sessions = await sessionService.getUserSessions(userId, 20);
            const completedSessions = sessions.filter(s => s.status === 'completed');

            // Analyze personality trends across sessions
            const prompt = `
Analyze personality development trends across these completed interview sessions:

Number of Sessions: ${completedSessions.length}
Session Data: ${completedSessions.map(s => ({
                role: s.context.candidateRole,
                date: s.createdAt.toDate().toISOString(),
                turns: s.turns.length
            })).slice(0, 10)}

Generate development analysis in this JSON format:
{
    "traits": ["confidence", "communication", "analytical_thinking"],
    "progress": {
        "confidence": 0.8,
        "communication": 0.6,
        "analytical_thinking": 0.7
    },
    "recommendations": ["Focus on storytelling", "Practice concise responses"]
}

Focus on:
1. Communication skill development
2. Confidence building progress
3. Analytical thinking improvement
4. Stress management growth
5. Adaptability enhancement
6. Specific next-step recommendations
`;

            const model = (this.ai as any).getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new APIError('Invalid AI response format');
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('Error tracking personality development:', error);
            throw new APIError('Failed to track personality development');
        }
    }

    // Generate personalized coaching plan
    async generateCoachingPlan(
        profile: PersonalityProfile,
        developmentData: any,
        targetRole: string
    ): Promise<{
        goals: string[];
        timeline: string;
        exercises: Array<{
            title: string;
            description: string;
            frequency: string;
            personalityNotes: string;
        }>;
        milestones: Array<{
            title: string;
            target: string;
            metrics: string[];
        }>;
    }> {
        const prompt = `
Create a personalized coaching plan based on:

Personality Profile:
${JSON.stringify(profile, null, 2)}

Development Progress:
${JSON.stringify(developmentData, null, 2)}

Target Role: ${targetRole}

Generate coaching plan in this JSON format:
{
    "goals": ["Improve confidence", "Enhance communication"],
    "timeline": "8-12 weeks",
    "exercises": [
        {
            "title": "Mock interviews",
            "description": "Weekly practice sessions",
            "frequency": "2x per week",
            "personalityNotes": "Adapted for analytical learning style"
        }
    ],
    "milestones": [
        {
            "title": "Confidence milestone",
            "target": "4 weeks",
            "metrics": ["Reduced hesitation", "Clearer responses"]
        }
    ]
}

Plan Guidelines:
1. Align with personality traits
2. Consider learning preferences
3. Address development areas
4. Set realistic timelines
5. Include personality-specific notes
6. Define measurable metrics
7. Build on strengths
8. Address growth areas
`;

        try {
            const model = (this.ai as any).getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new APIError('Invalid AI response format');
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('Error generating coaching plan:', error);
            throw new APIError('Failed to generate coaching plan');
        }
    }

    // Real-time personality adaptation during session
    async adaptDuringSession(
        currentResponse: string,
        previousResponses: string[],
        currentProfile: PersonalityProfile
    ): Promise<{
        adjustedProfile: PersonalityProfile;
        adaptationReasons: string[];
        nextQuestionStyle: string;
    }> {
        const prompt = `
Analyze real-time personality adaptation based on:

Current Response: ${currentResponse}
Previous Responses: ${previousResponses.slice(-2).join(' | ')}
Current Profile: ${JSON.stringify(currentProfile, null, 2)}

Provide adaptation analysis in this JSON format:
{
    "adjustedProfile": {
        "openness": 0.7,
        "conscientiousness": 0.8,
        "extraversion": 0.6,
        "agreeableness": 0.7,
        "neuroticism": 0.3,
        "communicationStyle": "direct",
        "learningPreference": "visual",
        "stressResponse": "moderate"
    },
    "adaptationReasons": ["Increased confidence detected", "More analytical responses"],
    "nextQuestionStyle": "More challenging, technical focus"
}

Focus on:
1. Real-time trait adjustments
2. Confidence level changes
3. Communication style shifts
4. Stress response modifications
5. Learning preference updates
6. Specific adaptation reasons
7. Next question recommendations
`;

        try {
            const model = (this.ai as any).getGenerativeModel({ model: this.model });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new APIError('Invalid AI response format');
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('Error adapting during session:', error);
            return {
                adjustedProfile: currentProfile,
                adaptationReasons: [],
                nextQuestionStyle: 'Continue with current approach'
            };
        }
    }
}

export const advancedAICoachingService = new AdvancedAICoachingService();
export default advancedAICoachingService;
