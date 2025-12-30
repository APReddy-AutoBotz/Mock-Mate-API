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
import { sessionService } from './sessionService';
import type { SessionContext, InterviewTurn, FinalReport } from '../types';

export interface Organization {
    id: string;
    name: string;
    domain: string;
    plan: 'starter' | 'professional' | 'enterprise';
    maxUsers: number;
    currentUsers: number;
    features: string[];
    settings: {
        allowSelfSignup: boolean;
        requireApproval: boolean;
        defaultRoles: string[];
        customBranding: boolean;
        ssoEnabled: boolean;
    };
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface Team {
    id: string;
    organizationId: string;
    name: string;
    description: string;
    leadId: string;
    memberIds: string[];
    department?: string;
    location?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface EnterpriseUser {
    id: string;
    organizationId: string;
    teamIds: string[];
    role: 'admin' | 'manager' | 'member' | 'viewer';
    permissions: string[];
    profile: {
        name: string;
        email: string;
        title: string;
        department: string;
        startDate: Timestamp;
        skills: string[];
        goals: string[];
    };
    lastLogin?: Timestamp;
    isActive: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface TeamAnalytics {
    teamId: string;
    period: 'daily' | 'weekly' | 'monthly';
    date: Timestamp;
    metrics: {
        totalSessions: number;
        completedSessions: number;
        averageScore: number;
        averageDuration: number;
        activeUsers: number;
        topCompetencies: Array<{
            competency: string;
            averageScore: number;
            improvement: number;
        }>;
        skillGaps: Array<{
            skill: string;
            gapPercentage: number;
            priority: 'high' | 'medium' | 'low';
        }>;
    };
}

export interface LearningPath {
    id: string;
    organizationId: string;
    title: string;
    description: string;
    targetRoles: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    modules: Array<{
        id: string;
        title: string;
        type: 'interview' | 'course' | 'assessment';
        required: boolean;
        estimatedTime: number;
        resources: string[];
    }>;
    prerequisites: string[];
    tags: string[];
    isActive: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface ProgressReport {
    id: string;
    userId: string;
    organizationId: string;
    teamId?: string;
    period: 'weekly' | 'monthly' | 'quarterly';
    startDate: Timestamp;
    endDate: Timestamp;
    metrics: {
        sessionsCompleted: number;
        averageScore: number;
        timeSpent: number;
        competenciesImproved: string[];
        goalsAchieved: string[];
        areasForImprovement: string[];
    };
    managerFeedback?: string;
    hrNotes?: string;
    generatedAt: Timestamp;
}

class EnterpriseService {
    private readonly organizationsCollection = 'organizations';
    private readonly teamsCollection = 'teams';
    private readonly usersCollection = 'enterprise_users';
    private readonly analyticsCollection = 'team_analytics';
    private readonly learningPathsCollection = 'learning_paths';
    private readonly reportsCollection = 'progress_reports';

    // Create organization
    async createOrganization(
        name: string,
        domain: string,
        plan: Organization['plan']
    ): Promise<string> {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to create organization');
        }

        const orgRef = doc(db, this.organizationsCollection);
        const organization: Organization = {
            id: orgRef.id,
            name,
            domain,
            plan,
            maxUsers: this.getMaxUsersForPlan(plan),
            currentUsers: 1,
            features: this.getFeaturesForPlan(plan),
            settings: {
                allowSelfSignup: plan !== 'enterprise',
                requireApproval: plan === 'enterprise',
                defaultRoles: ['member'],
                customBranding: plan !== 'starter',
                ssoEnabled: plan === 'enterprise'
            },
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        await setDoc(orgRef, organization);

        // Add creator as admin
        await this.addUserToOrganization(orgRef.id, auth.currentUser.uid, 'admin');

        return orgRef.id;
    }

    // Add user to organization
    async addUserToOrganization(
        organizationId: string,
        userId: string,
        role: EnterpriseUser['role'],
        teamIds: string[] = []
    ): Promise<void> {
        const userRef = doc(db, this.usersCollection, userId);
        const user: EnterpriseUser = {
            id: userId,
            organizationId,
            teamIds,
            role,
            permissions: this.getPermissionsForRole(role),
            profile: {
                name: '',
                email: '',
                title: '',
                department: '',
                startDate: Timestamp.now(),
                skills: [],
                goals: []
            },
            isActive: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        await setDoc(userRef, user);

        // Update organization user count
        await this.updateOrganizationUserCount(organizationId);
    }

    // Create team
    async createTeam(
        organizationId: string,
        name: string,
        description: string,
        leadId: string,
        memberIds: string[] = []
    ): Promise<string> {
        const teamRef = doc(db, this.teamsCollection);
        const team: Team = {
            id: teamRef.id,
            organizationId,
            name,
            description,
            leadId,
            memberIds: [leadId, ...memberIds],
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        await setDoc(teamRef, team);

        // Update team members
        await this.updateTeamMembers(teamRef.id, [leadId, ...memberIds]);

        return teamRef.id;
    }

    // Get organization analytics
    async getOrganizationAnalytics(
        organizationId: string,
        period: 'daily' | 'weekly' | 'monthly' = 'monthly',
        startDate?: Date,
        endDate?: Date
    ): Promise<{
        overview: {
            totalUsers: number;
            activeUsers: number;
            totalSessions: number;
            completedSessions: number;
            averageScore: number;
        };
        teams: Array<{
            teamId: string;
            teamName: string;
            metrics: TeamAnalytics['metrics'];
        }>;
        trends: Array<{
            date: string;
            sessions: number;
            score: number;
            users: number;
        }>;
        topPerformers: Array<{
            userId: string;
            name: string;
            score: number;
            sessions: number;
        }>;
    }> {
        // Get all users in organization
        const usersQuery = query(
            collection(db, this.usersCollection),
            where('organizationId', '==', organizationId),
            where('isActive', '==', true)
        );
        const usersSnapshot = await getDocs(usersQuery);
        const users = usersSnapshot.docs.map(doc => doc.data() as EnterpriseUser);

        // Get all teams in organization
        const teamsQuery = query(
            collection(db, this.teamsCollection),
            where('organizationId', '==', organizationId)
        );
        const teamsSnapshot = await getDocs(teamsQuery);
        const teams = teamsSnapshot.docs.map(doc => doc.data() as Team);

        // Get analytics data
        const analyticsQuery = query(
            collection(db, this.analyticsCollection),
            where('teamId', 'in', teams.map(t => t.id)),
            where('period', '==', period),
            orderBy('date', 'desc'),
            limit(30)
        );
        const analyticsSnapshot = await getDocs(analyticsQuery);
        const analytics = analyticsSnapshot.docs.map(doc => doc.data() as TeamAnalytics);

        // Calculate overview metrics
        const totalUsers = users.length;
        const activeUsers = users.filter(u => u.lastLogin && 
            u.lastLogin.toDate() > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length;

        const totalSessions = analytics.reduce((sum, a) => sum + a.metrics.totalSessions, 0);
        const completedSessions = analytics.reduce((sum, a) => sum + a.metrics.completedSessions, 0);
        const averageScore = analytics.length > 0
            ? analytics.reduce((sum, a) => sum + a.metrics.averageScore, 0) / analytics.length
            : 0;

        // Team metrics
        const teamMetrics = teams.map(team => {
            const teamAnalytics = analytics.filter(a => a.teamId === team.id);
            const latestAnalytics = teamAnalytics[0];
            
            return {
                teamId: team.id,
                teamName: team.name,
                metrics: latestAnalytics?.metrics || {
                    totalSessions: 0,
                    completedSessions: 0,
                    averageScore: 0,
                    averageDuration: 0,
                    activeUsers: 0,
                    topCompetencies: [],
                    skillGaps: []
                }
            };
        });

        // Trends data
        const trends = analytics
            .sort((a, b) => a.date.toMillis() - b.date.toMillis())
            .slice(-12)
            .map(a => ({
                date: a.date.toDate().toLocaleDateString(),
                sessions: a.metrics.totalSessions,
                score: a.metrics.averageScore,
                users: a.metrics.activeUsers
            }));

        // Top performers (simplified)
        const topPerformers = await this.getTopPerformers(organizationId, 10);

        return {
            overview: {
                totalUsers,
                activeUsers,
                totalSessions,
                completedSessions,
                averageScore
            },
            teams: teamMetrics,
            trends,
            topPerformers
        };
    }

    // Generate team analytics
    async generateTeamAnalytics(teamId: string, period: 'daily' | 'weekly' | 'monthly'): Promise<void> {
        const team = await this.getTeamById(teamId);
        if (!team) return;

        // Get all team members' sessions
        const teamAnalytics: TeamAnalytics[] = [];
        const now = new Date();
        const periodMs = period === 'daily' ? 24 * 60 * 60 * 1000 :
                        period === 'weekly' ? 7 * 24 * 60 * 60 * 1000 :
                        30 * 24 * 60 * 60 * 1000;

        // Generate analytics for the last 12 periods
        for (let i = 0; i < 12; i++) {
            const date = new Date(now.getTime() - i * periodMs);
            const startDate = new Date(date.getTime() - periodMs);
            
            const metrics = await this.calculateTeamMetrics(teamId, startDate, date);
            
            const analytics: TeamAnalytics = {
                teamId,
                period,
                date: Timestamp.fromDate(date),
                metrics
            };

            teamAnalytics.push(analytics);
        }

        // Save analytics
        for (const analytics of teamAnalytics) {
            const analyticsRef = doc(db, this.analyticsCollection);
            await setDoc(analyticsRef, analytics);
        }
    }

    // Calculate team metrics
    private async calculateTeamMetrics(
        teamId: string,
        startDate: Date,
        endDate: Date
    ): Promise<TeamAnalytics['metrics']> {
        const team = await this.getTeamById(teamId);
        if (!team) {
            return {
                totalSessions: 0,
                completedSessions: 0,
                averageScore: 0,
                averageDuration: 0,
                activeUsers: 0,
                topCompetencies: [],
                skillGaps: []
            };
        }

        let totalSessions = 0;
        let completedSessions = 0;
        let totalScore = 0;
        let totalDuration = 0;
        const competencyScores: Record<string, number[]> = {};
        const activeUserIds = new Set<string>();

        // Get sessions for all team members
        for (const memberId of team.memberIds) {
            const sessions = await sessionService.getUserSessions(memberId, 100);
            const periodSessions = sessions.filter(session => {
                const sessionDate = session.createdAt.toDate();
                return sessionDate >= startDate && sessionDate <= endDate;
            });

            totalSessions += periodSessions.length;
            completedSessions += periodSessions.filter(s => s.status === 'completed').length;

            for (const session of periodSessions) {
                if (session.status === 'completed' && session.finalReport) {
                    const score = this.calculateSessionScore(session.finalReport);
                    totalScore += score;
                    totalDuration += session.turns.length * 2 * 60 * 1000; // 2 minutes per turn

                    // Collect competency scores
                    session.finalReport.advisoryPanel.forEach(advisor => {
                        advisor.scores?.forEach(score => {
                            if (!competencyScores[score.skill]) {
                                competencyScores[score.skill] = [];
                            }
                            competencyScores[score.skill].push(score.score);
                        });
                    });
                }
            }

            if (periodSessions.length > 0) {
                activeUserIds.add(memberId);
            }
        }

        const averageScore = completedSessions > 0 ? totalScore / completedSessions : 0;
        const averageDuration = completedSessions > 0 ? totalDuration / completedSessions : 0;

        // Calculate top competencies
        const topCompetencies = Object.entries(competencyScores)
            .map(([competency, scores]) => ({
                competency,
                averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
                improvement: this.calculateImprovement(competencyScores[competency])
            }))
            .sort((a, b) => b.averageScore - a.averageScore)
            .slice(0, 5);

        // Calculate skill gaps
        const skillGaps = topCompetencies
            .filter(comp => comp.averageScore < 70)
            .map(comp => ({
                skill: comp.competency,
                gapPercentage: 100 - comp.averageScore,
                priority: (comp.averageScore < 50 ? 'high' : comp.averageScore < 65 ? 'medium' : 'low') as 'high' | 'medium' | 'low'
            }));

        return {
            totalSessions,
            completedSessions,
            averageScore,
            averageDuration,
            activeUsers: activeUserIds.size,
            topCompetencies,
            skillGaps
        };
    }

    // Create learning path
    async createLearningPath(
        organizationId: string,
        pathData: Omit<LearningPath, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>
    ): Promise<string> {
        const pathRef = doc(db, this.learningPathsCollection);
        const learningPath: LearningPath = {
            ...pathData,
            id: pathRef.id,
            organizationId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        await setDoc(pathRef, learningPath);
        return pathRef.id;
    }

    // Generate progress report
    async generateProgressReport(
        userId: string,
        period: 'weekly' | 'monthly' | 'quarterly',
        teamId?: string
    ): Promise<string> {
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const endDate = new Date();
        const startDate = new Date();
        switch (period) {
            case 'weekly':
                startDate.setDate(endDate.getDate() - 7);
                break;
            case 'monthly':
                startDate.setMonth(endDate.getMonth() - 1);
                break;
            case 'quarterly':
                startDate.setMonth(endDate.getMonth() - 3);
                break;
        }

        const sessions = await sessionService.getUserSessions(userId, 50);
        const periodSessions = sessions.filter(session => {
            const sessionDate = session.createdAt.toDate();
            return sessionDate >= startDate && sessionDate <= endDate;
        });

        const completedSessions = periodSessions.filter(s => s.status === 'completed');

        const metrics = {
            sessionsCompleted: completedSessions.length,
            averageScore: completedSessions.length > 0
                ? completedSessions.reduce((sum, s) => sum + this.calculateSessionScore(s.finalReport!), 0) / completedSessions.length
                : 0,
            timeSpent: completedSessions.reduce((sum, s) => sum + s.turns.length * 2 * 60 * 1000, 0),
            competenciesImproved: this.getImprovedCompetencies(completedSessions),
            goalsAchieved: this.getAchievedGoals(user.profile.goals, completedSessions),
            areasForImprovement: this.getAreasForImprovement(completedSessions)
        };

        const reportRef = doc(db, this.reportsCollection);
        const report: ProgressReport = {
            id: reportRef.id,
            userId,
            organizationId: user.organizationId,
            teamId,
            period,
            startDate: Timestamp.fromDate(startDate),
            endDate: Timestamp.fromDate(endDate),
            metrics,
            generatedAt: Timestamp.now()
        };

        await setDoc(reportRef, report);
        return reportRef.id;
    }

    // Helper methods
    private getMaxUsersForPlan(plan: Organization['plan']): number {
        switch (plan) {
            case 'starter': return 10;
            case 'professional': return 50;
            case 'enterprise': return 1000;
        }
    }

    private getFeaturesForPlan(plan: Organization['plan']): string[] {
        switch (plan) {
            case 'starter':
                return ['basic_sessions', 'team_analytics', 'peer_review'];
            case 'professional':
                return ['basic_sessions', 'team_analytics', 'peer_review', 'video_analysis', 'ai_coaching', 'learning_paths'];
            case 'enterprise':
                return ['basic_sessions', 'team_analytics', 'peer_review', 'video_analysis', 'ai_coaching', 'learning_paths', 'sso', 'custom_branding', 'api_access'];
        }
    }

    private getPermissionsForRole(role: EnterpriseUser['role']): string[] {
        switch (role) {
            case 'admin':
                return ['manage_organization', 'manage_teams', 'manage_users', 'view_analytics', 'manage_learning_paths'];
            case 'manager':
                return ['manage_teams', 'view_team_analytics', 'manage_team_members'];
            case 'member':
                return ['view_own_progress', 'participate_sessions', 'peer_review'];
            case 'viewer':
                return ['view_team_analytics'];
        }
    }

    private async updateOrganizationUserCount(organizationId: string): Promise<void> {
        const usersQuery = query(
            collection(db, this.usersCollection),
            where('organizationId', '==', organizationId),
            where('isActive', '==', true)
        );
        const usersSnapshot = await getDocs(usersQuery);
        
        const orgRef = doc(db, this.organizationsCollection, organizationId);
        await updateDoc(orgRef, {
            currentUsers: usersSnapshot.size,
            updatedAt: serverTimestamp()
        });
    }

    private async updateTeamMembers(teamId: string, memberIds: string[]): Promise<void> {
        for (const memberId of memberIds) {
            const userRef = doc(db, this.usersCollection, memberId);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                const user = userDoc.data() as EnterpriseUser;
                const updatedTeamIds = [...new Set([...user.teamIds, teamId])];
                await updateDoc(userRef, {
                    teamIds: updatedTeamIds,
                    updatedAt: serverTimestamp()
                });
            }
        }
    }

    private async getTeamById(teamId: string): Promise<Team | null> {
        const teamRef = doc(db, this.teamsCollection, teamId);
        const teamDoc = await getDoc(teamRef);
        
        if (!teamDoc.exists()) {
            return null;
        }

        return {
            ...teamDoc.data(),
            id: teamDoc.id
        } as Team;
    }

    private async getUserById(userId: string): Promise<EnterpriseUser | null> {
        const userRef = doc(db, this.usersCollection, userId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
            return null;
        }

        return {
            ...userDoc.data(),
            id: userDoc.id
        } as EnterpriseUser;
    }

    private calculateSessionScore(report: FinalReport): number {
        if (!report.advisoryPanel.length) return 0;
        
        const allScores = report.advisoryPanel.flatMap(advisor => 
            (advisor.scores || []).map(score => score.score)
        );
        
        return allScores.length > 0 
            ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
            : 0;
    }

    private calculateImprovement(scores: number[]): number {
        if (scores.length < 2) return 0;
        const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
        const secondHalf = scores.slice(Math.floor(scores.length / 2));
        
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        
        return secondAvg - firstAvg;
    }

    private getImprovedCompetencies(sessions: any[]): string[] {
        // Simplified implementation
        return ['Communication', 'Problem Solving', 'Leadership'];
    }

    private getAchievedGoals(goals: string[], sessions: any[]): string[] {
        // Simplified implementation
        return goals.filter(goal => 
            sessions.some(session => 
                session.finalReport?.overallSummary?.toLowerCase().includes(goal.toLowerCase())
            )
        );
    }

    private getAreasForImprovement(sessions: any[]): string[] {
        // Simplified implementation
        return ['Technical Skills', 'Time Management', 'Strategic Thinking'];
    }

    private async getTopPerformers(organizationId: string, limit: number): Promise<Array<{
        userId: string;
        name: string;
        score: number;
        sessions: number;
    }>> {
        // Simplified implementation
        return [];
    }
}

export const enterpriseService = new EnterpriseService();
export default enterpriseService;
