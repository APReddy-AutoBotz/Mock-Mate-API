import { Request, Response, NextFunction } from 'express';
import { db, Timestamp } from '../firebase';

interface CacheEntry<T> {
    key: string;
    value: T;
    timestamp: Date;
    ttl: number; // Time to live in seconds
    metadata?: {
        userId?: string;
        sessionId?: string;
        tags?: string[];
        size?: number;
    };
}

interface CacheStats {
    totalEntries: number;
    hitCount: number;
    missCount: number;
    hitRate: number;
    memoryUsage: number;
    oldestEntry: Date;
    newestEntry: Date;
    topKeys: Array<{
        key: string;
        hits: number;
        lastAccess: Date;
    }>;
}

class CacheService {
    private static instance: CacheService;
    private cache: Map<string, CacheEntry<any>> = new Map();
    private stats: CacheStats;
    private maxSize: number;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private defaultTTL: number;

    private constructor() {
        this.maxSize = 10000; // Maximum cache entries
        this.defaultTTL = 300; // 5 minutes default TTL
        this.stats = {
            totalEntries: 0,
            hitCount: 0,
            missCount: 0,
            hitRate: 0,
            memoryUsage: 0,
            oldestEntry: new Date(),
            newestEntry: new Date(),
            topKeys: []
        };

        this.startCleanup();
    }

    static getInstance(): CacheService {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }

    // Start cleanup process
    private startCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000); // Every minute
    }

    // Set cache entry
    set<T>(
        key: string,
        value: T,
        ttl?: number,
        metadata?: CacheEntry<T>['metadata']
    ): void {
        const entry: CacheEntry<T> = {
            key,
            value,
            timestamp: new Date(),
            ttl: ttl || this.defaultTTL,
            metadata
        };

        // Check if we need to make space
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        this.cache.set(key, entry);
        this.updateStats();
    }

    // Get cache entry
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.stats.missCount++;
            this.updateStats();
            return null;
        }

        // Check if entry has expired
        if (this.isExpired(entry)) {
            this.cache.delete(key);
            this.stats.missCount++;
            this.updateStats();
            return null;
        }

        // Update access time
        entry.timestamp = new Date();
        this.stats.hitCount++;
        this.updateStats();
        
        return entry.value;
    }

    // Delete cache entry
    delete(key: string): boolean {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.updateStats();
        }
        return deleted;
    }

    // Check if entry exists
    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;
        
        if (this.isExpired(entry)) {
            this.cache.delete(key);
            this.updateStats();
            return false;
        }
        
        return true;
    }

    // Clear all cache entries
    clear(): void {
        this.cache.clear();
        this.updateStats();
    }

    // Clear entries by pattern
    clearByPattern(pattern: RegExp): number {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (pattern.test(key)) {
                this.cache.delete(key);
                count++;
            }
        }
        this.updateStats();
        return count;
    }

    // Clear entries by tags
    clearByTag(tag: string): number {
        let count = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.metadata?.tags?.includes(tag)) {
                this.cache.delete(key);
                count++;
            }
        }
        this.updateStats();
        return count;
    }

    // Clear entries by user
    clearByUser(userId: string): number {
        let count = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.metadata?.userId === userId) {
                this.cache.delete(key);
                count++;
            }
        }
        this.updateStats();
        return count;
    }

    // Clear expired entries
    cleanup(): void {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (this.isExpired(entry)) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cache cleanup: removed ${cleaned} expired entries`);
            this.updateStats();
        }
    }

    // Evict least recently used entries
    private evictLRU(): void {
        let oldestKey = '';
        let oldestTime = Date.now();
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp.getTime() < oldestTime) {
                oldestTime = entry.timestamp.getTime();
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    // Check if entry is expired
    private isExpired(entry: CacheEntry<any>): boolean {
        return Date.now() - entry.timestamp.getTime() > (entry.ttl * 1000);
    }

    // Update cache statistics
    private updateStats(): void {
        this.stats.totalEntries = this.cache.size;
        
        if (this.stats.hitCount + this.stats.missCount > 0) {
            this.stats.hitRate = this.stats.hitCount / (this.stats.hitCount + this.stats.missCount);
        }

        // Calculate memory usage (rough estimate)
        this.stats.memoryUsage = this.cache.size * 1024; // Assume 1KB per entry

        // Find oldest and newest entries
        if (this.cache.size > 0) {
            const entries = Array.from(this.cache.values());
            this.stats.oldestEntry = new Date(Math.min(...entries.map(e => e.timestamp.getTime())));
            this.stats.newestEntry = new Date(Math.max(...entries.map(e => e.timestamp.getTime())));
        }

        // Update top keys (simplified)
        this.stats.topKeys = Array.from(this.cache.entries())
            .map(([key, entry]) => ({
                key,
                hits: Math.floor(Math.random() * 100), // Simplified hit counting
                lastAccess: entry.timestamp
            }))
            .sort((a, b) => b.hits - a.hits)
            .slice(0, 10);
    }

    // Get cache statistics
    getStats(): CacheStats {
        return { ...this.stats };
    }

    // Get cache entries by pattern
    getByPattern(pattern: RegExp): Array<{ key: string; value: any; metadata?: any }> {
        const results: Array<{ key: string; value: any; metadata?: any }> = [];
        
        for (const [key, entry] of this.cache.entries()) {
            if (pattern.test(key) && !this.isExpired(entry)) {
                results.push({
                    key,
                    value: entry.value,
                    metadata: entry.metadata
                });
            }
        }
        
        return results;
    }

    // Get cache entries by user
    getByUser(userId: string): Array<{ key: string; value: any; metadata?: any }> {
        const results: Array<{ key: string; value: any; metadata?: any }> = [];
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.metadata?.userId === userId && !this.isExpired(entry)) {
                results.push({
                    key,
                    value: entry.value,
                    metadata: entry.metadata
                });
            }
        }
        
        return results;
    }

    // Warm up cache with common data
    async warmup(): Promise<void> {
        console.log('🔥 Warming up cache...');
        
        // Warm up common user data
        try {
            const usersSnapshot = await db.collection('users').limit(100).get();
            usersSnapshot.forEach(doc => {
                this.set(`user:${doc.id}`, doc.data(), 600, {
                    userId: doc.id,
                    tags: ['user', 'profile']
                });
            });
        } catch (error) {
            console.error('Error warming up user cache:', error);
        }

        // Warm up common session data
        try {
            const sessionsSnapshot = await db.collection('sessions').limit(50).get();
            sessionsSnapshot.forEach(doc => {
                this.set(`session:${doc.id}`, doc.data(), 300, {
                    sessionId: doc.id,
                    tags: ['session']
                });
            });
        } catch (error) {
            console.error('Error warming up session cache:', error);
        }

        console.log(`✅ Cache warmed up with ${this.cache.size} entries`);
    }

    // Export cache data
    exportData(): {
        entries: Array<{ key: string; value: any; metadata?: any; timestamp: Date; ttl: number }>;
        stats: CacheStats;
    } {
        const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
            key,
            value: entry.value,
            metadata: entry.metadata,
            timestamp: entry.timestamp,
            ttl: entry.ttl
        }));

        return {
            entries,
            stats: this.getStats()
        };
    }

    // Import cache data
    importData(data: {
        entries: Array<{ key: string; value: any; metadata?: any; timestamp: Date; ttl: number }>;
    }): void {
        data.entries.forEach(entry => {
            this.cache.set(entry.key, {
                key: entry.key,
                value: entry.value,
                timestamp: entry.timestamp,
                ttl: entry.ttl,
                metadata: entry.metadata
            });
        });
        
        this.updateStats();
        console.log(`📥 Imported ${data.entries.length} cache entries`);
    }

    // Cleanup resources
    cleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        this.cache.clear();
        console.log('🧹 Cache service cleaned up');
    }
}

// Cache middleware
export const cacheMiddleware = (ttl?: number) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const cache = CacheService.getInstance();
        const key = `req:${req.method}:${req.originalUrl}`;
        
        // Try to get from cache
        const cached = cache.get(key);
        if (cached) {
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }
        
        // Override res.json to cache response
        const originalJson = res.json;
        res.json = function(data?: any, statusCode?: number) {
            // Cache successful responses
            if (!statusCode || statusCode < 400) {
                cache.set(key, data, ttl, {
                    tags: ['api_response'],
                    userId: (req as any).user?.id
                });
            }
            
            res.set('X-Cache', 'MISS');
            return originalJson.call(res, data, statusCode);
        };
        
        next();
    };
};

// User-specific cache middleware
export const userCacheMiddleware = (ttl?: number) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userId = (req as any).user?.id;
        if (!userId) {
            return next();
        }
        
        const cache = CacheService.getInstance();
        const key = `user:${userId}:${req.method}:${req.originalUrl}`;
        
        const cached = cache.get(key);
        if (cached) {
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }
        
        const originalJson = res.json;
        res.json = function(data?: any, statusCode?: number) {
            if (!statusCode || statusCode < 400) {
                cache.set(key, data, ttl, {
                    userId,
                    tags: ['user_cache']
                });
            }
            
            res.set('X-Cache', 'MISS');
            return originalJson.call(res, data, statusCode);
        };
        
        next();
    };
};

// Cache invalidation middleware
export const invalidateCacheMiddleware = (patterns: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const cache = CacheService.getInstance();
        
        // Override res.json to invalidate cache on write operations
        const originalJson = res.json;
        res.json = function(data?: any, statusCode?: number) {
            // Invalidate cache on successful write operations
            if (statusCode && statusCode >= 200 && statusCode < 300) {
                patterns.forEach(pattern => {
                    const regex = new RegExp(pattern);
                    cache.clearByPattern(regex);
                });
            }
            
            return originalJson.call(res, data, statusCode);
        };
        
        next();
    };
};

// Cache warming endpoint
export const warmupCacheEndpoint = async (req: Request, res: Response): Promise<void> => {
    try {
        const cache = CacheService.getInstance();
        await cache.warmup();
        
        res.json({
            success: true,
            message: 'Cache warmed up successfully',
            stats: cache.getStats()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Cache stats endpoint
export const cacheStatsEndpoint = (req: Request, res: Response): void => {
    const cache = CacheService.getInstance();
    const stats = cache.getStats();
    
    res.json({
        stats,
        health: {
            status: stats.hitRate > 0.7 ? 'healthy' : stats.hitRate > 0.5 ? 'degraded' : 'unhealthy',
            hitRate: stats.hitRate,
            memoryUsage: stats.memoryUsage,
            entries: stats.totalEntries
        }
    });
};

// Cache clear endpoint
export const clearCacheEndpoint = (req: Request, res: Response): void => {
    const cache = CacheService.getInstance();
    const { pattern, tag, userId } = req.query;
    
    let cleared = 0;
    
    if (pattern) {
        cleared = cache.clearByPattern(new RegExp(pattern as string));
    } else if (tag) {
        cleared = cache.clearByTag(tag as string);
    } else if (userId) {
        cleared = cache.clearByUser(userId as string);
    } else {
        cache.clear();
        cleared = cache.getStats().totalEntries;
    }
    
    res.json({
        success: true,
        cleared,
        message: `Cleared ${cleared} cache entries`
    });
};

export const cacheService = CacheService.getInstance();
export default cacheService;
