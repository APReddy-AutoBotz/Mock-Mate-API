import { config } from 'dotenv';

// Load environment variables
config({ path: '../../.env' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-api-key';

// Mock Firebase
jest.mock('../../firebase', () => ({
    db: {
        collection: jest.fn().mockReturnValue({
            doc: jest.fn(),
            getDoc: jest.fn(),
            set: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            add: jest.fn(),
            where: jest.fn().mockReturnSelf(),
            orderBy: jest.fn().mockReturnSelf(),
            limit: jest.fn().mockReturnSelf(),
            get: jest.fn().mockResolvedValue({
                docs: []
            }),
            batch: jest.fn().mockReturnValue({
                commit: jest.fn().mockResolvedValue()
            })
        }),
        Timestamp: {
            now: jest.fn().mockReturnValue({
                toDate: jest.fn().mockReturnValue(new Date())
            }),
            fromDate: jest.fn().mockReturnValue({
                toDate: jest.fn().mockReturnValue(new Date())
            })
        })
    },
    auth: {
        verifyIdToken: jest.fn().mockResolvedValue({
            uid: 'test-user-id',
            email: 'test@example.com',
            displayName: 'Test User'
        })
    }
}));

// Mock Google GenAI
jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
            generateContent: jest.fn().mockResolvedValue({
                response: {
                    text: JSON.stringify({
                        skillAssessments: [
                            {
                                skill: 'Test Skill',
                                category: 'technical',
                                level: 75,
                                confidence: 0.8,
                                evidence: ['Test evidence'],
                                gaps: ['Test gap'],
                                recommendations: ['Test recommendation'],
                                benchmarkComparison: {
                                    industryAverage: 70,
                                    topPerformers: 90,
                                    percentile: 75
                                }
                            }
                        ]
                    })
                }
            })
        })
    })
}));

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
};

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock process.uptime
const originalUptime = process.uptime;
Object.defineProperty(process, 'uptime', {
    get: jest.fn(() => originalUptime())
});

// Mock Date.now
const originalNow = Date.now;
Object.defineProperty(Date, 'now', {
    get: jest.fn(() => originalNow())
});

// Mock Math.random
const originalRandom = Math.random;
Object.defineProperty(Math, 'random', {
    get: jest.fn(() => originalRandom())
});

