import { GoogleGenAI } from '@google/genai';
import type { SessionContext, QuestionBlueprint, InterviewTurn, CompetencyWeight } from '../types';
import { sessionService } from './sessionService';
import { APIError, ValidationError } from '../utils/errorHandler';

interface RecommendationContext {
    userHistory: InterviewTurn[];
    competencyWeights: CompetencyWeight[];
    currentRole: string;
    difficulty: 'easy' | 'medium' | 'hard';
    sessionProgress: {
        questionsAsked: number;
        totalQuestions: number;
        phasesCovered: string[];
    };
}

interface QuestionRecommendation {
    question: string;
    category: string;
    difficulty: 'easy' | 'medium' | 'hard';
    rationale: string;
    competencyFocus: string[];
    estimatedTime: string;
    followUpQuestions: string[];
}

interface SkillGapAnalysis {
    competency: string;
    currentScore: number;
    targetScore: number;
    gap: number;
    recommendedFocus: string[];
    practiceQuestions: string[];
}

class AIRecommendationService {
    private ai: GoogleGenAI;
    private readonly model = 'gemini-1.5-flash';

    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new APIError('AI recommendation service requires GEMINI_API_KEY');
        }
        this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    // Get personalized question recommendations based on user performance
    async getQuestionRecommendations(
        userId: string,
        sessionId: string,
        context: SessionContext
    ): Promise<QuestionRecommendation[]> {
        try {
            // Gather user's historical data
            const userSessions = await sessionService.getUserSessions(userId, 20);
            const completedSessions = userSessions.filter(s => s.status === 'completed');
            
            // Build recommendation context
            const recContext = await this.buildRecommendationContext(
                completedSessions,
                context
            );

            // Generate AI-powered recommendations
            const recommendations = await this.generateRecommendations(recContext);
            
            return recommendations;
        } catch (error) {
            console.error('Error generating question recommendations:', error);
            throw new APIError('Failed to generate question recommendations');
        }
    }

    // Analyze skill gaps and provide targeted recommendations
    async analyzeSkillGaps(
        userId: string,
        targetRole: string
    ): Promise<SkillGapAnalysis[]> {
        try {
            const userSessions = await sessionService.getUserSessions(userId, 50);
            const completedSessions = userSessions.filter(s => s.status === 'completed');

            // Extract competency performance data
            const competencyScores = this.extractCompetencyScores(completedSessions);
            
            // Generate skill gap analysis
            const skillGaps = await this.generateSkillGapAnalysis(
                competencyScores,
                targetRole
            );

            return skillGaps;
        } catch (error) {
            console.error('Error analyzing skill gaps:', error);
            throw new APIError('Failed to analyze skill gaps');
        }
    }

    // Get adaptive difficulty recommendations
    async getAdaptiveDifficulty(
        userId: string,
        currentSession: InterviewTurn[]
    ): Promise<'easy' | 'medium' | 'hard'> {
        try {
            const userSessions = await sessionService.getUserSessions(userId, 10);
            const completedSessions = userSessions.filter(s => s.status === 'completed');

            // Calculate average performance
            const avgScore = this.calculateAverageScore(completedSessions);
            
            // Analyze current session performance
            const currentPerformance = this.analyzeCurrentPerformance(currentSession);

            // Recommend difficulty based on performance trends
            return this.recommendDifficulty(avgScore, currentPerformance);
        } catch (error) {
            console.error('Error getting adaptive difficulty:', error);
            return 'medium'; // Default fallback
        }
    }

    // Get next question recommendation in real-time
    async getNextQuestionRecommendation(
        sessionId: string,
        currentTurn: InterviewTurn,
        allTurns: InterviewTurn[]
    ): Promise<QuestionRecommendation | null> {
        try {
            const session = await sessionService.getSession(sessionId);
            if (!session) {
                throw new ValidationError('Session not found');
            }

            // Analyze the last response
            const responseAnalysis = await this.analyzeResponse(currentTurn);
            
            // Generate contextual recommendation
            const recommendation = await this.generateContextualRecommendation(
                session.context,
                responseAnalysis,
                allTurns
            );

            return recommendation;
        } catch (error) {
            console.error('Error getting next question recommendation:', error);
            return null;
        }
    }

    // Build recommendation context from user history
    private async buildRecommendationContext(
        completedSessions: any[],
        currentContext: SessionContext
    ): Promise<RecommendationContext> {
        // Extract user history
        const userHistory = completedSessions.flatMap(session => session.turns || []);
        
        // Get competency weights from current context
        const competencyWeights = currentContext.competencyWeights || [];
        
        // Determine current difficulty based on session controls
        const difficulty = this.mapDifficulty(currentContext.interviewPlan?.meta?.controls?.difficulty || 'mixed');
        
        // Calculate session progress
        const sessionProgress = {
            questionsAsked: userHistory.length,
            totalQuestions: currentContext.interviewPlan?.meta?.controls?.totalQuestions || 7,
            phasesCovered: this.extractPhasesCovered(userHistory)
        };

        return {
            userHistory,
            competencyWeights,
            currentRole: currentContext.candidateRole,
            difficulty,
            sessionProgress
        };
    }

    // Generate AI-powered recommendations
    private async generateRecommendations(
        context: RecommendationContext
    ): Promise<QuestionRecommendation[]> {
        const prompt = `
As an expert interview coach, generate 5 personalized question recommendations based on the following context:

User Role: ${context.currentRole}
Difficulty Level: ${context.difficulty}
Competency Focus: ${context.competencyWeights.map(c => `${c.competency} (${c.weight})`).join(', ')}
Session Progress: ${context.sessionProgress.questionsAsked}/${context.sessionProgress.totalQuestions} questions asked
Phases Covered: ${context.sessionProgress.phasesCovered.join(', ')}

Recent Performance Summary:
${context.userHistory.slice(-5).map((turn, i) => 
    `Q${i+1}: ${turn.question.substring(0, 100)}...\nResponse: ${turn.candidateResponse.substring(0, 100)}...`
).join('\n\n')}

Generate recommendations in this JSON format:
{
    "recommendations": [
        {
            "question": "Specific interview question",
            "category": "behavioral|technical|situational",
            "difficulty": "easy|medium|hard",
            "rationale": "Why this question is recommended for this user",
            "competencyFocus": ["competency1", "competency2"],
            "estimatedTime": "2-3 minutes",
            "followUpQuestions": ["follow-up 1", "follow-up 2"]
        }
    ]
}

Focus on:
1. Addressing identified skill gaps
2. Building on previous responses
3. Covering underrepresented competencies
4. Appropriate difficulty progression
5. Role relevance
`;

        const model = (this.ai as any).getGenerativeModel({ model: this.model });
        const result = await model.generateContent(prompt);

        const response = await result.response;
        const text = response.text();
        
        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new APIError('Invalid AI response format');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.recommendations || [];
    }

    // Generate skill gap analysis
    private async generateSkillGapAnalysis(
        competencyScores: Record<string, number[]>,
        targetRole: string
    ): Promise<SkillGapAnalysis[]> {
        const prompt = `
As an expert career coach, analyze the following competency scores for a ${targetRole} role and provide skill gap analysis:

Current Competency Performance:
${Object.entries(competencyScores).map(([comp, scores]) => 
    `${comp}: ${scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 'No data'} (based on ${scores.length} assessments)`
).join('\n')}

Generate skill gap analysis in this JSON format:
{
    "skillGaps": [
        {
            "competency": "competency name",
            "currentScore": 75,
            "targetScore": 85,
            "gap": 10,
            "recommendedFocus": ["focus area 1", "focus area 2"],
            "practiceQuestions": ["practice question 1", "practice question 2"]
        }
    ]
}

Consider:
1. Industry standards for ${targetRole}
2. Current performance trends
3. Critical vs nice-to-have skills
4. Actionable improvement recommendations
`;

        const model = (this.ai as any).getGenerativeModel({ model: this.model });
        const result = await model.generateContent(prompt);

        const response = await result.response;
        const text = response.text();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new APIError('Invalid AI response format');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.skillGaps || [];
    }

    // Helper methods
    private extractCompetencyScores(sessions: any[]): Record<string, number[]> {
        const scores: Record<string, number[]> = {};
        
        sessions.forEach(session => {
            if (session.finalReport?.advisoryPanel) {
                session.finalReport.advisoryPanel.forEach((advisor: any) => {
                    advisor.scores?.forEach((score: any) => {
                        if (!scores[score.skill]) {
                            scores[score.skill] = [];
                        }
                        scores[score.skill].push(score.score);
                    });
                });
            }
        });

        return scores;
    }

    private calculateAverageScore(sessions: any[]): number {
        const allScores = sessions.flatMap(session => {
            if (!session.finalReport?.advisoryPanel) return [];
            return session.finalReport.advisoryPanel.flatMap((advisor: any) => 
                (advisor.scores || []).map((s: any) => s.score)
            );
        });

        return allScores.length > 0 
            ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
            : 0;
    }

    private analyzeCurrentPerformance(turns: InterviewTurn[]): number {
        // Simple performance analysis based on response quality indicators
        // In a real implementation, this would use more sophisticated NLP
        const avgResponseLength = turns.reduce((acc, turn) => 
            acc + turn.candidateResponse.length, 0) / turns.length;
        
        // Basic heuristic: longer, detailed responses often indicate better engagement
        return Math.min(100, (avgResponseLength / 10));
    }

    private recommendDifficulty(avgScore: number, currentPerformance: number): 'easy' | 'medium' | 'hard' {
        const combinedScore = (avgScore + currentPerformance) / 2;
        
        if (combinedScore < 60) return 'easy';
        if (combinedScore < 80) return 'medium';
        return 'hard';
    }

    private mapDifficulty(difficulty: string): 'easy' | 'medium' | 'hard' {
        switch (difficulty.toLowerCase()) {
            case 'easy': return 'easy';
            case 'hard': return 'hard';
            default: return 'medium';
        }
    }

    private extractPhasesCovered(turns: InterviewTurn[]): string[] {
        const phases = new Set<string>();
        turns.forEach(turn => {
            if (turn.questionBlueprint?.phase) {
                phases.add(turn.questionBlueprint.phase);
            }
        });
        return Array.from(phases);
    }

    private async analyzeResponse(turn: InterviewTurn): Promise<any> {
        // Analyze the quality and content of the response
        // This would use NLP/ML in a production system
        return {
            clarity: turn.candidateResponse.length > 100 ? 8 : 5,
            relevance: 7, // Would be calculated based on question-response matching
            completeness: turn.candidateResponse.includes('example') ? 8 : 6
        };
    }

    private async generateContextualRecommendation(
        context: SessionContext,
        responseAnalysis: any,
        allTurns: InterviewTurn[]
    ): Promise<QuestionRecommendation | null> {
        // Generate a follow-up question based on the current response
        const prompt = `
Based on the following interview context and response analysis, generate one follow-up question:

Previous Question: ${allTurns[allTurns.length - 1]?.question || ''}
Response: ${allTurns[allTurns.length - 1]?.candidateResponse || ''}
Response Analysis: Clarity ${responseAnalysis.clarity}/10, Relevance ${responseAnalysis.relevance}/10, Completeness ${responseAnalysis.completeness}/10

Target Role: ${context.candidateRole}
Competency Focus: ${(context.competencyWeights || []).map(c => c.competency).join(', ')}

Generate a follow-up question in this JSON format:
{
    "question": "Specific follow-up question",
    "category": "behavioral|technical|situational",
    "difficulty": "easy|medium|hard",
    "rationale": "Why this follow-up is appropriate",
    "competencyFocus": ["competency1"],
    "estimatedTime": "1-2 minutes",
    "followUpQuestions": []
}
`;

        try {
            const model = (this.ai as any).getGenerativeModel({ model: this.model });
        const result = await model.generateContent(prompt);

            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return null;
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('Error generating contextual recommendation:', error);
            return null;
        }
    }
}

export const aiRecommendationService = new AIRecommendationService();
export default aiRecommendationService;
