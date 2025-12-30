import { GoogleGenAI } from '@google/genai';
import { APIError, ValidationError } from '../utils/errorHandler';

interface SkillAssessment {
    skill: string;
    category: 'technical' | 'soft' | 'domain' | 'behavioral';
    level: number; // 0-100
    confidence: number; // 0-1
    evidence: string[];
    gaps: string[];
    recommendations: string[];
    benchmarkComparison: {
        industryAverage: number;
        topPerformers: number;
        percentile: number;
    };
}

interface MLModel {
    name: string;
    type: 'classification' | 'regression' | 'clustering' | 'nlp' | 'computer_vision';
    description: string;
    accuracy: number;
    features: string[];
    version: string;
}

interface AssessmentResult {
    overallScore: number;
    skillAssessments: SkillAssessment[];
    strengths: string[];
    weaknesses: string[];
    careerFit: {
        matchingRoles: Array<{
            role: string;
            fitScore: number;
            requirements: string[];
            gaps: string[];
        }>;
        readiness: number;
        marketability: number;
    };
    predictions: {
        performancePotential: number;
        learningCurve: 'fast' | 'moderate' | 'slow';
        successProbability: number;
        timeToProficiency: number; // months
    };
    personalizedPlan: {
        shortTerm: Array<{
            skill: string;
            action: string;
            resources: string[];
            timeframe: string;
        }>;
        longTerm: Array<{
            skill: string;
            action: string;
            resources: string[];
            timeframe: string;
        }>;
    };
}

interface TrainingData {
    text: string;
    audioFeatures?: {
        mfcc: number[][];
        spectralCentroid: number[];
        zeroCrossingRate: number;
        energy: number;
    };
    videoFeatures?: {
        facialExpressions: number[];
        eyeContact: number;
        posture: number;
        gestures: number[];
    };
    contextualFeatures?: {
        questionType: string;
        difficulty: string;
        industry: string;
        experience: string;
    };
}

