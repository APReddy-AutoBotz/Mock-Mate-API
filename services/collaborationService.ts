import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs,
    updateDoc, 
    onSnapshot,
    serverTimestamp,
    Timestamp,
    orderBy,
    query,
    where,
    limit
} from 'firebase/firestore';
import { auth, db } from './firebaseClient';
import type { SessionContext, InterviewTurn } from '../types';

export interface CollaborationRoom {
    id: string;
    sessionId: string;
    hostId: string;
    participants: Participant[];
    status: 'active' | 'ended';
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface Participant {
    userId: string;
    displayName: string;
    role: 'host' | 'observer' | 'interviewee';
    joinedAt: Timestamp;
    isActive: boolean;
}

export interface LiveUpdate {
    id: string;
    roomId: string;
    type: 'turn_added' | 'context_updated' | 'status_changed' | 'participant_joined' | 'participant_left';
    data: any;
    userId: string;
    timestamp: Timestamp;
}

class CollaborationService {
    private readonly roomsCollection = 'collaboration_rooms';
    private readonly updatesCollection = 'live_updates';

    // Create a collaboration room for a session
    async createRoom(sessionId: string): Promise<string> {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to create a room');
        }

        const roomRef = doc(db, this.roomsCollection);
        const room: CollaborationRoom = {
            id: roomRef.id,
            sessionId,
            hostId: auth.currentUser.uid,
            participants: [{
                userId: auth.currentUser.uid,
                displayName: auth.currentUser.displayName || 'Host',
                role: 'host',
                joinedAt: Timestamp.now(),
                isActive: true
            }],
            status: 'active',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        await setDoc(roomRef, room);
        return roomRef.id;
    }

    // Join an existing collaboration room
    async joinRoom(roomId: string, role: 'observer' | 'interviewee' = 'observer'): Promise<void> {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to join a room');
        }

        const roomRef = doc(db, this.roomsCollection, roomId);
        const roomDoc = await getDoc(roomRef);

        if (!roomDoc.exists()) {
            throw new Error('Room not found');
        }

        const room = roomDoc.data() as CollaborationRoom;
        const existingParticipant = room.participants.find(p => p.userId === auth.currentUser.uid);

        if (existingParticipant) {
            // Reactivate existing participant
            await updateDoc(roomRef, {
                participants: room.participants.map(p => 
                    p.userId === auth.currentUser.uid 
                        ? { ...p, isActive: true, joinedAt: Timestamp.now() }
                        : p
                ),
                updatedAt: serverTimestamp()
            });
        } else {
            // Add new participant
            const newParticipant: Participant = {
                userId: auth.currentUser.uid,
                displayName: auth.currentUser.displayName || 'Participant',
                role,
                joinedAt: Timestamp.now(),
                isActive: true
            };

            await updateDoc(roomRef, {
                participants: [...room.participants, newParticipant],
                updatedAt: serverTimestamp()
            });
        }

        // Broadcast participant joined
        await this.broadcastUpdate(roomId, 'participant_joined', {
            userId: auth.currentUser.uid,
            displayName: auth.currentUser.displayName || 'Participant',
            role
        });
    }

    // Leave a collaboration room
    async leaveRoom(roomId: string): Promise<void> {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to leave a room');
        }

        const roomRef = doc(db, this.roomsCollection, roomId);
        const roomDoc = await getDoc(roomRef);

        if (!roomDoc.exists()) {
            return;
        }

        const room = roomDoc.data() as CollaborationRoom;
        const updatedParticipants = room.participants.map(p => 
            p.userId === auth.currentUser.uid 
                ? { ...p, isActive: false }
                : p
        );

        await updateDoc(roomRef, {
            participants: updatedParticipants,
            updatedAt: serverTimestamp()
        });

        // Broadcast participant left
        await this.broadcastUpdate(roomId, 'participant_left', {
            userId: auth.currentUser.uid
        });
    }

    // Get room details
    async getRoom(roomId: string): Promise<CollaborationRoom | null> {
        const roomRef = doc(db, this.roomsCollection, roomId);
        const roomDoc = await getDoc(roomRef);

        if (!roomDoc.exists()) {
            return null;
        }

        return {
            ...roomDoc.data(),
            id: roomDoc.id
        } as CollaborationRoom;
    }

    // Listen for room updates
    onRoomUpdate(roomId: string, callback: (room: CollaborationRoom | null) => void): () => void {
        const roomRef = doc(db, this.roomsCollection, roomId);

        return onSnapshot(roomRef, (doc) => {
            if (!doc.exists()) {
                callback(null);
                return;
            }

            callback({
                ...doc.data(),
                id: doc.id
            } as CollaborationRoom);
        });
    }

    // Listen for live updates in a room
    onLiveUpdates(roomId: string, callback: (update: LiveUpdate) => void): () => void {
        const q = query(
            collection(db, this.updatesCollection),
            where('roomId', '==', roomId),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        return onSnapshot(q, (querySnapshot) => {
            querySnapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const update = {
                        ...change.doc.data(),
                        id: change.doc.id
                    } as LiveUpdate;
                    callback(update);
                }
            });
        });
    }

    // Broadcast an update to all room participants
    private async broadcastUpdate(roomId: string, type: LiveUpdate['type'], data: any): Promise<void> {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to broadcast updates');
        }

        const updateRef = doc(db, this.updatesCollection);
        const update: LiveUpdate = {
            id: updateRef.id,
            roomId,
            type,
            data,
            userId: auth.currentUser.uid,
            timestamp: Timestamp.now()
        };

        await setDoc(updateRef, update);
    }

    // Broadcast when a new turn is added
    async broadcastTurnAdded(roomId: string, turn: InterviewTurn): Promise<void> {
        await this.broadcastUpdate(roomId, 'turn_added', { turn });
    }

    // Broadcast when session context is updated
    async broadcastContextUpdated(roomId: string, context: Partial<SessionContext>): Promise<void> {
        await this.broadcastUpdate(roomId, 'context_updated', { context });
    }

    // Broadcast when session status changes
    async broadcastStatusChanged(roomId: string, status: string): Promise<void> {
        await this.broadcastUpdate(roomId, 'status_changed', { status });
    }

    // End a collaboration session
    async endRoom(roomId: string): Promise<void> {
        const roomRef = doc(db, this.roomsCollection, roomId);
        
        await updateDoc(roomRef, {
            status: 'ended',
            updatedAt: serverTimestamp()
        });

        await this.broadcastUpdate(roomId, 'status_changed', { status: 'ended' });
    }

    // Get active rooms for the current user
    async getUserActiveRooms(): Promise<CollaborationRoom[]> {
        if (!auth.currentUser) {
            return [];
        }

        const q = query(
            collection(db, this.roomsCollection),
            where('participants', 'array-contains', {
                userId: auth.currentUser.uid,
                isActive: true
            }),
            where('status', '==', 'active'),
            orderBy('updatedAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })) as CollaborationRoom[];
    }
}

export const collaborationService = new CollaborationService();
export default collaborationService;