// Setup global test utilities
global.testUtils = {
    createMockUser: (overrides = {}) => ({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        permissions: ['read:profile', 'write:profile'],
        profile: {
            skills: ['JavaScript', 'React', 'Node.js'],
            experience: 'mid',
            industry: 'Technology',
            goals: ['Get a job at FAANG'],
            learningStyle: 'visual'
        },
        preferences: {
            language: 'en',
            timezone: 'America/New_York',
            notifications: {
                email: true,
                push: true,
                sms: false
            },
            privacy: {
                profileVisibility: 'public',
                dataSharing: false
            }
        },
        subscription: {
            plan: 'premium',
            status: 'active'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        lastLogin: new Date(),
        ...overrides
    }),

    createMockSession: (overrides = {}) => ({
        id: 'test-session-id',
        userId: 'test-user-id',
        context: {
            targetRole: 'Software Engineer',
            experience: 'mid',
            industry: 'Technology',
            difficulty: 'medium'
        },
        settings: {
            enableVideo: true,
            enableAudio: true,
            enableTranscription: true,
            maxDuration: 60,
            questionCount: 10,
            questionTypes: ['behavioral', 'technical', 'situational'],
            aiAssistance: true
        },
        status: 'active',
        turns: [],
        metrics: {
            duration: 1800,
            score: 85,
            completionRate: 0.8,
            engagement: 0.9,
            sentiment: 'positive'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    }),

    createMockAnalytics: (overrides = {}) => ({
        id: 'test-analytics-id',
        userId: 'test-user-id',
        overview: {
            totalSessions: 25,
            completedSessions: 20,
            averageScore: 85,
            totalDuration: 1800,
            recentSessions: 5
        },
        skillBreakdown: {
            technical: 85,
            behavioral: 80,
            communication: 90
        },
        progressTrend: [
            { date: '2024-01-01', score: 75, sessions: 3 },
            { date: '2024-01-02', score: 78, sessions: 2 },
            { date: '2024-01-03', score: 82, sessions: 4 }
        ],
        achievements: [],
        recommendations: [],
        ...overrides
    }),

    createMockCredential: (overrides = {}) => ({
        id: 'test-credential-id',
        type: 'degree',
        title: 'Bachelor of Science',
        issuer: 'Test University',
        recipient: 'test-user-id',
        issueDate: new Date('2020-01-01'),
        metadata: {
            description: 'Test degree',
            skills: ['JavaScript', 'React', 'Node.js'],
            level: 'undergraduate',
            verificationMethod: 'blockchain'
        },
        blockchain: {
            network: 'sepolia',
            contractAddress: '0x123456789012345678901234567890',
            transactionHash: '0x' + 'test-hash',
            blockNumber: 18000000
        },
        status: 'active',
        verificationCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    }),

    createMockApplication: (overrides = {}) => ({
        id: 'test-application-id',
        jobId: 'test-job-id',
        candidateId: 'test-candidate-id',
        status: 'applied',
        appliedDate: new Date(),
        lastUpdated: new Date(),
        resumeUrl: 'https://example.com/resume.pdf',
        coverLetter: 'Test cover letter',
        screeningNotes: 'Test screening notes',
        interviewSchedule: {
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            type: 'video',
            interviewers: ['Interviewer 1', 'Interviewer 2'],
            location: 'Video call'
        },
        feedback: [],
        offer: {
            salary: 100000,
            startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            status: 'pending'
        },
        ...overrides
    }),

    createMockATSSettings: (provider: string) => ({
        name: provider,
        apiEndpoint: `https://api.${provider}.com/v1`,
        apiKey: `test-${provider}-key`,
        version: 'v1',
        features: ['job_posting', 'candidate_management', 'interview_scheduling'],
        rateLimits: {
            requestsPerMinute: 100,
            requestsPerHour: 5000,
            requestsPerDay: 50000
        }
    }),

    createMockWebhook: (provider: string) => ({
        id: `webhook-${provider}`,
        url: `https://mockmate.com/webhooks/ats/${provider}`,
        events: ['job.created', 'job.updated', 'candidate.created', 'application.updated'],
        secret: `webhook-secret-${provider}`,
        active: true,
        lastTriggered: new Date(),
        triggerCount: 0
    }),

    createMockAPIKey: (userId: string) => ({
        id: `api-key-${userId}`,
        userId,
        name: 'Test API Key',
        key: 'test-api-key',
        permissions: ['read:analytics', 'write:sessions'],
        isActive: true,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        lastUsed: new Date(),
        usageCount: 0,
        rateLimit: {
            requestsPerMinute: 100,
            requestsPerHour: 5000,
            requestsPerDay: 50000
        }
    }),

    createMockLogEntry: (level: string, message: string, meta?: any) => ({
        timestamp: new Date(),
        level,
        message,
        meta
    }),

    createMockMetrics: (overrides = {}) => ({
        timestamp: new Date(),
        requestsPerSecond: 10,
        averageResponseTime: 150,
        errorRate: 0.02,
        activeConnections: 25,
        memoryUsage: 0.6,
        cpuUsage: 0.4,
        diskUsage: 0.3,
        networkIO: {
            bytesIn: 1000000,
            bytesOut: 500000
        },
        databaseMetrics: {
            connections: 25,
            queriesPerSecond: 50,
            averageQueryTime: 25,
            cacheHitRate: 0.85
        },
        aiMetrics: {
            requestsPerSecond: 5,
            averageResponseTime: 200,
            errorRate: 0.01,
            tokenUsage: 1000
        },
        ...overrides
    }),

    createMockHealthCheck: (overrides = {}) => ({
        status: 'healthy',
        timestamp: new Date(),
        uptime: 3600,
        version: '1.0.0',
        services: {
            database: {
                status: 'healthy',
                responseTime: 50,
                lastCheck: new Date(),
                details: {
                    connections: 25,
                    queriesPerSecond: 50
                }
            },
            ai: {
                status: 'healthy',
                responseTime: 200,
                lastCheck: new Date(),
                details: {
                    requestsPerSecond: 5,
                    tokenUsage: 1000
                }
            },
            blockchain: {
                status: 'healthy',
                responseTime: 300,
                lastCheck: new Date(),
                details: {
                    network: 'sepolia',
                    blockNumber: 18000000,
                    gasPrice: 50
                }
            },
            ats: {
                status: 'healthy',
                responseTime: 150,
                lastCheck: new Date(),
                details: {
                    connectedProviders: 3,
                    totalJobs: 1000,
                    totalCandidates: 5000
                }
            },
            cache: {
                status: 'healthy',
                responseTime: 25,
                lastCheck: new Date(),
                details: {
                    hitRate: 0.85,
                    memoryUsage: 0.3,
                    keys: 1000
                }
            },
            storage: {
                status: 'healthy',
                responseTime: 100,
                lastCheck: new Date(),
                details: {
                    usedSpace: 1000000000,
                    totalSpace: 10000000000,
                    fileCount: 100000
                }
            }
        },
        metrics: {
            totalRequests: 1000,
            errorRate: 0.02,
            averageResponseTime: 150,
            memoryUsage: 0.6,
            cpuUsage: 0.4,
            diskUsage: 0.3
        },
        lastChecks: {
            database: new Date(),
            ai: new Date(),
            blockchain: new Date(),
            ats: new Date(),
            cache: new Date(),
            storage: new Date()
        },
        ...overrides
    }),

    createMockAlert: (type: string, service: string, message: string, overrides = {}) => ({
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        service,
        message,
        timestamp: new Date(),
        resolved: false,
        ...overrides
    }),

    createMockCacheEntry: (key: string, value: any, ttl?: number, metadata?: any) => ({
        key,
        value,
        timestamp: new Date(),
        ttl: ttl || 300,
        metadata
    }),

    createMockCacheStats: (overrides = {}) => ({
        totalEntries: 100,
        hitCount: 85,
        missCount: 15,
        hitRate: 0.85,
        memoryUsage: 102400,
        oldestEntry: new Date(Date.now() - 3600000),
        newestEntry: new Date(),
        topKeys: [
            { key: 'test-key-1', hits: 10, lastAccess: new Date() },
            { key: 'test-key-2', hits: 8, lastAccess: new Date() },
            { key: 'test-key-3', hits: 5, lastAccess: new Date() }
        ],
        ...overrides
    })
};
