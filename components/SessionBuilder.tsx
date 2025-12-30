
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

const BAR_COLORS = ['#14C8B0', '#38BDF8', '#FBBF24', '#F86A6A', '#A78BFA'];

const ArenaBlueprint: React.FC<SessionBuilderProps> = ({ jdInsights, competencyWeights, onAdjustSpecs = () => { }, onInitialize = () => { } }) => {

    const BAR_COLORS = {
        'DomainKnowledge': '#14C8B0',
        'MethodsTools': '#38BDF8',
        'ProcessCompliance': '#FBBF24',
        'ScenarioDecision': '#F86A6A',
        'BehavioralComms': '#A78BFA'
    };

    // Ensure weightData matches the 5 expected competencies
    const weightData = (competencyWeights || []).map((w) => {
        const rawWeight = w.weight;
        const displayPercentage = rawWeight <= 1 ? rawWeight * 100 : rawWeight;

        return {
            label: w.competency,
            percentage: displayPercentage,
            color: (BAR_COLORS as any)[w.competency] || '#94A3B8'
        };
    });

    const getSourceMeta = (source: string) => {
        switch (source) {
            case 'realJD':
                return { label: 'Direct JD Analysis', color: 'text-info-blue', border: 'border-info-blue/20' };
            case 'questionBank':
                return { label: 'Question Bank Integration', color: 'text-accent-amber', border: 'border-accent-amber/20' };
            case 'attachment':
                return { label: 'Attached Documentation', color: 'text-action-teal', border: 'border-action-teal/20' };
            default:
                return { label: 'Industry Standard Baseline', color: 'text-white/40', border: 'border-white/10' };
        }
    };

    const sourceMeta = getSourceMeta(jdInsights.source);

    const CategoryBlock = ({ title, items, colorClass = "text-action-teal" }: { title: string, items: string[], colorClass?: string }) => {
        if (!items || items.length === 0) return null;
        return (
            <div className="space-y-6">
                <h4 className={`text-[12px] font-black uppercase tracking-[0.25em] ${colorClass} opacity-80 border-b border-white/5 pb-3`}>{title}</h4>
                <ul className="space-y-3">
                    {items.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-4 group">
                            <span className="text-action-teal/40 group-hover:text-action-teal transition-colors mt-2 text-[6px]">●</span>
                            <span className="text-text-secondary text-[14px] font-semibold leading-relaxed group-hover:text-white transition-colors">
                                {item}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <div className="w-full max-w-6xl mx-auto py-12 px-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#0A192F]/60 backdrop-blur-2xl border border-white/10 rounded-[4rem] p-12 md:p-20 shadow-[0_80px_160px_rgba(0,0,0,0.7)] flex flex-col relative overflow-hidden"
            >
                {/* Premium Background Accents */}
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-action-teal/5 rounded-full blur-[120px]" />
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-info-blue/5 rounded-full blur-[120px]" />

                <header className="mb-24 flex flex-col items-start text-left">
                    <div className={`mb-8 px-5 py-2 border ${sourceMeta.border} rounded-full inline-flex items-center gap-3 bg-white/[0.03]`}>
                        <div className={`w-2 h-2 rounded-full bg-current ${sourceMeta.color} animate-pulse`} />
                        <span className={`text-[11px] font-black uppercase tracking-[0.3em] ${sourceMeta.color}`}>
                            {sourceMeta.label}
                        </span>
                    </div>
                    <h2 className="text-6xl md:text-7xl font-serif font-black text-white mb-8 tracking-tighter leading-none">
                        Prepare Your Session
                    </h2>
                    <p className="text-text-secondary text-xl max-w-3xl leading-relaxed font-semibold opacity-60">
                        We've selected a recommended panel for you. Upload a JD or a Question Bank for a tailored plan.
                    </p>
                </header>

                <div className="space-y-32">
                    {/* Your Interview Blueprint */}
                    <div>
                        <div className="mb-12">
                            <h3 className="text-action-teal font-black text-2xl uppercase tracking-[0.2em] mb-2">Your Interview Blueprint</h3>
                            <p className="text-text-secondary font-semibold opacity-40">We've analyzed your goal and generated a tailored interview plan.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-20 gap-y-16">
                            <CategoryBlock title="Must-Have Skills" items={jdInsights.mustHaveSkills} />
                            <CategoryBlock title="Nice-To-Have Skills" items={jdInsights.niceToHave} />
                            <CategoryBlock title="Domains" items={jdInsights.domains} />
                            <CategoryBlock title="Tools & Technologies" items={jdInsights.tools} />
                            <CategoryBlock title="Soft Skills" items={jdInsights.softSkills} />
                        </div>
                    </div>

                    {/* Competency Weights */}
                    <div className="space-y-16">
                        <div>
                            <h3 className="text-action-teal font-black text-2xl uppercase tracking-[0.2em] mb-2">Competency Weights</h3>
                            <p className="text-text-secondary font-semibold opacity-40">The interview will focus on these areas, weighted as shown.</p>
                        </div>

                        <div className="space-y-10 max-w-4xl pt-4">
                            {weightData.map((item, i) => (
                                <div key={i} className="flex items-center gap-10 group cursor-default">
                                    <div className="w-56 text-right shrink-0">
                                        <span className="text-[14px] font-black text-white/40 uppercase tracking-[0.2em] group-hover:text-white transition-all transform group-hover:-translate-x-1 inline-block">
                                            {item.label}
                                        </span>
                                    </div>
                                    <div className="flex-grow h-6 bg-white/[0.03] rounded-sm relative overflow-visible border border-white/5">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${item.percentage}%` }}
                                            transition={{ delay: 0.3 + (i * 0.1), duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                                            className="h-full rounded-sm relative group/bar"
                                            style={{ backgroundColor: item.color }}
                                        >
                                            {/* Tooltip-like value display */}
                                            <div className="absolute -right-3 -top-12 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-base-surface border border-white/10 px-3 py-1.5 rounded-lg shadow-2xl z-20 pointer-events-none">
                                                <div className="text-[12px] font-black text-white whitespace-nowrap">
                                                    {item.label}: <span className="text-action-teal">{Math.round(item.percentage)}%</span>
                                                </div>
                                                <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-base-surface border-r border-b border-white/10 rotate-45" />
                                            </div>
                                        </motion.div>
                                    </div>
                                    <div className="w-20 shrink-0">
                                        <span className="text-[16px] font-mono font-black text-white group-hover:text-action-teal transition-colors">
                                            {Math.round(item.percentage)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-32 pt-16 flex flex-col md:flex-row gap-8 border-t border-white/5">
                    <button
                        onClick={onAdjustSpecs}
                        className="flex-1 bg-white/5 text-white/60 font-black py-7 rounded-[2rem] hover:bg-white/10 hover:text-white transition-all text-[11px] tracking-[0.3em] uppercase border border-white/5"
                    >
                        Adjust Specs
                    </button>
                    <button
                        onClick={onInitialize}
                        className="flex-[2] bg-action-teal text-base-surface font-black py-7 rounded-[2rem] hover:shadow-[0_30px_60px_rgba(20,200,176,0.3)] transition-all text-[11px] tracking-[0.3em] uppercase transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Initialize Arena
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default ArenaBlueprint;
