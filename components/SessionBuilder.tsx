import { motion } from 'framer-motion';
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

const SkillChip: React.FC<{ label: string; index: number }> = ({ label, index }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.03, duration: 0.3 }}
        className="px-4 py-2 bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-xl text-sm text-white font-medium hover:border-action-teal/50 hover:bg-white/15 transition-all cursor-default"
    >
        {label}
    </motion.div>
);

const ArenaBlueprint: React.FC<SessionBuilderProps> = ({
    jdInsights,
    competencyWeights,
    onAdjustSpecs = () => { },
    onInitialize = () => { }
}) => {

    const isQuestionBank = jdInsights.source === 'questionBank';

    // Ensure we always have data to display
    const skills = jdInsights.mustHaveSkills?.length > 0 ? jdInsights.mustHaveSkills : ['General Technical Skills'];
    const domains = jdInsights.domains?.length > 0 ? jdInsights.domains : ['Cross-Functional Domain'];
    const tools = jdInsights.tools?.length > 0 ? jdInsights.tools : ['Industry Standard Tools'];
    const softSkills = jdInsights.softSkills?.length > 0 ? jdInsights.softSkills : ['Communication', 'Problem Solving'];

    const weightData = (competencyWeights || []).map((w) => {
        const rawWeight = w.weight;
        const displayPercentage = rawWeight <= 1 ? rawWeight * 100 : rawWeight;
        const formattedLabel = w.competency.replace(/([A-Z])/g, ' $1').trim();

        const colorMap: Record<string, string> = {
            'DomainKnowledge': '#14C8B0',
            'MethodsTools': '#38BDF8',
            'ProcessCompliance': '#FBBF24',
            'ScenarioDecision': '#F86A6A',
            'BehavioralComms': '#A78BFA'
        };

        return {
            label: formattedLabel,
            percentage: Math.round(displayPercentage),
            color: colorMap[w.competency] || '#94A3B8'
        };
    });

    return (
        <div className="w-full min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#010912] via-[#020B14] to-[#010912]">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-7xl"
            >
                {/* Premium Header Card */}
                <div className="bg-gradient-to-br from-[#0A192F]/90 to-[#020B14]/90 backdrop-blur-3xl border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)]">

                    {/* Status Banner */}
                    <div className="bg-gradient-to-r from-white/5 to-transparent border-b border-white/10 px-12 py-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${isQuestionBank ? 'bg-accent-amber' : 'bg-action-teal'} shadow-lg shadow-current/50 animate-pulse`} />
                            <span className={`text-xs font-black uppercase tracking-[0.3em] ${isQuestionBank ? 'text-accent-amber' : 'text-action-teal'}`}>
                                {isQuestionBank ? '⚡ Simulation Mode' : '🎯 Job Description Analysis'}
                            </span>
                        </div>
                        <div className="text-xs font-mono text-white/40 uppercase tracking-widest">
                            Session Protocol
                        </div>
                    </div>

                    {/* Main Header */}
                    <div className="text-center py-16 px-12 border-b border-white/5">
                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-6xl md:text-7xl font-serif font-black text-white mb-6 tracking-tight"
                        >
                            Arena Blueprint
                        </motion.h1>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="flex items-center justify-center gap-6 text-lg"
                        >
                            <span className="text-white/60 font-bold uppercase tracking-wider">
                                {jdInsights.role || 'Technical Professional'}
                            </span>
                            <div className="w-2 h-2 rounded-full bg-action-teal/50" />
                            <span className="text-action-teal font-black uppercase tracking-wider">
                                {jdInsights.level || 'Intermediate'} Level
                            </span>
                        </motion.div>
                    </div>

                    {/* Main Content */}
                    <div className="p-12 md:p-20 space-y-16">

                        {/* Skills Matrix */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

                            {/* Core Competencies */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 }}
                                className="space-y-8"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-1 h-8 bg-gradient-to-b from-action-teal to-transparent rounded-full" />
                                    <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">
                                        Core Competencies
                                    </h3>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {skills.map((skill, idx) => (
                                        <SkillChip key={idx} label={skill} index={idx} />
                                    ))}
                                </div>

                                <div className="flex items-center gap-4 mt-12">
                                    <div className="w-1 h-8 bg-gradient-to-b from-info-blue to-transparent rounded-full" />
                                    <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">
                                        Domain Expertise
                                    </h3>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {domains.map((domain, idx) => (
                                        <SkillChip key={idx} label={domain} index={idx} />
                                    ))}
                                </div>
                            </motion.div>

                            {/* Technical & Soft Skills */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.6 }}
                                className="space-y-8"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-1 h-8 bg-gradient-to-b from-accent-amber to-transparent rounded-full" />
                                    <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">
                                        Technical Stack
                                    </h3>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {tools.map((tool, idx) => (
                                        <SkillChip key={idx} label={tool} index={idx} />
                                    ))}
                                </div>

                                <div className="flex items-center gap-4 mt-12">
                                    <div className="w-1 h-8 bg-gradient-to-b from-[#A78BFA] to-transparent rounded-full" />
                                    <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">
                                        Leadership & Soft Skills
                                    </h3>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {softSkills.map((skill, idx) => (
                                        <SkillChip key={idx} label={skill} index={idx} />
                                    ))}
                                </div>
                            </motion.div>
                        </div>

                        {/* Assessment Vectors */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 }}
                            className="bg-white/[0.02] border border-white/10 rounded-3xl p-12 space-y-10"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-1 h-8 bg-gradient-to-b from-white/50 to-transparent rounded-full" />
                                    <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">
                                        Assessment Focus Distribution
                                    </h3>
                                </div>
                                <div className="text-xs text-white/30 font-mono uppercase tracking-wider">
                                    Weighted Vectors
                                </div>
                            </div>

                            <div className="space-y-8">
                                {weightData.map((item, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.8 + (i * 0.1) }}
                                        className="space-y-3"
                                    >
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-sm font-bold text-white uppercase tracking-widest">
                                                {item.label}
                                            </span>
                                            <span className="text-2xl font-black text-white font-mono">
                                                {item.percentage}<span className="text-base text-white/40">%</span>
                                            </span>
                                        </div>
                                        <div className="h-3 bg-white/5 rounded-full overflow-hidden relative">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${item.percentage}%` }}
                                                transition={{ delay: 1 + (i * 0.1), duration: 1, ease: "easeOut" }}
                                                className="h-full rounded-full shadow-lg"
                                                style={{
                                                    backgroundColor: item.color,
                                                    boxShadow: `0 0 20px ${item.color}40`
                                                }}
                                            />
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {weightData.length > 0 && (
                                <div className="pt-8 border-t border-white/10">
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                        <span className="text-white/40">Primary Focus:</span>{' '}
                                        <span className="text-white font-bold">
                                            {weightData.sort((a, b) => b.percentage - a.percentage)[0].label}
                                        </span>
                                        {' '}will be the dominant evaluation criterion for this session.
                                    </p>
                                </div>
                            )}
                        </motion.div>

                        {/* Action Buttons */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.2 }}
                            className="flex flex-col sm:flex-row gap-6 pt-8"
                        >
                            <button
                                onClick={onAdjustSpecs}
                                className="flex-1 group bg-white/5 hover:bg-white/10 border border-white/20 text-white font-black py-6 rounded-2xl transition-all text-sm tracking-[0.2em] uppercase relative overflow-hidden"
                            >
                                <span className="relative z-10">← Reconfigure Parameters</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 transform -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                            </button>
                            <button
                                onClick={onInitialize}
                                className="flex-[2] group bg-gradient-to-r from-action-teal to-info-blue text-base-surface font-black py-6 rounded-2xl shadow-2xl shadow-action-teal/30 hover:shadow-action-teal/50 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm tracking-[0.3em] uppercase relative overflow-hidden"
                            >
                                <span className="relative z-10">🚀 Launch Interview Session</span>
                                <div className="absolute inset-0 bg-white/20 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                            </button>
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default ArenaBlueprint;
