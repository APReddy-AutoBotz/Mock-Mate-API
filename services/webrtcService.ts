import { APIError, ValidationError } from '../utils/errorHandler';

interface WebRTCConfig {
    iceServers: RTCIceServer[];
    constraints: MediaStreamConstraints;
    offerOptions: RTCOfferOptions;
}

interface PeerConnection {
    id: string;
    userId: string;
    connection: RTCPeerConnection;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isInitiator: boolean;
    state: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
    createdAt: Date;
    lastActivity: Date;
}

interface CollaborationRoom {
    id: string;
    name: string;
    type: 'interview' | 'practice' | 'review' | 'mentoring';
    participants: Array<{
        userId: string;
        name: string;
        role: 'interviewer' | 'candidate' | 'observer' | 'mentor';
        joinedAt: Date;
        permissions: string[];
    }>;
    settings: {
        maxParticipants: number;
        allowScreenShare: boolean;
        allowRecording: boolean;
        requireApproval: boolean;
        enableChat: boolean;
        enableWhiteboard: boolean;
    };
    createdAt: Date;
    createdBy: string;
    isActive: boolean;
}

interface SignalingMessage {
    type: 'offer' | 'answer' | 'ice-candidate' | 'join-room' | 'leave-room' | 'chat' | 'screen-share' | 'whiteboard';
    roomId: string;
    userId: string;
    data: any;
    timestamp: Date;
}

interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    message: string;
    timestamp: Date;
    type: 'text' | 'file' | 'system';
}

interface WhiteboardAction {
    type: 'draw' | 'erase' | 'clear' | 'text' | 'shape';
    data: any;
    userId: string;
    timestamp: Date;
}

class WebRTCService {
    private peerConnections: Map<string, PeerConnection> = new Map();
    private rooms: Map<string, CollaborationRoom> = new Map();
    private localStream: MediaStream | null = null;
    private signalingCallbacks: Map<string, (message: SignalingMessage) => void> = new Map();
    private config: WebRTCConfig;

