import { Request, Response, NextFunction } from 'express';
import { db, Timestamp } from '../firebase';

interface HealthCheck {
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: Date;
    uptime: number;
    version: string;
    services: {
        database: ServiceStatus;
        ai: ServiceStatus;
        blockchain: ServiceStatus;
        ats: ServiceStatus;
        cache: ServiceStatus;
        storage: ServiceStatus;
    };
    metrics: {
        totalRequests: number;
        errorRate: number;
        averageResponseTime: number;
        memoryUsage: number;
        cpuUsage: number;
        diskUsage: number;
    };
    lastChecks: {
        database: Date;
        ai: Date;
        blockchain: Date;
        ats: Date;
        cache: Date;
        storage: Date;
    };
}

interface ServiceStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
    responseTime: number;
    lastCheck: Date;
    error?: string;
    details?: any;
}

interface Alert {
    id: string;
    type: 'error' | 'warning' | 'info' | 'critical';
    service: string;
    message: string;
    timestamp: Date;
    resolved: boolean;
    resolvedAt?: Date;
    metadata?: any;
}

interface PerformanceMetrics {
    timestamp: Date;
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    networkIO: {
        bytesIn: number;
        bytesOut: number;
    };
    databaseMetrics: {
        connections: number;
        queriesPerSecond: number;
        averageQueryTime: number;
        cacheHitRate: number;
    };
    aiMetrics: {
        requestsPerSecond: number;
        averageResponseTime: number;
        errorRate: number;
        tokenUsage: number;
    };
}

class MonitoringService {
    private static instance: MonitoringService;
    private healthChecks: Map<string, HealthCheck> = new Map();
    private alerts: Alert[] = [];
    private metrics: PerformanceMetrics[] = [];
    private maxMetricsHistory = 1000;
    private alertThresholds = {
        errorRate: 0.05, // 5%
        responseTime: 2000, // 2 seconds
        memoryUsage: 0.8, // 80%
        cpuUsage: 0.8, // 80%
        diskUsage: 0.9, // 90%
        databaseConnections: 100,
        aiResponseTime: 5000 // 5 seconds
    };

    private constructor() {
        this.startMonitoring();
    }

    static getInstance(): MonitoringService {
        if (!MonitoringService.instance) {
            MonitoringService.instance = new MonitoringService();
        }
        return MonitoringService.instance;
    }

    // Start monitoring services
    private startMonitoring(): void {
        // Health check every 30 seconds
        setInterval(() => {
            this.performHealthChecks();
        }, 30000);

        // Metrics collection every minute
        setInterval(() => {
            this.collectMetrics();
        }, 60000);

        // Alert processing every 5 minutes
        setInterval(() => {
            this.processAlerts();
        }, 300000);

        // Cleanup old metrics every hour
        setInterval(() => {
            this.cleanupOldMetrics();
        }, 3600000);
    }

    // Perform health checks
    private async performHealthChecks(): Promise<void> {
        const healthCheck: HealthCheck = {
            status: 'healthy',
            timestamp: new Date(),
            uptime: process.uptime(),
            version: '1.0.0',
            services: {
                database: await this.checkDatabase(),
                ai: await this.checkAIService(),
                blockchain: await this.checkBlockchainService(),
                ats: await this.checkATSService(),
                cache: await this.checkCacheService(),
                storage: await this.checkStorageService()
            },
            metrics: await this.getCurrentMetrics(),
            lastChecks: {
                database: new Date(),
                ai: new Date(),
                blockchain: new Date(),
                ats: new Date(),
                cache: new Date(),
                storage: new Date()
            }
        };

        // Determine overall health status
        const serviceStatuses = Object.values(healthCheck.services);
        const unhealthyCount = serviceStatuses.filter(s => s.status === 'unhealthy').length;
        const degradedCount = serviceStatuses.filter(s => s.status === 'degraded').length;

        if (unhealthyCount > 0) {
            healthCheck.status = 'unhealthy';
        } else if (degradedCount > 0) {
            healthCheck.status = 'degraded';
        }

        // Store health check
        this.healthChecks.set('main', healthCheck);

        // Check for alerts
        this.checkForAlerts(healthCheck);

        console.log('🏥 Health check completed:', healthCheck.status);
    }

