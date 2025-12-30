import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// Rate limiting configurations for different user types and endpoints

// Global rate limiter for all users
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        return req.ip || 'unknown';
    }
});

// Auth endpoints - more restrictive
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit to 20 auth attempts per window
    message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: '15 minutes'
    },
    skipSuccessfulRequests: true,
    keyGenerator: (req: Request) => {
        return `auth:${req.ip}`;
    }
});

// AI service endpoints - resource intensive
export const aiServiceLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit to 10 AI requests per minute
    message: {
        error: 'AI service rate limit exceeded, please try again later.',
        retryAfter: '1 minute'
    },
    keyGenerator: (req: Request) => {
        const userId = (req as any).user?.id || req.ip;
        return `ai:${userId}`;
    }
});

// Report generation - very resource intensive
export const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit to 5 reports per hour
    message: {
        error: 'Report generation limit exceeded, please try again later.',
        retryAfter: '1 hour'
    },
    keyGenerator: (req: Request) => {
        const userId = (req as any).user?.id || req.ip;
        return `report:${userId}`;
    }
});

// File upload endpoints
export const uploadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 20, // Limit to 20 uploads per 10 minutes
    message: {
        error: 'Upload limit exceeded, please try again later.',
        retryAfter: '10 minutes'
    },
    keyGenerator: (req: Request) => {
        const userId = (req as any).user?.id || req.ip;
        return `upload:${userId}`;
    }
});

// Premium users - higher limits
export const premiumLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Higher limit for premium users
    message: {
        error: 'Premium rate limit exceeded, please try again later.',
        retryAfter: '15 minutes'
    },
    keyGenerator: (req: Request) => {
        const userId = (req as any).user?.id || req.ip;
        return `premium:${userId}`;
    }
});

// Enterprise users - highest limits
export const enterpriseLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Highest limit for enterprise users
    message: {
        error: 'Enterprise rate limit exceeded, please try again later.',
        retryAfter: '15 minutes'
    },
    keyGenerator: (req: Request) => {
        const userId = (req as any).user?.id || req.ip;
        return `enterprise:${userId}`;
    }
});

// API key users - separate limits
export const apiKeyLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit for API key users
    message: {
        error: 'API key rate limit exceeded, please try again later.',
        retryAfter: '1 minute'
    },
    keyGenerator: (req: Request) => {
        const apiKey = (req as any).apiKey || req.ip;
        return `apikey:${apiKey}`;
    }
});

// WebSocket connections
export const websocketLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit to 10 WebSocket connections per minute
    message: {
        error: 'WebSocket connection limit exceeded, please try again later.',
        retryAfter: '1 minute'
    },
    keyGenerator: (req: Request) => {
        const userId = (req as any).user?.id || req.ip;
        return `ws:${userId}`;
    }
});

// Dynamic rate limiter based on user role
export const dynamicRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
        // Unauthenticated users get global limiter
        return globalLimiter(req, res, next);
    }

    // Apply different limits based on user role
    switch (user.role) {
        case 'enterprise':
            return enterpriseLimiter(req, res, next);
        case 'premium':
            return premiumLimiter(req, res, next);
        case 'user':
            return globalLimiter(req, res, next);
        default:
            return globalLimiter(req, res, next);
    }
};

// Endpoint-specific rate limiter
export const endpointRateLimiter = (endpoint: string) => {
    const limiters: Record<string, any> = {
        '/api/auth': authLimiter,
        '/api/ai': aiServiceLimiter,
        '/api/reports': reportLimiter,
        '/api/upload': uploadLimiter,
        '/api/websocket': websocketLimiter
    };

    return limiters[endpoint] || globalLimiter;
};

// Custom rate limiter with database tracking
export const databaseRateLimiter = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = (req as any).user?.id || req.ip;
    const endpoint = req.path;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes

    try {
        // In production, would check against database
        // For now, simulate with in-memory tracking
        const key = `${userId}:${endpoint}`;
        
        // This would be replaced with actual database query
        const requestCount = await getRequestCount(key, now, windowMs);
        
        const maxRequests = getMaxRequestsForUser((req as any).user, endpoint);
        
        if (requestCount >= maxRequests) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                retryAfter: '15 minutes',
                limit: maxRequests,
                remaining: 0
            });
        }

        // Record this request
        await recordRequest(key, now);
        
        // Add rate limit headers
        res.set({
            'X-RateLimit-Limit': maxRequests,
            'X-RateLimit-Remaining': Math.max(0, maxRequests - requestCount - 1),
            'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
        });

        next();
    } catch (error) {
        console.error('Database rate limiter error:', error);
        // Fallback to basic rate limiting
        return globalLimiter(req, res, next);
    }
};

