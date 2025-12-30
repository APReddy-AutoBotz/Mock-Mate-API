import { APIError, ValidationError } from '../utils/errorHandler';

interface VREnvironment {
    id: string;
    name: string;
    type: 'office' | 'conference_room' | 'casual' | 'formal' | 'virtual';
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
    features: string[];
    lighting: 'bright' | 'dim' | 'natural' | 'warm' | 'dynamic';
    background: string;
    avatarSettings: {
        interviewer: string;
        position: 'sitting' | 'standing';
        distance: 'close' | 'normal' | 'far';
    };
}

interface VRInterviewSession {
    id: string;
    userId: string;
    environment: VREnvironment;
    questions: Array<{
        id: string;
        text: string;
        type: 'behavioral' | 'technical' | 'situational';
        duration: number;
        vrContext: string;
    }>;
    settings: {
        enableEyeTracking: boolean;
        enableGestureTracking: boolean;
        enableVoiceAnalysis: boolean;
        enableStressMonitoring: boolean;
        difficulty: 'adaptive' | 'fixed';
        feedbackLevel: 'minimal' | 'standard' | 'detailed';
    };
    status: 'preparing' | 'active' | 'paused' | 'completed';
    startTime?: Date;
    endTime?: Date;
    metrics: VRMetrics;
}

interface VRMetrics {
    eyeContact: {
        consistency: number; // 0-1
        duration: number; // percentage
        breaks: number; // count per minute
    };
    gestures: {
        frequency: number; // gestures per minute
        appropriateness: number; // 0-1
        nervousness: number; // 0-1
        confidence: number; // 0-1
    };
    posture: {
        upright: number; // 0-1
        movement: number; // 0-1
        fidgeting: number; // 0-1
    };
    voice: {
        volume: number; // 0-1
        pace: number; // words per minute
        clarity: number; // 0-1
        confidence: number; // 0-1
    };
    stress: {
        level: number; // 0-1
        fluctuations: number; // changes per minute
        recovery: number; // 0-1
    };
    engagement: {
        attention: number; // 0-1
        participation: number; // 0-1
        enthusiasm: number; // 0-1
    };
}

interface VRFeedback {
    overallScore: number;
    categories: {
        eyeContact: { score: number; feedback: string[] };
        bodyLanguage: { score: number; feedback: string[] };
        voice: { score: number; feedback: string[] };
        confidence: { score: number; feedback: string[] };
        engagement: { score: number; feedback: string[] };
    };
    strengths: string[];
    improvements: string[];
    recommendations: string[];
    vrSpecific: {
        environmentComfort: number;
        avatarInteraction: number;
        immersionLevel: number;
        technicalIssues: string[];
    };
}

class VRInterviewService {
    private vrSupported: boolean = false;
    private activeSession: VRInterviewSession | null = null;
    private metricsCollector: NodeJS.Timeout | null = null;

    constructor() {
        this.checkVRSupport();
    }

    // Check VR support
    private checkVRSupport(): void {
        this.vrSupported = !!(navigator as any).xr && 
            ((navigator as any).xr.isSessionSupported || 
             (navigator as any).xr.supportsSession);
    }

    // Initialize VR session
    async initializeVRSession(
        userId: string,
        environmentId: string,
        settings: VRInterviewSession['settings']
    ): Promise<string> {
        if (!this.vrSupported) {
            throw new ValidationError('VR is not supported on this device');
        }

        const environment = await this.getVREnvironment(environmentId);
        const questions = await this.generateVRQuestions(environment);

        const session: VRInterviewSession = {
            id: this.generateId(),
            userId,
            environment,
            questions,
            settings,
            status: 'preparing',
            metrics: this.initializeMetrics()
        };

        this.activeSession = session;
        return session.id;
    }

    // Start VR session
    async startVRSession(sessionId: string): Promise<void> {
        if (!this.activeSession || this.activeSession.id !== sessionId) {
            throw new ValidationError('Invalid session');
        }

        try {
            // Initialize WebXR session
            const xrSession = await (navigator as any).xr.requestSession('immersive-vr', {
                requiredFeatures: ['local-floor'],
                optionalFeatures: ['hand-tracking', 'eye-tracking']
            });

            this.activeSession.status = 'active';
            this.activeSession.startTime = new Date();

            // Start metrics collection
            this.startMetricsCollection();

            return xrSession;
        } catch (error) {
            console.error('Failed to start VR session:', error);
            throw new APIError('Failed to start VR session');
        }
    }

