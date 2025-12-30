import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUiExpress from 'swagger-ui-express';
import { Express } from 'express';

// Swagger configuration
export const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'MockMate API',
            version: '1.0.0',
            description: 'Elite interview practice platform API documentation',
            contact: {
                name: 'MockMate Team',
                email: 'support@mockmate.com',
                url: 'https://mockmate.com'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: 'http://localhost:3001/api',
                description: 'Development server'
            },
            {
                url: 'https://api.mockmate.com/api',
                description: 'Production server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                },
                apiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    required: ['id', 'email', 'name', 'role'],
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Unique user identifier',
                            example: 'user_123456'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'User email address',
                            example: 'john.doe@example.com'
                        },
                        name: {
                            type: 'string',
                            description: 'User full name',
                            example: 'John Doe'
                        },
                        role: {
                            type: 'string',
                            enum: ['user', 'premium', 'enterprise', 'admin', 'superadmin'],
                            description: 'User role',
                            example: 'user'
                        },
                        permissions: {
                            type: 'array',
                            items: {
                                type: 'string'
                            },
                            description: 'User permissions',
                            example: ['read:profile', 'write:profile']
                        },
                        profile: {
                            type: 'object',
                            properties: {
                                skills: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'User skills',
                                    example: ['JavaScript', 'React', 'Node.js']
                                },
                                experience: {
                                    type: 'string',
                                    enum: ['entry', 'junior', 'mid', 'senior', 'executive'],
                                    description: 'Experience level',
                                    example: 'mid'
                                },
                                industry: {
                                    type: 'string',
                                    description: 'Industry',
                                    example: 'Technology'
                                },
                                goals: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Career goals',
                                    example: ['Get a job at FAANG']
                                }
                            }
                        },
                        preferences: {
                            type: 'object',
                            properties: {
                                language: {
                                    type: 'string',
                                    description: 'Preferred language',
                                    example: 'en'
                                },
                                timezone: {
                                    type: 'string',
                                    description: 'User timezone',
                                    example: 'America/New_York'
                                },
                                notifications: {
                                    type: 'object',
                                    properties: {
                                        email: {
                                            type: 'boolean',
                                            description: 'Email notifications enabled',
                                            example: true
                                        },
                                        push: {
                                            type: 'boolean',
                                            description: 'Push notifications enabled',
                                            example: true
                                        }
                                    }
                                }
                            }
                        },
                        subscription: {
                            type: 'object',
                            properties: {
                                plan: {
                                    type: 'string',
                                    enum: ['free', 'basic', 'premium', 'enterprise'],
                                    description: 'Subscription plan',
                                    example: 'premium'
                                },
                                status: {
                                    type: 'string',
                                    enum: ['active', 'trial', 'cancelled', 'expired'],
                                    description: 'Subscription status',
                                    example: 'active'
                                }
                            }
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'User creation timestamp',
                            example: '2024-01-01T00:00:00.000Z'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Last update timestamp',
                            example: '2024-01-01T00:00:00.000Z'
                        }
                    }
                },
                Session: {
                    type: 'object',
                    required: ['id', 'userId', 'context', 'status'],
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Unique session identifier',
                            example: 'session_123456'
                        },
                        userId: {
                            type: 'string',
                            description: 'User ID',
                            example: 'user_123456'
                        },
                        context: {
                            type: 'object',
                            required: ['targetRole'],
                            properties: {
                                targetRole: {
                                    type: 'string',
                                    description: 'Target interview role',
                                    example: 'Software Engineer'
                                },
                                experience: {
                                    type: 'string',
                                    enum: ['entry', 'junior', 'mid', 'senior', 'executive'],
                                    description: 'Experience level',
                                    example: 'mid'
                                },
                                industry: {
                                    type: 'string',
                                    description: 'Industry',
                                    example: 'Technology'
                                },
                                difficulty: {
                                    type: 'string',
                                    enum: ['easy', 'medium', 'hard', 'adaptive'],
                                    description: 'Interview difficulty',
                                    example: 'medium'
                                }
                            }
                        },
                        settings: {
                            type: 'object',
                            properties: {
                                enableVideo: {
                                    type: 'boolean',
                                    description: 'Enable video recording',
                                    example: true
                                },
                                enableAudio: {
                                    type: 'boolean',
                                    description: 'Enable audio recording',
                                    example: true
                                },
                                maxDuration: {
                                    type: 'integer',
                                    minimum: 5,
                                    maximum: 120,
                                    description: 'Maximum session duration in minutes',
                                    example: 60
                                },
                                questionCount: {
                                    type: 'integer',
                                    minimum: 1,
                                    maximum: 20,
                                    description: 'Number of questions',
                                    example: 10
                                }
                            }
                        },
                        status: {
                            type: 'string',
                            enum: ['active', 'paused', 'completed', 'cancelled'],
                            description: 'Session status',
                            example: 'active'
                        },
                        turns: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: {
                                        type: 'string',
                                        description: 'Turn ID'
                                    },
                                    question: {
                                        type: 'string',
                                        description: 'Interview question'
                                    },
                                    answer: {
                                        type: 'string',
                                        description: 'User answer'
                                    },
                                    timestamp: {
                                        type: 'string',
                                        format: 'date-time',
                                        description: 'Turn timestamp'
                                    },
                                    feedback: {
                                        type: 'object',
                                        properties: {
                                            score: {
                                                type: 'number',
                                                minimum: 0,
                                                maximum: 100,
                                                description: 'Turn score'
                                            },
                                            strengths: {
                                                type: 'array',
                                                items: { type: 'string' },
                                                description: 'Strengths identified'
                                            },
                                            improvements: {
                                                type: 'array',
                                                items: { type: 'string' },
                                                description: 'Areas for improvement'
                                            }
                                        }
                                    }
                                }
                            },
                            description: 'Interview turns'
                        },
                        metrics: {
                            type: 'object',
                            properties: {
                                duration: {
                                    type: 'integer',
                                    description: 'Session duration in seconds',
                                    example: 1800
                                },
                                score: {
                                    type: 'number',
                                    minimum: 0,
                                    maximum: 100,
                                    description: 'Overall session score',
                                    example: 85
                                },
                                completionRate: {
                                    type: 'number',
                                    minimum: 0,
                                    maximum: 1,
                                    description: 'Session completion rate',
                                    example: 0.8
                                }
                            }
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Session creation timestamp'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Last update timestamp'
                        }
                    }
                },
                Analytics: {
                    type: 'object',
                    required: ['userId', 'overview'],
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Analytics ID'
                        },
                        userId: {
                            type: 'string',
                            description: 'User ID'
                        },
                        overview: {
                            type: 'object',
                            properties: {
                                totalSessions: {
                                    type: 'integer',
                                    description: 'Total number of sessions',
                                    example: 25
                                },
                                completedSessions: {
                                    type: 'integer',
                                    description: 'Number of completed sessions',
                                    example: 20
                                },
                                averageScore: {
                                    type: 'number',
                                    minimum: 0,
                                    maximum: 100,
                                    description: 'Average session score',
                                    example: 85
                                },
                                totalDuration: {
                                    type: 'integer',
                                    description: 'Total practice time in minutes',
                                    example: 1800
                                }
                            }
                        },
                        skillBreakdown: {
                            type: 'object',
                            properties: {
                                technical: {
                                    type: 'number',
                                    description: 'Technical skills score',
                                    example: 85
                                },
                                behavioral: {
                                    type: 'number',
                                    description: 'Behavioral skills score',
                                    example: 80
                                },
                                communication: {
                                    type: 'number',
                                    description: 'Communication skills score',
                                    example: 90
                                }
                            }
                        },
                        progressTrend: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    date: {
                                        type: 'string',
                                        format: 'date',
                                        description: 'Date'
                                    },
                                    score: {
                                        type: 'number',
                                        description: 'Score for the date'
                                    },
                                    sessions: {
                                        type: 'integer',
                                        description: 'Number of sessions'
                                    }
                                }
                            },
                            description: 'Progress trend data'
                        },
                        achievements: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: {
                                        type: 'string',
                                        description: 'Achievement ID'
                                    },
                                    name: {
                                        type: 'string',
                                        description: 'Achievement name'
                                    },
                                    description: {
                                        type: 'string',
                                        description: 'Achievement description'
                                    },
                                    earnedAt: {
                                        type: 'string',
                                        format: 'date-time',
                                        description: 'When achievement was earned'
                                    }
                                }
                            },
                            description: 'User achievements'
                        }
                    }
                },
                Credential: {
                    type: 'object',
                    required: ['id', 'type', 'title', 'issuer', 'recipient'],
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Credential ID'
                        },
                        type: {
                            type: 'string',
                            enum: ['degree', 'certificate', 'skill_badge', 'experience', 'achievement'],
                            description: 'Credential type'
                        },
                        title: {
                            type: 'string',
                            description: 'Credential title'
                        },
                        issuer: {
                            type: 'string',
                            description: 'Issuing organization'
                        },
                        recipient: {
                            type: 'string',
                            description: 'Credential recipient'
                        },
                        issueDate: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Issue date'
                        },
                        metadata: {
                            type: 'object',
                            properties: {
                                description: {
                                    type: 'string',
                                    description: 'Credential description'
                                },
                                skills: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Skills verified'
                                },
                                level: {
                                    type: 'string',
                                    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
                                    description: 'Skill level'
                                }
                            }
                        },
                        blockchain: {
                            type: 'object',
                            properties: {
                                network: {
                                    type: 'string',
                                    description: 'Blockchain network'
                                },
                                contractAddress: {
                                    type: 'string',
                                    description: 'Smart contract address'
                                },
                                transactionHash: {
                                    type: 'string',
                                    description: 'Transaction hash'
                                },
                                blockNumber: {
                                    type: 'integer',
                                    description: 'Block number'
                                }
                            }
                        },
                        status: {
                            type: 'string',
                            enum: ['active', 'revoked', 'expired'],
                            description: 'Credential status'
                        }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Error message'
                        },
                        code: {
                            type: 'string',
                            description: 'Error code'
                        },
                        details: {
                            type: 'object',
                            description: 'Additional error details'
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Error timestamp'
                        }
                    }
                },
                Success: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            description: 'Success status'
                        },
                        message: {
                            type: 'string',
                            description: 'Success message'
                        },
                        data: {
                            type: 'object',
                            description: 'Response data'
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Response timestamp'
                        }
                    }
                }
            }
        }
    },
    apis: {
        '/api/auth': {
            description: 'Authentication endpoints',
            tags: ['Authentication'],
            paths: {
                '/register': {
                    post: {
                        summary: 'Register a new user',
                        tags: ['Authentication'],
                        requestBody: {
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        $ref: '#/components/schemas/User'
                                    }
                                }
                            }
                        },
                        responses: {
                            '201': {
                                description: 'User registered successfully',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                user: {
                                                    $ref: '#/components/schemas/User'
                                                },
                                                token: {
                                                    type: 'string',
                                                    description: 'JWT token'
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            '400': {
                                description: 'Validation error',
                                content: {
                                    'application/json': {
                                        schema: {
                                            $ref: '#/components/schemas/Error'
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                '/login': {
                    post: {
                        summary: 'Authenticate user',
                        tags: ['Authentication'],
                        requestBody: {
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        required: ['email', 'password'],
                                        properties: {
                                            email: {
                                                type: 'string',
                                                format: 'email'
                                            },
                                            password: {
                                                type: 'string',
                                                minLength: 8
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            '200': {
                                description: 'Authentication successful',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                token: {
                                                    type: 'string',
                                                    description: 'JWT token'
                                                },
                                                user: {
                                                    $ref: '#/components/schemas/User'
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            '401': {
                                description: 'Authentication failed',
                                content: {
                                    'application/json': {
                                        schema: {
                                            $ref: '#/components/schemas/Error'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/api/sessions': {
            description: 'Session management endpoints',
            tags: ['Sessions'],
            paths: {
                '/': {
                    post: {
                        summary: 'Create a new interview session',
                        tags: ['Sessions'],
                        security: [{ bearerAuth: [] }],
                        requestBody: {
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        $ref: '#/components/schemas/Session'
                                    }
                                }
                            }
                        },
                        responses: {
                            '201': {
                                description: 'Session created successfully',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                session: {
                                                    $ref: '#/components/schemas/Session'
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    '/:id': {
                        get: {
                            summary: 'Get session by ID',
                            tags: ['Sessions'],
                            security: [{ bearerAuth: [] }],
                            parameters: [
                                {
                                    name: 'id',
                                    in: 'path',
                                    required: true,
                                    schema: {
                                        type: 'string'
                                    }
                                }
                            ],
                            responses: {
                                '200': {
                                    description: 'Session retrieved successfully',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                type: 'object',
                                                properties: {
                                                    session: {
                                                        $ref: '#/components/schemas/Session'
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                '404': {
                                    description: 'Session not found',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                $ref: '#/components/schemas/Error'
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        put: {
                            summary: 'Update session',
                            tags: ['Sessions'],
                            security: [{ bearerAuth: [] }],
                            parameters: [
                                {
                                    name: 'id',
                                    in: 'path',
                                    required: true,
                                    schema: {
                                        type: 'string'
                                    }
                                }
                            ],
                            requestBody: {
                                required: true,
                                content: {
                                    'application/json': {
                                        schema: {
                                            $ref: '#/components/schemas/Session'
                                        }
                                    }
                                }
                            },
                            responses: {
                                '200': {
                                    description: 'Session updated successfully',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                type: 'object',
                                                properties: {
                                                    session: {
                                                        $ref: '#/components/schemas/Session'
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        delete: {
                            summary: 'Delete session',
                            tags: ['Sessions'],
                            security: [{ bearerAuth: [] }],
                            parameters: [
                                {
                                    name: 'id',
                                    in: 'path',
                                    required: true,
                                    schema: {
                                        type: 'string'
                                    }
                                }
                            ],
                            responses: {
                                '204': {
                                    description: 'Session deleted successfully'
                                },
                                '404': {
                                    description: 'Session not found',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                $ref: '#/components/schemas/Error'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/api/analytics': {
            description: 'Analytics endpoints',
            tags: ['Analytics'],
            paths: {
                '/overview/{userId}': {
                    get: {
                        summary: 'Get user analytics overview',
                        tags: ['Analytics'],
                        security: [{ bearerAuth: [] }],
                        parameters: [
                            {
                                name: 'userId',
                                in: 'path',
                                required: true,
                                schema: {
                                    type: 'string'
                                }
                            }
                        ],
                        responses: {
                            '200': {
                                description: 'Analytics retrieved successfully',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                analytics: {
                                                    $ref: '#/components/schemas/Analytics'
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                '/detailed/{userId}': {
                    get: {
                        summary: 'Get detailed analytics',
                        tags: ['Analytics'],
                        security: [{ bearerAuth: [] }],
                        parameters: [
                            {
                                name: 'userId',
                                in: 'path',
                                required: true,
                                schema: {
                                    type: 'string'
                                }
                            }
                        ],
                        responses: {
                            '200': {
                                description: 'Detailed analytics retrieved successfully',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                analytics: {
                                                    $ref: '#/components/schemas/Analytics'
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/api/blockchain': {
            description: 'Blockchain credential endpoints',
            tags: ['Blockchain'],
            paths: {
                '/issue-credential': {
                    post: {
                        summary: 'Issue a new blockchain credential',
                        tags: ['Blockchain'],
                        security: [{ bearerAuth: [] }],
                        requestBody: {
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        $ref: '#/components/schemas/Credential'
                                    }
                                }
                            }
                        },
                        responses: {
                            '201': {
                                description: 'Credential issued successfully',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                credential: {
                                                    $ref: '#/components/schemas/Credential'
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                '/verify/{credentialId}': {
                    get: {
                        summary: 'Verify blockchain credential',
                        tags: ['Blockchain'],
                        parameters: [
                            {
                                name: 'credentialId',
                                in: 'path',
                                required: true,
                                schema: {
                                    type: 'string'
                                }
                            }
                        ],
                        responses: {
                            '200': {
                                description: 'Credential verification result',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                verification: {
                                                    type: 'object',
                                                    properties: {
                                                        isValid: {
                                                            type: 'boolean'
                                                        },
                                                        credentialId: {
                                                            type: 'string'
                                                        },
                                                        verifiedAt: {
                                                            type: 'string',
                                                            format: 'date-time'
                                                        },
                                                        confidence: {
                                                            type: 'number'
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

// Swagger documentation setup
export const setupSwagger = (app: Express): void => {
    // Swagger UI setup
    app.use('/api-docs', swaggerUiExpress.serve);
    app.use('/api-docs', swaggerUiExpress.setup(swaggerOptions));
    
    // Swagger JSON endpoint
    app.get('/api-docs.json', (req: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerOptions);
    });
    
    console.log('📚 Swagger documentation available at /api-docs');
};