// Helper functions for database rate limiting (would be implemented with actual database)
async function getRequestCount(key: string, now: number, windowMs: number): Promise<number> {
    // In production, would query database for requests in the window
    // For now, simulate with random number
    return Math.floor(Math.random() * 10);
}

async function recordRequest(key: string, timestamp: number): Promise<void> {
    // In production, would record request in database
    console.log(`Recording request: ${key} at ${timestamp}`);
}

function getMaxRequestsForUser(user: any, endpoint: string): number {
    if (!user) return 10; // Unauthenticated users

    const baseLimits: Record<string, number> = {
        '/api/auth': 20,
        '/api/ai': 10,
        '/api/reports': 5,
        '/api/upload': 20,
        '/api/websocket': 10
    };

    const baseLimit = baseLimits[endpoint] || 100;

    // Multiply by user tier multiplier
    const multipliers: Record<string, number> = {
        'enterprise': 10,
        'premium': 5,
        'user': 1,
        'admin': 20
    };

    const multiplier = multipliers[user.role] || 1;
    return baseLimit * multiplier;
}

// Rate limiting middleware with user-specific limits
export const userRateLimitMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const user = (req as any).user;
    const endpoint = req.path;

    // Skip rate limiting for admin users
    if (user?.role === 'admin' || user?.role === 'superadmin') {
        return next();
    }

    // Apply database rate limiting
    return databaseRateLimiter(req, res, next);
};

// Burst rate limiter (allows short bursts)
export const burstLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 50, // Allow up to 50 requests in a minute
    message: {
        error: 'Burst rate limit exceeded, please slow down.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        const userId = (req as any).user?.id || req.ip;
        return `burst:${userId}`;
    }
});

// Sustained rate limiter (for longer periods)
export const sustainedLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000, // Allow 1000 requests per hour
    message: {
        error: 'Sustained rate limit exceeded, please try again later.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        const userId = (req as any).user?.id || req.ip;
        return `sustained:${userId}`;
    }
});

// Combined rate limiter (burst + sustained)
export const combinedLimiter = [
    burstLimiter,
    sustainedLimiter
];

// Rate limiting middleware for different HTTP methods
export const methodRateLimiter = {
    get: rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 200, // More permissive for GET requests
        message: { error: 'GET rate limit exceeded' }
    }),
    post: rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 50, // Stricter for POST requests
        message: { error: 'POST rate limit exceeded' }
    }),
    put: rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 30, // Stricter for PUT requests
        message: { error: 'PUT rate limit exceeded' }
    }),
    delete: rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20, // Strictest for DELETE requests
        message: { error: 'DELETE rate limit exceeded' }
    })
};

// Apply method-specific rate limiting
export const methodRateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const method = req.method.toLowerCase();
    const limiter = methodRateLimiter[method as keyof typeof methodRateLimiter];
    
    if (limiter) {
        return limiter(req, res, next);
    }
    
    next();
};

// Rate limiting middleware with custom key generator
export const customRateLimiter = (keyGenerator: (req: Request) => string) => {
    return rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: { error: 'Custom rate limit exceeded' },
        keyGenerator
    });
};

// Rate limiting middleware for specific user groups
export const userGroupRateLimiter = (group: string) => {
    const limits: Record<string, any> = {
        'free': {
            windowMs: 15 * 60 * 1000,
            max: 50,
            message: { error: 'Free tier rate limit exceeded' }
        },
        'basic': {
            windowMs: 15 * 60 * 1000,
            max: 100,
            message: { error: 'Basic tier rate limit exceeded' }
        },
        'pro': {
            windowMs: 15 * 60 * 1000,
            max: 200,
            message: { error: 'Pro tier rate limit exceeded' }
        }
    };

    return rateLimit(limits[group] || limits['free']);
};

// Export default rate limiter
export default dynamicRateLimiter;
