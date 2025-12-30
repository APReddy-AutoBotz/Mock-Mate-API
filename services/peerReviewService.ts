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
import type { SessionContext, InterviewTurn, FinalReport } from '../types';

export interface PeerReview {
    id: string;
    sessionId: string;
    reviewerId: string;
    revieweeId: string;
    status: 'pending' | 'completed' | 'expired';
    createdAt: Timestamp;
    completedAt?: Timestamp;
    rating: number; // 1-5
    feedback: string;
    strengths: string[];
    improvements: string[];
    recommendations: string[];
    anonymous: boolean;
    reviewerInfo?: {
        name: string;
        title: string;
        experience: string;
    };
}

export interface MentorshipRequest {
    id: string;
    menteeId: string;
    mentorId?: string;
    status: 'open' | 'matched' | 'completed' | 'cancelled';
    category: string;
    description: string;
    goals: string[];
    experience: string;
    targetRole: string;
    createdAt: Timestamp;
    matchedAt?: Timestamp;
    completedAt?: Timestamp;
}

export interface MentorProfile {
    id: string;
    userId: string;
    name: string;
    title: string;
    company?: string;
    experience: string;
    expertise: string[];
    bio: string;
    availability: {
        days: string[];
        timeRange: string;
        timezone: string;
    };
    mentorshipStyle: string;
    rating: number;
    reviewCount: number;
    active: boolean;
    createdAt: Timestamp;
}

export interface ReviewSession {
    id: string;
    reviewId: string;
    reviewerId: string;
    revieweeId: string;
    scheduledFor: Timestamp;
    duration: number; // minutes
    status: 'scheduled' | 'completed' | 'cancelled';
    meetingLink?: string;
    notes?: string;
    feedback?: string;
}

class PeerReviewService {
    private readonly reviewsCollection = 'peer_reviews';
    private readonly mentorshipCollection = 'mentorship_requests';
    private readonly mentorsCollection = 'mentor_profiles';
    private readonly sessionsCollection = 'review_sessions';

    // Create peer review request
    async createReviewRequest(
        sessionId: string,
        revieweeId: string,
        category: string,
        anonymous: boolean = true
    ): Promise<string> {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to create review request');
        }

        const reviewRef = doc(db, this.reviewsCollection);
        const review: PeerReview = {
            id: reviewRef.id,
            sessionId,
            reviewerId: auth.currentUser.uid,
            revieweeId,
            status: 'pending',
            createdAt: Timestamp.now(),
            rating: 0,
            feedback: '',
            strengths: [],
            improvements: [],
            recommendations: [],
            anonymous
        };

