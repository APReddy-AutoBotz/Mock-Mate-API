import { GoogleGenAI } from '@google/genai';
import type { InterviewTurn, SessionContext } from '../types';
import { APIError, ValidationError } from '../utils/errorHandler';

interface SpeechMetrics {
    clarity: number;           // 0-1: Speech clarity
    confidence: number;       // 0-1: Confidence level
    pace: number;            // words per minute
    volume: number;          // 0-1: Volume consistency
    fluency: number;         // 0-1: Speech fluency
    pauses: number;          // appropriate pauses per minute
    fillerWords: number;     // filler words per minute
    articulation: number;    // 0-1: Word articulation
}

interface SentimentAnalysis {
    overall: 'positive' | 'neutral' | 'negative';
    confidence: number;      // 0-1: Confidence in sentiment
    emotions: {
        joy: number;         // 0-1
        confidence: number;  // 0-1
        anxiety: number;     // 0-1
        enthusiasm: number;  // 0-1
        stress: number;      // 0-1
    };
    tone: 'professional' | 'casual' | 'formal' | 'enthusiastic';
    engagement: number;      // 0-1: Engagement level
}

interface SpeechInsights {
    transcript: string;
    metrics: SpeechMetrics;
    sentiment: SentimentAnalysis;
    strengths: string[];
    improvements: string[];
    recommendations: string[];
    realTimeFeedback: Array<{
        timestamp: number;
        type: 'pace' | 'volume' | 'filler' | 'sentiment';
        message: string;
        severity: 'info' | 'warning' | 'error';
    }>;
}

