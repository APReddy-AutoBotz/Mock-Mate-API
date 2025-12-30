import { db, Timestamp } from '../firebase';

// Migration interface
interface Migration {
    id: string;
    name: string;
    version: string;
    description: string;
    up: () => Promise<void>;
    down: () => Promise<void>;
    createdAt: Timestamp;
    appliedAt?: Timestamp;
}

// Migration registry
const migrations: Migration[] = [
    {
        id: '001',
        name: 'create_users_collection',
        version: '1.0.0',
        description: 'Create users collection with basic user schema',
        createdAt: Timestamp.now(),
        up: async () => {
            // Create sample users collection structure
            const sampleUser = {
                id: 'user_123',
                email: 'john.doe@example.com',
                name: 'John Doe',
                role: 'user',
                permissions: ['read:profile', 'write:profile', 'read:sessions'],
                profile: {
                    skills: ['JavaScript', 'React', 'Node.js'],
                    experience: 'mid',
                    industry: 'Technology',
                    goals: ['Get a job at FAANG', 'Improve technical skills'],
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
                    plan: 'free',
                    status: 'active',
                    expiresAt: null
                },
                metadata: {
                    source: 'web',
                    referral: null,
                    campaign: null
                },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                isActive: true,
                lastLogin: Timestamp.now()
            };

            await db.collection('users').doc(sampleUser.id).set(sampleUser);
            console.log('✅ Created users collection structure');
        },
        down: async () => {
            // Remove users collection
            const usersSnapshot = await db.collection('users').get();
            const batch = db.batch();
            
            usersSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log('✅ Dropped users collection');
        }
    },
    {
        id: '002',
        name: 'create_sessions_collection',
        version: '1.0.0',
        description: 'Create sessions collection for interview sessions',
        createdAt: Timestamp.now(),
        up: async () => {
            const sampleSession = {
                id: 'session_456',
                userId: 'user_123',
                context: {
                    targetRole: 'Software Engineer',
                    experience: 'mid',
                    industry: 'Technology',
                    difficulty: 'medium',
                    language: 'en'
                },
                settings: {
                    enableVideo: true,
                    enableAudio: true,
                    enableTranscription: true,
                    enableRecording: false,
                    maxDuration: 60,
                    questionCount: 10,
                    questionTypes: ['behavioral', 'technical', 'situational'],
                    aiAssistance: true
                },
                preferences: {
                    pace: 'normal',
                    feedbackLevel: 'detailed',
                    language: 'en'
                },
                status: 'active',
                turns: [
                    {
                        id: 'turn_1',
                        question: 'Tell me about yourself',
                        answer: 'I am a software engineer with 5 years of experience...',
                        timestamp: Timestamp.now(),
                        feedback: {
                            score: 85,
                            strengths: ['Clear communication'],
                            improvements: ['Add more specific examples'],
                            aiAnalysis: 'Good response with relevant experience'
                        }
                    }
                ],
                metrics: {
                    duration: 1800, // seconds
                    score: 85,
                    completionRate: 0.8,
                    engagement: 0.9,
                    sentiment: 'positive'
                },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) // 7 days
            };

            await db.collection('sessions').doc(sampleSession.id).set(sampleSession);
            console.log('✅ Created sessions collection structure');
        },
        down: async () => {
            const sessionsSnapshot = await db.collection('sessions').get();
            const batch = db.batch();
            
            sessionsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log('✅ Dropped sessions collection');
        }
    },
    {
        id: '003',
        name: 'create_analytics_collection',
        version: '1.0.0',
        description: 'Create analytics collection for user analytics and reports',
        createdAt: Timestamp.now(),
        up: async () => {
            const sampleAnalytics = {
                id: 'analytics_789',
                userId: 'user_123',
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
                    communication: 90,
                    problemSolving: 75,
                    leadership: 70
                },
                progressTrend: [
                    { date: '2024-01-01', score: 75, sessions: 3 },
                    { date: '2024-01-02', score: 78, sessions: 2 },
                    { date: '2024-01-03', score: 82, sessions: 4 }
                ],
                achievements: [
                    {
                        id: 'achievement_1',
                        name: 'First Interview',
                        description: 'Completed your first interview session',
                        earnedAt: Timestamp.now(),
                        category: 'milestone'
                    }
                ],
                recommendations: [
                    {
                        id: 'rec_1',
                        type: 'skill',
                        title: 'Improve System Design',
                        description: 'Focus on system design patterns and scalability',
                        priority: 'high',
                        resources: ['system-design-interview.com', 'designpatterns.info']
                    }
                ],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            await db.collection('analytics').doc(sampleAnalytics.id).set(sampleAnalytics);
            console.log('✅ Created analytics collection structure');
        },
        down: async () => {
            const analyticsSnapshot = await db.collection('analytics').get();
            const batch = db.batch();
            
            analyticsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log('✅ Dropped analytics collection');
        }
    },
    {
        id: '004',
        name: 'create_credentials_collection',
        version: '1.0.0',
        description: 'Create credentials collection for blockchain verification',
        createdAt: Timestamp.now(),
        up: async () => {
            const sampleCredential = {
                id: 'cred_012',
                type: 'degree',
                title: 'Bachelor of Science in Computer Science',
                issuer: 'University of California',
                recipient: 'user_123',
                issueDate: Timestamp.fromDate(new Date('2019-06-15')),
                metadata: {
                    description: 'Bachelor degree in Computer Science',
                    skills: ['Programming', 'Algorithms', 'Data Structures'],
                    level: 'undergraduate',
                    verificationMethod: 'blockchain'
                },
                blockchain: {
                    network: 'sepolia',
                    contractAddress: '0x123456789012345678901234567890',
                    transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
                    blockNumber: 18000000 + Math.floor(Math.random() * 1000)
                },
                status: 'active',
                verificationCount: 0,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            await db.collection('credentials').doc(sampleCredential.id).set(sampleCredential);
            console.log('✅ Created credentials collection structure');
        },
        down: async () => {
            const credentialsSnapshot = await db.collection('credentials').get();
            const batch = db.batch();
            
            credentialsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log('✅ Dropped credentials collection');
        }
    },
    {
        id: '005',
        name: 'create_webhooks_collection',
        version: '1.0.0',
        description: 'Create webhooks collection for ATS integrations',
        createdAt: Timestamp.now(),
        up: async () => {
            const sampleWebhook = {
                id: 'webhook_345',
                provider: 'greenhouse',
                url: 'https://mockmate.com/webhooks/ats/greenhouse',
                events: ['job.created', 'job.updated', 'candidate.created', 'application.updated'],
                secret: 'webhook_' + Math.random().toString(36).substr(2, 32),
                active: true,
                lastTriggered: Timestamp.now(),
                triggerCount: 0,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            await db.collection('webhooks').doc(sampleWebhook.id).set(sampleWebhook);
            console.log('✅ Created webhooks collection structure');
        },
        down: async () => {
            const webhooksSnapshot = await db.collection('webhooks').get();
            const batch = db.batch();
            
            webhooksSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log('✅ Dropped webhooks collection');
        }
    },
    {
        id: '006',
        name: 'create_api_keys_collection',
        version: '1.0.0',
        description: 'Create API keys collection for external integrations',
        createdAt: Timestamp.now(),
        up: async () => {
            const sampleApiKey = {
                id: 'key_678',
                userId: 'user_123',
                name: 'Production API Key',
                key: 'api_' + Math.random().toString(36).substr(2, 32),
                permissions: ['read:analytics', 'write:sessions', 'read:reports'],
                isActive: true,
                expiresAt: Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)), // 1 year
                lastUsed: Timestamp.now(),
                usageCount: 0,
                rateLimit: {
                    requestsPerMinute: 100,
                    requestsPerHour: 5000,
                    requestsPerDay: 50000
                },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            await db.collection('apiKeys').doc(sampleApiKey.id).set(sampleApiKey);
            console.log('✅ Created API keys collection structure');
        },
        down: async () => {
            const apiKeysSnapshot = await db.collection('apiKeys').get();
            const batch = db.batch();
            
            apiKeysSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log('✅ Dropped API keys collection');
        }
    },
    {
        id: '007',
        name: 'create_migration_tracking',
        version: '1.0.0',
        description: 'Create migration tracking collection',
        createdAt: Timestamp.now(),
        up: async () => {
            // This collection will track applied migrations
            console.log('✅ Migration tracking will be handled in the migration runner');
        },
        down: async () => {
            const migrationSnapshot = await db.collection('migrations').get();
            const batch = db.batch();
            
            migrationSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log('✅ Dropped migration tracking collection');
        }
    }
];

