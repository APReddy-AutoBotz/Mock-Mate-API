import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    updateDoc, 
    query, 
    where, 
    orderBy, 
    limit,
    Timestamp,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './firebaseClient';
import { sessionService } from './sessionService';
import type { SessionContext, InterviewTurn, FinalReport } from '../types';

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'sessions' | 'performance' | 'streak' | 'social' | 'learning';
    type: 'milestone' | 'progress' | 'special';
    criteria: {
        type: 'session_count' | 'score_average' | 'streak_days' | 'peer_reviews' | 'learning_paths';
        value: number;
        timeframe?: 'daily' | 'weekly' | 'monthly' | 'all_time';
    };
    reward: {
        points: number;
        badge?: string;
        title?: string;
    };
    isActive: boolean;
    createdAt: Timestamp;
}

export interface UserAchievement {
    id: string;
    userId: string;
    achievementId: string;
    unlockedAt: Timestamp;
    progress: number; // 0-1
    metadata?: Record<string, any>;
}

export interface UserProfile {
    id: string;
    userId: string;
    level: number;
    experience: number;
    totalPoints: number;
    currentStreak: number;
    longestStreak: number;
    lastActivity: Timestamp;
    badges: string[];
    titles: string[];
    stats: {
        totalSessions: number;
        completedSessions: number;
        averageScore: number;
        totalDuration: number;
        peerReviewsGiven: number;
        peerReviewsReceived: number;
        mentorshipHours: number;
    };
    preferences: {
        showAchievements: boolean;
        allowLeaderboard: boolean;
        notificationSettings: {
            achievements: boolean;
            streaks: boolean;
            leaderboard: boolean;
        };
    };
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface Leaderboard {
    id: string;
    type: 'global' | 'organization' | 'team' | 'role';
    period: 'daily' | 'weekly' | 'monthly' | 'all_time';
    category: 'points' | 'level' | 'sessions' | 'score';
    entries: Array<{
        userId: string;
        userName: string;
        userAvatar?: string;
        value: number;
        rank: number;
        change: number; // rank change from previous period
    }>;
    lastUpdated: Timestamp;
}

export interface Challenge {
    id: string;
    title: string;
    description: string;
    type: 'individual' | 'team';
    category: 'performance' | 'consistency' | 'learning' | 'social';
    criteria: {
        description: string;
        target: number;
        metric: string;
    };
    reward: {
        points: number;
        badge: string;
    };
    startDate: Timestamp;
    endDate: Timestamp;
    isActive: boolean;
    participants: string[];
    completions: Array<{
        userId: string;
        completedAt: Timestamp;
        value: number;
    }>;
}

class GamificationService {
    private readonly achievementsCollection = 'achievements';
    private readonly userAchievementsCollection = 'user_achievements';
    private readonly userProfilesCollection = 'user_profiles';
    private readonly leaderboardsCollection = 'leaderboards';
    private readonly challengesCollection = 'challenges';

