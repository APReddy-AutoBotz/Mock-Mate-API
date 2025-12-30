import { APIError, ValidationError } from '../utils/errorHandler';

interface ATSProvider {
    name: string;
    type: 'greenhouse' | 'lever' | 'workday' | 'icims' | 'smartrecruiters' | 'custom';
    apiEndpoint: string;
    apiKey: string;
    version: string;
    features: string[];
    rateLimits: {
        requestsPerMinute: number;
        requestsPerHour: number;
        requestsPerDay: number;
    };
}

interface JobPosting {
    id: string;
    title: string;
    description: string;
    requirements: string[];
    qualifications: string[];
    responsibilities: string[];
    location: string;
    employmentType: 'full-time' | 'part-time' | 'contract' | 'internship';
    experience: 'entry' | 'mid' | 'senior' | 'executive';
    salary: {
        min: number;
        max: number;
        currency: string;
    };
    department: string;
    postedDate: Date;
    deadline?: Date;
    status: 'active' | 'closed' | 'draft';
    metadata: {
        source: string;
        externalId: string;
        tags: string[];
        category: string;
    };
}

interface Candidate {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    location: string;
    resume: {
        url: string;
        content: string;
        parsedData: {
            skills: string[];
            experience: Array<{
                company: string;
                position: string;
                duration: string;
                description: string[];
            }>;
            education: Array<{
                institution: string;
                degree: string;
                year: string;
            }>;
        };
    };
    applications: Array<{
        jobId: string;
        status: 'applied' | 'screening' | 'interview' | 'offered' | 'rejected' | 'withdrawn';
        appliedDate: Date;
        lastUpdated: Date;
        notes?: string;
    }>;
    metadata: {
        source: string;
        tags: string[];
        score?: number;
        fitScore?: number;
    };
}

interface Application {
    id: string;
    jobId: string;
    candidateId: string;
    status: 'applied' | 'screening' | 'interview' | 'offered' | 'rejected' | 'withdrawn';
    appliedDate: Date;
    lastUpdated: Date;
    screeningNotes?: string;
    interviewSchedule?: {
        date: Date;
        type: 'phone' | 'video' | 'onsite' | 'panel';
        interviewers: string[];
        location: string;
    };
    feedback: Array<{
        interviewerId: string;
        interviewerName: string;
        rating: number; // 1-5
        notes: string;
        strengths: string[];
        weaknesses: string[];
        recommendation: 'hire' | 'no-hire' | 'maybe';
        date: Date;
    }>;
    offer?: {
        salary: number;
        startDate: Date;
        deadline: Date;
        status: 'pending' | 'accepted' | 'rejected';
    };
}

interface ATSIntegration {
    provider: ATSProvider;
    isConnected: boolean;
    lastSync: Date;
    syncStatus: 'success' | 'error' | 'pending';
    statistics: {
        totalJobs: number;
        totalCandidates: number;
        totalApplications: number;
        activeJobs: number;
        recentApplications: number;
    };
}

class ATSIntegrationService {
    private providers: Map<string, ATSProvider> = new Map();
    private integrations: Map<string, ATSIntegration> = new Map();
    private webhooks: Map<string, {
        url: string;
        events: string[];
        secret: string;
        active: boolean;
    }> = new Map();

    constructor() {
        this.initializeProviders();
    }