    // Get VR environments
    async getVREnvironments(): Promise<VREnvironment[]> {
        return [
            {
                id: 'modern-office',
                name: 'Modern Office',
                type: 'office',
                description: 'Contemporary office setting with natural lighting',
                difficulty: 'medium',
                features: ['desk', 'window', 'plants', 'whiteboard'],
                lighting: 'natural',
                background: 'city-view',
                avatarSettings: {
                    interviewer: 'professional',
                    position: 'sitting',
                    distance: 'normal'
                }
            },
            {
                id: 'executive-office',
                name: 'Executive Office',
                type: 'formal',
                description: 'Formal executive office for senior-level interviews',
                difficulty: 'hard',
                features: ['large-desk', 'bookshelves', 'art', 'city-view'],
                lighting: 'bright',
                background: 'skyline',
                avatarSettings: {
                    interviewer: 'executive',
                    position: 'sitting',
                    distance: 'normal'
                }
            },
            {
                id: 'casual-cafe',
                name: 'Casual Cafe',
                type: 'casual',
                description: 'Relaxed coffee shop atmosphere for informal interviews',
                difficulty: 'easy',
                features: ['table', 'chairs', 'menu-board', 'background-music'],
                lighting: 'warm',
                background: 'street-view',
                avatarSettings: {
                    interviewer: 'friendly',
                    position: 'sitting',
                    distance: 'close'
                }
            },
            {
                id: 'tech-hub',
                name: 'Tech Hub',
                type: 'virtual',
                description: 'Futuristic virtual environment for tech interviews',
                difficulty: 'medium',
                features: ['holograms', 'digital-displays', 'interactive-elements'],
                lighting: 'dynamic',
                background: 'digital-grid',
                avatarSettings: {
                    interviewer: 'tech-enthusiast',
                    position: 'standing',
                    distance: 'normal'
                }
            },
            {
                id: 'conference-room',
                name: 'Conference Room',
                type: 'conference_room',
                description: 'Professional conference room setting',
                difficulty: 'medium',
                features: ['large-table', 'presentation-screen', 'whiteboard', 'chairs'],
                lighting: 'bright',
                background: 'corporate',
                avatarSettings: {
                    interviewer: 'manager',
                    position: 'sitting',
                    distance: 'normal'
                }
            }
        ];
    }

    // Get specific VR environment
    private async getVREnvironment(environmentId: string): Promise<VREnvironment> {
        const environments = await this.getVREnvironments();
        const environment = environments.find(env => env.id === environmentId);
        
        if (!environment) {
            throw new ValidationError('Environment not found');
        }
        
        return environment;
    }

    // Generate VR-specific questions
    private async generateVRQuestions(environment: VREnvironment): Promise<VRInterviewSession['questions']> {
        const baseQuestions = [
            {
                id: 'vr-intro',
                text: `Thank you for coming in today. We're conducting this interview in our ${environment.name} environment. How do you feel about this interview format?`,
                type: 'behavioral' as const,
                duration: 120,
                vrContext: 'environment-introduction'
            },
            {
                id: 'vr-comfort',
                text: 'How comfortable are you with virtual reality environments? Have you used VR before in a professional context?',
                type: 'behavioral' as const,
                duration: 90,
                vrContext: 'vr-experience'
            },
            {
                id: 'vr-adaptation',
                text: `This environment is designed to simulate a real ${environment.type.replace('_', ' ')}. How well do you think you're adapting to this setting?`,
                type: 'situational' as const,
                duration: 120,
                vrContext: 'adaptation-assessment'
            }
        ];

        // Add environment-specific questions
        const environmentQuestions = this.getEnvironmentSpecificQuestions(environment);
        
        return [...baseQuestions, ...environmentQuestions];
    }