// Migration runner class
export class MigrationRunner {
    private static instance: MigrationRunner;
    private migrationsCollection = 'migrations';

    static getInstance(): MigrationRunner {
        if (!MigrationRunner.instance) {
            MigrationRunner.instance = new MigrationRunner();
        }
        return MigrationRunner.instance;
    }

    // Get all migrations
    private async getAppliedMigrations(): Promise<string[]> {
        const snapshot = await db.collection(this.migrationsCollection).get();
        return snapshot.docs.map(doc => doc.id);
    }

    // Record migration as applied
    private async recordMigration(migration: Migration): Promise<void> {
        await db.collection(this.migrationsCollection).doc(migration.id).set({
            id: migration.id,
            name: migration.name,
            version: migration.version,
            description: migration.description,
            appliedAt: Timestamp.now(),
            createdAt: migration.createdAt
        });
    }

    // Remove migration record
    private async removeMigrationRecord(migrationId: string): Promise<void> {
        await db.collection(this.migrationsCollection).doc(migrationId).delete();
    }

    // Run pending migrations
    async runMigrations(): Promise<void> {
        console.log('🚀 Running database migrations...');
        
        const appliedMigrations = await this.getAppliedMigrations();
        const pendingMigrations = migrations.filter(m => !appliedMigrations.includes(m.id));
        
        if (pendingMigrations.length === 0) {
            console.log('✅ No pending migrations to run');
            return;
        }

        console.log(`📋 Found ${pendingMigrations.length} pending migrations`);
        
        for (const migration of pendingMigrations) {
            try {
                console.log(`⬆️  Running migration: ${migration.name} (${migration.id})`);
                
                await migration.up();
                await this.recordMigration(migration);
                
                console.log(`✅ Migration ${migration.name} completed successfully`);
            } catch (error) {
                console.error(`❌ Migration ${migration.name} failed:`, error);
                throw error;
            }
        }
        
        console.log('🎉 All migrations completed successfully');
    }

