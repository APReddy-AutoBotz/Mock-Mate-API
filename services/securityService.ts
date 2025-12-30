import { APIError } from '../utils/errorHandler';

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}

interface RateLimitEntry {
    count: number;
    resetTime: number;
    lastRequest: number;
}

interface SecurityConfig {
    rateLimiting: {
        global: RateLimitConfig;
        auth: RateLimitConfig;
        api: RateLimitConfig;
        upload: RateLimitConfig;
    };
    security: {
        enableCORS: boolean;
        enableHelmet: boolean;
        enableCSRF: boolean;
        maxRequestSize: number;
        allowedOrigins: string[];
        blockedIPs: string[];
    };
    monitoring: {
        enableLogging: boolean;
        enableMetrics: boolean;
        alertThresholds: {
            requestsPerMinute: number;
            errorRate: number;
            responseTime: number;
        };
    };
}

class SecurityService {
    private rateLimitStore = new Map<string, RateLimitEntry>();
    private blockedIPs = new Set<string>();
    private securityLogs: Array<{
        timestamp: number;
        type: 'rate_limit' | 'blocked_ip' | 'suspicious_activity' | 'security_event';
        details: any;
        ip?: string;
        userId?: string;
    }> = [];

    private config: SecurityConfig = {
        rateLimiting: {
            global: { windowMs: 15 * 60 * 1000, maxRequests: 1000 }, // 15 minutes, 1000 requests
            auth: { windowMs: 15 * 60 * 1000, maxRequests: 20 },    // 15 minutes, 20 auth attempts
            api: { windowMs: 1 * 60 * 1000, maxRequests: 100 },     // 1 minute, 100 API calls
            upload: { windowMs: 1 * 60 * 1000, maxRequests: 10 }     // 1 minute, 10 uploads
        },
        security: {
            enableCORS: true,
            enableHelmet: true,
            enableCSRF: true,
            maxRequestSize: 10 * 1024 * 1024, // 10MB
            allowedOrigins: ['http://localhost:3000', 'https://mockmate.app'],
            blockedIPs: []
        },
        monitoring: {
            enableLogging: true,
            enableMetrics: true,
            alertThresholds: {
                requestsPerMinute: 500,
                errorRate: 0.05, // 5%
                responseTime: 5000 // 5 seconds
            }
        }
    };

    // Rate limiting middleware
    checkRateLimit(
        identifier: string,
        type: keyof SecurityConfig['rateLimiting'] = 'global'
    ): { allowed: boolean; remaining: number; resetTime: number } {
        const config = this.config.rateLimiting[type];
        const now = Date.now();
        const key = `${type}:${identifier}`;

        const entry = this.rateLimitStore.get(key);
        
        if (!entry || now > entry.resetTime) {
            // New window or expired entry
            const newEntry: RateLimitEntry = {
                count: 1,
                resetTime: now + config.windowMs,
                lastRequest: now
            };
            this.rateLimitStore.set(key, newEntry);
            
            return {
                allowed: true,
                remaining: config.maxRequests - 1,
                resetTime: newEntry.resetTime
            };
        }

        // Check if limit exceeded
        if (entry.count >= config.maxRequests) {
            this.logSecurityEvent('rate_limit', {
                identifier,
                type,
                count: entry.count,
                limit: config.maxRequests
            });
            
            return {
                allowed: false,
                remaining: 0,
                resetTime: entry.resetTime
            };
        }

        // Increment count
        entry.count++;
        entry.lastRequest = now;
        this.rateLimitStore.set(key, entry);

        return {
            allowed: true,
            remaining: config.maxRequests - entry.count,
            resetTime: entry.resetTime
        };
    }

    // IP blocking
    blockIP(ip: string, reason: string, duration?: number): void {
        this.blockedIPs.add(ip);
        this.config.security.blockedIPs.push(ip);
        
        this.logSecurityEvent('blocked_ip', { ip, reason, duration });
        
        if (duration) {
            setTimeout(() => {
                this.unblockIP(ip);
            }, duration);
        }
    }

    unblockIP(ip: string): void {
        this.blockedIPs.delete(ip);
        const index = this.config.security.blockedIPs.indexOf(ip);
        if (index > -1) {
            this.config.security.blockedIPs.splice(index, 1);
        }
    }