    // Get environment-specific questions
    private getEnvironmentSpecificQuestions(environment: VREnvironment): VRInterviewSession['questions'] {
        switch (environment.id) {
            case 'modern-office':
                return [
                    {
                        id: 'office-collaboration',
                        text: 'In a modern office like this, collaboration is key. Can you describe a time when you worked effectively with a diverse team?',
                        type: 'behavioral' as const,
                        duration: 150,
                        vrContext: 'teamwork-scenario'
                    }
                ];
            
            case 'executive-office':
                return [
                    {
                        id: 'executive-leadership',
                        text: 'As you can see, this is an executive setting. Tell me about your experience with strategic decision-making at a leadership level.',
                        type: 'behavioral' as const,
                        duration: 180,
                        vrContext: 'leadership-assessment'
                    }
                ];
            
            case 'casual-cafe':
                return [
                    {
                        id: 'casual-fit',
                        text: 'This relaxed setting allows for more natural conversation. What do you value most about company culture?',
                        type: 'behavioral' as const,
                        duration: 120,
                        vrContext: 'culture-fit'
                    }
                ];
            
            case 'tech-hub':
                return [
                    {
                        id: 'tech-innovation',
                        text: 'In this futuristic environment, let\'s discuss innovation. How do you stay current with emerging technologies?',
                        type: 'technical' as const,
                        duration: 150,
                        vrContext: 'tech-assessment'
                    }
                ];
            
            default:
                return [];
        }
    }

    // Initialize metrics
    private initializeMetrics(): VRMetrics {
        return {
            eyeContact: { consistency: 0, duration: 0, breaks: 0 },
            gestures: { frequency: 0, appropriateness: 0, nervousness: 0, confidence: 0 },
            posture: { upright: 0, movement: 0, fidgeting: 0 },
            voice: { volume: 0, pace: 0, clarity: 0, confidence: 0 },
            stress: { level: 0, fluctuations: 0, recovery: 0 },
            engagement: { attention: 0, participation: 0, enthusiasm: 0 }
        };
    }

    // Start metrics collection
    private startMetricsCollection(): void {
        if (!this.activeSession) return;

        this.metricsCollector = setInterval(() => {
            this.collectVREnvironmentMetrics();
        }, 1000); // Collect every second
    }

    // Collect VR environment metrics
    private collectVREnvironmentMetrics(): void {
        if (!this.activeSession) return;

        // Simulate metrics collection (in production, would use actual VR sensors)
        const metrics = this.activeSession.metrics;

        // Eye tracking simulation
        metrics.eyeContact.consistency = Math.min(1, metrics.eyeContact.consistency + Math.random() * 0.1);
        metrics.eyeContact.duration = Math.min(1, metrics.eyeContact.duration + Math.random() * 0.05);
        metrics.eyeContact.breaks = Math.max(0, metrics.eyeContact.breaks + (Math.random() - 0.5) * 0.2);

        // Gesture tracking simulation
        metrics.gestures.frequency = Math.max(0, metrics.gestures.frequency + (Math.random() - 0.5) * 0.1);
        metrics.gestures.appropriateness = Math.min(1, metrics.gestures.appropriateness + Math.random() * 0.05);
        metrics.gestures.confidence = Math.min(1, metrics.gestures.confidence + Math.random() * 0.03);

        // Posture simulation
        metrics.posture.upright = Math.min(1, metrics.posture.upright + Math.random() * 0.05);
        metrics.posture.movement = Math.max(0, metrics.posture.movement + (Math.random() - 0.5) * 0.1);
        metrics.posture.fidgeting = Math.max(0, metrics.posture.fidgeting + (Math.random() - 0.3) * 0.1);

        // Voice analysis simulation
        metrics.voice.volume = Math.min(1, Math.max(0.3, metrics.voice.volume + (Math.random() - 0.5) * 0.1));
        metrics.voice.pace = Math.max(100, Math.min(200, metrics.voice.pace + (Math.random() - 0.5) * 10));
        metrics.voice.confidence = Math.min(1, metrics.voice.confidence + Math.random() * 0.05);

        // Stress monitoring simulation
        metrics.stress.level = Math.max(0, Math.min(1, metrics.stress.level + (Math.random() - 0.5) * 0.1));
        metrics.stress.fluctuations = Math.max(0, metrics.stress.fluctuations + Math.abs(Math.random() - 0.5) * 0.05);
        metrics.stress.recovery = Math.min(1, metrics.stress.recovery + Math.random() * 0.03);

        // Engagement simulation
        metrics.engagement.attention = Math.min(1, metrics.engagement.attention + Math.random() * 0.05);
        metrics.engagement.participation = Math.min(1, metrics.engagement.participation + Math.random() * 0.05);
        metrics.engagement.enthusiasm = Math.min(1, metrics.engagement.enthusiasm + Math.random() * 0.03);
    }

    // Pause VR session
    pauseVRSession(): void {
        if (this.activeSession) {
            this.activeSession.status = 'paused';
            if (this.metricsCollector) {
                clearInterval(this.metricsCollector);
                this.metricsCollector = null;
            }
        }
    }

