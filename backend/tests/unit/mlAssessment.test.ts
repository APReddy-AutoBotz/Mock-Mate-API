import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mockDeep } from 'jest-mock-extended';
import { db, Timestamp } from '../../firebase';
import { mlAssessmentService } from '../../services/mlAssessmentService';

// Mock Firebase
jest.mock('../../firebase');
const mockDb = mockDeep(db);
const mockCollection = mockDeep();
mockDb.collection.mockReturnValue(mockCollection);

describe('ML Assessment Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('assessSkills', () => {
        test('should assess skills from user responses', async () => {
            // Arrange
            const responses = [
                {
                    question: 'Tell me about your experience with React',
                    answer: 'I have 3 years of experience with React, building complex applications with hooks and context.',
                    context: { experience: 'mid' }
                }
            ];

            // Mock Gemini AI response
            const mockResponse = {
                response: {
                    text: JSON.stringify({
                        skillAssessments: [
                            {
                                skill: 'React',
                                category: 'technical',
                                level: 85,
                                confidence: 0.9,
                                evidence: ['3 years experience', 'complex applications'],
                                gaps: ['Could improve on performance optimization'],
                                recommendations: ['Learn React performance patterns'],
                                benchmarkComparison: {
                                    industryAverage: 75,
                                    topPerformers: 92,
                                    percentile: 80
                                }
                            }
                        ]
                    })
                }
            };

            // Mock the AI service
            jest.doMock('../../services/mlAssessmentService', () => {
                const originalModule = jest.requireActual('../../services/mlAssessmentService');
                return {
                    ...originalModule,
                    assessSkills: jest.fn().mockResolvedValue({
                        overallScore: 85,
                        skillAssessments: [
                            {
                                skill: 'React',
                                category: 'technical',
                                level: 85,
                                confidence: 0.9,
                                evidence: ['3 years experience', 'complex applications'],
                                gaps: ['Could improve on performance optimization'],
                                recommendations: ['Learn React performance patterns'],
                                benchmarkComparison: {
                                    industryAverage: 75,
                                    topPerformers: 92,
                                    percentile: 80
                                }
                            }
                        ],
                        strengths: ['Strong React knowledge'],
                        weaknesses: ['Performance optimization'],
                        careerFit: {
                            matchingRoles: [],
                            readiness: 80,
                            marketability: 75
                        },
                        predictions: {
                            performancePotential: 90,
                            learningCurve: 'fast',
                            successProbability: 0.85,
                            timeToProficiency: 6
                        },
                        personalizedPlan: {
                            shortTerm: [],
                            longTerm: []
                        }
                    })
                };
            });

            // Act
            const result = await mlAssessmentService.assessSkills(responses);

            // Assert
            expect(result).toBeDefined();
            expect(result.overallScore).toBe(85);
            expect(result.skillAssessments).toHaveLength(1);
            expect(result.skillAssessments[0].skill).toBe('React');
            expect(result.skillAssessments[0].level).toBe(85);
        });

        test('should handle empty responses', async () => {
            // Arrange
            const responses = [];

            // Act & Assert
            await expect(mlAssessmentService.assessSkills(responses))
                .rejects.toThrow('Failed to complete ML assessment');
        });

        test('should include career fit analysis', async () => {
            // Arrange
            const responses = [
                {
                    question: 'What role are you targeting?',
                    answer: 'I am targeting a Senior Software Engineer role',
                    context: { targetRole: 'Senior Software Engineer' }
                }
            ];

            // Act
            const result = await mlAssessmentService.assessSkills(responses);

            // Assert
            expect(result.careerFit).toBeDefined();
            expect(result.careerFit.matchingRoles).toBeInstanceOf(Array);
            expect(result.careerFit.readiness).toBeGreaterThanOrEqual(0);
            expect(result.careerFit.marketability).toBeGreaterThanOrEqual(0);
        });

        test('should generate personalized development plan', async () => {
            // Arrange
            const responses = [
                {
                    question: 'What areas do you want to improve?',
                    answer: 'I want to improve my system design skills',
                    context: { experience: 'mid' }
                }
            ];

            // Act
            const result = await mlAssessmentService.assessSkills(responses);

            // Assert
            expect(result.personalizedPlan).toBeDefined();
            expect(result.personalizedPlan.shortTerm).toBeInstanceOf(Array);
            expect(result.personalizedPlan.longTerm).toBeInstanceOf(Array);
        });
    });

    describe('getAvailableModels', () => {
        test('should return available ML models', () => {
            // Act
            const models = mlAssessmentService.getAvailableModels();

            // Assert
            expect(models).toBeInstanceOf(Array);
            expect(models.length).toBeGreaterThan(0);
            expect(models[0]).toHaveProperty('name');
            expect(models[0]).toHaveProperty('type');
            expect(models[0]).toHaveProperty('accuracy');
        });
    });

    describe('getModelPerformanceMetrics', () => {
        test('should return model performance metrics', async () => {
            // Act
            const metrics = await mlAssessmentService.getModelPerformanceMetrics();

            // Assert
            expect(metrics).toBeDefined();
            expect(metrics.totalAssessments).toBeGreaterThanOrEqual(0);
            expect(metrics.averageAccuracy).toBeGreaterThanOrEqual(0);
            expect(metrics.modelUsage).toBeInstanceOf(Array);
            expect(metrics.recentAccuracy).toBeGreaterThanOrEqual(0);
        });
    });

    describe('trainModel', () => {
        test('should train model with provided data', async () => {
            // Arrange
            const modelName = 'skill_classifier';
            const trainingData = [
                {
                    text: 'I am proficient in JavaScript',
                    contextualFeatures: { questionType: 'technical' }
                }
            ];
            const labels = ['javascript'];

            // Act
            const result = await mlAssessmentService.trainModel(modelName, trainingData, labels);

            // Assert
            expect(result).toBeDefined();
            expect(result.modelAccuracy).toBeGreaterThanOrEqual(0);
            expect(result.modelAccuracy).toBeLessThanOrEqual(1);
            expect(result.trainingLoss).toBeGreaterThanOrEqual(0);
            expect(result.validationLoss).toBeGreaterThanOrEqual(0);
            expect(result.epochs).toBeGreaterThan(0);
        });
    });

    describe('validateModel', () => {
        test('should validate model performance', async () => {
            // Arrange
            const modelName = 'skill_classifier';
            const testData = [
                {
                    text: 'I know React',
                    contextualFeatures: { questionType: 'technical' }
                }
            ];
            const testLabels = ['react'];

            // Act
            const result = await mlAssessmentService.validateModel(modelName, testData, testLabels);

            // Assert
            expect(result).toBeDefined();
            expect(result.accuracy).toBeGreaterThanOrEqual(0);
            expect(result.accuracy).toBeLessThanOrEqual(1);
            expect(result.precision).toBeGreaterThanOrEqual(0);
            expect(result.precision).toBeLessThanOrEqual(1);
            expect(result.recall).toBeGreaterThanOrEqual(0);
            expect(result.recall).toBeLessThanOrEqual(1);
            expect(result.f1Score).toBeGreaterThanOrEqual(0);
            expect(result.f1Score).toBeLessThanOrEqual(1);
            expect(result.confusionMatrix).toBeDefined();
        });
    });

    describe('exportModel', () => {
        test('should export model data', async () => {
            // Arrange
            const modelName = 'skill_classifier';

            // Act
            const result = await mlAssessmentService.exportModel(modelName);

            // Assert
            expect(result).toBeDefined();
            expect(result.modelData).toBeDefined();
            expect(result.modelConfig).toBeDefined();
            expect(result.version).toBeDefined();
            expect(result.exportDate).toBeInstanceOf(Date);
        });
    });

    describe('importModel', () => {
        test('should import model data', async () => {
            // Arrange
            const modelData = 'base64_encoded_model_data';
            const modelConfig = {
                type: 'classification',
                features: ['text_embeddings'],
                accuracy: 0.85
            };
            const version = '2.1.0';

            // Act
            const result = await mlAssessmentService.importModel(modelData, modelConfig, version);

            // Assert
            expect(result).toBeDefined();
            expect(result).toMatch(/^imported_model_/);
        });
    });

    describe('error handling', () => {
        test('should handle invalid responses gracefully', async () => {
            // Arrange
            const responses = [
                {
                    question: 'Invalid question',
                    answer: '',
                    context: {}
                }
            ];

            // Act & Assert
            await expect(mlAssessmentService.assessSkills(responses))
                .rejects.toThrow('Failed to complete ML assessment');
        });

        test('should handle missing AI API key', async () => {
            // Arrange
            const originalApiKey = process.env.GEMINI_API_KEY;
            delete process.env.GEMINI_API_KEY;

            // Act & Assert
            await expect(mlAssessmentService.assessSkills([]))
                .rejects.toThrow('ML assessment requires GEMINI_API_KEY');

            // Cleanup
            process.env.GEMINI_API_KEY = originalApiKey;
        });
    });

    describe('edge cases', () => {
        test('should handle very long responses', async () => {
            // Arrange
            const longResponse = 'A'.repeat(10000);
            const responses = [
                {
                    question: 'Tell me about yourself',
                    answer: longResponse,
                    context: {}
                }
            ];

            // Act
            const result = await mlAssessmentService.assessSkills(responses);

            // Assert
            expect(result).toBeDefined();
            expect(result.skillAssessments).toBeDefined();
        });

        test('should handle special characters in responses', async () => {
            // Arrange
            const responses = [
                {
                    question: 'What special characters can you handle?',
                    answer: 'I can handle @#$%^&*()_+-={}[]{}|\\:;"\'<>,.?/~`',
                    context: {}
                }
            ];

            // Act
            const result = await mlAssessmentService.assessSkills(responses);

            // Assert
            expect(result).toBeDefined();
            expect(result.skillAssessments).toBeDefined();
        });

        test('should handle multiple languages', async () => {
            // Arrange
            const responses = [
                {
                    question: 'Describe your skills in English',
                    answer: 'I am proficient in JavaScript, React, and Node.js',
                    context: { language: 'en' }
                },
                {
                    question: 'Describe tus habilidades en español',
                    answer: 'Soy experto en JavaScript, React y Node.js',
                    context: { language: 'es' }
                }
            ];

            // Act
            const result = await mlAssessmentService.assessSkills(responses);

            // Assert
            expect(result).toBeDefined();
            expect(result.skillAssessments).toBeDefined();
        });
    });
});