    // Rollback migrations
    async rollbackMigrations(targetVersion?: string): Promise<void> {
        console.log('🔄 Rolling back database migrations...');
        
        const appliedMigrations = await this.getAppliedMigrations();
        const appliedMigrationObjs = migrations.filter(m => appliedMigrations.includes(m.id));
        
        let migrationsToRollback = appliedMigrationObjs;
        
        if (targetVersion) {
            const targetIndex = appliedMigrationObjs.findIndex(m => m.version === targetVersion);
            if (targetIndex === -1) {
                throw new Error(`Target version ${targetVersion} not found`);
            }
            migrationsToRollback = appliedMigrationObjs.slice(targetIndex + 1);
        }

        if (migrationsToRollback.length === 0) {
            console.log('✅ No migrations to rollback');
            return;
        }

        console.log(`📋 Rolling back ${migrationsToRollback.length} migrations`);
        
        // Rollback in reverse order
        for (const migration of migrationsToRollback.reverse()) {
            try {
                console.log(`⬇️  Rolling back migration: ${migration.name} (${migration.id})`);
                
                await migration.down();
                await this.removeMigrationRecord(migration.id);
                
                console.log(`✅ Migration ${migration.name} rolled back successfully`);
            } catch (error) {
                console.error(`❌ Migration ${migration.name} rollback failed:`, error);
                throw error;
            }
        }
        
        console.log('🎉 Rollback completed successfully');
    }

    // Get migration status
    async getMigrationStatus(): Promise<{
        total: number;
        applied: number;
        pending: number;
        appliedMigrations: Array<{ id: string; name: string; version: string; appliedAt: Timestamp }>;
        pendingMigrations: Array<{ id: string; name: string; version: string; description: string }>;
    }> {
        const appliedMigrations = await this.getAppliedMigrations();
        const appliedMigrationObjs = migrations.filter(m => appliedMigrations.includes(m.id));
        const pendingMigrations = migrations.filter(m => !appliedMigrations.includes(m.id));
        
        const appliedDetails = [];
        for (const migration of appliedMigrationObjs) {
            const doc = await db.collection(this.migrationsCollection).doc(migration.id).get();
            if (doc.exists) {
                appliedDetails.push({
                    id: migration.id,
                    name: migration.name,
                    version: migration.version,
                    appliedAt: doc.data()!.appliedAt
                });
            }
        }

        return {
            total: migrations.length,
            applied: appliedMigrations.length,
            pending: pendingMigrations.length,
            appliedMigrations: appliedDetails,
            pendingMigrations: pendingMigrations.map(m => ({
                id: m.id,
                name: m.name,
                version: m.version,
                description: m.description
            }))
        };
    }

    // Validate migration integrity
    async validateMigrations(): Promise<boolean> {
        try {
            const status = await this.getMigrationStatus();
            
            // Check if migration sequence is correct
            const appliedIds = status.appliedMigrations.map(m => m.id);
            const expectedIds = migrations.slice(0, appliedIds.length).map(m => m.id);
            
            const sequenceValid = JSON.stringify(appliedIds) === JSON.stringify(expectedIds);
            
            if (!sequenceValid) {
                console.error('❌ Migration sequence is corrupted');
                return false;
            }
            
            console.log('✅ Migration integrity validated successfully');
            return true;
        } catch (error) {
            console.error('❌ Migration validation failed:', error);
            return false;
        }
    }

    // Create new migration
    createMigration(
        id: string,
        name: string,
        version: string,
        description: string,
        up: () => Promise<void>,
        down: () => Promise<void>
    ): Migration {
        return {
            id,
            name,
            version,
            description,
            up,
            down,
            createdAt: Timestamp.now()
        };
    }
}

// Export migration runner instance
export const migrationRunner = MigrationRunner.getInstance();

// Export migrations for external use
export { migrations };

// Auto-run migrations on import (optional)
if (process.env.AUTO_RUN_MIGRATIONS === 'true') {
    migrationRunner.runMigrations().catch(console.error);
}