    // Resume VR session
    resumeVRSession(): void {
        if (this.activeSession) {
            this.activeSession.status = 'active';
            this.startMetricsCollection();
        }
    }

    // End VR session and generate feedback
    async endVRSession(): Promise<VRFeedback> {
        if (!this.activeSession) {
            throw new ValidationError('No active session');
        }

        this.activeSession.status = 'completed';
        this.activeSession.endTime = new Date();

        if (this.metricsCollector) {
            clearInterval(this.metricsCollector);
            this.metricsCollector = null;
        }

        const feedback = await this.generateVRFeedback(this.activeSession);
        
        // Clear active session
        this.activeSession = null;

        return feedback;
    }

    // Generate VR feedback
    private async generateVRFeedback(session: VRInterviewSession): Promise<VRFeedback> {
        const metrics = session.metrics;

        // Calculate category scores
        const eyeContactScore = (metrics.eyeContact.consistency + metrics.eyeContact.duration) / 2 * 100;
        const bodyLanguageScore = (
            metrics.gestures.appropriateness * 0.4 +
            metrics.posture.upright * 0.3 +
            (1 - metrics.posture.fidgeting) * 0.3
        ) * 100;
        const voiceScore = (
            metrics.voice.clarity * 0.4 +
            metrics.voice.confidence * 0.3 +
            Math.min(1, Math.abs(150 - metrics.voice.pace) / 50) * 0.3
        ) * 100;
        const confidenceScore = (metrics.gestures.confidence + metrics.voice.confidence) / 2 * 100;
        const engagementScore = (
            metrics.engagement.attention * 0.4 +
            metrics.engagement.participation * 0.3 +
            metrics.engagement.enthusiasm * 0.3
        ) * 100;

        const overallScore = (
            eyeContactScore * 0.2 +
            bodyLanguageScore * 0.2 +
            voiceScore * 0.2 +
            confidenceScore * 0.2 +
            engagementScore * 0.2
        );

        // Generate feedback
        const feedback: VRFeedback = {
            overallScore,
            categories: {
                eyeContact: {
                    score: eyeContactScore,
                    feedback: this.generateEyeContactFeedback(metrics.eyeContact)
                },
                bodyLanguage: {
                    score: bodyLanguageScore,
                    feedback: this.generateBodyLanguageFeedback(metrics)
                },
                voice: {
                    score: voiceScore,
                    feedback: this.generateVoiceFeedback(metrics.voice)
                },
                confidence: {
                    score: confidenceScore,
                    feedback: this.generateConfidenceFeedback(metrics)
                },
                engagement: {
                    score: engagementScore,
                    feedback: this.generateEngagementFeedback(metrics.engagement)
                }
            },
            strengths: this.identifyStrengths(metrics),
            improvements: this.identifyImprovements(metrics),
            recommendations: this.generateRecommendations(metrics),
            vrSpecific: {
                environmentComfort: Math.random() * 0.3 + 0.7, // Simulated
                avatarInteraction: Math.random() * 0.3 + 0.7, // Simulated
                immersionLevel: Math.random() * 0.3 + 0.7, // Simulated
                technicalIssues: [] // Would collect actual issues
            }
        };

        return feedback;
    }

    // Generate specific feedback
    private generateEyeContactFeedback(eyeContact: VRMetrics['eyeContact']): string[] {
        const feedback: string[] = [];
        
        if (eyeContact.consistency > 0.8) {
            feedback.push('Excellent consistent eye contact throughout the interview');
        } else if (eyeContact.consistency < 0.5) {
            feedback.push('Work on maintaining more consistent eye contact');
        }

        if (eyeContact.breaks > 3) {
            feedback.push('Try to reduce eye contact breaks for better engagement');
        }

        return feedback;
    }

    private generateBodyLanguageFeedback(metrics: VRMetrics): string[] {
        const feedback: string[] = [];
        
        if (metrics.posture.upright > 0.8) {
            feedback.push('Great posture throughout the session');
        } else if (metrics.posture.upright < 0.5) {
            feedback.push('Work on maintaining more upright posture');
        }

        if (metrics.gestures.appropriateness > 0.8) {
            feedback.push('Appropriate and effective use of gestures');
        } else if (metrics.gestures.appropriateness < 0.5) {
            feedback.push('Focus on more natural and purposeful gestures');
        }

        return feedback;
    }

