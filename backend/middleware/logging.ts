import { Request, Response, RequestHandler } from 'express';
import { db, Timestamp } from '../firebase';

interface LogEntry {
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    message: string;
    meta?: {
        userId?: string;
        sessionId?: string;
        requestId?: string;
        ip?: string;
        userAgent?: string;
        method?: string;
        url?: string;
        statusCode?: number;
        responseTime?: number;
        error?: {
            name: string;
            message: string;
            stack?: string;
        };
        business?: {
            action?: string;
            resource?: string;
            result?: string;
            value?: any;
        };
    };
}

interface MetricsData {
    totalRequests: number;
    totalErrors: number;
    averageResponseTime: number;
    requestsPerMinute: number;
    errorRate: number;
    topErrors: Array<{
        error: string;
        count: number;
        lastOccurrence: Date;
    }>;
    userMetrics: {
        activeUsers: number;
        newUsers: number;
        premiumUsers: number;
        enterpriseUsers: number;
    };
    apiMetrics: {
        sessions: number;
        analytics: number;
        aiServices: number;
        blockchain: number;
        ats: number;
    };
}

class LoggingService {
    private static instance: LoggingService;
    private logs: LogEntry[] = [];
    private metrics: MetricsData;
    private logBuffer: LogEntry[] = [];
    private maxBufferSize = 1000;
    private logLevel: string = process.env.LOG_LEVEL || 'info';
    private enableConsole: process.env.ENABLE_CONSOLE_LOG !== 'false';
    private enableDatabase: process.env.ENABLE_DB_LOGGING === 'true';
    private enableMetrics: process.env.ENABLE_METRICS !== 'false';
    private metricsInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.metrics = {
            totalRequests: 0,
            totalErrors: 0,
            averageResponseTime: 0,
            requestsPerMinute: 0,
            errorRate: 0,
            topErrors: [],
            userMetrics: {
                activeUsers: 0,
                newUsers: 0,
                premiumUsers: 0,
                enterpriseUsers: 0
            },
            apiMetrics: {
                sessions: 0,
                analytics: 0,
                aiServices: 0,
                blockchain: 0,
                ats: 0
            }
        };

        if (this.enableMetrics) {
            this.startMetricsCollection();
        }