        await setDoc(reviewRef, review);
        return reviewRef.id;
    }

    // Get pending reviews for user
    async getPendingReviews(userId: string): Promise<PeerReview[]> {
        const q = query(
            collection(db, this.reviewsCollection),
            where('reviewerId', '==', userId),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })) as PeerReview[];
    }

    // Submit peer review
    async submitReview(
        reviewId: string,
        rating: number,
        feedback: string,
        strengths: string[],
        improvements: string[],
        recommendations: string[]
    ): Promise<void> {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to submit review');
        }

        const reviewRef = doc(db, this.reviewsCollection, reviewId);
        await updateDoc(reviewRef, {
            rating,
            feedback,
            strengths,
            improvements,
            recommendations,
            status: 'completed',
            completedAt: serverTimestamp()
        });
    }

    // Get reviews for user's sessions
    async getUserReviews(userId: string, maxCount: number = 20): Promise<PeerReview[]> {
        const q = query(
            collection(db, this.reviewsCollection),
            where('revieweeId', '==', userId),
            where('status', '==', 'completed'),
            orderBy('completedAt', 'desc'),
            limit(maxCount)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })) as PeerReview[];
    }

    // Create mentorship request
    async createMentorshipRequest(
        category: string,
        description: string,
        goals: string[],
        experience: string,
        targetRole: string
    ): Promise<string> {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to create mentorship request');
        }

        const requestRef = doc(db, this.mentorshipCollection);
        const request: MentorshipRequest = {
            id: requestRef.id,
            menteeId: auth.currentUser.uid,
            status: 'open',
            category,
            description,
            goals,
            experience,
            targetRole,
            createdAt: Timestamp.now()
        };

        await setDoc(requestRef, request);
        return requestRef.id;
    }

    // Get available mentors
    async getAvailableMentors(category?: string): Promise<MentorProfile[]> {
        let q = query(
            collection(db, this.mentorsCollection),
            where('active', '==', true),
            orderBy('rating', 'desc')
        );

        if (category) {
            q = query(
                collection(db, this.mentorsCollection),
                where('active', '==', true),
                where('expertise', 'array-contains', category),
                orderBy('rating', 'desc')
            );
        }

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })) as MentorProfile[];
    }

    // Create/update mentor profile
    async createMentorProfile(profile: Omit<MentorProfile, 'id' | 'userId' | 'createdAt'>): Promise<string> {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to create mentor profile');
        }

        const mentorRef = doc(db, this.mentorsCollection);
        const mentorProfile: MentorProfile = {
            ...profile,
            id: mentorRef.id,
            userId: auth.currentUser.uid,
            createdAt: Timestamp.now()
        };

        await setDoc(mentorRef, mentorProfile);
        return mentorRef.id;
    }

    // Accept mentorship request
    async acceptMentorshipRequest(requestId: string, mentorId: string): Promise<void> {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to accept mentorship request');
        }

        const requestRef = doc(db, this.mentorshipCollection, requestId);
        await updateDoc(requestRef, {
            mentorId,
            status: 'matched',
            matchedAt: serverTimestamp()
        });
    }

    // Schedule review session
    async scheduleReviewSession(
        reviewId: string,
        scheduledFor: Date,
        duration: number
    ): Promise<string> {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to schedule session');
        }

        const review = await this.getReviewById(reviewId);
        if (!review) {
            throw new Error('Review not found');
        }

        const sessionRef = doc(db, this.sessionsCollection);
        const session: ReviewSession = {
            id: sessionRef.id,
            reviewId,
            reviewerId: review.reviewerId,
            revieweeId: review.revieweeId,
            scheduledFor: Timestamp.fromDate(scheduledFor),
            duration,
            status: 'scheduled'
        };

        await setDoc(sessionRef, session);
        return sessionRef.id;
    }

    // Get user's mentorship requests
    async getUserMentorshipRequests(userId: string): Promise<MentorshipRequest[]> {
        const q = query(
            collection(db, this.mentorshipCollection),
            where('menteeId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })) as MentorshipRequest[];
    }

    // Get mentor's assigned requests
    async getMentorRequests(mentorId: string): Promise<MentorshipRequest[]> {
        const q = query(
            collection(db, this.mentorshipCollection),
            where('mentorId', '==', mentorId),
            where('status', 'in', ['matched', 'completed']),
            orderBy('matchedAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        })) as MentorshipRequest[];
    }

    // Complete review session
    async completeReviewSession(
        sessionId: string,
        feedback: string,
        rating: number
    ): Promise<void> {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to complete session');
        }

        const sessionRef = doc(db, this.sessionsCollection, sessionId);
        await updateDoc(sessionRef, {
            status: 'completed',
            feedback,
            rating
        });

        // Update mentor rating
        const session = await this.getSessionById(sessionId);
        if (session) {
            await this.updateMentorRating(session.reviewerId, rating);
        }
    }

    // Get review statistics
    async getReviewStatistics(userId: string): Promise<{
        totalReviews: number;
        averageRating: number;
        reviewsGiven: number;
        reviewsReceived: number;
        mentorshipRequests: number;
        mentorshipCompleted: number;
    }> {
        const reviewsGiven = await getDocs(
            query(collection(db, this.reviewsCollection), where('reviewerId', '==', userId))
        );
        
        const reviewsReceived = await getDocs(
            query(collection(db, this.reviewsCollection), where('revieweeId', '==', userId))
        );

        const completedReviews = reviewsReceived.docs.filter(doc => 
            doc.data().status === 'completed'
        );

        const averageRating = completedReviews.length > 0
            ? completedReviews.reduce((sum, doc) => sum + doc.data().rating, 0) / completedReviews.length
            : 0;

        const mentorshipRequests = await getDocs(
            query(collection(db, this.mentorshipCollection), where('menteeId', '==', userId))
        );

        const mentorshipCompleted = mentorshipRequests.docs.filter(doc => 
            doc.data().status === 'completed'
        ).length;

        return {
            totalReviews: reviewsGiven.size + reviewsReceived.size,
            averageRating,
            reviewsGiven: reviewsGiven.size,
            reviewsReceived: reviewsReceived.size,
            mentorshipRequests: mentorshipRequests.size,
            mentorshipCompleted
        };
    }

    // Listen for real-time updates
    onReviewUpdate(reviewId: string, callback: (review: PeerReview | null) => void): () => void {
        const reviewRef = doc(db, this.reviewsCollection, reviewId);
        
        return onSnapshot(reviewRef, (doc) => {
            if (!doc.exists()) {
                callback(null);
                return;
            }

            callback({
                ...doc.data(),
                id: doc.id
            } as PeerReview);
        });
    }

    // Helper methods
    private async getReviewById(reviewId: string): Promise<PeerReview | null> {
        const reviewRef = doc(db, this.reviewsCollection, reviewId);
        const reviewDoc = await getDoc(reviewRef);
        
        if (!reviewDoc.exists()) {
            return null;
        }

        return {
            ...reviewDoc.data(),
            id: reviewDoc.id
        } as PeerReview;
    }

    private async getSessionById(sessionId: string): Promise<ReviewSession | null> {
        const sessionRef = doc(db, this.sessionsCollection, sessionId);
        const sessionDoc = await getDoc(sessionRef);
        
        if (!sessionDoc.exists()) {
            return null;
        }

        return {
            ...sessionDoc.data(),
            id: sessionDoc.id
        } as ReviewSession;
    }

    private async updateMentorRating(mentorId: string, newRating: number): Promise<void> {
        const mentorRef = doc(db, this.mentorsCollection, mentorId);
        const mentorDoc = await getDoc(mentorRef);
        
        if (!mentorDoc.exists()) {
            return;
        }

        const mentor = mentorDoc.data() as MentorProfile;
        const totalRating = mentor.rating * mentor.reviewCount + newRating;
        const newReviewCount = mentor.reviewCount + 1;
        const updatedRating = totalRating / newReviewCount;

        await updateDoc(mentorRef, {
            rating: updatedRating,
            reviewCount: newReviewCount
        });
    }

    // Search mentors by expertise
    async searchMentors(searchTerm: string): Promise<MentorProfile[]> {
        const allMentors = await getDocs(
            query(collection(db, this.mentorsCollection), where('active', '==', true))
        );

        return allMentors.docs
            .map(doc => ({ ...doc.data(), id: doc.id } as MentorProfile))
            .filter(mentor => 
                mentor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                mentor.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                mentor.expertise.some(exp => exp.toLowerCase().includes(searchTerm.toLowerCase())) ||
                mentor.bio.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }

    // Get mentor availability
    async getMentorAvailability(mentorId: string): Promise<{
        availableSlots: Array<{
            date: string;
            timeSlots: string[];
        }>;
        timezone: string;
    }> {
        const mentorRef = doc(db, this.mentorsCollection, mentorId);
        const mentorDoc = await getDoc(mentorRef);
        
        if (!mentorDoc.exists()) {
            throw new Error('Mentor not found');
        }

        const mentor = mentorDoc.data() as MentorProfile;
        
        // Generate available slots for next 2 weeks
        const availableSlots = this.generateAvailableSlots(mentor.availability);
        
        return {
            availableSlots,
            timezone: mentor.availability.timezone
        };
    }

    private generateAvailableSlots(availability: MentorProfile['availability']): Array<{
        date: string;
        timeSlots: string[];
    }> {
        const slots = [];
        const today = new Date();
        
        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            
            if (availability.days.includes(date.toLocaleDateString('en-US', { weekday: 'long' }))) {
                const timeSlots = this.generateTimeSlots(availability.timeRange);
                slots.push({
                    date: date.toISOString().split('T')[0],
                    timeSlots
                });
            }
        }
        
        return slots;
    }

    private generateTimeSlots(timeRange: string): string[] {
        // Parse time range like "9:00-17:00" and generate hourly slots
        const [start, end] = timeRange.split('-');
        const startHour = parseInt(start.split(':')[0]);
        const endHour = parseInt(end.split(':')[0]);
        
        const slots = [];
        for (let hour = startHour; hour < endHour; hour++) {
            slots.push(`${hour}:00-${hour + 1}:00`);
        }
        
        return slots;
    }
}

export const peerReviewService = new PeerReviewService();
export default peerReviewService;