    // Check database health
    private async checkDatabase(): Promise<ServiceStatus> {
        const startTime = Date.now();
        
        try {
            // Test database connection
            await db.collection('health').doc('check').set({
                timestamp: Timestamp.now(),
                status: 'ok'
            });

            const responseTime = Date.now() - startTime;
            
            return {
                status: responseTime < 1000 ? 'healthy' : 'degraded',
                responseTime,
                lastCheck: new Date(),
                details: {
                    connections: await this.getDatabaseConnections(),
                    queriesPerSecond: await this.getQueriesPerSecond()
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                lastCheck: new Date(),
                error: error.message
            };
        }
    }

    // Check AI service health
    private async checkAIService(): Promise<ServiceStatus> {
        const startTime = Date.now();
        
        try {
            // Simulate AI service check
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const responseTime = Date.now() - startTime;
            
            return {
                status: responseTime < 5000 ? 'healthy' : 'degraded',
                responseTime,
                lastCheck: new Date(),
                details: {
                    requestsPerSecond: Math.floor(Math.random() * 10),
                    tokenUsage: Math.floor(Math.random() * 10000)
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                lastCheck: new Date(),
                error: error.message
            };
        }
    }

    // Check blockchain service health
    private async checkBlockchainService(): Promise<ServiceStatus> {
        const startTime = Date.now();
        
        try {
            // Simulate blockchain service check
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const responseTime = Date.now() - startTime;
            
            return {
                status: responseTime < 3000 ? 'healthy' : 'degraded',
                responseTime,
                lastCheck: new Date(),
                details: {
                    network: 'sepolia',
                    blockNumber: 18000000 + Math.floor(Math.random() * 1000),
                    gasPrice: Math.floor(Math.random() * 100)
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                lastCheck: new Date(),
                error: error.message
            };
        }
    }

    // Check ATS service health
    private async checkATSService(): Promise<ServiceStatus> {
        const startTime = Date.now();
        
        try {
            // Simulate ATS service check
            await new Promise(resolve => setTimeout(resolve, 150));
            
            const responseTime = Date.now() - startTime;
            
            return {
                status: responseTime < 2000 ? 'healthy' : 'degraded',
                responseTime,
                lastCheck: new Date(),
                details: {
                    connectedProviders: 3,
                    totalJobs: Math.floor(Math.random() * 1000),
                    totalCandidates: Math.floor(Math.random() * 5000)
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                lastCheck: new Date(),
                error: error.message
            };
        }
    }

    // Check cache service health
    private async checkCacheService(): Promise<ServiceStatus> {
        const startTime = Date.now();
        
        try {
            // Simulate cache service check
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const responseTime = Date.now() - startTime;
            
            return {
                status: responseTime < 100 ? 'healthy' : 'degraded',
                responseTime,
                lastCheck: new Date(),
                details: {
                    hitRate: 0.85 + Math.random() * 0.1,
                    memoryUsage: Math.random() * 0.5,
                    keys: Math.floor(Math.random() * 10000)
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                lastCheck: new Date(),
                error: error.message
            };
        }
    }

    // Check storage service health
    private async checkStorageService(): Promise<ServiceStatus> {
        const startTime = Date.now();
        
        try {
            // Simulate storage service check
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const responseTime = Date.now() - startTime;
            
            return {
                status: responseTime < 500 ? 'healthy' : 'degraded',
                responseTime,
                lastCheck: new Date(),
                details: {
                    usedSpace: Math.random() * 1000000000, // bytes
                    totalSpace: 10000000000, // bytes
                    fileCount: Math.floor(Math.random() * 100000)
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                lastCheck: new Date(),
                error: error.message
            };
        }
    }

    // Get current metrics
    private async getCurrentMetrics(): Promise<HealthCheck['metrics']> {
        const memUsage = process.memoryUsage();
        
        return {
            totalRequests: this.getRecentRequestCount(),
            errorRate: this.getRecentErrorRate(),
            averageResponseTime: this.getRecentAverageResponseTime(),
            memoryUsage: memUsage.heapUsed / memUsage.heapTotal,
            cpuUsage: Math.random() * 0.5, // Simulated CPU usage
            diskUsage: Math.random() * 0.7 // Simulated disk usage
        };
    }

    // Collect performance metrics
    private async collectMetrics(): Promise<void> {
        const metrics: PerformanceMetrics = {
            timestamp: new Date(),
            requestsPerSecond: this.getRequestsPerSecond(),
            averageResponseTime: this.getRecentAverageResponseTime(),
            errorRate: this.getRecentErrorRate(),
            activeConnections: Math.floor(Math.random() * 100),
            memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
            cpuUsage: Math.random() * 0.5,
            diskUsage: Math.random() * 0.7,
            networkIO: {
                bytesIn: Math.floor(Math.random() * 1000000),
                bytesOut: Math.floor(Math.random() * 1000000)
            },
            databaseMetrics: {
                connections: await this.getDatabaseConnections(),
                queriesPerSecond: await this.getQueriesPerSecond(),
                averageQueryTime: Math.random() * 100,
                cacheHitRate: 0.85 + Math.random() * 0.1
            },
            aiMetrics: {
                requestsPerSecond: Math.floor(Math.random() * 10),
                averageResponseTime: Math.random() * 2000,
                errorRate: Math.random() * 0.02,
                tokenUsage: Math.floor(Math.random() * 10000)
            }
        };

        this.metrics.push(metrics);
        
        // Trim metrics history
        if (this.metrics.length > this.maxMetricsHistory) {
            this.metrics = this.metrics.slice(-this.maxMetricsHistory);
        }
    }

    // Check for alerts
    private checkForAlerts(healthCheck: HealthCheck): void {
        const alerts: Alert[] = [];

        // Check error rate
        if (healthCheck.metrics.errorRate > this.alertThresholds.errorRate) {
            alerts.push({
                id: `alert_${Date.now()}_error_rate`,
                type: 'warning',
                service: 'system',
                message: `Error rate ${(healthCheck.metrics.errorRate * 100).toFixed(2)}% exceeds threshold`,
                timestamp: new Date(),
                resolved: false
            });
        }

        // Check response time
        if (healthCheck.metrics.averageResponseTime > this.alertThresholds.responseTime) {
            alerts.push({
                id: `alert_${Date.now()}_response_time`,
                type: 'warning',
                service: 'system',
                message: `Average response time ${healthCheck.metrics.averageResponseTime}ms exceeds threshold`,
                timestamp: new Date(),
                resolved: false
            });
        }

        // Check memory usage
        if (healthCheck.metrics.memoryUsage > this.alertThresholds.memoryUsage) {
            alerts.push({
                id: `alert_${Date.now()}_memory`,
                type: 'critical',
                service: 'system',
                message: `Memory usage ${(healthCheck.metrics.memoryUsage * 100).toFixed(2)}% exceeds threshold`,
                timestamp: new Date(),
                resolved: false
            });
        }

        // Check service-specific issues
        Object.entries(healthCheck.services).forEach(([service, status]) => {
            if (status.status === 'unhealthy') {
                alerts.push({
                    id: `alert_${Date.now()}_${service}`,
                    type: 'critical',
                    service,
                    message: `${service} service is unhealthy: ${status.error || 'Unknown error'}`,
                    timestamp: new Date(),
                    resolved: false
                });
            } else if (status.status === 'degraded') {
                alerts.push({
                    id: `alert_${Date.now()}_${service}_degraded`,
                    type: 'warning',
                    service,
                    message: `${service} service is degraded`,
                    timestamp: new Date(),
                    resolved: false
                });
            }
        });

        // Add new alerts
        alerts.forEach(alert => {
            if (!this.alerts.find(a => a.id === alert.id)) {
                this.alerts.push(alert);
            }
        });
    }

    // Process alerts
    private processAlerts(): void {
        // Auto-resolve old warnings
        const now = Date.now();
        const warningTimeout = 5 * 60 * 1000; // 5 minutes
        
        this.alerts.forEach(alert => {
            if (alert.type === 'warning' && !alert.resolved && 
                (now - alert.timestamp.getTime()) > warningTimeout) {
                alert.resolved = true;
                alert.resolvedAt = new Date();
            }
        });

        // Remove old resolved alerts
        this.alerts = this.alerts.filter(alert => 
            !alert.resolved || (now - alert.resolvedAt!.getTime()) < 24 * 60 * 60 * 1000
        );
    }

    // Cleanup old metrics
    private cleanupOldMetrics(): void {
        const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
        this.metrics = this.metrics.filter(metric => 
            metric.timestamp.getTime() > cutoffTime
        );
    }

    // Helper methods for metrics (simulated)
    private getRecentRequestCount(): number {
        return Math.floor(Math.random() * 1000) + 500;
    }

    private getRecentErrorRate(): number {
        return Math.random() * 0.05; // 0-5%
    }

    private getRecentAverageResponseTime(): number {
        return Math.random() * 1000 + 100; // 100-1100ms
    }

    private getRequestsPerSecond(): number {
        return Math.random() * 10 + 1;
    }

    private async getDatabaseConnections(): Promise<number> {
        return Math.floor(Math.random() * 50) + 10;
    }

    private async getQueriesPerSecond(): Promise<number> {
        return Math.floor(Math.random() * 100) + 20;
    }

    // Public API methods
    getHealthCheck(): HealthCheck | null {
        return this.healthChecks.get('main') || null;
    }

    getAlerts(type?: Alert['type'], service?: string): Alert[] {
        let alerts = this.alerts;
        
        if (type) {
            alerts = alerts.filter(alert => alert.type === type);
        }
        
        if (service) {
            alerts = alerts.filter(alert => alert.service === service);
        }
        
        return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    getMetrics(timeRange?: { start: Date; end: Date }): PerformanceMetrics[] {
        if (!timeRange) {
            return this.metrics.slice(-100); // Last 100 metrics
        }
        
        return this.metrics.filter(metric => 
            metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
        );
    }

    resolveAlert(alertId: string): boolean {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert && !alert.resolved) {
            alert.resolved = true;
            alert.resolvedAt = new Date();
            return true;
        }
        return false;
    }

    getServiceStatus(service: string): ServiceStatus | null {
        const healthCheck = this.healthChecks.get('main');
        if (!healthCheck) return null;
        
        return healthCheck.services[service as keyof HealthCheck['services']] || null;
    }

    // Export monitoring data
    async exportData(format: 'json' | 'csv'): Promise<string> {
        const data = {
            healthCheck: this.getHealthCheck(),
            alerts: this.getAlerts(),
            metrics: this.getMetrics()
        };

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else if (format === 'csv') {
            // Convert metrics to CSV
            const headers = ['timestamp', 'requestsPerSecond', 'averageResponseTime', 'errorRate', 'memoryUsage', 'cpuUsage'];
            const csvContent = [
                headers.join(','),
                ...this.metrics.map(metric => [
                    metric.timestamp.toISOString(),
                    metric.requestsPerSecond,
                    metric.averageResponseTime,
                    metric.errorRate,
                    metric.memoryUsage,
                    metric.cpuUsage
                ])
            ].join('\n');
            return csvContent;
        } else {
            throw new Error(`Unsupported export format: ${format}`);
        }
    }

    // Health check endpoint
    healthCheckEndpoint = (req: Request, res: Response): void => {
        const healthCheck = this.getHealthCheck();
        
        if (!healthCheck) {
            res.status(503).json({
                status: 'unhealthy',
                message: 'Health check not available'
            });
            return;
        }

        const statusCode = healthCheck.status === 'healthy' ? 200 : 
                          healthCheck.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json(healthCheck);
    };

    // Metrics endpoint
    metricsEndpoint = (req: Request, res: Response): void => {
        const timeRange = req.query.timeRange as string;
        let metrics: PerformanceMetrics[];
        
        if (timeRange) {
            const now = new Date();
            let start: Date;
            
            switch (timeRange) {
                case '1h':
                    start = new Date(now.getTime() - 60 * 60 * 1000);
                    break;
                case '24h':
                    start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    start = new Date(now.getTime() - 60 * 60 * 1000);
            }
            
            metrics = this.getMetrics({ start, end: now });
        } else {
            metrics = this.getMetrics();
        }
        
        res.json({
            metrics,
            summary: {
                totalRequests: metrics.reduce((sum, m) => sum + m.requestsPerSecond, 0),
                averageResponseTime: metrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / metrics.length,
                averageErrorRate: metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length,
                peakMemoryUsage: Math.max(...metrics.map(m => m.memoryUsage)),
                peakCpuUsage: Math.max(...metrics.map(m => m.cpuUsage))
            }
        });
    };

    // Alerts endpoint
    alertsEndpoint = (req: Request, res: Response): void => {
        const type = req.query.type as Alert['type'];
        const service = req.query.service as string;
        
        const alerts = this.getAlerts(type, service);
        
        res.json({
            alerts,
            summary: {
                total: alerts.length,
                critical: alerts.filter(a => a.type === 'critical').length,
                warning: alerts.filter(a => a.type === 'warning').length,
                info: alerts.filter(a => a.type === 'info').length,
                resolved: alerts.filter(a => a.resolved).length,
                unresolved: alerts.filter(a => !a.resolved).length
            }
        });
    };
}

export const monitoringService = MonitoringService.getInstance();
export default monitoringService;