        if (this.enableDatabase) {
            this.setupDatabaseLogging();
        }
    }

    static getInstance(): LoggingService {
        if (!LoggingService.instance) {
            LoggingService.instance = new LoggingService();
        }
        return LoggingService.instance;
    }

    // Log entry creation
    private createLogEntry(
        level: LogEntry['level'],
        message: string,
        meta?: LogEntry['meta']
    ): LogEntry {
        return {
            timestamp: new Date(),
            level,
            message,
            meta
        };
    }

    // Main logging method
    log(level: LogEntry['level'], message: string, meta?: LogEntry['meta']): void {
        if (!this.shouldLog(level)) {
            return;
        }

        const logEntry = this.createLogEntry(level, message, meta);
        
        // Add to buffer
        this.logBuffer.push(logEntry);
        
        // Trim buffer if necessary
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
        }

        // Console logging
        if (this.enableConsole) {
            this.logToConsole(logEntry);
        }

        // Database logging
        if (this.enableDatabase) {
            this.logToDatabase(logEntry);
        }

        // Update metrics
        if (this.enableMetrics) {
            this.updateMetrics(logEntry);
        }
    }

    // Check if log level should be logged
    private shouldLog(level: LogEntry['level']): boolean {
        const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const logLevelIndex = levels.indexOf(level);
        return logLevelIndex >= currentLevelIndex;
    }

    // Console logging with formatting
    private logToConsole(logEntry: LogEntry): void {
        const timestamp = logEntry.timestamp.toISOString();
        const level = logEntry.level.toUpperCase();
        const message = logEntry.message;
        
        const metaString = logEntry.meta ? 
            ` | ${JSON.stringify(logEntry.meta)}` : '';
        
        const logMessage = `[${timestamp}] ${level}: ${message}${metaString}`;
        
        switch (logEntry.level) {
            case 'debug':
                console.debug(logMessage);
                break;
            case 'info':
                console.info(logMessage);
                break;
            case 'warn':
                console.warn(logMessage);
                break;
            case 'error':
                console.error(logMessage);
                break;
            case 'fatal':
                console.error(logMessage);
                break;
            default:
                console.log(logMessage);
        }
    }

    // Database logging
    private async logToDatabase(logEntry: LogEntry): Promise<void> {
        try {
            await db.collection('logs').add({
                ...logEntry,
                timestamp: Timestamp.fromDate(logEntry.timestamp)
            });
        } catch (error) {
            console.error('Failed to log to database:', error);
        }
    }

    // Update metrics
    private updateMetrics(logEntry: LogEntry): void {
        this.metrics.totalRequests++;
        
        if (logEntry.level === 'error' || logEntry.level === 'fatal') {
            this.metrics.totalErrors++;
        }

        if (logEntry.meta?.responseTime) {
            this.updateAverageResponseTime(logEntry.meta.responseTime);
        }

        if (logEntry.meta?.userId) {
            this.updateUserMetrics(logEntry.meta.userId);
        }

        if (logEntry.meta?.requestId) {
            this.updateApiMetrics(logEntry.meta.requestId);
        }

        if (logEntry.error) {
            this.updateTopErrors(logEntry.error);
        }

        // Calculate requests per minute
        this.calculateRequestsPerMinute();
        this.calculateErrorRate();
    }

    // Update average response time
    private updateAverageResponseTime(responseTime: number): void {
        const currentAvg = this.metrics.averageResponseTime;
        const count = this.metrics.totalRequests;
        this.metrics.averageResponseTime = (currentAvg * (count - 1) + responseTime) / count;
    }

    // Update user metrics
    private updateUserMetrics(userId: string): void {
        // In production, would query database for user role
        // For now, simulate user metrics
        this.metrics.userMetrics.activeUsers++;
    }

    // Update API metrics
    private updateApiMetrics(requestId: string): void {
        // In production, would parse request ID to determine API type
        // For now, simulate API metrics
        if (requestId.includes('session')) {
            this.metrics.apiMetrics.sessions++;
        } else if (requestId.includes('analytics')) {
            this.metrics.apiMetrics.analytics++;
        } else if (requestId.includes('ai')) {
            this.metrics.apiMetrics.aiServices++;
        } else if (requestId.includes('blockchain')) {
            this.metrics.apiMetrics.blockchain++;
        } else if (requestId.includes('ats')) {
            this.metrics.apiMetrics.ats++;
        }
    }

    // Update top errors
    private updateTopErrors(error: any): void {
        const errorMessage = error.message || error.toString();
        const existingError = this.metrics.topErrors.find(e => e.error === errorMessage);
        
        if (existingError) {
            existingError.count++;
            existingError.lastOccurrence = new Date();
        } else {
            this.metrics.topErrors.push({
                error: errorMessage,
                count: 1,
                lastOccurrence: new Date()
            });
        }

        // Keep only top 10 errors
        this.metrics.topErrors.sort((a, b) => b.count - a.count);
        this.metrics.topErrors = this.metrics.topErrors.slice(0, 10);
    }

    // Calculate requests per minute
    private calculateRequestsPerMinute(): void {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const recentRequests = this.logBuffer.filter(
            log => log.timestamp.getTime() > oneMinuteAgo
        );
        this.metrics.requestsPerMinute = recentRequests.length;
    }

    // Calculate error rate
    private calculateErrorRate(): void {
        if (this.metrics.totalRequests > 0) {
            this.metrics.errorRate = this.metrics.totalErrors / this.metrics.totalRequests;
        }
    }

    // Start metrics collection
    private startMetricsCollection(): void {
        this.metricsInterval = setInterval(() => {
            this.collectMetrics();
        }, 60000); // Every minute
    }

    // Collect metrics
    private async collectMetrics(): Promise<void> {
        try {
            // In production, would query database for real metrics
            // For now, simulate metrics collection
            
            // Reset counters periodically
            if (this.metrics.requestsPerMinute === 0) {
                this.metrics.requestsPerMinute = Math.floor(Math.random() * 10);
            }
            
            // Simulate user metrics
            this.metrics.userMetrics = {
                activeUsers: Math.floor(Math.random() * 100) + 50,
                newUsers: Math.floor(Math.random() * 10) + 1,
                premiumUsers: Math.floor(Math.random() * 20) + 5,
                enterpriseUsers: Math.floor(Math.random() * 5) + 1
            };
            
            console.log('📊 Metrics collected:', {
                totalRequests: this.metrics.totalRequests,
                totalErrors: this.metrics.totalErrors,
                averageResponseTime: Math.round(this.metrics.averageResponseTime),
                requestsPerMinute: this.metrics.requestsPerMinute,
                errorRate: (this.metrics.errorRate * 100).toFixed(2) + '%',
                topErrors: this.metrics.topErrors.slice(0, 3)
            });
        } catch (error) {
            console.error('Error collecting metrics:', error);
        }
    }

    // Setup database logging
    private setupDatabaseLogging(): void {
        // In production, would set up database triggers
        console.log('📝 Database logging enabled');
    }

    // Get current metrics
    getMetrics(): MetricsData {
        return { ...this.metrics };
    }

    // Get recent logs
    getRecentLogs(limit: number = 100): LogEntry[] {
        return this.logBuffer.slice(-limit);
    }

    // Get logs by level
    getLogsByLevel(level: LogEntry['level'], limit: number = 100): LogEntry[] {
        return this.logBuffer
            .filter(log => log.level === level)
            .slice(-limit);
    }

    // Get logs by user
    async getLogsByUser(userId: string, limit: number = 100): Promise<LogEntry[]> {
        try {
            const snapshot = await db.collection('logs')
                .where('meta.userId', '==', userId)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            return snapshot.docs.map(doc => ({
                timestamp: doc.data().timestamp.toDate(),
                level: doc.data().level,
                message: doc.data().message,
                meta: doc.data().meta
            }));
        } catch (error) {
            console.error('Error fetching user logs:', error);
            return [];
        }
    }

    // Get logs by date range
    async getLogsByDateRange(
        startDate: Date,
        endDate: Date,
        limit: number = 1000
    ): Promise<LogEntry[]> {
        try {
            const snapshot = await db.collection('logs')
                .where('timestamp', '>=', Timestamp.fromDate(startDate))
                .where('timestamp', '<=', Timestamp.fromDate(endDate))
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            return snapshot.docs.map(doc => ({
                timestamp: doc.data().timestamp.toDate(),
                level: doc.data().level,
                message: doc.data().message,
                meta: doc.data().meta
            }));
        } catch (error) {
            console.error('Error fetching logs by date range:', error);
            return [];
        }
    }

    // Search logs
    async searchLogs(query: string, limit: number = 100): Promise<LogEntry[]> {
        try {
            const snapshot = await db.collection('logs')
                .where('message', '>=', query)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            return snapshot.docs.map(doc => ({
                timestamp: doc.data().timestamp.toDate(),
                level: doc.data().level,
                message: doc.data().message,
                meta: doc.data().meta
            }));
        } catch (error) {
            console.error('Error searching logs:', error);
            return [];
        }
    }

    // Clear old logs
    async clearOldLogs(daysOld: number = 30): Promise<void> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            
            const snapshot = await db.collection('logs')
                .where('timestamp', '<', Timestamp.fromDate(cutoffDate))
                .get();
            
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log(`🧹 Cleared ${snapshot.docs.length} old log entries`);
        } catch (error) {
            console.error('Error clearing old logs:', error);
        }
    }

    // Export logs
    async exportLogs(format: 'json' | 'csv', dateRange?: { start: Date; end: Date }): Promise<string> {
        try {
            let logs: LogEntry[];
            
            if (dateRange) {
                logs = await this.getLogsByDateRange(dateRange.start, dateRange.end);
            } else {
                logs = this.getRecentLogs(1000);
            }

            if (format === 'json') {
                return JSON.stringify(logs, null, 2);
            } else if (format === 'csv') {
                const headers = ['timestamp', 'level', 'message', 'userId', 'sessionId', 'requestId', 'ip', 'method', 'url', 'statusCode'];
                const csvContent = [
                    headers.join(','),
                    ...logs.map(log => [
                        log.timestamp.toISOString(),
                        log.level,
                        `"${log.message.replace(/"/g, '""')}"`,
                        log.meta?.userId || '',
                        log.meta?.sessionId || '',
                        log.meta?.requestId || '',
                        log.meta?.ip || '',
                        log.meta?.method || '',
                        log.meta?.url || '',
                        log.meta?.statusCode || ''
                    ])
                ].join('\n');
                return csvContent;
            } else {
                throw new Error(`Unsupported export format: ${format}`);
            }
        } catch (error) {
            console.error('Error exporting logs:', error);
            throw error;
        }
    }

    // Health check for logging service
    healthCheck(): {
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            config: {
                logLevel: this.logLevel,
                enableConsole: this.enableConsole,
                enableDatabase: this.enableDatabase,
                enableMetrics: this.enableMetrics,
                maxBufferSize: this.maxBufferSize
            },
            metrics: this.metrics,
            buffer: {
                size: this.logBuffer.length,
                oldest: this.logBuffer[0]?.timestamp?.toISOString(),
                newest: this.logBuffer[this.logBuffer.length - 1]?.timestamp?.toISOString()
            }
        };
    }

    // Cleanup resources
    cleanup(): void {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = null;
        }
        
        this.logBuffer = [];
        console.log('🧹 Logging service cleaned up');
    }
}

