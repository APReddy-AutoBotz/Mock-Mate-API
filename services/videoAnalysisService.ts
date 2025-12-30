import type { SessionContext, InterviewTurn } from '../types';
import { APIError, ValidationError } from '../utils/errorHandler';

interface VideoMetrics {
    eyeContact: number;        // 0-1: Eye contact consistency
    facialExpressions: number; // 0-1: Appropriate facial expressions
    posture: number;          // 0-1: Posture quality
    gestures: number;          // 0-1: Appropriate gesture usage
    confidence: number;        // 0-1: Overall confidence
    engagement: number;       // 0-1: Engagement level
    speakingRate: number;     // words per minute
    fillers: number;          // filler words per minute
    pauses: number;           // appropriate pauses
}

interface FrameAnalysis {
    timestamp: number;
    eyeContact: boolean;
    facialExpression: string;
    posture: string;
    gesture: string;
    confidence: number;
}

interface VideoFeedback {
    overallScore: number;
    metrics: VideoMetrics;
    strengths: string[];
    improvements: string[];
    recommendations: string[];
    frameAnalysis: FrameAnalysis[];
}

class VideoAnalysisService {
    private mediaRecorder: MediaRecorder | null = null;
    private videoStream: MediaStream | null = null;
    private audioStream: MediaStream | null = null;
    private recordedChunks: Blob[] = [];
    private analysisInterval: NodeJS.Timeout | null = null;

    // Start video recording
    async startRecording(): Promise<void> {
        try {
            // Get video and audio streams
            this.videoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });

            // Combine streams
            const combinedStream = new MediaStream([
                ...this.videoStream.getVideoTracks(),
                ...this.videoStream.getAudioTracks()
            ]);

