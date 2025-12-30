import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    limit,
    Timestamp,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './firebaseClient';
import type { SessionContext, FinalReport, InterviewTurn } from '../types';

export interface SessionData {
    id: string;
    userId: string;
    context: SessionContext;
    status: 'active' | 'completed' | 'abandoned';
    createdAt: Timestamp;
    updatedAt: Timestamp;
    turns: InterviewTurn[];
    finalReport?: FinalReport;
}

export interface SessionCreateData {
    userId: string;
    context: SessionContext;
    turns?: InterviewTurn[];
}

class SessionService {
    private readonly collection = 'sessions';

    // Create a new session
    async createSession(data: SessionCreateData): Promise<string> {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to create a session');
        }

        const sessionRef = doc(db, this.collection);
        const sessionData: SessionData = {
            id: sessionRef.id,
            userId: data.userId,
            context: data.context,
            status: 'active',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            turns: data.turns || []
        };

        await setDoc(sessionRef, sessionData);
        return sessionRef.id;
    }

    // Get a session by ID
    async getSession(sessionId: string): Promise<SessionData | null> {
        const sessionRef = doc(db, this.collection, sessionId);
        const sessionDoc = await getDoc(sessionRef);
        
        if (!sessionDoc.exists()) {
            return null;
        }

        return {
            ...sessionDoc.data(),
            id: sessionDoc.id
        } as SessionData;
    }

    // Update session context
    async updateSessionContext(sessionId: string, context: Partial<SessionContext>): Promise<void> {
        const sessionRef = doc(db, this.collection, sessionId);
        await updateDoc(sessionRef, {
            context,
            updatedAt: serverTimestamp()
        });
    }

    // Add a turn to session
    async addTurn(sessionId: string, turn: InterviewTurn): Promise<void> {
        const sessionRef = doc(db, this.collection, sessionId);
        await updateDoc(sessionRef, {
            turns: [...(await this.getSessionTurns(sessionId)), turn],
            updatedAt: serverTimestamp()
        });
    }

    // Get session turns
    private async getSessionTurns(sessionId: string): Promise<InterviewTurn[]> {
        const session = await this.getSession(sessionId);
        return session?.turns || [];
    }

    // Complete session with final report
    async completeSession(sessionId: string, report: FinalReport): Promise<void> {
        const sessionRef = doc(db, this.collection, sessionId);
        await updateDoc(sessionRef, {
            status: 'completed',
            finalReport: report,
            updatedAt: serverTimestamp()
        });
    }

    // Abandon session
    async abandonSession(sessionId: string): Promise<void> {
        const sessionRef = doc(db, this.collection, sessionId);
        await updateDoc(sessionRef, {
            status: 'abandoned',
            updatedAt: serverTimestamp()
        });
    }

    // Get user's recent sessions
    async getUserSessions(userId: string, maxCount: number = 10): Promise<SessionData[]> {
        const q = query(
            collection(db, this.collection),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(maxCount)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })) as SessionData[];
    }

    // Delete a session
    async deleteSession(sessionId: string): Promise<void> {
        const sessionRef = doc(db, this.collection, sessionId);
        await deleteDoc(sessionRef);
    }

    // Real-time session listener
    onSessionUpdate(sessionId: string, callback: (session: SessionData | null) => void): () => void {
        const sessionRef = doc(db, this.collection, sessionId);
        
        return onSnapshot(sessionRef, (doc) => {
            if (!doc.exists()) {
                callback(null);
                return;
            }

            callback({
                ...doc.data(),
                id: doc.id
            } as SessionData);
        });
    }

    // Get session statistics for analytics
    async getSessionStats(userId: string): Promise<{
        totalSessions: number;
        completedSessions: number;
        averageScore: number;
        totalDuration: number;
    }> {
        const sessions = await this.getUserSessions(userId, 100); // Get more for stats
        
        const completed = sessions.filter(s => s.status === 'completed');
        const scores = completed
            .map(s => {
                if (!s.finalReport?.advisoryPanel) return 0;
                const allScores = s.finalReport.advisoryPanel.flatMap(a => 
                    (a.scores || []).map(s => s.score)
                );
                return allScores.length > 0 
                    ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
                    : 0;
            })
            .filter(score => score > 0);

        const totalDuration = sessions.reduce((acc, session) => {
            if (!session.finalReport) return acc;
            // Estimate duration based on number of turns (2 minutes per turn average)
            return acc + (session.turns.length * 2 * 60 * 1000);
        }, 0);

        return {
            totalSessions: sessions.length,
            completedSessions: completed.length,
            averageScore: scores.length > 0 
                ? scores.reduce((a, b) => a + b, 0) / scores.length 
                : 0,
            totalDuration
        };
    }
}

export const sessionService = new SessionService();
export default sessionService;