// Logging middleware
export const loggingMiddleware = (
    req: Request,
    res: Response,
    next: RequestHandler
) => {
    const startTime = Date.now();
    
    // Override res.json to capture response time
    const originalJson = res.json;
    res.json = function(body?: any, statusCode?: number) {
        const responseTime = Date.now() - startTime;
        
        // Log the request
        const logger = LoggingService.getInstance();
        logger.log('info', `${req.method} ${req.path}`, {
            requestId: req.headers['x-request-id'] || `req_${Date.now()}`,
            ip: req.ip,
            method: req.method,
            url: req.url,
            userAgent: req.headers['user-agent'],
            statusCode: statusCode || 200,
            responseTime,
            userId: (req as any).user?.id
        });
        
        return originalJson.call(res, body, statusCode);
    };
    
    // Override res.status to capture status codes
    const originalStatus = res.status;
    res.status = function(code: number) {
        const responseTime = Date.now() - startTime;
        
        // Log the status
        const logger = LoggingService.getInstance();
        if (code >= 400) {
            logger.log('error', `HTTP ${code} - ${req.method} ${req.path}`, {
                requestId: req.headers['x-request-id'] || `req_${Date.now()}`,
                ip: req.ip,
                method: req.method,
                url: req.url,
                statusCode: code,
                responseTime,
                userId: (req as any).user?.id
            });
        }
        
        return originalStatus.call(res, code);
    };
    
    next();
};

// Error logging middleware
export const errorLoggingMiddleware = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const logger = LoggingService.getInstance();
    
    logger.log('error', error.message, {
        requestId: req.headers['x-request-id'] || `req_${Date.now()}`,
        ip: req.ip,
        method: req.method,
        url: req.url,
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack
        },
        userId: (req as any).user?.id
    });
    
    next(error);
};

// Request ID middleware
export const requestIdMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
};

// Performance monitoring middleware
export const performanceMonitoringMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        const logger = LoggingService.getInstance();
        
        logger.log('info', `Request completed in ${responseTime}ms`, {
            requestId: req.headers['x-request-id'],
            ip: req.ip,
            method: req.method,
            url: req.url,
            responseTime,
            userId: (req as any).user?.id
        });
    });
    
    next();
};

// Business event logging
export const businessEventLogging = (
    action: string,
    resource: string,
    result: string,
    value?: any,
    userId?: string,
    sessionId?: string
) => {
    const logger = LoggingService.getInstance();
    
    logger.log('info', `Business Event: ${action} - ${resource} - ${result}`, {
        business: {
            action,
            resource,
            result,
            value
        },
        userId,
        sessionId
    });
};

export default LoggingService.getInstance();