    // Initialize user profile
    async initializeUserProfile(userId: string): Promise<void> {
        const profileRef = doc(db, this.userProfilesCollection, userId);
        const profileDoc = await getDoc(profileRef);

        if (!profileDoc.exists()) {
            const profile: UserProfile = {
                id: userId,
                userId,
                level: 1,
                experience: 0,
                totalPoints: 0,
                currentStreak: 0,
                longestStreak: 0,
                lastActivity: Timestamp.now(),
                badges: [],
                titles: [],
                stats: {
                    totalSessions: 0,
                    completedSessions: 0,
                    averageScore: 0,
                    totalDuration: 0,
                    peerReviewsGiven: 0,
                    peerReviewsReceived: 0,
                    mentorshipHours: 0
                },
                preferences: {
                    showAchievements: true,
                    allowLeaderboard: true,
                    notificationSettings: {
                        achievements: true,
                        streaks: true,
                        leaderboard: false
                    }
                },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            await setDoc(profileRef, profile);
        }
    }

    // Award experience and points
    async awardExperience(
        userId: string,
        experience: number,
        points: number,
        source: string,
        metadata?: Record<string, any>
    ): Promise<{
        levelUp: boolean;
        newLevel: number;
        achievements: UserAchievement[];
    }> {
        const profileRef = doc(db, this.userProfilesCollection, userId);
        const profileDoc = await getDoc(profileRef);

        if (!profileDoc.exists()) {
            await this.initializeUserProfile(userId);
        }

        const profile = profileDoc.data() as UserProfile;
        const oldLevel = profile.level;
        
        // Update experience and points
        profile.experience += experience;
        profile.totalPoints += points;
        profile.lastActivity = Timestamp.now();
        profile.updatedAt = Timestamp.now();

        // Calculate new level
        const newLevel = this.calculateLevel(profile.experience);
        profile.level = newLevel;

        await updateDoc(profileRef, {
            experience: profile.experience,
            totalPoints: profile.totalPoints,
            level: newLevel,
            lastActivity: Timestamp.now(),
            updatedAt: Timestamp.now()
        });

        // Check for new achievements
        const achievements = await this.checkAchievements(userId, metadata);

        return {
            levelUp: newLevel > oldLevel,
            newLevel,
            achievements
        };
    }

    // Update session statistics
    async updateSessionStats(
        userId: string,
        sessionId: string,
        completed: boolean,
        score?: number,
        duration?: number
    ): Promise<void> {
        const profileRef = doc(db, this.userProfilesCollection, userId);
        const profileDoc = await getDoc(profileRef);

        if (!profileDoc.exists()) return;

        const profile = profileDoc.data() as UserProfile;
        
        profile.stats.totalSessions += 1;
        
        if (completed) {
            profile.stats.completedSessions += 1;
            
            if (score !== undefined) {
                const totalScore = profile.stats.averageScore * (profile.stats.completedSessions - 1) + score;
                profile.stats.averageScore = totalScore / profile.stats.completedSessions;
            }
            
            if (duration !== undefined) {
                profile.stats.totalDuration += duration;
            }

            // Update streak
            await this.updateStreak(userId);
        }

        await updateDoc(profileRef, {
            stats: profile.stats,
            updatedAt: Timestamp.now()
        });

        // Award experience for session
        const experience = completed ? 50 : 25;
        const points = completed ? (score || 0) * 10 : 10;
        await this.awardExperience(userId, experience, points, 'session', {
            sessionId,
            completed,
            score,
            duration
        });
    }

    // Update streak
    private async updateStreak(userId: string): Promise<void> {
        const profileRef = doc(db, this.userProfilesCollection, userId);
        const profileDoc = await getDoc(profileRef);

        if (!profileDoc.exists()) return;

        const profile = profileDoc.data() as UserProfile;
        const now = Timestamp.now();
        const lastActivity = profile.lastActivity.toDate();
        const daysDiff = Math.floor((now.toDate().getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff === 1) {
            // Continue streak
            profile.currentStreak += 1;
            if (profile.currentStreak > profile.longestStreak) {
                profile.longestStreak = profile.currentStreak;
            }
        } else if (daysDiff > 1) {
            // Break streak
            profile.currentStreak = 1;
        }

        await updateDoc(profileRef, {
            currentStreak: profile.currentStreak,
            longestStreak: profile.longestStreak,
            lastActivity: now,
            updatedAt: Timestamp.now()
        });
    }

    // Check for achievements
    async checkAchievements(
        userId: string,
        metadata?: Record<string, any>
    ): Promise<UserAchievement[]> {
        const achievementsQuery = query(
            collection(db, this.achievementsCollection),
            where('isActive', '==', true)
        );
        const achievementsSnapshot = await getDocs(achievementsQuery);
        const achievements = achievementsSnapshot.docs.map(doc => doc.data() as Achievement);

        const newAchievements: UserAchievement[] = [];
        const profile = await this.getUserProfile(userId);

        for (const achievement of achievements) {
            // Check if already unlocked
            const existingQuery = query(
                collection(db, this.userAchievementsCollection),
                where('userId', '==', userId),
                where('achievementId', '==', achievement.id)
            );
            const existingSnapshot = await getDocs(existingQuery);
            
            if (!existingSnapshot.empty) continue;

            // Check criteria
            const progress = await this.calculateAchievementProgress(achievement, profile, metadata);
            
            if (progress >= 1) {
                // Unlock achievement
                const userAchievement: UserAchievement = {
                    id: `${userId}_${achievement.id}`,
                    userId,
                    achievementId: achievement.id,
                    unlockedAt: Timestamp.now(),
                    progress: 1,
                    metadata
                };

                const achievementRef = doc(db, this.userAchievementsCollection, userAchievement.id);
                await setDoc(achievementRef, userAchievement);

                // Award reward
                await this.awardExperience(userId, 0, achievement.reward.points, 'achievement', {
                    achievementId: achievement.id
                });

                // Update badges/titles
                if (achievement.reward.badge) {
                    await this.addBadge(userId, achievement.reward.badge);
                }
                if (achievement.reward.title) {
                    await this.addTitle(userId, achievement.reward.title);
                }

                newAchievements.push(userAchievement);
            }
        }

        return newAchievements;
    }

    // Calculate achievement progress
    private async calculateAchievementProgress(
        achievement: Achievement,
        profile: UserProfile,
        metadata?: Record<string, any>
    ): Promise<number> {
        switch (achievement.criteria.type) {
            case 'session_count':
                return Math.min(1, profile.stats.totalSessions / achievement.criteria.value);
            
            case 'score_average':
                return Math.min(1, profile.stats.averageScore / achievement.criteria.value);
            
            case 'streak_days':
                return Math.min(1, profile.currentStreak / achievement.criteria.value);
            
            case 'peer_reviews':
                return Math.min(1, profile.stats.peerReviewsGiven / achievement.criteria.value);
            
            case 'learning_paths':
                // Would need to track learning path completions
                return 0;
            
            default:
                return 0;
        }
    }

    // Get user profile
    async getUserProfile(userId: string): Promise<UserProfile | null> {
        const profileRef = doc(db, this.userProfilesCollection, userId);
        const profileDoc = await getDoc(profileRef);

        if (!profileDoc.exists()) {
            return null;
        }

        return {
            ...profileDoc.data(),
            id: profileDoc.id
        } as UserProfile;
    }

    // Get user achievements
    async getUserAchievements(userId: string): Promise<Array<{
        achievement: Achievement;
        userAchievement: UserAchievement;
    }>> {
        const userAchievementsQuery = query(
            collection(db, this.userAchievementsCollection),
            where('userId', '==', userId),
            orderBy('unlockedAt', 'desc')
        );
        const userAchievementsSnapshot = await getDocs(userAchievementsQuery);
        const userAchievements = userAchievementsSnapshot.docs.map(doc => doc.data() as UserAchievement);

        const results = [];
        for (const userAchievement of userAchievements) {
            const achievementRef = doc(db, this.achievementsCollection, userAchievement.achievementId);
            const achievementDoc = await getDoc(achievementRef);
            
            if (achievementDoc.exists()) {
                results.push({
                    achievement: achievementDoc.data() as Achievement,
                    userAchievement
                });
            }
        }

        return results;
    }

    // Get leaderboard
    async getLeaderboard(
        type: Leaderboard['type'],
        period: Leaderboard['period'],
        category: Leaderboard['category'],
        limit: number = 50
    ): Promise<Leaderboard> {
        const leaderboardId = `${type}_${period}_${category}`;
        const leaderboardRef = doc(db, this.leaderboardsCollection, leaderboardId);
        const leaderboardDoc = await getDoc(leaderboardRef);

        if (!leaderboardDoc.exists()) {
            // Generate new leaderboard
            const leaderboard = await this.generateLeaderboard(type, period, category);
            await setDoc(leaderboardRef, leaderboard);
            return leaderboard;
        }

        const leaderboard = leaderboardDoc.data() as Leaderboard;
        
        // Check if needs refresh (older than 1 hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (leaderboard.lastUpdated.toDate() < oneHourAgo) {
            const updatedLeaderboard = await this.generateLeaderboard(type, period, category);
            await updateDoc(leaderboardRef, updatedLeaderboard as any);
            return updatedLeaderboard;
        }

        return leaderboard;
    }

    // Generate leaderboard
    private async generateLeaderboard(
        type: Leaderboard['type'],
        period: Leaderboard['period'],
        category: Leaderboard['category']
    ): Promise<Leaderboard> {
        // Get all user profiles
        const profilesQuery = query(
            collection(db, this.userProfilesCollection),
            where('preferences.allowLeaderboard', '==', true)
        );
        const profilesSnapshot = await getDocs(profilesQuery);
        const profiles = profilesSnapshot.docs.map(doc => doc.data() as UserProfile);

        // Sort based on category
        let entries = profiles.map(profile => ({
            userId: profile.userId,
            userName: profile.userId, // Would get from user service
            value: category === 'points' ? profile.totalPoints :
                   category === 'level' ? profile.level :
                   category === 'sessions' ? profile.stats.completedSessions :
                   profile.stats.averageScore,
            rank: 0,
            change: 0
        }));

        // Sort by value (descending)
        entries.sort((a, b) => b.value - a.value);

        // Assign ranks
        entries.forEach((entry, index) => {
            entry.rank = index + 1;
        });

        return {
            id: `${type}_${period}_${category}`,
            type,
            period,
            category,
            entries: entries.slice(0, 50),
            lastUpdated: Timestamp.now()
        };
    }

    // Create challenge
    async createChallenge(challengeData: Omit<Challenge, 'id' | 'participants' | 'completions'>): Promise<string> {
        const challengeRef = doc(db, this.challengesCollection);
        const challenge: Challenge = {
            ...challengeData,
            id: challengeRef.id,
            participants: [],
            completions: []
        };

        await setDoc(challengeRef, challenge);
        return challengeRef.id;
    }

    // Join challenge
    async joinChallenge(userId: string, challengeId: string): Promise<void> {
        const challengeRef = doc(db, this.challengesCollection, challengeId);
        await updateDoc(challengeRef, {
            participants: [...(await this.getChallengeParticipants(challengeId)), userId]
        });
    }

    // Complete challenge
    async completeChallenge(
        userId: string,
        challengeId: string,
        value: number
    ): Promise<void> {
        const challengeRef = doc(db, this.challengesCollection, challengeId);
        const challengeDoc = await getDoc(challengeRef);

        if (!challengeDoc.exists()) return;

        const challenge = challengeDoc.data() as Challenge;
        
        // Add completion
        const completion = {
            userId,
            completedAt: Timestamp.now(),
            value
        };

        await updateDoc(challengeRef, {
            completions: [...challenge.completions, completion]
        });

        // Award reward
        await this.awardExperience(userId, 0, challenge.reward.points, 'challenge', {
            challengeId,
            value
        });

        if (challenge.reward.badge) {
            await this.addBadge(userId, challenge.reward.badge);
        }
    }

    // Helper methods
    private calculateLevel(experience: number): number {
        // Level formula: 100 * level^2 experience needed
        return Math.floor(Math.sqrt(experience / 100)) + 1;
    }

    private async addBadge(userId: string, badge: string): Promise<void> {
        const profileRef = doc(db, this.userProfilesCollection, userId);
        const profileDoc = await getDoc(profileRef);

        if (!profileDoc.exists()) return;

        const profile = profileDoc.data() as UserProfile;
        if (!profile.badges.includes(badge)) {
            await updateDoc(profileRef, {
                badges: [...profile.badges, badge],
                updatedAt: Timestamp.now()
            });
        }
    }

    private async addTitle(userId: string, title: string): Promise<void> {
        const profileRef = doc(db, this.userProfilesCollection, userId);
        const profileDoc = await getDoc(profileRef);

        if (!profileDoc.exists()) return;

        const profile = profileDoc.data() as UserProfile;
        if (!profile.titles.includes(title)) {
            await updateDoc(profileRef, {
                titles: [...profile.titles, title],
                updatedAt: Timestamp.now()
            });
        }
    }

    private async getChallengeParticipants(challengeId: string): Promise<string[]> {
        const challengeRef = doc(db, this.challengesCollection, challengeId);
        const challengeDoc = await getDoc(challengeRef);

        if (!challengeDoc.exists()) return [];

        return (challengeDoc.data() as Challenge).participants;
    }

    // Get active challenges
    async getActiveChallenges(): Promise<Challenge[]> {
        const now = Timestamp.now();
        const challengesQuery = query(
            collection(db, this.challengesCollection),
            where('isActive', '==', true),
            where('startDate', '<=', now),
            where('endDate', '>=', now)
        );

        const challengesSnapshot = await getDocs(challengesQuery);
        return challengesSnapshot.docs.map(doc => doc.data() as Challenge);
    }

    // Get user's challenge progress
    async getUserChallengeProgress(userId: string): Promise<Array<{
        challenge: Challenge;
        progress: number;
        completed: boolean;
    }>> {
        const activeChallenges = await this.getActiveChallenges();
        const results = [];

        for (const challenge of activeChallenges) {
            const isParticipant = challenge.participants.includes(userId);
            const completion = challenge.completions.find(c => c.userId === userId);
            
            results.push({
                challenge,
                progress: completion ? completion.value / challenge.criteria.target : 0,
                completed: !!completion
            });
        }

        return results;
    }

    // Initialize default achievements
    async initializeDefaultAchievements(): Promise<void> {
        const defaultAchievements: Omit<Achievement, 'id' | 'createdAt'>[] = [
            {
                name: 'First Steps',
                description: 'Complete your first interview session',
                icon: '🎯',
                category: 'sessions',
                type: 'milestone',
                criteria: { type: 'session_count', value: 1 },
                reward: { points: 100, badge: 'beginner' },
                isActive: true
            },
            {
                name: 'Consistent Learner',
                description: 'Complete 10 interview sessions',
                icon: '📚',
                category: 'sessions',
                type: 'milestone',
                criteria: { type: 'session_count', value: 10 },
                reward: { points: 500, badge: 'consistent' },
                isActive: true
            },
            {
                name: 'High Performer',
                description: 'Achieve an average score of 80+',
                icon: '⭐',
                category: 'performance',
                type: 'milestone',
                criteria: { type: 'score_average', value: 80 },
                reward: { points: 300, badge: 'high_performer' },
                isActive: true
            },
            {
                name: 'Week Warrior',
                description: 'Maintain a 7-day streak',
                icon: '🔥',
                category: 'streak',
                type: 'milestone',
                criteria: { type: 'streak_days', value: 7 },
                reward: { points: 200, badge: 'week_warrior' },
                isActive: true
            },
            {
                name: 'Team Player',
                description: 'Give 5 peer reviews',
                icon: '🤝',
                category: 'social',
                type: 'milestone',
                criteria: { type: 'peer_reviews', value: 5 },
                reward: { points: 150, badge: 'team_player' },
                isActive: true
            }
        ];

        for (const achievement of defaultAchievements) {
            const achievementRef = doc(db, this.achievementsCollection);
            await setDoc(achievementRef, {
                ...achievement,
                id: achievementRef.id,
                createdAt: Timestamp.now()
            });
        }
    }
}

export const gamificationService = new GamificationService();
export default gamificationService;
