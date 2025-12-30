
import { motion, AnimatePresence } from 'framer-motion';
import { JDInsights, CompetencyWeight, QuestionBlueprint } from '../types';
import React from 'react';

interface SessionBuilderProps {
    jdInsights: JDInsights;
    competencyWeights: CompetencyWeight[];
    questionSet?: QuestionBlueprint[];
    researchLinks?: { uri: string; title: string; }[];
    onAdjustSpecs?: () => void;
    onInitialize?: () => void;
}

const BAR_COLORS: Record<string, string> = {
    'DomainKnowledge': '#14C8B0',
    'MethodsTools': '#38BDF8',
    'ProcessCompliance': '#FBBF24',
    'ScenarioDecision': '#F86A6A',
    'BehavioralComms': '#A78BFA'
};

const BlueprintCard: React.FC<{
    title: string;
    items: string[];
    icon?: string;
    delay?: number;
    accentColor?: string;
}> = ({ title, items, icon = "◈", delay = 0, accentColor = "text-action-teal" }) => {
    if (!items || items.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="group relative"
        >
            <div className="absolute inset-0 bg-white/[0.02] rounded-3xl blur-2xl transition-all group-hover:bg-white/[0.05] -z-10" />
            <div className="bg-[#0A192F]/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-8 h-full flex flex-col gap-6 hover:border-white/20 transition-all border-b-4 border-b-white/5 group-hover:border-b-white/20">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${accentColor} opacity-50`}>{icon} Phase Analysis</span>
                        <h4 className="text-xl font-bold text-white tracking-tight">{title}</h4>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                    {items.map((item, idx) => (
                        <motion.span
                            key={idx}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: delay + (idx * 0.05) }}
                            className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-[12px] font-medium text-text-secondary hover:text-white hover:bg-white/10 transition-all cursor-default"
                        >
                            {item}
                        </motion.span>
                    ))}
                </div>
            </div>
        </motion.div>
    );
};

const ArenaBlueprint: React.FC<SessionBuilderProps> = ({
    jdInsights,
    competencyWeights,
    onAdjustSpecs = () => { },
    onInitialize = () => { }
}) => {

    const weightData = (competencyWeights || []).map((w) => {
        const rawWeight = w.weight;
        const displayPercentage = rawWeight <= 1 ? rawWeight * 100 : rawWeight;
        const formattedLabel = w.competency.replace(/([A-Z])/g, ' $1').trim();

        return {
            label: formattedLabel,
            percentage: displayPercentage,
            color: BAR_COLORS[w.competency] || '#94A3B8'
        };
    });

    const getSourceMeta = (source: string) => {
        switch (source) {
            case 'questionBank':
                return { label: 'Question Bank Simulation', color: 'text-accent-amber', border: 'border-accent-amber/20', bg: 'bg-accent-amber/5' };
            default:
                return { label: 'Intelligent JD Exploration', color: 'text-info-blue', border: 'border-info-blue/20', bg: 'bg-info-blue/5' };
        }
    };

    const sourceMeta = getSourceMeta(jdInsights.source || '');

    return (
        <div className="w-full max-w-7xl mx-auto py-12 px-6">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative overflow-hidden bg-[#020B14] rounded-[4rem] p-12 md:p-24 shadow-[0_100px_200px_rgba(0,0,0,0.8)] border border-white/[0.05]"
            >
                {/* Tactical Grid Background */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

                {/* Scanning Line Animation */}
                <motion.div
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-action-teal/20 to-transparent z-10 pointer-events-none"
                />

                <header className="mb-24 flex flex-col items-center text-center relative z-20">
                    <div className={`mb-12 px-8 py-3 border ${sourceMeta.border} rounded-2xl inline-flex items-center gap-4 ${sourceMeta.bg} backdrop-blur-3xl shadow-2xl transition-all hover:scale-105 cursor-default`}>
                        <div className={`w-3 h-3 rounded-full bg-current ${sourceMeta.color} animate-pulse shadow-[0_0_20px_rgba(56,189,248,0.5)]`} />
                        <span className={`text-[12px] font-black uppercase tracking-[0.5em] ${sourceMeta.color}`}>
                            {sourceMeta.label}
                        </span>
                    </div>
                    <div className="space-y-6">
                        <h2 className="text-6xl md:text-8xl font-serif font-black text-white tracking-tighter leading-none">
                            Mission Blueprint
                        </h2>
                        <p className="text-text-secondary text-xl max-w-3xl mx-auto leading-relaxed font-medium opacity-60 italic">
                            System calibration complete. We've synthesized your {jdInsights.source === 'questionBank' ? 'question bank' : 'job description'} into a high-fidelity interview protocol.
                        </p>
                    </div>
                </header>

                <div className="space-y-32 relative z-20">
                    {/* Your Interview Blueprint Grid */}
                    <div className="space-y-16">
                        <div className="flex items-center gap-6">
                            <div className="h-[1px] flex-grow bg-white/5" />
                            <h3 className="text-action-teal font-black text-[14px] uppercase tracking-[0.4em] whitespace-nowrap">Tactical Skill Matrix</h3>
                            <div className="h-[1px] flex-grow bg-white/5" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            <BlueprintCard title="Core Must-Haves" items={jdInsights.mustHaveSkills} delay={0.1} accentColor="text-action-teal" icon="▼" />
                            <BlueprintCard title="Nice-To-Have Edge" items={jdInsights.niceToHave} delay={0.2} accentColor="text-info-blue" icon="▲" />
                            <BlueprintCard title="Operational Domains" items={jdInsights.domains} delay={0.3} accentColor="text-accent-amber" icon="◆" />
                            <BlueprintCard title="Technical Stack" items={jdInsights.tools} delay={0.4} accentColor="text-action-teal" icon="●" />
                            <BlueprintCard title="Soft Power & Comms" items={jdInsights.softSkills} delay={0.5} accentColor="text-info-blue" icon="◈" />

                            {/* Role Context Card */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.6, duration: 1 }}
                                className="bg-gradient-to-br from-white/5 to-transparent rounded-3xl p-10 flex flex-col justify-center border border-white/10"
                            >
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] mb-4">Role Profile</span>
                                <h4 className="text-4xl font-black text-white leading-none mb-4">{jdInsights.role}</h4>
                                <span className="text-action-teal font-black text-[12px] uppercase tracking-[0.3em]">{jdInsights.level} Target</span>
                            </motion.div>
                        </div>
                    </div>

                    {/* Competency Weights Visualization */}
                    <div className="space-y-20">
                        <div className="flex items-center gap-6">
                            <div className="h-[1px] flex-grow bg-white/5" />
                            <h3 className="text-info-blue font-black text-[14px] uppercase tracking-[0.4em] whitespace-nowrap">Weighted Assessment Vectors</h3>
                            <div className="h-[1px] flex-grow bg-white/5" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                            <div className="space-y-12">
                                {weightData.map((item, i) => (
                                    <div key={i} className="space-y-4 group">
                                        <div className="flex justify-between items-end px-1">
                                            <span className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em] group-hover:text-white transition-all transform group-hover:translate-x-2">
                                                {item.label}
                                            </span>
                                            <span className="text-lg font-mono font-black text-white opacity-80 group-hover:text-action-teal transition-all">{item.percentage}%</span>
                                        </div>
                                        <div className="h-2 bg-white/[0.03] rounded-full overflow-hidden border border-white/5 relative">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${item.percentage}%` }}
                                                transition={{ delay: 0.8 + (i * 0.1), duration: 2, ease: [0.16, 1, 0.3, 1] }}
                                                className="h-full rounded-full shadow-[0_0_15px_rgba(20,200,176,0.2)]"
                                                style={{ backgroundColor: item.color }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-white/[0.02] border border-white/10 rounded-[3rem] p-12 text-center space-y-8 backdrop-blur-3xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-info-blue/10 blur-[100px] -mr-32 -mt-32 group-hover:bg-info-blue/20 transition-all" />
                                <div className="space-y-4 relative z-10">
                                    <h4 className="text-3xl font-serif font-black text-white tracking-tight">System Verdict</h4>
                                    <p className="text-sm text-text-secondary leading-relaxed max-w-sm mx-auto opacity-70">
                                        The interview will prioritize <span className="text-white font-bold">{weightData.sort((a, b) => b.percentage - a.percentage)[0].label}</span> as the primary success indicator for this specific session.
                                    </p>
                                </div>
                                <div className="pt-8 border-t border-white/5 relative z-10">
                                    <span className="text-[10px] font-black text-action-teal uppercase tracking-[0.4em] animate-pulse">Validation: Active</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Final Handover Actions */}
                <div className="mt-40 pt-16 flex flex-col md:flex-row gap-8 border-t border-white/5 relative z-20">
                    <button
                        onClick={onAdjustSpecs}
                        className="flex-1 bg-white/5 text-white/60 font-black py-8 rounded-3xl hover:bg-white/10 hover:text-white transition-all text-[12px] tracking-[0.4em] uppercase border border-white/10 group overflow-hidden relative"
                    >
                        <span className="relative z-10">Re-Calibrate Specs</span>
                        <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                    </button>
                    <button
                        onClick={onInitialize}
                        className="flex-[2] bg-action-teal text-base-surface font-black py-8 rounded-3xl hover:shadow-[0_40px_80px_rgba(20,200,176,0.3)] transition-all text-[12px] tracking-[0.5em] uppercase transform hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden"
                    >
                        <span className="relative z-10">Enter Interview Arena</span>
                        <div className="absolute inset-0 bg-white/20 translate-x-full group-hover:translate-x-0 transition-transform duration-700" />
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default ArenaBlueprint;
