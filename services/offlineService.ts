import { sessionService } from './sessionService';
import type { SessionContext, InterviewTurn, FinalReport } from '../types';

interface OfflineSession {
    id: string;
    context: SessionContext;
    turns: InterviewTurn[];
    status: 'active' | 'completed' | 'synced';
    createdAt: number;
    lastModified: number;
    finalReport?: FinalReport;
}

interface OfflineData {
    sessions: OfflineSession[];
    lastSyncTime: number;
    userId: string;
}

class OfflineService {
    private readonly STORAGE_KEY = 'mockmate_offline_data';
    private readonly SYNC_QUEUE_KEY = 'mockmate_sync_queue';
    
    // Check if online/offline
    get isOnline(): boolean {
        return navigator.onLine;
    }

    // Initialize offline service
    async initialize(userId: string): Promise<void> {
        const offlineData = this.getOfflineData();
        if (!offlineData || offlineData.userId !== userId) {
            this.clearOfflineData();
            this.saveOfflineData({
                sessions: [],
                lastSyncTime: Date.now(),
                userId
            });
        }

        // Set up online/offline event listeners
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
    }

    // Save session data locally
    async saveSessionOffline(session: OfflineSession): Promise<void> {
        const offlineData = this.getOfflineData();
        if (!offlineData) return;

        const existingIndex = offlineData.sessions.findIndex(s => s.id === session.id);
        if (existingIndex >= 0) {
            offlineData.sessions[existingIndex] = session;
        } else {
            offlineData.sessions.push(session);
        }

        this.saveOfflineData(offlineData);
    }

    // Get session from local storage
    getSessionOffline(sessionId: string): OfflineSession | null {
        const offlineData = this.getOfflineData();
        if (!offlineData) return null;

        return offlineData.sessions.find(s => s.id === sessionId) || null;
    }

    // Get all offline sessions
    getOfflineSessions(): OfflineSession[] {
        const offlineData = this.getOfflineData();
        return offlineData?.sessions || [];
    }

    // Sync offline data with server
    async syncWithServer(): Promise<void> {
        if (!this.isOnline) {
            throw new Error('Cannot sync while offline');
        }

        const offlineData = this.getOfflineData();
        if (!offlineData) return;

        const unsyncedSessions = offlineData.sessions.filter(s => s.status !== 'synced');
        
        for (const session of unsyncedSessions) {
            try {
                await this.syncSession(session);
                session.status = 'synced';
            } catch (error) {
                console.error(`Failed to sync session ${session.id}:`, error);
                // Keep as unsynced for next attempt
            }
        }

        // Update last sync time
        offlineData.lastSyncTime = Date.now();
        this.saveOfflineData(offlineData);
    }

    // Sync individual session
    private async syncSession(session: OfflineSession): Promise<void> {
        try {
            // Try to create/update session on server
            if (session.finalReport) {
                // Complete session with report
                await sessionService.completeSession(session.id, session.finalReport);
            } else {
                // Update session context and turns
                await sessionService.updateSessionContext(session.id, session.context);
                for (const turn of session.turns) {
                    await sessionService.addTurn(session.id, turn);
                }
            }
        } catch (error) {
            // If session doesn't exist on server, create it
            if (error.message.includes('not found')) {
                await sessionService.createSession({
                    userId: this.getOfflineData()?.userId || '',
                    context: session.context,
                    turns: session.turns
                });
            } else {
                throw error;
            }
        }
    }

    // Add session to sync queue
    addToSyncQueue(action: string, data: any): void {
        const queue = this.getSyncQueue();
        queue.push({
            id: Date.now().toString(),
            action,
            data,
            timestamp: Date.now()
        });
        this.saveSyncQueue(queue);
    }

    // Process sync queue
    async processSyncQueue(): Promise<void> {
        if (!this.isOnline) return;

        const queue = this.getSyncQueue();
        const remainingQueue = [];

        for (const item of queue) {
            try {
                await this.processQueueItem(item);
            } catch (error) {
                console.error(`Failed to process queue item ${item.id}:`, error);
                remainingQueue.push(item);
            }
        }

        this.saveSyncQueue(remainingQueue);
    }

    // Process individual queue item
    private async processQueueItem(item: any): Promise<void> {
        switch (item.action) {
            case 'create_session':
                await sessionService.createSession(item.data);
                break;
            case 'update_session':
                await sessionService.updateSessionContext(item.data.sessionId, item.data.context);
                break;
            case 'add_turn':
                await sessionService.addTurn(item.data.sessionId, item.data.turn);
                break;
            case 'complete_session':
                await sessionService.completeSession(item.data.sessionId, item.data.report);
                break;
            default:
                console.warn(`Unknown queue action: ${item.action}`);
        }
    }

    // Get offline data from localStorage
    private getOfflineData(): OfflineData | null {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error reading offline data:', error);
            return null;
        }
    }

    // Save offline data to localStorage
    private saveOfflineData(data: OfflineData): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving offline data:', error);
        }
    }

    // Get sync queue from localStorage
    private getSyncQueue(): any[] {
        try {
            const queue = localStorage.getItem(this.SYNC_QUEUE_KEY);
            return queue ? JSON.parse(queue) : [];
        } catch (error) {
            console.error('Error reading sync queue:', error);
            return [];
        }
    }

    // Save sync queue to localStorage
    private saveSyncQueue(queue: any[]): void {
        try {
            localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(queue));
        } catch (error) {
            console.error('Error saving sync queue:', error);
        }
    }

    // Clear all offline data
    clearOfflineData(): void {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            localStorage.removeItem(this.SYNC_QUEUE_KEY);
        } catch (error) {
            console.error('Error clearing offline data:', error);
        }
    }

    // Get storage usage
    getStorageUsage(): { used: number; available: number; percentage: number } {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            const queue = localStorage.getItem(this.SYNC_QUEUE_KEY);
            const used = (data?.length || 0) + (queue?.length || 0);
            
            // Estimate available space (localStorage typically has 5-10MB limit)
            const available = 5 * 1024 * 1024; // 5MB
            const percentage = (used / available) * 100;

            return { used, available, percentage };
        } catch (error) {
            console.error('Error calculating storage usage:', error);
            return { used: 0, available: 0, percentage: 0 };
        }
    }

    // Handle online event
    private handleOnline(): void {
        console.log('App is online - attempting to sync');
        this.syncWithServer().catch(console.error);
        this.processSyncQueue().catch(console.error);
    }

    // Handle offline event
    private handleOffline(): void {
        console.log('App is offline - using local storage');
    }

    // Cleanup old data
    cleanupOldData(maxAge: number = 30 * 24 * 60 * 60 * 1000): void {
        const offlineData = this.getOfflineData();
        if (!offlineData) return;

        const cutoffTime = Date.now() - maxAge;
        offlineData.sessions = offlineData.sessions.filter(session => 
            session.lastModified > cutoffTime || session.status !== 'synced'
        );

        this.saveOfflineData(offlineData);
    }
}

export const offlineService = new OfflineService();
export default offlineService;