            // Setup media recorder
            this.mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType: 'video/webm;codecs=vp9,opus'
            });

            this.recordedChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.start(1000); // Collect data every second
        } catch (error) {
            console.error('Error starting video recording:', error);
            throw new APIError('Failed to start video recording');
        }
    }

    // Stop video recording
    async stopRecording(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder) {
                reject(new Error('No active recording'));
                return;
            }

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                this.cleanup();
                resolve(blob);
            };

            this.mediaRecorder.stop();
        });
    }

    // Analyze video in real-time
    async startRealTimeAnalysis(callback: (analysis: FrameAnalysis) => void): Promise<void> {
        if (!this.videoStream) {
            throw new Error('No video stream available');
        }

        const videoTrack = this.videoStream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(videoTrack);

        this.analysisInterval = setInterval(async () => {
            try {
                const bitmap = await (imageCapture as any).grabFrame();
                const analysis = await this.analyzeFrame(bitmap);
                callback(analysis);
            } catch (error) {
                console.error('Error in real-time analysis:', error);
            }
        }, 2000); // Analyze every 2 seconds
    }

    // Stop real-time analysis
    stopRealTimeAnalysis(): void {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
    }

    // Analyze single frame
    private async analyzeFrame(bitmap: ImageBitmap): Promise<FrameAnalysis> {
        // This is a simplified implementation
        // In production, you would use TensorFlow.js or similar for actual computer vision
        
        const timestamp = Date.now();
        
        // Simulate analysis (replace with actual ML model)
        const eyeContact = Math.random() > 0.3; // 70% chance of good eye contact
        const facialExpression = this.detectFacialExpression(bitmap);
        const posture = this.detectPosture(bitmap);
        const gesture = this.detectGesture(bitmap);
        const confidence = this.calculateConfidence(eyeContact, facialExpression, posture);

        return {
            timestamp,
            eyeContact,
            facialExpression,
            posture,
            gesture,
            confidence
        };
    }

    // Detect facial expression (simplified)
    private detectFacialExpression(bitmap: ImageBitmap): string {
        // In production, use face detection and expression recognition
        const expressions = ['neutral', 'smiling', 'concerned', 'engaged', 'thoughtful'];
        return expressions[Math.floor(Math.random() * expressions.length)];
    }

    // Detect posture (simplified)
    private detectPosture(bitmap: ImageBitmap): string {
        // In production, use pose estimation
        const postures = ['upright', 'slouched', 'leaning', 'forward', 'relaxed'];
        return postures[Math.floor(Math.random() * postures.length)];
    }

    // Detect gesture (simplified)
    private detectGesture(bitmap: ImageBitmap): string {
        // In production, use hand tracking
        const gestures = ['none', 'hand_talk', 'emphatic', 'descriptive', 'calm'];
        return gestures[Math.floor(Math.random() * gestures.length)];
    }

    // Calculate confidence score
    private calculateConfidence(eyeContact: boolean, expression: string, posture: string): number {
        let score = 0.5; // Base score

        if (eyeContact) score += 0.2;
        if (expression === 'engaged' || expression === 'smiling') score += 0.15;
        if (posture === 'upright' || posture === 'forward') score += 0.15;

        return Math.min(1, score);
    }

    // Analyze complete video recording
    async analyzeVideo(videoBlob: Blob, audioTranscript: string): Promise<VideoFeedback> {
        try {
            // Create video element for analysis
            const video = document.createElement('video');
            video.src = URL.createObjectURL(videoBlob);
            
            await new Promise((resolve) => {
                video.onloadedmetadata = resolve;
            });

            const duration = video.duration;
            const frameAnalyses: FrameAnalysis[] = [];

            // Sample frames throughout the video
            const sampleInterval = 2; // Every 2 seconds
            for (let time = 0; time < duration; time += sampleInterval) {
                video.currentTime = time;
                await new Promise((resolve) => {
                    video.onseeked = resolve;
                });

                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(video, 0, 0);

                const bitmap = await createImageBitmap(canvas);
                const analysis = await this.analyzeFrame(bitmap);
                frameAnalyses.push(analysis);
            }

            // Calculate metrics
            const metrics = this.calculateMetrics(frameAnalyses, audioTranscript);
            
            // Generate feedback
            const feedback = this.generateFeedback(metrics, frameAnalyses);

            URL.revokeObjectURL(video.src);

            return {
                overallScore: this.calculateOverallScore(metrics),
                metrics,
                strengths: feedback.strengths,
                improvements: feedback.improvements,
                recommendations: feedback.recommendations,
                frameAnalysis: frameAnalyses
            };
        } catch (error) {
            console.error('Error analyzing video:', error);
            throw new APIError('Failed to analyze video');
        }
    }

    // Calculate video metrics
    private calculateMetrics(frameAnalyses: FrameAnalysis[], transcript: string): VideoMetrics {
        const eyeContactScore = frameAnalyses.filter(f => f.eyeContact).length / frameAnalyses.length;
        
        const expressions = frameAnalyses.map(f => f.facialExpression);
        const facialExpressionScore = expressions.filter(e => 
            e === 'engaged' || e === 'smiling'
        ).length / expressions.length;

        const postures = frameAnalyses.map(f => f.posture);
        const postureScore = postures.filter(p => 
            p === 'upright' || p === 'forward'
        ).length / postures.length;

        const gestures = frameAnalyses.map(f => f.gesture);
        const gestureScore = gestures.filter(g => 
            g !== 'none' && g !== 'excessive'
        ).length / gestures.length;

        const confidenceScore = frameAnalyses.reduce((sum, f) => sum + f.confidence, 0) / frameAnalyses.length;
        
        const engagementScore = (eyeContactScore + facialExpressionScore + gestureScore) / 3;

        // Audio metrics
        const words = transcript.split(' ').length;
        const duration = frameAnalyses[frameAnalyses.length - 1]?.timestamp / 1000 || 60;
        const speakingRate = words / (duration / 60); // words per minute

        const fillerWords = ['um', 'uh', 'like', 'you know', 'actually', 'basically'];
        const fillerCount = fillerWords.reduce((count, filler) => 
            count + (transcript.toLowerCase().match(new RegExp(filler, 'g')) || []).length, 0
        );
        const fillers = fillerCount / (duration / 60);

        const pauses = this.estimatePauses(transcript, duration);

        return {
            eyeContact: eyeContactScore,
            facialExpressions: facialExpressionScore,
            posture: postureScore,
            gestures: gestureScore,
            confidence: confidenceScore,
            engagement: engagementScore,
            speakingRate,
            fillers,
            pauses
        };
    }

    // Estimate pauses in speech
    private estimatePauses(transcript: string, duration: number): number {
        // Simplified pause detection
        const sentences = transcript.split(/[.!?]+/).length;
        const avgSentenceDuration = duration / sentences;
        return Math.max(0, 3 - avgSentenceDuration); // Ideal is 2-3 seconds per sentence
    }

    // Generate feedback based on metrics
    private generateFeedback(metrics: VideoMetrics, frameAnalyses: FrameAnalysis[]): {
        strengths: string[];
        improvements: string[];
        recommendations: string[];
    } {
        const strengths: string[] = [];
        const improvements: string[] = [];
        const recommendations: string[] = [];

        // Eye contact
        if (metrics.eyeContact > 0.8) {
            strengths.push('Excellent eye contact throughout the interview');
        } else if (metrics.eyeContact < 0.5) {
            improvements.push('Work on maintaining consistent eye contact');
            recommendations.push('Practice looking at the camera while speaking');
        }

        // Facial expressions
        if (metrics.facialExpressions > 0.7) {
            strengths.push('Appropriate and engaging facial expressions');
        } else if (metrics.facialExpressions < 0.4) {
            improvements.push('Show more facial expression to convey engagement');
            recommendations.push('Practice smiling and showing enthusiasm');
        }

        // Posture
        if (metrics.posture > 0.8) {
            strengths.push('Professional and confident posture');
        } else if (metrics.posture < 0.5) {
            improvements.push('Improve posture to appear more confident');
            recommendations.push('Sit upright with shoulders back');
        }

        // Gestures
        if (metrics.gestures > 0.6 && metrics.gestures < 0.9) {
            strengths.push('Appropriate use of hand gestures');
        } else if (metrics.gestures < 0.3) {
            improvements.push('Use more natural hand gestures');
            recommendations.push('Practice using gestures to emphasize points');
        } else if (metrics.gestures > 0.9) {
            improvements.push('Reduce excessive gestures');
            recommendations.push('Focus on purposeful, meaningful gestures');
        }

        // Speaking rate
        if (metrics.speakingRate >= 120 && metrics.speakingRate <= 160) {
            strengths.push('Optimal speaking rate');
        } else if (metrics.speakingRate < 120) {
            improvements.push('Speak slightly faster to maintain engagement');
            recommendations.push('Practice speaking at 120-160 words per minute');
        } else if (metrics.speakingRate > 160) {
            improvements.push('Slow down to improve clarity');
            recommendations.push('Take pauses between points');
        }

        // Fillers
        if (metrics.fillers < 2) {
            strengths.push('Minimal use of filler words');
        } else if (metrics.fillers > 5) {
            improvements.push('Reduce use of filler words');
            recommendations.push('Practice pausing instead of using fillers');
        }

        return { strengths, improvements, recommendations };
    }

    // Calculate overall score
    private calculateOverallScore(metrics: VideoMetrics): number {
        const weights = {
            eyeContact: 0.2,
            facialExpressions: 0.15,
            posture: 0.15,
            gestures: 0.1,
            confidence: 0.2,
            engagement: 0.1,
            speakingRate: 0.05,
            fillers: 0.025,
            pauses: 0.025
        };

        return Object.entries(weights).reduce((score, [metric, weight]) => {
            const value = metrics[metric as keyof VideoMetrics];
            let normalizedValue = 0;

            // Normalize different metrics to 0-1 scale
            if (metric === 'speakingRate') {
                normalizedValue = value >= 120 && value <= 160 ? 1 : Math.max(0, 1 - Math.abs(140 - value) / 40);
            } else if (metric === 'fillers') {
                normalizedValue = Math.max(0, 1 - value / 10);
            } else if (metric === 'pauses') {
                normalizedValue = Math.max(0, 1 - Math.abs(value - 2) / 2);
            } else {
                normalizedValue = value as number;
            }

            return score + (normalizedValue * weight);
        }, 0) * 100;
    }

    // Cleanup resources
    private cleanup(): void {
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        this.mediaRecorder = null;
        this.stopRealTimeAnalysis();
    }

    // Check browser compatibility
    static checkCompatibility(): {
        supported: boolean;
        missingFeatures: string[];
    } {
        const missingFeatures: string[] = [];

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            missingFeatures.push('Camera/Microphone access');
        }

        if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
            missingFeatures.push('Video recording format');
        }

        if (!window.ImageCapture) {
            missingFeatures.push('Frame capture API');
        }

        return {
            supported: missingFeatures.length === 0,
            missingFeatures
        };
    }
}

export const videoAnalysisService = new VideoAnalysisService();
export default videoAnalysisService;