    private generateVoiceFeedback(voice: VRMetrics['voice']): string[] {
        const feedback: string[] = [];
        
        if (voice.clarity > 0.8) {
            feedback.push('Very clear and articulate speech');
        } else if (voice.clarity < 0.5) {
            feedback.push('Work on speaking more clearly and distinctly');
        }

        if (voice.pace >= 120 && voice.pace <= 160) {
            feedback.push('Good speaking pace for easy comprehension');
        } else if (voice.pace < 120) {
            feedback.push('Consider speaking slightly faster to maintain engagement');
        } else if (voice.pace > 160) {
            feedback.push('Try slowing down for better clarity');
        }

        return feedback;
    }

    private generateConfidenceFeedback(metrics: VRMetrics): string[] {
        const feedback: string[] = [];
        
        if (metrics.gestures.confidence > 0.8 && metrics.voice.confidence > 0.8) {
            feedback.push('High level of confidence projected throughout');
        } else if (metrics.gestures.confidence < 0.5) {
            feedback.push('Build confidence through more assertive body language');
        }

        return feedback;
    }

    private generateEngagementFeedback(engagement: VRMetrics['engagement']): string[] {
        const feedback: string[] = [];
        
        if (engagement.attention > 0.8) {
            feedback.push('Excellent attention and focus maintained');
        } else if (engagement.attention < 0.5) {
            feedback.push('Work on maintaining better attention during responses');
        }

        return feedback;
    }

    private identifyStrengths(metrics: VRMetrics): string[] {
        const strengths: string[] = [];
        
        if (metrics.eyeContact.consistency > 0.8) {
            strengths.push('Strong eye contact and engagement');
        }
        
        if (metrics.posture.upright > 0.8) {
            strengths.push('Professional posture and presence');
        }
        
        if (metrics.voice.clarity > 0.8) {
            strengths.push('Clear and articulate communication');
        }
        
        if (metrics.engagement.enthusiasm > 0.8) {
            strengths.push('High enthusiasm and positive energy');
        }

        return strengths;
    }

    private identifyImprovements(metrics: VRMetrics): string[] {
        const improvements: string[] = [];
        
        if (metrics.eyeContact.consistency < 0.6) {
            improvements.push('Improve eye contact consistency');
        }
        
        if (metrics.gestures.frequency < 1) {
            improvements.push('Use more natural hand gestures');
        }
        
        if (metrics.stress.level > 0.7) {
            improvements.push('Work on stress management techniques');
        }

        return improvements;
    }

    private generateRecommendations(metrics: VRMetrics): string[] {
        const recommendations: string[] = [];
        
        if (metrics.eyeContact.breaks > 2) {
            recommendations.push('Practice maintaining eye contact during longer responses');
        }
        
        if (metrics.posture.fidgeting > 0.6) {
            recommendations.push('Practice controlled posture to reduce nervous fidgeting');
        }
        
        if (metrics.voice.pace > 170) {
            recommendations.push('Practice speaking at a more measured pace');
        }

        recommendations.push('Continue practicing in VR environments to build comfort');
        recommendations.push('Record sessions to review and improve non-verbal cues');

        return recommendations;
    }

    // Get current session status
    getSessionStatus(): VRInterviewSession | null {
        return this.activeSession;
    }

    // Check VR compatibility
    checkVRCompatibility(): {
        supported: boolean;
        features: string[];
        recommendations: string[];
    } {
        const features: string[] = [];
        const recommendations: string[] = [];

        if (this.vrSupported) {
            features.push('VR headset support');
            features.push('Immersive environments');
            
            // Check for additional features
            if ((navigator as any).xr?.isSessionSupported('immersive-vr', { optionalFeatures: ['hand-tracking'] })) {
                features.push('Hand tracking');
            }
            
            if ((navigator as any).xr?.isSessionSupported('immersive-vr', { optionalFeatures: ['eye-tracking'] })) {
                features.push('Eye tracking');
            }
        } else {
            recommendations.push('Use a VR-compatible browser');
            recommendations.push('Ensure WebXR support is enabled');
            recommendations.push('Consider using a VR headset for full experience');
        }

        return {
            supported: this.vrSupported,
            features,
            recommendations
        };
    }

    // Generate unique ID
    private generateId(): string {
        return `vr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

export const vrInterviewService = new VRInterviewService();
export default vrInterviewService;
