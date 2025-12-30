import { io, Socket } from 'socket.io-client';
import type { SessionContext, InterviewTurn, FinalReport } from '../types';

export interface WebSocketMessage {
    type: 'session_update' | 'turn_added' | 'session_completed' | 'collaboration_invite' | 'heartbeat';
    payload: any;
    timestamp: number;
    userId?: string;
    sessionId?: string;
}

export interface CollaborationInvite {
    roomId: string;
    sessionId: string;
    inviterName: string;
    role: 'observer' | 'interviewee';
}

class WebSocketService {
    private socket: Socket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private listeners: Map<string, Set<(data: any) => void>> = new Map();

    // Connect to WebSocket server
    connect(userId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.socket?.connected) {
                resolve();
                return;
            }

            // In production, this would be your WebSocket server URL
            const serverUrl = process.env.NODE_ENV === 'production' 
                ? 'wss://your-server.com' 
                : 'ws://localhost:3001';

            this.socket = io(serverUrl, {
                auth: { userId },
                transports: ['websocket', 'polling']
            });

            this.socket.on('connect', () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.startHeartbeat();
                resolve();
            });

            this.socket.on('disconnect', (reason) => {
                console.log('WebSocket disconnected:', reason);
                this.stopHeartbeat();
                
                if (reason === 'io server disconnect') {
                    // Server initiated disconnect, don't reconnect automatically
                    return;
                }
                
                this.handleReconnect();
            });

            this.socket.on('connect_error', (error) => {
                console.error('WebSocket connection error:', error);
                this.stopHeartbeat();
                
                if (this.reconnectAttempts === 0) {
                    reject(error);
                }
            });

            // Handle incoming messages
            this.socket.on('message', (message: WebSocketMessage) => {
                this.handleMessage(message);
            });

            // Handle collaboration invites
            this.socket.on('collaboration_invite', (invite: CollaborationInvite) => {
                this.notifyListeners('collaboration_invite', invite);
            });

            // Handle session updates
            this.socket.on('session_update', (data: { sessionId: string; update: any }) => {
                this.notifyListeners('session_update', data);
            });
        });
    }

    // Disconnect from WebSocket server
    disconnect(): void {
        this.stopHeartbeat();
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.listeners.clear();
    }

    // Send a message to the server
    send(type: WebSocketMessage['type'], payload: any, sessionId?: string): void {
        if (!this.socket?.connected) {
            console.warn('WebSocket not connected, message not sent:', type);
            return;
        }

        const message: WebSocketMessage = {
            type,
            payload,
            timestamp: Date.now(),
            userId: (this.socket.auth as any)?.userId,
            sessionId
        };

        this.socket.emit('message', message);
    }

    // Join a session room for real-time updates
    joinSession(sessionId: string): void {
        if (!this.socket?.connected) {
            console.warn('WebSocket not connected, cannot join session');
            return;
        }

        this.socket.emit('join_session', { sessionId });
    }

    // Leave a session room
    leaveSession(sessionId: string): void {
        if (!this.socket?.connected) {
            return;
        }

        this.socket.emit('leave_session', { sessionId });
    }

    // Send collaboration invite
    sendCollaborationInvite(targetUserId: string, invite: CollaborationInvite): void {
        this.send('collaboration_invite', { targetUserId, invite });
    }

    // Broadcast session update
    broadcastSessionUpdate(sessionId: string, update: Partial<SessionContext>): void {
        this.send('session_update', update, sessionId);
    }

    // Broadcast new turn
    broadcastTurnAdded(sessionId: string, turn: InterviewTurn): void {
        this.send('turn_added', { turn }, sessionId);
    }

    // Broadcast session completion
    broadcastSessionCompleted(sessionId: string, report: FinalReport): void {
        this.send('session_completed', { report }, sessionId);
    }

    // Add event listener
    addEventListener(event: string, callback: (data: any) => void): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        
        this.listeners.get(event)!.add(callback);

        // Return unsubscribe function
        return () => {
            const eventListeners = this.listeners.get(event);
            if (eventListeners) {
                eventListeners.delete(callback);
                if (eventListeners.size === 0) {
                    this.listeners.delete(event);
                }
            }
        };
    }

    // Get connection status
    get isConnected(): boolean {
        return this.socket?.connected || false;
    }

    // Handle incoming messages
    private handleMessage(message: WebSocketMessage): void {
        const { type, payload } = message;
        this.notifyListeners(type, payload);
    }

    // Notify all listeners of an event
    private notifyListeners(event: string, data: any): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in WebSocket event listener:', error);
                }
            });
        }
    }

    // Handle reconnection logic
    private handleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            if ((this.socket.auth as any)?.userId) {
                this.connect((this.socket.auth as any).userId).catch(console.error);
            }
        }, delay);
    }

    // Start heartbeat to keep connection alive
    private startHeartbeat(): void {
        this.stopHeartbeat();
        
        this.heartbeatInterval = setInterval(() => {
            if (this.socket?.connected) {
                this.send('heartbeat', { timestamp: Date.now() });
            }
        }, 30000); // Send heartbeat every 30 seconds
    }

    // Stop heartbeat
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
}

// Singleton instance
export const websocketService = new WebSocketService();
export default websocketService;