    isIPBlocked(ip: string): boolean {
        return this.blockedIPs.has(ip);
    }

    // Request validation
    validateRequest(request: {
        method: string;
        url: string;
        headers: Record<string, string>;
        body?: any;
        ip?: string;
        userId?: string;
    }): { valid: boolean; reason?: string } {
        // Check IP blocking
        if (request.ip && this.isIPBlocked(request.ip)) {
            return { valid: false, reason: 'IP blocked' };
        }

        // Check request size
        const contentLength = parseInt(request.headers['content-length'] || '0');
        if (contentLength > this.config.security.maxRequestSize) {
            this.logSecurityEvent('suspicious_activity', {
                type: 'oversized_request',
                size: contentLength,
                url: request.url,
                ip: request.ip
            });
            return { valid: false, reason: 'Request too large' };
        }

        // Check for suspicious patterns
        const suspiciousPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // XSS
            /union\s+select/gi, // SQL injection
            /javascript:/gi, // JavaScript protocol
            /data:text\/html/gi // Data URI
        ];

        const bodyStr = request.body ? JSON.stringify(request.body) : '';
        const urlAndBody = request.url + bodyStr;

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(urlAndBody)) {
                this.logSecurityEvent('suspicious_activity', {
                    type: 'malicious_pattern',
                    pattern: pattern.source,
                    url: request.url,
                    ip: request.ip,
                    userId: request.userId
                });
                return { valid: false, reason: 'Suspicious content detected' };
            }
        }

        return { valid: true };
    }

    // CSRF protection
    generateCSRFToken(): string {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    validateCSRFToken(token: string, sessionToken: string): boolean {
        // In production, this would validate against stored session tokens
        return token === sessionToken;
    }

    // Input sanitization
    sanitizeInput(input: any): any {
        if (typeof input === 'string') {
            return input
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;');
        }

        if (Array.isArray(input)) {
            return input.map(item => this.sanitizeInput(item));
        }

        if (typeof input === 'object' && input !== null) {
            const sanitized: any = {};
            for (const [key, value] of Object.entries(input)) {
                sanitized[key] = this.sanitizeInput(value);
            }
            return sanitized;
        }

        return input;
    }

    // Authentication security
    validatePassword(password: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        // Check for common passwords
        const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein'];
        if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
            errors.push('Password cannot contain common words');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Session security
    generateSecureToken(): string {
        const array = new Uint8Array(64);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    validateSession(session: {
        token: string;
        userId: string;
        expiresAt: number;
        ip?: string;
        userAgent?: string;
    }, requestIP?: string, requestUserAgent?: string): { valid: boolean; reason?: string } {
        // Check expiration
        if (Date.now() > session.expiresAt) {
            return { valid: false, reason: 'Session expired' };
        }

        // Check IP consistency (optional, based on security level)
        if (session.ip && requestIP && session.ip !== requestIP) {
            this.logSecurityEvent('suspicious_activity', {
                type: 'ip_mismatch',
                sessionIP: session.ip,
                requestIP,
                userId: session.userId
            });
            return { valid: false, reason: 'IP address mismatch' };
        }

        // Check User-Agent consistency (optional)
        if (session.userAgent && requestUserAgent && session.userAgent !== requestUserAgent) {
            this.logSecurityEvent('suspicious_activity', {
                type: 'user_agent_mismatch',
                sessionUA: session.userAgent,
                requestUA: requestUserAgent,
                userId: session.userId
            });
        }

        return { valid: true };
    }

    // Data encryption
    async encryptData(data: string, key: string): Promise<string> {
        try {
            const encodedKey = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(key),
                { name: 'AES-GCM' },
                false,
                ['encrypt']
            );

            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encodedData = new TextEncoder().encode(data);

            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                encodedKey,
                encodedData
            );

            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);

            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('Encryption error:', error);
            throw new APIError('Failed to encrypt data');
        }
    }

    async decryptData(encryptedData: string, key: string): Promise<string> {
        try {
            const encodedKey = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(key),
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            const combined = new Uint8Array(
                atob(encryptedData).split('').map(char => char.charCodeAt(0))
            );

            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                encodedKey,
                encrypted
            );

            return new TextDecoder().decode(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            throw new APIError('Failed to decrypt data');
        }
    }

    // Security monitoring
    logSecurityEvent(
        type: 'rate_limit' | 'blocked_ip' | 'suspicious_activity' | 'security_event',
        details: any,
        ip?: string,
        userId?: string
    ): void {
        const event = {
            timestamp: Date.now(),
            type,
            details,
            ip,
            userId
        };

        this.securityLogs.push(event);

        // Keep only last 1000 events
        if (this.securityLogs.length > 1000) {
            this.securityLogs = this.securityLogs.slice(-1000);
        }

        // Check for alert conditions
        this.checkAlertConditions(event);
    }

    private checkAlertConditions(event: any): void {
        // Rate limit alerts
        if (event.type === 'rate_limit') {
            const recentRateLimits = this.securityLogs.filter(
                log => log.type === 'rate_limit' && 
                Date.now() - log.timestamp < 60000 // Last minute
            );

            if (recentRateLimits.length > 10) {
                this.triggerAlert('High rate limit activity detected', event);
            }
        }

        // Suspicious activity alerts
        if (event.type === 'suspicious_activity') {
            const recentSuspicious = this.securityLogs.filter(
                log => log.type === 'suspicious_activity' && 
                Date.now() - log.timestamp < 300000 // Last 5 minutes
            );

            if (recentSuspicious.length > 5) {
                this.triggerAlert('Suspicious activity spike detected', event);
            }
        }
    }

    private triggerAlert(message: string, event: any): void {
        console.warn(`SECURITY ALERT: ${message}`, event);
        // In production, this would send alerts to monitoring systems
    }

    // Get security metrics
    getSecurityMetrics(): {
        rateLimitHits: number;
        blockedIPs: number;
        suspiciousActivities: number;
        topBlockedIPs: Array<{ ip: string; count: number }>;
        recentEvents: any[];
    } {
        const now = Date.now();
        const lastHour = now - 3600000;

        const recentEvents = this.securityLogs.filter(event => event.timestamp > lastHour);
        
        const rateLimitHits = recentEvents.filter(event => event.type === 'rate_limit').length;
        const suspiciousActivities = recentEvents.filter(event => event.type === 'suspicious_activity').length;

        const ipCounts = new Map<string, number>();
        recentEvents.forEach(event => {
            if (event.ip) {
                ipCounts.set(event.ip, (ipCounts.get(event.ip) || 0) + 1);
            }
        });

        const topBlockedIPs = Array.from(ipCounts.entries())
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([ip, count]) => ({ ip, count }));

        return {
            rateLimitHits,
            blockedIPs: this.blockedIPs.size,
            suspiciousActivities,
            topBlockedIPs,
            recentEvents: recentEvents.slice(-50)
        };
    }

    // Cleanup expired entries
    cleanup(): void {
        const now = Date.now();
        
        // Clean up rate limit entries
        for (const [key, entry] of this.rateLimitStore.entries()) {
            if (now > entry.resetTime) {
                this.rateLimitStore.delete(key);
            }
        }

        // Clean up old security logs
        const weekAgo = now - 7 * 24 * 3600000;
        this.securityLogs = this.securityLogs.filter(event => event.timestamp > weekAgo);
    }

    // Update configuration
    updateConfig(newConfig: Partial<SecurityConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Update blocked IPs list
        if (newConfig.security?.blockedIPs) {
            this.blockedIPs.clear();
            newConfig.security.blockedIPs.forEach(ip => this.blockedIPs.add(ip));
        }
    }

    // Get current configuration
    getConfig(): SecurityConfig {
        return { ...this.config };
    }

    // Security headers middleware
    getSecurityHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};

        if (this.config.security.enableHelmet) {
            headers['X-Content-Type-Options'] = 'nosniff';
            headers['X-Frame-Options'] = 'DENY';
            headers['X-XSS-Protection'] = '1; mode=block';
            headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
            headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()';
        }

        if (this.config.security.enableCORS) {
            headers['Access-Control-Allow-Origin'] = this.config.security.allowedOrigins.join(', ');
            headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRF-Token';
            headers['Access-Control-Allow-Credentials'] = 'true';
        }

        return headers;
    }

    // Initialize security service
    initialize(): void {
        // Set up periodic cleanup
        setInterval(() => {
            this.cleanup();
        }, 60000); // Every minute

        console.log('Security service initialized');
    }
}

export const securityService = new SecurityService();
export default securityService;