class SpeechSentimentService {
    private ai: GoogleGenAI;
    private readonly model = 'gemini-1.5-flash';
    private recognition: any = null;
    private isRecording = false;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private microphone: MediaStreamAudioSourceNode | null = null;

    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new APIError('Speech sentiment analysis requires GEMINI_API_KEY');
        }
        this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    // Initialize speech recognition
    async initializeSpeechRecognition(): Promise<void> {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            throw new Error('Speech recognition not supported in this browser');
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;
    }

    // Start real-time speech analysis
    async startRealTimeAnalysis(
        onTranscript: (transcript: string) => void,
        onMetrics: (metrics: Partial<SpeechMetrics>) => void,
        onSentiment: (sentiment: Partial<SentimentAnalysis>) => void
    ): Promise<void> {
        if (!this.recognition) {
            await this.initializeSpeechRecognition();
        }

        // Initialize audio analysis
        await this.initializeAudioAnalysis();

        this.isRecording = true;
        let transcriptBuffer = '';
        let wordCount = 0;
        let fillerCount = 0;
        let lastWordTime = Date.now();

        this.recognition.onresult = async (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                    wordCount += result[0].transcript.split(' ').length;
                    
                    // Check for filler words
                    const fillers = ['um', 'uh', 'like', 'you know', 'actually', 'basically'];
                    fillerCount += fillers.reduce((count, filler) => 
                        count + (result[0].transcript.toLowerCase().match(new RegExp(filler, 'g')) || []).length, 0
                    );
                } else {
                    interimTranscript += result[0].transcript;
                }
            }

            transcriptBuffer += finalTranscript;
            onTranscript(transcriptBuffer + interimTranscript);

            // Calculate real-time metrics
            const currentTime = Date.now();
            const timeElapsed = (currentTime - lastWordTime) / 1000 / 60; // minutes
            
            if (timeElapsed > 0) {
                const pace = wordCount / timeElapsed;
                const fillerRate = fillerCount / timeElapsed;
                
                onMetrics({
                    pace,
                    fillerWords: fillerRate
                });

                // Analyze sentiment for complete sentences
                if (finalTranscript.trim()) {
                    try {
                        const sentiment = await this.analyzeSentiment(finalTranscript);
                        onSentiment(sentiment);
                    } catch (error) {
                        console.error('Error analyzing sentiment:', error);
                    }
                }
            }

            lastWordTime = currentTime;
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                onMetrics({ clarity: 0.5 });
            }
        };

        this.recognition.start();
    }

    // Stop real-time analysis
    stopRealTimeAnalysis(): void {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
            this.isRecording = false;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
            this.analyser = null;
            this.microphone = null;
        }
    }

    // Initialize audio analysis for volume and pitch
    private async initializeAudioAnalysis(): Promise<void> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            this.analyser.fftSize = 2048;
            this.microphone.connect(this.analyser);
        } catch (error) {
            console.error('Error initializing audio analysis:', error);
        }
    }

    // Analyze complete speech segment
    async analyzeSpeech(audioBlob: Blob, transcript: string): Promise<SpeechInsights> {
        try {
            // Analyze speech metrics
            const metrics = await this.analyzeSpeechMetrics(audioBlob, transcript);
            
            // Analyze sentiment
            const sentiment = await this.analyzeSentiment(transcript);
            
            // Generate insights
            const insights = this.generateInsights(metrics, sentiment, transcript);
            
            return {
                transcript,
                metrics,
                sentiment,
                strengths: insights.strengths,
                improvements: insights.improvements,
                recommendations: insights.recommendations,
                realTimeFeedback: insights.realTimeFeedback
            };
        } catch (error) {
            console.error('Error analyzing speech:', error);
            throw new APIError('Failed to analyze speech');
        }
    }

    // Analyze speech metrics
    private async analyzeSpeechMetrics(audioBlob: Blob, transcript: string): Promise<SpeechMetrics> {
        const words = transcript.split(' ').filter(w => w.length > 0);
        const wordCount = words.length;
        
        // Get audio duration (simplified - in production would analyze actual audio)
        const audioDuration = await this.getAudioDuration(audioBlob);
        const durationMinutes = audioDuration / 60;
        
        // Calculate metrics
        const pace = durationMinutes > 0 ? wordCount / durationMinutes : 0;
        
        const fillerWords = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'sort of', 'kind of'];
        const fillerCount = fillerWords.reduce((count, filler) => 
            count + (transcript.toLowerCase().match(new RegExp(filler, 'g')) || []).length, 0
        );
        const fillerRate = durationMinutes > 0 ? fillerCount / durationMinutes : 0;
        
        // Estimate other metrics (in production, would use actual audio analysis)
        const clarity = Math.max(0, 1 - (fillerRate / 10));
        const confidence = this.estimateConfidence(transcript);
        const volume = 0.8; // Would analyze actual volume
        const fluency = Math.max(0, 1 - (fillerRate / 5));
        const pauses = this.estimatePauses(transcript, audioDuration);
        const articulation = this.estimateArticulation(words);
        
        return {
            clarity,
            confidence,
            pace,
            volume,
            fluency,
            pauses,
            fillerWords: fillerRate,
            articulation
        };
    }

    // Analyze sentiment using AI
    private async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
        const prompt = `
Analyze the sentiment and emotional tone of this interview response:

"${text}"

Provide analysis in this JSON format:
{
    "overall": "positive|neutral|negative",
    "confidence": 0.8,
    "emotions": {
        "joy": 0.6,
        "confidence": 0.7,
        "anxiety": 0.2,
        "enthusiasm": 0.5,
        "stress": 0.1
    },
    "tone": "professional|casual|formal|enthusiastic",
    "engagement": 0.7
}

Focus on:
1. Overall sentiment (positive/neutral/negative)
2. Confidence in the analysis (0-1)
3. Emotional breakdown (0-1 for each emotion)
4. Communication tone
5. Engagement level
6. Professionalism indicators
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
            console.error('Error analyzing sentiment:', error);
            // Return default analysis
            return {
                overall: 'neutral',
                confidence: 0.5,
                emotions: {
                    joy: 0.5,
                    confidence: 0.5,
                    anxiety: 0.5,
                    enthusiasm: 0.5,
                    stress: 0.5
                },
                tone: 'professional',
                engagement: 0.5
            };
        }
    }

    // Generate insights from metrics and sentiment
    private generateInsights(
        metrics: SpeechMetrics,
        sentiment: SentimentAnalysis,
        transcript: string
    ): {
        strengths: string[];
        improvements: string[];
        recommendations: string[];
        realTimeFeedback: Array<{
            timestamp: number;
            type: 'pace' | 'volume' | 'filler' | 'sentiment';
            message: string;
            severity: 'info' | 'warning' | 'error';
        }>;
    } {
        const strengths: string[] = [];
        const improvements: string[] = [];
        const recommendations: string[] = [];
        const realTimeFeedback: any[] = [];

        // Pace analysis
        if (metrics.pace >= 120 && metrics.pace <= 160) {
            strengths.push('Optimal speaking pace for clear communication');
        } else if (metrics.pace < 120) {
            improvements.push('Speaking too slowly - may reduce engagement');
            recommendations.push('Practice speaking at 120-160 words per minute');
            realTimeFeedback.push({
                timestamp: Date.now(),
                type: 'pace',
                message: 'Consider speaking a bit faster to maintain engagement',
                severity: 'warning'
            });
        } else if (metrics.pace > 160) {
            improvements.push('Speaking too quickly - may reduce clarity');
            recommendations.push('Slow down and add strategic pauses');
            realTimeFeedback.push({
                timestamp: Date.now(),
                type: 'pace',
                message: 'Try slowing down for better clarity',
                severity: 'warning'
            });
        }

        // Filler words analysis
        if (metrics.fillerWords < 2) {
            strengths.push('Minimal use of filler words');
        } else if (metrics.fillerWords > 5) {
            improvements.push('High usage of filler words');
            recommendations.push('Practice pausing instead of using fillers');
            realTimeFeedback.push({
                timestamp: Date.now(),
                type: 'filler',
                message: 'Try to reduce filler words like "um" and "uh"',
                severity: 'warning'
            });
        }

        // Confidence analysis
        if (metrics.confidence > 0.7) {
            strengths.push('High confidence in responses');
        } else if (metrics.confidence < 0.4) {
            improvements.push('Low confidence detected');
            recommendations.push('Practice with more preparation and positive self-talk');
        }

        // Sentiment analysis
        if (sentiment.overall === 'positive' && sentiment.engagement > 0.7) {
            strengths.push('Positive and engaging communication style');
        } else if (sentiment.overall === 'negative' || sentiment.emotions.stress > 0.7) {
            improvements.push('Negative or stressed tone detected');
            recommendations.push('Practice stress management techniques');
            realTimeFeedback.push({
                timestamp: Date.now(),
                type: 'sentiment',
                message: 'Try to maintain a more positive tone',
                severity: 'warning'
            });
        }

        // Fluency and clarity
        if (metrics.fluency > 0.8 && metrics.clarity > 0.8) {
            strengths.push('Excellent fluency and clarity');
        } else if (metrics.fluency < 0.5) {
            improvements.push('Speech fluency needs improvement');
            recommendations.push('Practice speaking with more fluidity');
        }

        return { strengths, improvements, recommendations, realTimeFeedback };
    }

    // Helper methods
    private async getAudioDuration(audioBlob: Blob): Promise<number> {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.onloadedmetadata = () => resolve(audio.duration);
            audio.src = URL.createObjectURL(audioBlob);
        });
    }

    private estimateConfidence(transcript: string): number {
        const confidentWords = ['absolutely', 'definitely', 'certainly', 'surely', 'confident'];
        const uncertainWords = ['maybe', 'perhaps', 'possibly', 'might', 'could be', 'not sure'];
        
        const confidentCount = confidentWords.reduce((count, word) => 
            count + (transcript.toLowerCase().match(new RegExp(word, 'g')) || []).length, 0
        );
        
        const uncertainCount = uncertainWords.reduce((count, word) => 
            count + (transcript.toLowerCase().match(new RegExp(word, 'g')) || []).length, 0
        );
        
        const totalWords = transcript.split(' ').length;
        const confidenceRatio = (confidentCount - uncertainCount) / totalWords;
        
        return Math.max(0, Math.min(1, 0.5 + confidenceRatio));
    }

    private estimatePauses(transcript: string, duration: number): number {
        const sentences = transcript.split(/[.!?]+/).length;
        const avgSentenceDuration = duration / sentences;
        return Math.max(0, 3 - avgSentenceDuration); // Ideal is 2-3 seconds per sentence
    }

    private estimateArticulation(words: string[]): number {
        // Simplified articulation analysis
        const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
        const complexWords = words.filter(word => word.length > 8).length;
        const articulationScore = 1 - (complexWords / words.length * 0.3);
        
        return Math.max(0, Math.min(1, articulationScore));
    }

    // Get real-time volume level
    getVolumeLevel(): number {
        if (!this.analyser) return 0;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        return average / 255; // Normalize to 0-1
    }

    // Check browser compatibility
    static checkCompatibility(): {
        supported: boolean;
        missingFeatures: string[];
    } {
        const missingFeatures: string[] = [];

        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            missingFeatures.push('Speech recognition');
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            missingFeatures.push('Microphone access');
        }

        if (!window.AudioContext && !(window as any).webkitAudioContext) {
            missingFeatures.push('Audio analysis');
        }

        return {
            supported: missingFeatures.length === 0,
            missingFeatures
        };
    }
}

export const speechSentimentService = new SpeechSentimentService();
export default speechSentimentService;
