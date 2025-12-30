import React, { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { getSessionHistory } from '../services/storageService';
import { SessionHistoryRecord, FinalReport } from '../types';

interface GrowthDashboardProps {
    onBack: () => void;
    onViewReport: (report: FinalReport) => void;
}

const ReadinessMap: Record<string, number> = {
    'NOT_READY': 1,
    'ALMOST_READY': 2,
    'INTERVIEW_READY': 3
};

const GrowthDashboard: React.FC<GrowthDashboardProps> = React.memo(({ onBack, onViewReport }) => {
    const history = useMemo(() => getSessionHistory().reverse(), []); // Chronological for charts

    const chartData = useMemo(() => history.map(h => ({
        date: new Date(h.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        confidence: h.avgScore,
        readiness: ReadinessMap[h.readinessStatus] || 1,
        role: h.role
    })), [history]);

    const latestSessions = useMemo(() => [...history].reverse(), [history]);

    const handleBack = useCallback(() => {
        onBack();
    }, [onBack]);

    return (
        <div className="w-full max-w-5xl mx-auto p-4 md:p-8 space-y-12 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/5 pb-10 gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-info-blue animate-pulse" />
                        <span className="text-[10px] font-black text-info-blue uppercase tracking-[0.4em] block">Private Performance Journal</span>
                    </div>
                    <h1 className="text-5xl font-black text-text-primary tracking-tighter uppercase leading-none">Readiness Portfolio</h1>
                </div>
                <button
                    onClick={handleBack}
                    className="group flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-text-secondary hover:text-white hover:bg-white/10 uppercase tracking-widest transition-all"
                >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span> Return to Arena
                </button>
            </header>

            {history.length === 0 ? (
                <div className="text-center py-32 bg-white/[0.02] border border-dashed border-white/10 rounded-[3rem]">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                        <div className="w-2 h-2 rounded-full bg-info-blue animate-pulse" />
                    </div>
                    <h2 className="text-xl font-black text-text-primary mb-4">No sessions yet</h2>
                    <p className="text-sm text-text-secondary">Complete your first interview to see your performance data here.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                        {history.map((session, idx) => (
                            <motion.div
                                key={session.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as any }}
                                className="bg-white/[0.03] border border-white/10 rounded-3xl p-6"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-info-blue animate-pulse" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-white">{session.readinessStatus.replace(/_/g, ' ')}</span>
                                            <span className="text-[10px] font-black uppercase text-text-secondary opacity-40">Readiness Level</span>
                                        </div>
                                        <div className="text-2xl font-black text-action-teal">{session.avgScore}</div>
                                    </div>
                                    <button
                                        onClick={() => session.fullReport && onViewReport(session.fullReport)}
                                        disabled={!session.fullReport}
                                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <span className="text-xs text-text-secondary">View Details →</span>
                                    </button>
                                </div>
                                <div className="text-right">
                                    <div
                                        title={session.readinessStatus.replace(/_/g, ' ')}
                                        className={`w-3 h-3 rounded-full ${session.readinessStatus === 'INTERVIEW_READY' ? 'bg-action-teal shadow-[0_0_12px_rgba(20,200,176,0.6)]' :
                                                session.readinessStatus === 'ALMOST_READY' ? 'bg-accent-amber shadow-[0_0_12px_rgba(251,191,36,0.4)]' :
                                                    'bg-alert-coral shadow-[0_0_12px_rgba(248,106,106,0.4)]'
                                            }`}
                                    />
                                    <div className="text-right mt-2">
                                        <p className="text-xs text-text-secondary opacity-60 italic">{new Date(session.timestamp).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-12">
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeWidth={1} />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 10, fill: "#888" }}
                                    stroke="#888"
                                />
                                <YAxis
                                    dataKey="readiness"
                                    domain={[0.5, 3.5]}
                                    tick={{ fill: "#888" }}
                                    label={{ value: 'Readiness', position: 'insideLeft', style: { fill: "#888" } }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none' }}
                                    formatter={(value: any, name: any) => {
                                        if (name === 'readiness') return `Readiness: ${value}`;
                                        if (name === 'confidence') return `Score: ${value}`;
                                        return `${name}: ${value}`;
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="readiness"
                                    stroke="#888"
                                    strokeWidth={2}
                                    fill="url(#readinessGradient)"
                                    fillOpacity={0.3}
                                />
                                <defs>
                                    <linearGradient id="readinessGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </>
            )}
        </div>
    );
});

export default GrowthDashboard;