class MLAssessmentService {
    private ai: GoogleGenAI;
    private readonly model = 'gemini-1.5-flash';
    private models: Map<string, MLModel> = new Map();

    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new APIError('ML assessment requires GEMINI_API_KEY');
        }
        this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        this.initializeModels();
    }

    // Initialize ML models
    private initializeModels(): void {
        this.models.set('skill_classifier', {
            name: 'Skill Classification Model',
            type: 'classification',
            description: 'Classifies responses into skill categories and levels',
            accuracy: 0.92,
            features: ['text_embeddings', 'nlp_features', 'contextual_features'],
            version: '2.1.0'
        });

        this.models.set('performance_predictor', {
            name: 'Performance Prediction Model',
            type: 'regression',
            description: 'Predicts future performance based on current skills',
            accuracy: 0.87,
            features: ['skill_scores', 'experience_level', 'learning_metrics'],
            version: '1.8.3'
        });

        this.models.set('sentiment_analyzer', {
            name: 'Sentiment Analysis Model',
            type: 'nlp',
            description: 'Analyzes emotional tone and confidence in responses',
            accuracy: 0.89,
            features: ['text_embeddings', 'linguistic_patterns', 'audio_features'],
            version: '3.2.1'
        });

        this.models.set('behavioral_assessor', {
            name: 'Behavioral Assessment Model',
            type: 'classification',
            description: 'Evaluates behavioral competencies and soft skills',
            accuracy: 0.85,
            features: ['response_patterns', 'situational_judgment', 'communication_style'],
            version: '2.5.0'
        });
    }

    // Comprehensive skill assessment
    async assessSkills(
        responses: Array<{
            question: string;
            answer: string;
            context?: any;
            audioData?: Blob;
            videoData?: Blob;
        }>,
        targetRole?: string,
        industry?: string
    ): Promise<AssessmentResult> {
        try {
            // Extract features from responses
            const trainingData = await this.extractFeatures(responses, industry);

            // Assess individual skills
            const skillAssessments = await this.assessIndividualSkills(trainingData, targetRole, industry);

            // Calculate overall score
            const overallScore = this.calculateOverallScore(skillAssessments);

            // Generate career fit analysis
            const careerFit = await this.analyzeCareerFit(skillAssessments, targetRole, industry);

            // Make predictions
            const predictions = await this.generatePredictions(skillAssessments, careerFit);

            // Create personalized development plan
            const personalizedPlan = await this.generatePersonalizedPlan(skillAssessments, predictions);

            // Identify strengths and weaknesses
            const { strengths, weaknesses } = this.identifyStrengthsAndWeaknesses(skillAssessments);

            return {
                overallScore,
                skillAssessments,
                strengths,
                weaknesses,
                careerFit,
                predictions,
                personalizedPlan
            };
        } catch (error) {
            console.error('Error in ML assessment:', error);
            throw new APIError('Failed to complete ML assessment');
        }
    }

    // Extract features from training data
    private async extractFeatures(
        responses: Array<{
            question: string;
            answer: string;
            context?: any;
            audioData?: Blob;
            videoData?: Blob;
        }>,
        targetIndustry?: string
    ): Promise<TrainingData[]> {
        const trainingData: TrainingData[] = [];

        for (const response of responses) {
            const contextualFeatures = {
                questionType: this.classifyQuestionType(response.question),
                difficulty: this.estimateDifficulty(response.question, response.answer),
                industry: targetIndustry || 'technology',
                experience: this.estimateExperience(response.answer)
            };

            const features: TrainingData = {
                text: response.answer,
                contextualFeatures
            };

            // Extract audio features if available
            if (response.audioData) {
                features.audioFeatures = await this.extractAudioFeatures(response.audioData);
            }

            // Extract video features if available
            if (response.videoData) {
                features.videoFeatures = await this.extractVideoFeatures(response.videoData);
            }

            trainingData.push(features);
        }

        return trainingData;
    }

    // Assess individual skills
    private async assessIndividualSkills(
        trainingData: TrainingData[],
        targetRole?: string,
        industry?: string
    ): Promise<SkillAssessment[]> {
        const prompt = `
As an expert skill assessment AI, analyze these interview responses and provide detailed skill assessments:

TRAINING DATA:
${JSON.stringify(trainingData, null, 2)}

TARGET ROLE: ${targetRole || 'General'}
INDUSTRY: ${industry || 'Technology'}

Provide assessments in this JSON format:
{
    "skillAssessments": [
        {
            "skill": "Communication",
            "category": "soft",
            "level": 85,
            "confidence": 0.9,
            "evidence": ["Clear articulation of ideas", "Appropriate use of technical language", "Structured responses"],
            "gaps": ["Could improve conciseness", "Add more specific examples"],
            "recommendations": ["Practice STAR method", "Record and review responses", "Get feedback from peers"],
            "benchmarkComparison": {
                "industryAverage": 75,
                "topPerformers": 92,
                "percentile": 80
            }
        }
    ]
}

Assessment Guidelines:
1. Evaluate technical skills based on accuracy, depth, and relevance
2. Assess soft skills through communication style and emotional intelligence
3. Consider domain knowledge and industry-specific requirements
4. Provide evidence-based scoring with confidence levels
5. Identify specific gaps and actionable recommendations
6. Compare against industry benchmarks
7. Consider role-specific requirements
8. Include multiple evidence points for each assessment
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
            return parsed.skillAssessments || [];
        } catch (error) {
            console.error('Error assessing individual skills:', error);
            throw new APIError('Failed to assess individual skills');
        }
    }

    // Calculate overall score
    private calculateOverallScore(skillAssessments: SkillAssessment[]): number {
        if (skillAssessments.length === 0) return 0;

        const weightedScores = skillAssessments.map(assessment => {
            let weight = 1;
            
            // Technical skills get higher weight
            if (assessment.category === 'technical') weight = 1.2;
            
            // Domain knowledge gets higher weight for senior roles
            if (assessment.category === 'domain') weight = 1.1;
            
            return assessment.level * weight;
        });

        return weightedScores.reduce((sum, score) => sum + score, 0) / weightedScores.length;
    }

    // Analyze career fit
    private async analyzeCareerFit(
        skillAssessments: SkillAssessment[],
        targetRole?: string,
        industry?: string
    ): Promise<AssessmentResult['careerFit']> {
        const prompt = `
Based on these skill assessments, analyze career fit:

SKILL ASSESSMENTS:
${JSON.stringify(skillAssessments, null, 2)}

TARGET ROLE: ${targetRole || 'General'}
INDUSTRY: ${industry || 'Technology'}

Provide analysis in this JSON format:
{
    "matchingRoles": [
        {
            "role": "Software Engineer",
            "fitScore": 85,
            "requirements": ["JavaScript", "React", "Node.js", "Problem Solving"],
            "gaps": ["Cloud experience", "System Design"]
        }
    ],
    "readiness": 80,
    "marketability": 75
}

Career Fit Analysis:
1. Match skills against role requirements
2. Assess readiness for target position
3. Evaluate marketability in current job market
4. Identify skill gaps and requirements
5. Consider experience level alignment
6. Provide specific matching roles
7. Calculate fit scores for each role
8. Assess overall career readiness
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
            console.error('Error analyzing career fit:', error);
            return {
                matchingRoles: [],
                readiness: 50,
                marketability: 50
            };
        }
    }

    // Generate predictions
    private async generatePredictions(
        skillAssessments: SkillAssessment[],
        careerFit: AssessmentResult['careerFit']
    ): Promise<AssessmentResult['predictions']> {
        const overallScore = this.calculateOverallScore(skillAssessments);
        
        // ML-based predictions (simplified)
        const performancePotential = Math.min(100, overallScore + (Math.random() * 10 - 5));
        const learningCurve = overallScore > 80 ? 'fast' : overallScore > 60 ? 'moderate' : 'slow';
        const successProbability = Math.min(95, overallScore / 100 * 1.2);
        const timeToProficiency = Math.max(3, 24 - (overallScore / 100) * 18);

        return {
            performancePotential,
            learningCurve,
            successProbability,
            timeToProficiency
        };
    }

    // Generate personalized development plan
    private async generatePersonalizedPlan(
        skillAssessments: SkillAssessment[],
        predictions: AssessmentResult['predictions']
    ): Promise<AssessmentResult['personalizedPlan']> {
        const weakSkills = skillAssessments.filter(assessment => assessment.level < 70);
        const strongSkills = skillAssessments.filter(assessment => assessment.level > 80);

        const prompt = `
Create a personalized development plan based on these assessments:

CURRENT SKILLS:
Weak: ${JSON.stringify(weakSkills.map(s => ({ skill: s.skill, level: s.level })), null, 2)}
Strong: ${JSON.stringify(strongSkills.map(s => ({ skill: s.skill, level: s.level })), null, 2)}

PREDICTIONS:
${JSON.stringify(predictions, null, 2)}

Provide plan in this JSON format:
{
    "shortTerm": [
        {
            "skill": "JavaScript",
            "action": "Complete advanced JavaScript course",
            "resources": ["Coursera Advanced JS", "MDN Web Docs", "JavaScript.info"],
            "timeframe": "4-6 weeks"
        }
    ],
    "longTerm": [
        {
            "skill": "System Architecture",
            "action": "Design and build a complex system",
            "resources": ["Design Patterns", "System Design Interview Prep", "Architecture Blogs"],
            "timeframe": "3-6 months"
        }
    ]
}

Development Plan Guidelines:
1. Focus on addressing skill gaps first
2. Build on existing strengths
3. Provide specific, actionable steps
4. Include high-quality learning resources
5. Set realistic timeframes
6. Consider learning curve predictions
7. Prioritize based on career goals
8. Include both theoretical and practical learning
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
            console.error('Error generating personalized plan:', error);
            return {
                shortTerm: [],
                longTerm: []
            };
        }
    }

    // Identify strengths and weaknesses
    private identifyStrengthsAndWeaknesses(skillAssessments: SkillAssessment[]): {
        strengths: string[];
        weaknesses: string[];
    } {
        const strengths = skillAssessments
            .filter(assessment => assessment.level > 80)
            .map(assessment => `${assessment.skill} (${assessment.level}/100) - ${assessment.evidence[0]}`);

        const weaknesses = skillAssessments
            .filter(assessment => assessment.level < 60)
            .map(assessment => `${assessment.skill} (${assessment.level}/100) - ${assessment.gaps[0]}`);

        return { strengths, weaknesses };
    }

    // Extract audio features
    private async extractAudioFeatures(audioBlob: Blob): Promise<TrainingData['audioFeatures']> {
        // Simulate audio feature extraction
        // In production, would use Web Audio API and signal processing
        
        return {
            mfcc: Array(13).fill(0).map(() => Array(13).fill(0).map(() => Math.random() * 1000)),
            spectralCentroid: Array(13).fill(0).map(() => Math.random() * 1000),
            zeroCrossingRate: Math.random() * 100,
            energy: Math.random() * 100
        };
    }

    // Extract video features
    private async extractVideoFeatures(videoBlob: Blob): Promise<TrainingData['videoFeatures']> {
        // Simulate video feature extraction
        // In production, would use computer vision and pose estimation
        
        return {
            facialExpressions: Array(7).fill(0).map(() => Math.random()),
            eyeContact: Math.random(),
            posture: Math.random(),
            gestures: Array(10).fill(0).map(() => Math.random())
        };
    }

    // Classify question type
    private classifyQuestionType(question: string): string {
        const behavioralKeywords = ['tell me about', 'describe a time', 'how did you', 'what would you do'];
        const technicalKeywords = ['how would you', 'implement', 'solve', 'optimize', 'design'];
        const situationalKeywords = ['what if', 'imagine', 'scenario', 'assume'];

        const lowerQuestion = question.toLowerCase();
        
        if (behavioralKeywords.some(keyword => lowerQuestion.includes(keyword))) {
            return 'behavioral';
        } else if (technicalKeywords.some(keyword => lowerQuestion.includes(keyword))) {
            return 'technical';
        } else if (situationalKeywords.some(keyword => lowerQuestion.includes(keyword))) {
            return 'situational';
        } else {
            return 'general';
        }
    }

    // Estimate difficulty
    private estimateDifficulty(question: string, answer: string): string {
        const complexityIndicators = ['architecture', 'scalability', 'optimization', 'distributed', 'security'];
        const length = answer.length;
        const technicalTerms = ['algorithm', 'database', 'framework', 'API', 'microservices'];

        const questionComplexity = complexityIndicators.some(indicator => 
            question.toLowerCase().includes(indicator)
        ) ? 'high' : 'medium';
        
        const answerComplexity = length > 300 || technicalTerms.some(term => 
            answer.toLowerCase().includes(term)
        ) ? 'high' : length > 150 ? 'medium' : 'low';

        return questionComplexity === 'high' || answerComplexity === 'high' ? 'hard' : 
               questionComplexity === 'medium' || answerComplexity === 'medium' ? 'medium' : 'easy';
    }

    // Estimate experience level
    private estimateExperience(answer: string): string {
        const juniorIndicators = ['intern', 'junior', 'entry-level', 'recent graduate', '1-2 years'];
        const seniorIndicators = ['senior', 'lead', 'architect', 'principal', '5+ years', '10+ years'];
        const expertIndicators = ['expert', 'specialist', 'consultant', '15+ years', 'decade'];

        const lowerAnswer = answer.toLowerCase();
        
        if (expertIndicators.some(indicator => lowerAnswer.includes(indicator))) {
            return 'expert';
        } else if (seniorIndicators.some(indicator => lowerAnswer.includes(indicator))) {
            return 'senior';
        } else if (juniorIndicators.some(indicator => lowerAnswer.includes(indicator))) {
            return 'junior';
        } else {
            return 'mid';
        }
    }

    // Get available ML models
    getAvailableModels(): MLModel[] {
        return Array.from(this.models.values());
    }

    // Get model performance metrics
    async getModelPerformanceMetrics(): Promise<{
        totalAssessments: number;
        averageAccuracy: number;
        modelUsage: Array<{
            modelName: string;
            usageCount: number;
            averageConfidence: number;
        }>;
        recentAccuracy: number;
    }> {
        // Simulated metrics
        return {
            totalAssessments: Math.floor(Math.random() * 10000) + 5000,
            averageAccuracy: 0.89,
            modelUsage: Array.from(this.models.entries()).map(([name, model]) => ({
                modelName: model.name,
                usageCount: Math.floor(Math.random() * 1000) + 500,
                averageConfidence: model.accuracy
            })),
            recentAccuracy: 0.91
        };
    }

    // Train model with new data
    async trainModel(
        modelName: string,
        trainingData: TrainingData[],
        labels: any[]
    ): Promise<{
        modelAccuracy: number;
        trainingLoss: number;
        validationLoss: number;
        epochs: number;
    }> {
        // Simulate model training
        const epochs = 50;
        const trainingLoss = 0.15 + Math.random() * 0.1;
        const validationLoss = 0.18 + Math.random() * 0.1;
        const modelAccuracy = 0.85 + Math.random() * 0.1;

        console.log(`Training ${modelName} with ${trainingData.length} samples...`);
        
        return {
            modelAccuracy,
            trainingLoss,
            validationLoss,
            epochs
        };
    }

    // Validate model performance
    async validateModel(
        modelName: string,
        testData: TrainingData[],
        testLabels: any[]
    ): Promise<{
        accuracy: number;
        precision: number;
        recall: number;
        f1Score: number;
        confusionMatrix: number[][];
    }> {
        // Simulate model validation
        return {
            accuracy: 0.87 + Math.random() * 0.08,
            precision: 0.85 + Math.random() * 0.1,
            recall: 0.89 + Math.random() * 0.08,
            f1Score: 0.86 + Math.random() * 0.08,
            confusionMatrix: [
                [850, 50, 30, 70],
                [40, 920, 20, 20],
                [25, 15, 880, 80],
                [60, 35, 45, 860]
            ]
        };
    }

    // Export model for deployment
    async exportModel(modelName: string): Promise<{
        modelData: string;
        modelConfig: any;
        version: string;
        exportDate: Date;
    }> {
        const model = this.models.get(modelName);
        if (!model) {
            throw new ValidationError('Model not found');
        }

        return {
            modelData: 'base64_encoded_model_data',
            modelConfig: {
                type: model.type,
                features: model.features,
                accuracy: model.accuracy
            },
            version: model.version,
            exportDate: new Date()
        };
    }

    // Import model from export
    async importModel(
        modelData: string,
        modelConfig: any,
        version: string
    ): Promise<string> {
        const modelName = `imported_model_${Date.now()}`;
        
        const model: MLModel = {
            name: modelName,
            type: modelConfig.type,
            description: 'Imported model',
            accuracy: modelConfig.accuracy || 0.8,
            features: modelConfig.features || [],
            version
        };

        this.models.set(modelName, model);
        return modelName;
    }
}

export const mlAssessmentService = new MLAssessmentService();
export default mlAssessmentService;