    // Initialize ATS providers
    private initializeProviders(): void {
        const defaultProviders: ATSProvider[] = [
            {
                name: 'Greenhouse',
                type: 'greenhouse',
                apiEndpoint: 'https://harvest.greenhouse.io/v1',
                apiKey: process.env.GREENHOUSE_API_KEY || '',
                version: 'v1',
                features: ['job_posting', 'candidate_management', 'interview_scheduling', 'analytics'],
                rateLimits: {
                    requestsPerMinute: 60,
                    requestsPerHour: 1000,
                    requestsPerDay: 10000
                }
            },
            {
                name: 'Lever',
                type: 'lever',
                apiEndpoint: 'https://api.lever.co/v1',
                apiKey: process.env.LEVER_API_KEY || '',
                version: 'v1',
                features: ['job_posting', 'candidate_management', 'interview_kit', 'analytics'],
                rateLimits: {
                    requestsPerMinute: 100,
                    requestsPerHour: 5000,
                    requestsPerDay: 50000
                }
            },
            {
                name: 'Workday',
                type: 'workday',
                apiEndpoint: 'https://workday.com/api/v1',
                apiKey: process.env.WORKDAY_API_KEY || '',
                version: 'v1',
                features: ['job_posting', 'candidate_management', 'onboarding', 'analytics'],
                rateLimits: {
                    requestsPerMinute: 120,
                    requestsPerHour: 7200,
                    requestsPerDay: 86400
                }
            },
            {
                name: 'iCIMS',
                type: 'icims',
                apiEndpoint: 'https://api.icims.com/platform',
                apiKey: process.env.ICIMS_API_KEY || '',
                version: 'v2',
                features: ['job_posting', 'candidate_management', 'workflow', 'analytics'],
                rateLimits: {
                    requestsPerMinute: 200,
                    requestsPerHour: 12000,
                    requestsPerDay: 288000
                }
            }
        ];

        defaultProviders.forEach(provider => {
            this.providers.set(provider.name, provider);
        });
    }

    // Connect to ATS provider
    async connectProvider(providerName: string, apiKey: string): Promise<boolean> {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new ValidationError('Provider not found');
        }

        // Test connection
        const isConnected = await this.testConnection(provider, apiKey);
        
        if (isConnected) {
            // Update provider API key
            const updatedProvider = { ...provider, apiKey };
            this.providers.set(providerName, updatedProvider);

            // Create integration record
            const integration: ATSIntegration = {
                provider: updatedProvider,
                isConnected: true,
                lastSync: new Date(),
                syncStatus: 'success',
                statistics: {
                    totalJobs: 0,
                    totalCandidates: 0,
                    totalApplications: 0,
                    activeJobs: 0,
                    recentApplications: 0
                }
            };

            this.integrations.set(providerName, integration);
            
            // Set up webhooks
            await this.setupWebhooks(providerName);
        }