    constructor() {
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ],
            constraints: {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            },
            offerOptions: {
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            }
        };
    }

    // Initialize local media stream
    async initializeLocalStream(constraints?: MediaStreamConstraints): Promise<MediaStream> {
        try {
            const streamConstraints = constraints || this.config.constraints;
            this.localStream = await navigator.mediaDevices.getUserMedia(streamConstraints);
            return this.localStream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw new APIError('Failed to access camera/microphone');
        }
    }

    // Create collaboration room
    async createRoom(
        userId: string,
        roomData: Omit<CollaborationRoom, 'id' | 'createdAt' | 'isActive'>
    ): Promise<string> {
        const roomId = this.generateRoomId();
        
        const room: CollaborationRoom = {
            ...roomData,
            id: roomId,
            createdAt: new Date(),
            isActive: true
        };

        this.rooms.set(roomId, room);
        return roomId;
    }

    // Join room
    async joinRoom(
        userId: string,
        roomId: string,
        participantData: Omit<CollaborationRoom['participants'][0], 'joinedAt'>
    ): Promise<{
        room: CollaborationRoom;
        peerConnections: string[];
    }> {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new ValidationError('Room not found');
        }

        if (room.participants.length >= room.settings.maxParticipants) {
            throw new ValidationError('Room is full');
        }

        // Add participant to room
        const participant = {
            ...participantData,
            joinedAt: new Date()
        };
        room.participants.push(participant);

        // Create peer connections with existing participants
        const peerConnections: string[] = [];
        
        for (const existingParticipant of room.participants) {
            if (existingParticipant.userId !== userId) {
                const connectionId = await this.createPeerConnection(userId, existingParticipant.userId);
                peerConnections.push(connectionId);
            }
        }

        return { room, peerConnections };
    }

    // Create peer connection
    async createPeerConnection(
        localUserId: string,
        remoteUserId: string,
        isInitiator: boolean = false
    ): Promise<string> {
        const connectionId = `${localUserId}-${remoteUserId}`;
        
        const peerConnection = new RTCPeerConnection(this.config);
        
        const pc: PeerConnection = {
            id: connectionId,
            userId: localUserId,
            connection: peerConnection,
            localStream: null,
            remoteStream: null,
            isInitiator,
            state: 'new',
            createdAt: new Date(),
            lastActivity: new Date()
        };

        // Add local stream if available
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream!);
            });
            pc.localStream = this.localStream;
        }

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalingMessage({
                    type: 'ice-candidate',
                    roomId: this.getRoomIdForConnection(connectionId),
                    userId: localUserId,
                    data: event.candidate,
                    timestamp: new Date()
                });
            }
        };

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            pc.remoteStream = event.streams[0];
            pc.state = 'connected';
            pc.lastActivity = new Date();
            
            // Notify about new remote stream
            this.onRemoteStream(connectionId, event.streams[0]);
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            pc.state = peerConnection.connectionState as PeerConnection['state'];
            pc.lastActivity = new Date();
            
            if (pc.state === 'disconnected' || pc.state === 'failed' || pc.state === 'closed') {
                this.cleanupConnection(connectionId);
            }
        };

        this.peerConnections.set(connectionId, pc);

        // Create offer if initiator
        if (isInitiator) {
            const offer = await peerConnection.createOffer(this.config.offerOptions);
            await peerConnection.setLocalDescription(offer);
            
            this.sendSignalingMessage({
                type: 'offer',
                roomId: this.getRoomIdForConnection(connectionId),
                userId: localUserId,
                data: offer,
                timestamp: new Date()
            });
        }

        return connectionId;
    }

    // Handle incoming offer
    async handleOffer(
        connectionId: string,
        offer: RTCSessionDescriptionInit
    ): Promise<void> {
        const pc = this.peerConnections.get(connectionId);
        if (!pc) {
            throw new ValidationError('Connection not found');
        }

        await pc.connection.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await pc.connection.createAnswer();
        await pc.connection.setLocalDescription(answer);
        
        this.sendSignalingMessage({
            type: 'answer',
            roomId: this.getRoomIdForConnection(connectionId),
            userId: pc.userId,
            data: answer,
            timestamp: new Date()
        });
    }

    // Handle incoming answer
    async handleAnswer(
        connectionId: string,
        answer: RTCSessionDescriptionInit
    ): Promise<void> {
        const pc = this.peerConnections.get(connectionId);
        if (!pc) {
            throw new ValidationError('Connection not found');
        }

        await pc.connection.setRemoteDescription(new RTCSessionDescription(answer));
    }

    // Handle ICE candidate
    async handleIceCandidate(
        connectionId: string,
        candidate: RTCIceCandidateInit
    ): Promise<void> {
        const pc = this.peerConnections.get(connectionId);
        if (!pc) {
            return;
        }

        await pc.connection.addIceCandidate(new RTCIceCandidate(candidate));
    }

    // Start screen sharing
    async startScreenShare(connectionId: string): Promise<MediaStream> {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            const pc = this.peerConnections.get(connectionId);
            if (pc) {
                const videoTrack = screenStream.getVideoTracks()[0];
                if (videoTrack) {
                    const sender = pc.connection.getSenders().find(s => 
                        s.track && s.track.kind === 'video'
                    );
                    
                    if (sender) {
                        await sender.replaceTrack(videoTrack);
                    } else {
                        pc.connection.addTrack(videoTrack, screenStream);
                    }
                }
            }

            return screenStream;
        } catch (error) {
            console.error('Error starting screen share:', error);
            throw new APIError('Failed to start screen sharing');
        }
    }

    // Stop screen sharing
    async stopScreenShare(connectionId: string): Promise<void> {
        const pc = this.peerConnections.get(connectionId);
        if (pc) {
            const senders = pc.connection.getSenders();
            const videoSender = senders.find(s => 
                s.track && s.track.kind === 'video' && s.track.label.includes('screen')
            );
            
            if (videoSender) {
                await videoSender.replaceTrack(null!);
            }
        }
    }

    // Send chat message
    sendChatMessage(roomId: string, userId: string, userName: string, message: string): void {
        const chatMessage: ChatMessage = {
            id: this.generateId(),
            userId,
            userName,
            message,
            timestamp: new Date(),
            type: 'text'
        };

        this.sendSignalingMessage({
            type: 'chat',
            roomId,
            userId,
            data: chatMessage,
            timestamp: new Date()
        });
    }

    // Send whiteboard action
    sendWhiteboardAction(roomId: string, userId: string, action: WhiteboardAction): void {
        this.sendSignalingMessage({
            type: 'whiteboard',
            roomId,
            userId,
            data: action,
            timestamp: new Date()
        });
    }

    // Register signaling callback
    registerSignalingCallback(userId: string, callback: (message: SignalingMessage) => void): void {
        this.signalingCallbacks.set(userId, callback);
    }

    // Send signaling message
    private sendSignalingMessage(message: SignalingMessage): void {
        // In production, this would send via WebSocket or signaling server
        // For now, simulate by calling callbacks
        this.signalingCallbacks.forEach((callback, userId) => {
            if (userId !== message.userId) {
                callback(message);
            }
        });
    }

    // Handle incoming signaling message
    async handleSignalingMessage(message: SignalingMessage): Promise<void> {
        switch (message.type) {
            case 'offer':
                // Find connection for this offer
                const offerConnection = Array.from(this.peerConnections.values())
                    .find(pc => !pc.isInitiator && pc.userId === message.userId);
                
                if (offerConnection) {
                    await this.handleOffer(offerConnection.id, message.data);
                }
                break;

            case 'answer':
                const answerConnection = Array.from(this.peerConnections.values())
                    .find(pc => pc.isInitiator && pc.userId !== message.userId);
                
                if (answerConnection) {
                    await this.handleAnswer(answerConnection.id, message.data);
                }
                break;

            case 'ice-candidate':
                const iceConnection = Array.from(this.peerConnections.values())
                    .find(pc => pc.userId !== message.userId);
                
                if (iceConnection) {
                    await this.handleIceCandidate(iceConnection.id, message.data);
                }
                break;

            case 'chat':
            case 'whiteboard':
                // Broadcast to all participants in room
                this.broadcastToRoom(message.roomId, message);
                break;

            default:
                console.warn('Unknown signaling message type:', message.type);
        }
    }

    // Broadcast message to room participants
    private broadcastToRoom(roomId: string, message: SignalingMessage): void {
        const room = this.rooms.get(roomId);
        if (room) {
            room.participants.forEach(participant => {
                const callback = this.signalingCallbacks.get(participant.userId);
                if (callback) {
                    callback(message);
                }
            });
        }
    }

    // Get room for connection
    private getRoomIdForConnection(connectionId: string): string {
        // Find room that contains both users in this connection
        for (const room of this.rooms.values()) {
            const [user1, user2] = connectionId.split('-');
            const hasUser1 = room.participants.some(p => p.userId === user1);
            const hasUser2 = room.participants.some(p => p.userId === user2);
            
            if (hasUser1 && hasUser2) {
                return room.id;
            }
        }
        return '';
    }

    // Handle remote stream
    private onRemoteStream(connectionId: string, stream: MediaStream): void {
        // Notify about new remote stream
        console.log(`Remote stream received for connection ${connectionId}`);
        
        // In production, would emit event or call callback
        const event = new CustomEvent('remoteStream', {
            detail: { connectionId, stream }
        });
        window.dispatchEvent(event);
    }

    // Leave room
    async leaveRoom(userId: string, roomId: string): Promise<void> {
        const room = this.rooms.get(roomId);
        if (!room) {
            return;
        }

        // Remove participant
        room.participants = room.participants.filter(p => p.userId !== userId);

        // Close peer connections
        const connectionsToClose = Array.from(this.peerConnections.entries())
            .filter(([id, pc]) => id.includes(userId))
            .map(([id]) => id);

        connectionsToClose.forEach(connectionId => {
            this.cleanupConnection(connectionId);
        });

        // Remove room if empty
        if (room.participants.length === 0) {
            this.rooms.delete(roomId);
        }
    }

    // Cleanup connection
    private cleanupConnection(connectionId: string): void {
        const pc = this.peerConnections.get(connectionId);
        if (pc) {
            pc.connection.close();
            this.peerConnections.delete(connectionId);
        }
    }

    // Get connection statistics
    getConnectionStats(connectionId: string): Promise<RTCStatsReport | null> {
        const pc = this.peerConnections.get(connectionId);
        if (!pc) {
            return Promise.resolve(null);
        }

        return pc.connection.getStats().then(stats => stats);
    }

    // Get room statistics
    getRoomStats(roomId: string): {
        participantCount: number;
        activeConnections: number;
        totalBandwidth: number;
        averageLatency: number;
    } | null {
        const room = this.rooms.get(roomId);
        if (!room) {
            return null;
        }

        const activeConnections = Array.from(this.peerConnections.values())
            .filter(pc => this.getRoomIdForConnection(pc.id) === roomId)
            .filter(pc => pc.state === 'connected');

        return {
            participantCount: room.participants.length,
            activeConnections: activeConnections.length,
            totalBandwidth: 0, // Would calculate from stats
            averageLatency: 0   // Would calculate from stats
        };
    }

    // Test WebRTC support
    static testSupport(): {
        isSupported: boolean;
        features: string[];
        limitations: string[];
    } {
        const features: string[] = [];
        const limitations: string[] = [];

        if (!window.RTCPeerConnection) {
            return {
                isSupported: false,
                features: [],
                limitations: ['WebRTC not supported in this browser']
            };
        }

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            features.push('Camera/Microphone access');
        } else {
            limitations.push('Camera/Microphone access not available');
        }

        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
            features.push('Screen sharing');
        } else {
            limitations.push('Screen sharing not available');
        }

        if (window.RTCDataChannel) {
            features.push('Data channels');
        } else {
            limitations.push('Data channels not available');
        }

        return {
            isSupported: true,
            features,
            limitations
        };
    }

    // Get available devices
    async getAvailableDevices(): Promise<{
        cameras: MediaDeviceInfo[];
        microphones: MediaDeviceInfo[];
        speakers: MediaDeviceInfo[];
    }> {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            return { cameras: [], microphones: [], speakers: [] };
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        
        return {
            cameras: devices.filter(device => device.kind === 'videoinput'),
            microphones: devices.filter(device => device.kind === 'audioinput'),
            speakers: devices.filter(device => device.kind === 'audiooutput')
        };
    }

    // Generate room ID
    private generateRoomId(): string {
        return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Generate ID
    private generateId(): string {
        return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Cleanup all connections
    cleanup(): void {
        // Close all peer connections
        this.peerConnections.forEach((pc, id) => {
            pc.connection.close();
        });
        this.peerConnections.clear();

        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Clear rooms
        this.rooms.clear();
        this.signalingCallbacks.clear();
    }

    // Get configuration
    getConfig(): WebRTCConfig {
        return { ...this.config };
    }

    // Update configuration
    updateConfig(updates: Partial<WebRTCConfig>): void {
        this.config = { ...this.config, ...updates };
    }
}

export const webrtcService = new WebRTCService();
export default webrtcService;
