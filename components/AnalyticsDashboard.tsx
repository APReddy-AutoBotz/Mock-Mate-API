import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { sessionService } from '../services/sessionService';
import type { SessionData } from '../services/sessionService';

interface AnalyticsData {
    totalSessions: number;
    completedSessions: number;
    averageScore: number;
    totalDuration: number;
    sessionsByRole: Array<{ role: string; count: number }>;
    scoresOverTime: Array<{ date: string; score: number }>;
    competencyPerformance: Array<{ competency: string; averageScore: number }>;
    sessionTrends: Array<{ week: string; sessions: number; completed: number }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const AnalyticsDashboard: React.FC = () => {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('month');

    useEffect(() => {
        loadAnalyticsData();
    }, [timeRange]);

    const loadAnalyticsData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Get all user sessions
            const sessions = await sessionService.getUserSessions('', 100); // Empty string for current user
            
            // Filter by time range
            const filteredSessions = filterSessionsByTimeRange(sessions, timeRange);
            
            // Process analytics data
            const analyticsData = processAnalyticsData(filteredSessions);
            setData(analyticsData);
        } catch (err) {
            setError('Failed to load analytics data');
            console.error('Analytics error:', err);
        } finally {
            setLoading(false);
        }
    };

    const filterSessionsByTimeRange = (sessions: SessionData[], range: string): SessionData[] => {
        if (range === 'all') return sessions;
        
        const now = new Date();
        const cutoffDate = new Date();
        
        if (range === 'week') {
            cutoffDate.setDate(now.getDate() - 7);
        } else if (range === 'month') {
            cutoffDate.setMonth(now.getMonth() - 1);
        }
        
        return sessions.filter(session => 
            session.createdAt.toDate() >= cutoffDate
        );
    };

    const processAnalyticsData = (sessions: SessionData[]): AnalyticsData => {
        const completedSessions = sessions.filter(s => s.status === 'completed');
        
        // Calculate scores
        const scores = completedSessions
            .map(session => {
                if (!session.finalReport?.advisoryPanel) return 0;
                const allScores = session.finalReport.advisoryPanel.flatMap(a => 
                    (a.scores || []).map(s => s.score)
                );
                return allScores.length > 0 
                    ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
                    : 0;
            })
            .filter(score => score > 0);

        // Sessions by role
        const roleCounts = sessions.reduce((acc, session) => {
            const role = session.context.candidateRole || 'Unknown';
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const sessionsByRole = Object.entries(roleCounts).map(([role, count]) => ({
            role,
            count
        }));

        // Scores over time
        const scoresOverTime = completedSessions
            .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis())
            .map(session => ({
                date: session.createdAt.toDate().toLocaleDateString(),
                score: scores[completedSessions.indexOf(session)] || 0
            }));

        // Competency performance
        const competencyScores: Record<string, number[]> = {};
        completedSessions.forEach(session => {
            if (session.finalReport?.advisoryPanel) {
                session.finalReport.advisoryPanel.forEach(advisor => {
                    advisor.scores?.forEach(score => {
                        if (!competencyScores[score.skill]) {
                            competencyScores[score.skill] = [];
                        }
                        competencyScores[score.skill].push(score.score);
                    });
                });
            }
        });

        const competencyPerformance = Object.entries(competencyScores).map(([competency, scores]) => ({
            competency,
            averageScore: scores.reduce((a, b) => a + b, 0) / scores.length
        }));

        // Session trends by week
        const sessionTrends = generateSessionTrends(sessions);

        return {
            totalSessions: sessions.length,
            completedSessions: completedSessions.length,
            averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
            totalDuration: sessions.reduce((acc, session) => {
                return acc + (session.turns.length * 2 * 60 * 1000); // 2 minutes per turn
            }, 0),
            sessionsByRole,
            scoresOverTime,
            competencyPerformance,
            sessionTrends
        };
    };

    const generateSessionTrends = (sessions: SessionData[]) => {
        const trends: Record<string, { sessions: number; completed: number }> = {};
        
        sessions.forEach(session => {
            const weekStart = new Date(session.createdAt.toDate());
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const weekKey = weekStart.toLocaleDateString();
            
            if (!trends[weekKey]) {
                trends[weekKey] = { sessions: 0, completed: 0 };
            }
            
            trends[weekKey].sessions++;
            if (session.status === 'completed') {
                trends[weekKey].completed++;
            }
        });

        return Object.entries(trends)
            .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
            .slice(-8) // Last 8 weeks
            .map(([week, data]) => ({
                week: new Date(week).toLocaleDateString(),
                sessions: data.sessions,
                completed: data.completed
            }));
    };

    const formatDuration = (ms: number): string => {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600">{error}</p>
                <button 
                    onClick={loadAnalyticsData}
                    className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!data) {
        return <div>No analytics data available</div>;
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
                <div className="flex gap-2">
                    {(['week', 'month', 'all'] as const).map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-4 py-2 rounded capitalize ${
                                timeRange === range 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-500">Total Sessions</h3>
                    <p className="text-2xl font-bold text-gray-900">{data.totalSessions}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-500">Completed Sessions</h3>
                    <p className="text-2xl font-bold text-green-600">{data.completedSessions}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-500">Average Score</h3>
                    <p className="text-2xl font-bold text-blue-600">{data.averageScore.toFixed(1)}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-500">Total Duration</h3>
                    <p className="text-2xl font-bold text-purple-600">{formatDuration(data.totalDuration)}</p>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sessions by Role */}
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4">Sessions by Role</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={data.sessionsByRole}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={(entry: any) => `${entry.role}: ${entry.count}`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="count"
                            >
                                {data.sessionsByRole.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Scores Over Time */}
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4">Scores Over Time</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={data.scoresOverTime}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="score" stroke="#8884d8" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Competency Performance */}
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4">Competency Performance</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data.competencyPerformance}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="competency" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="averageScore" fill="#82ca9d" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Session Trends */}
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h3 className="text-lg font-semibold mb-4">Session Trends</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data.sessionTrends}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="week" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="sessions" fill="#8884d8" name="Total Sessions" />
                            <Bar dataKey="completed" fill="#82ca9d" name="Completed" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