        return isConnected;
    }

    // Test connection to ATS provider
    private async testConnection(provider: ATSProvider, apiKey: string): Promise<boolean> {
        try {
            // Simulate API connection test
            const response = await this.makeAPIRequest(provider, '/test', 'GET', null, apiKey);
            return response.status === 'success';
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }

    // Make API request to ATS provider
    private async makeAPIRequest(
        provider: ATSProvider,
        endpoint: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        data?: any,
        apiKey?: string
    ): Promise<{
        status: string;
        data?: any;
        error?: string;
    }> {
        try {
            const url = `${provider.apiEndpoint}${endpoint}`;
            const headers = {
                'Authorization': `Bearer ${apiKey || provider.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            const options: RequestInit = {
                method,
                headers
            };

            if (data && method !== 'GET') {
                options.body = JSON.stringify(data);
            }

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // In production, would make actual HTTP request
            return {
                status: 'success',
                data: this.simulateResponse(provider, endpoint, method, data)
            };
        } catch (error) {
            console.error('API request failed:', error);
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    // Simulate API response
    private simulateResponse(
        provider: ATSProvider,
        endpoint: string,
        method: string,
        data?: any
    ): any {
        // Simulate different responses based on endpoint and method
        if (endpoint === '/test') {
            return { message: 'Connection successful' };
        }

        if (endpoint.includes('/jobs')) {
            if (method === 'GET') {
                return this.simulateJobsResponse(provider);
            } else if (method === 'POST') {
                return { id: 'job_' + Date.now(), ...data };
            }
        }

        if (endpoint.includes('/candidates')) {
            if (method === 'GET') {
                return this.simulateCandidatesResponse(provider);
            } else if (method === 'POST') {
                return { id: 'candidate_' + Date.now(), ...data };
            }
        }

        if (endpoint.includes('/applications')) {
            return this.simulateApplicationsResponse(provider);
        }

        return { message: 'Response simulated' };
    }

    // Simulate jobs response
    private simulateJobsResponse(provider: ATSProvider): any[] {
        const jobs = [
            {
                id: 'job_1',
                title: 'Senior Software Engineer',
                description: 'We are looking for a senior software engineer...',
                requirements: ['5+ years experience', 'JavaScript', 'React', 'Node.js'],
                qualifications: ['Bachelor\'s degree', 'Computer Science'],
                responsibilities: ['Develop web applications', 'Code review', 'Mentor junior developers'],
                location: 'San Francisco, CA',
                employmentType: 'full-time',
                experience: 'senior',
                salary: { min: 120000, max: 180000, currency: 'USD' },
                department: 'Engineering',
                postedDate: new Date(),
                status: 'active',
                metadata: {
                    source: provider.name,
                    externalId: 'ext_123',
                    tags: ['engineering', 'software', 'senior'],
                    category: 'Technology'
                }
            },
            {
                id: 'job_2',
                title: 'Product Manager',
                description: 'Join our product management team...',
                requirements: ['3+ years experience', 'Product strategy', 'Analytics'],
                qualifications: ['MBA or equivalent'],
                responsibilities: ['Product roadmap', 'User research', 'Stakeholder management'],
                location: 'New York, NY',
                employmentType: 'full-time',
                experience: 'mid',
                salary: { min: 100000, max: 150000, currency: 'USD' },
                department: 'Product',
                postedDate: new Date(),
                status: 'active',
                metadata: {
                    source: provider.name,
                    externalId: 'ext_456',
                    tags: ['product', 'strategy', 'analytics'],
                    category: 'Product'
                }
            }
        ];

        return jobs;
    }

    // Simulate candidates response
    private simulateCandidatesResponse(provider: ATSProvider): any[] {
        return [
            {
                id: 'candidate_1',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com',
                phone: '+1-555-123-4567',
                location: 'San Francisco, CA',
                resume: {
                    url: 'https://example.com/resume/john_doe.pdf',
                    content: 'Resume content...',
                    parsedData: {
                        skills: ['JavaScript', 'React', 'Node.js', 'Python'],
                        experience: [
                            {
                                company: 'Tech Corp',
                                position: 'Software Engineer',
                                duration: '2019-2023',
                                description: ['Developed web applications', 'Led team projects']
                            }
                        ],
                        education: [
                            {
                                institution: 'University of California',
                                degree: 'Bachelor of Science',
                                year: '2019'
                            }
                        ]
                    }
                },
                applications: [],
                metadata: {
                    source: provider.name,
                    tags: ['engineering', 'software'],
                    score: 85
                }
            }
        ];
    }

    // Simulate applications response
    private simulateApplicationsResponse(provider: ATSProvider): any[] {
        return [
            {
                id: 'app_1',
                jobId: 'job_1',
                candidateId: 'candidate_1',
                status: 'interview',
                appliedDate: new Date(),
                lastUpdated: new Date(),
                screeningNotes: 'Strong technical skills, good cultural fit',
                interviewSchedule: {
                    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    type: 'video',
                    interviewers: ['Jane Smith', 'Bob Johnson'],
                    location: 'Video call'
                },
                feedback: [
                    {
                        interviewerId: 'interviewer_1',
                        interviewerName: 'Jane Smith',
                        rating: 4,
                        notes: 'Good problem solving skills',
                        strengths: ['Technical knowledge', 'Communication'],
                        weaknesses: ['Could improve on system design'],
                        recommendation: 'hire',
                        date: new Date()
                    }
                ]
            }
        ];
    }

    // Sync jobs from ATS
    async syncJobs(providerName: string): Promise<{
        synced: number;
        updated: number;
        errors: string[];
    }> {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new ValidationError('Provider not found');
        }

        const integration = this.integrations.get(providerName);
        if (!integration || !integration.isConnected) {
            throw new ValidationError('Provider not connected');
        }

        try {
            const response = await this.makeAPIRequest(provider, '/jobs', 'GET');
            
            if (response.status === 'success') {
                const jobs = response.data;
                let synced = 0;
                let updated = 0;
                const errors: string[] = [];

                // Process each job
                for (const job of jobs) {
                    try {
                        // Check if job already exists
                        const existingJob = await this.getJobByExternalId(providerName, job.metadata.externalId);
                        
                        if (existingJob) {
                            // Update existing job
                            await this.updateJob(providerName, job.metadata.externalId, job);
                            updated++;
                        } else {
                            // Create new job
                            await this.createJob(providerName, job);
                            synced++;
                        }
                    } catch (error) {
                        errors.push(`Failed to sync job ${job.id}: ${error.message}`);
                    }
                }

                // Update integration stats
                integration.lastSync = new Date();
                integration.syncStatus = errors.length === 0 ? 'success' : 'error';
                integration.statistics.totalJobs = synced + updated;

                return { synced, updated, errors };
            } else {
                throw new APIError('Failed to fetch jobs from ATS');
            }
        } catch (error) {
            console.error('Error syncing jobs:', error);
            throw new APIError('Failed to sync jobs');
        }
    }

    // Sync candidates from ATS
    async syncCandidates(providerName: string): Promise<{
        synced: number;
        updated: number;
        errors: string[];
    }> {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new ValidationError('Provider not found');
        }

        const integration = this.integrations.get(providerName);
        if (!integration || !integration.isConnected) {
            throw new ValidationError('Provider not connected');
        }

        try {
            const response = await this.makeAPIRequest(provider, '/candidates', 'GET');
            
            if (response.status === 'success') {
                const candidates = response.data;
                let synced = 0;
                let updated = 0;
                const errors: string[] = [];

                for (const candidate of candidates) {
                    try {
                        const existingCandidate = await this.getCandidateByExternalId(providerName, candidate.id);
                        
                        if (existingCandidate) {
                            await this.updateCandidate(providerName, candidate.id, candidate);
                            updated++;
                        } else {
                            await this.createCandidate(providerName, candidate);
                            synced++;
                        }
                    } catch (error) {
                        errors.push(`Failed to sync candidate ${candidate.id}: ${error.message}`);
                    }
                }

                integration.lastSync = new Date();
                integration.statistics.totalCandidates = synced + updated;

                return { synced, updated, errors };
            } else {
                throw new APIError('Failed to fetch candidates from ATS');
            }
        } catch (error) {
            console.error('Error syncing candidates:', error);
            throw new APIError('Failed to sync candidates');
        }
    }

    // Post job to ATS
    async postJob(providerName: string, job: Omit<JobPosting, 'id' | 'metadata'>): Promise<string> {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new ValidationError('Provider not found');
        }

        const jobWithMetadata = {
            ...job,
            metadata: {
                source: provider.name,
                externalId: `mockmate_${Date.now()}`,
                tags: job.requirements,
                category: 'Technology'
            }
        };

        const response = await this.makeAPIRequest(provider, '/jobs', 'POST', jobWithMetadata);
        
        if (response.status === 'success') {
            return response.data.id;
        } else {
            throw new APIError('Failed to post job to ATS');
        }
    }

    // Submit application to ATS
    async submitApplication(
        providerName: string,
        application: Omit<Application, 'id'>
    ): Promise<string> {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new ValidationError('Provider not found');
        }

        const response = await this.makeAPIRequest(provider, '/applications', 'POST', application);
        
        if (response.status === 'success') {
            return response.data.id;
        } else {
            throw new APIError('Failed to submit application to ATS');
        }
    }

    // Update application status
    async updateApplicationStatus(
        providerName: string,
        applicationId: string,
        status: Application['status'],
        notes?: string
    ): Promise<void> {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new ValidationError('Provider not found');
        }

        const response = await this.makeAPIRequest(provider, `/applications/${applicationId}`, 'PUT', {
            status,
            notes,
            lastUpdated: new Date()
        });

        if (response.status !== 'success') {
            throw new APIError('Failed to update application status');
        }
    }

    // Get jobs from ATS
    async getJobs(providerName: string, filters?: {
        status?: JobPosting['status'];
        department?: string;
        location?: string;
    }): Promise<JobPosting[]> {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new ValidationError('Provider not found');
        }

        const response = await this.makeAPIRequest(provider, '/jobs', 'GET');
        
        if (response.status === 'success') {
            let jobs = response.data;
            
            // Apply filters
            if (filters) {
                if (filters.status) {
                    jobs = jobs.filter(job => job.status === filters.status);
                }
                if (filters.department) {
                    jobs = jobs.filter(job => job.department === filters.department);
                }
                if (filters.location) {
                    jobs = jobs.filter(job => job.location.includes(filters.location));
                }
            }

            return jobs;
        } else {
            throw new APIError('Failed to fetch jobs from ATS');
        }
    }

    // Get candidates from ATS
    async getCandidates(providerName: string): Promise<Candidate[]> {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new ValidationError('Provider not found');
        }

        const response = await this.makeAPIRequest(provider, '/candidates', 'GET');
        
        if (response.status === 'success') {
            return response.data;
        } else {
            throw new APIError('Failed to fetch candidates from ATS');
        }
    }

    // Get applications from ATS
    async getApplications(
        providerName: string,
        filters?: {
            jobId?: string;
            candidateId?: string;
            status?: Application['status'];
        }
    ): Promise<Application[]> {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new ValidationError('Provider not found');
        }

        const response = await this.makeAPIRequest(provider, '/applications', 'GET');
        
        if (response.status === 'success') {
            let applications = response.data;
            
            // Apply filters
            if (filters) {
                if (filters.jobId) {
                    applications = applications.filter(app => app.jobId === filters.jobId);
                }
                if (filters.candidateId) {
                    applications = applications.filter(app => app.candidateId === filters.candidateId);
                }
                if (filters.status) {
                    applications = applications.filter(app => app.status === filters.status);
                }
            }

            return applications;
        } else {
            throw new APIError('Failed to fetch applications from ATS');
        }
    }

    // Set up webhooks
    private async setupWebhooks(providerName: string): Promise<void> {
        const webhookUrl = `${window.location.origin}/webhooks/ats/${providerName}`;
        const secret = this.generateWebhookSecret();
        
        const webhook = {
            url: webhookUrl,
            events: ['job.created', 'job.updated', 'candidate.created', 'application.updated'],
            secret,
            active: true
        };

        this.webhooks.set(providerName, webhook);

        // In production, would register webhook with ATS provider
        console.log(`Webhook set up for ${providerName}: ${webhookUrl}`);
    }

    // Handle webhook event
    async handleWebhook(
        providerName: string,
        event: string,
        data: any,
        signature: string
    ): Promise<void> {
        const webhook = this.webhooks.get(providerName);
        if (!webhook || !webhook.active) {
            throw new ValidationError('Webhook not found or inactive');
        }

        // Verify signature
        const isValid = this.verifyWebhookSignature(data, signature, webhook.secret);
        if (!isValid) {
            throw new ValidationError('Invalid webhook signature');
        }

        // Process webhook event
        await this.processWebhookEvent(providerName, event, data);
    }

    // Verify webhook signature
    private verifyWebhookSignature(data: any, signature: string, secret: string): boolean {
        // In production, would use HMAC verification
        // For now, simulate verification
        return signature.length > 0;
    }

    // Process webhook event
    private async processWebhookEvent(providerName: string, event: string, data: any): Promise<void> {
        switch (event) {
            case 'job.created':
                await this.handleJobCreated(providerName, data);
                break;
            case 'job.updated':
                await this.handleJobUpdated(providerName, data);
                break;
            case 'candidate.created':
                await this.handleCandidateCreated(providerName, data);
                break;
            case 'application.updated':
                await this.handleApplicationUpdated(providerName, data);
                break;
            default:
                console.warn(`Unknown webhook event: ${event}`);
        }
    }

    // Handle webhook events
    private async handleJobCreated(providerName: string, data: any): Promise<void> {
        console.log(`Job created in ${providerName}:`, data);
        // In production, would update local database
    }

    private async handleJobUpdated(providerName: string, data: any): Promise<void> {
        console.log(`Job updated in ${providerName}:`, data);
        // In production, would update local database
    }

    private async handleCandidateCreated(providerName: string, data: any): Promise<void> {
        console.log(`Candidate created in ${providerName}:`, data);
        // In production, would update local database
    }

    private async handleApplicationUpdated(providerName: string, data: any): Promise<void> {
        console.log(`Application updated in ${providerName}:`, data);
        // In production, would update local database
    }

    // Helper methods
    private generateWebhookSecret(): string {
        return 'webhook_' + Math.random().toString(36).substr(2, 32);
    }

    private async createJob(providerName: string, job: JobPosting): Promise<void> {
        // In production, would save to local database
        console.log(`Created job in ${providerName}:`, job.id);
    }

    private async updateJob(providerName: string, externalId: string, job: JobPosting): Promise<void> {
        // In production, would update local database
        console.log(`Updated job in ${providerName}:`, externalId);
    }

    private async getJobByExternalId(providerName: string, externalId: string): Promise<JobPosting | null> {
        // In production, would query local database
        return null;
    }

    private async createCandidate(providerName: string, candidate: Candidate): Promise<void> {
        // In production, would save to local database
        console.log(`Created candidate in ${providerName}:`, candidate.id);
    }

    private async updateCandidate(providerName: string, candidateId: string, candidate: Candidate): Promise<void> {
        // In production, would update local database
        console.log(`Updated candidate in ${providerName}:`, candidateId);
    }

    private async getCandidateByExternalId(providerName: string, candidateId: string): Promise<Candidate | null> {
        // In production, would query local database
        return null;
    }

    // Get integration status
    getIntegrationStatus(providerName: string): ATSIntegration | null {
        return this.integrations.get(providerName) || null;
    }

    // Get all integrations
    getAllIntegrations(): ATSIntegration[] {
        return Array.from(this.integrations.values());
    }

    // Disconnect provider
    async disconnectProvider(providerName: string): Promise<void> {
        const integration = this.integrations.get(providerName);
        if (integration) {
            integration.isConnected = false;
            integration.syncStatus = 'error';
            
            // Remove webhook
            this.webhooks.delete(providerName);
            
            console.log(`Disconnected from ${providerName}`);
        }
    }

    // Get provider statistics
    async getProviderStatistics(providerName: string): Promise<{
        jobs: number;
        candidates: number;
        applications: number;
        recentActivity: number;
        syncStatus: string;
        lastSync: Date;
    }> {
        const integration = this.integrations.get(providerName);
        if (!integration) {
            throw new ValidationError('Integration not found');
        }

        return {
            jobs: integration.statistics.totalJobs,
            candidates: integration.statistics.totalCandidates,
            applications: integration.statistics.totalApplications,
            recentActivity: integration.statistics.recentApplications,
            syncStatus: integration.syncStatus,
            lastSync: integration.lastSync
        };
    }

    // Get available providers
    getAvailableProviders(): ATSProvider[] {
        return Array.from(this.providers.values());
    }

    // Add custom provider
    addCustomProvider(provider: ATSProvider): string {
        this.providers.set(provider.name, provider);
        return provider.name;
    }
}

export const atsIntegrationService = new ATSIntegrationService();
export default atsIntegrationService;
