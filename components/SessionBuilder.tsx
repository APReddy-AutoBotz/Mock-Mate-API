import { JDInsights, CompetencyWeight, QuestionBlueprint } from '../types';
import React from 'react';

interface SessionBuilderProps {
    jdInsights: JDInsights;
    competencyWeights: CompetencyWeight[];
    questionSet?: QuestionBlueprint[];
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

const BlueprintCategory: React.FC<{
    title: string;
    items: string[];
    colorClass: string;
    delay?: number;
}> = ({ title, items, colorClass, delay = 0 }) => {
    if (!items || items.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5 }}
            className="space-y-4"
        >
            <div className="flex items-center gap-3">
                <div className={`w-1 h-3 rounded-full ${colorClass}`} />
                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white opacity-40">{title}</h4>
            </div>
            <ul className="space-y-2 pl-4">
                {items.map((item, idx) => (
                    <li key={idx} className="text-[13px] text-text-secondary font-medium list-disc marker:text-white/20">
                        {item}
                    </li>
                ))}
            </ul>
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

    const isQuestionBank = jdInsights.source === 'questionBank';

    return (
        <div className="w-full max-w-6xl mx-auto py-12 px-6">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#020B14] rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl relative"
            >
                {/* Subtle Header */}
                <div className="bg-white/[0.02] border-b border-white/5 py-12 px-10 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className={`px-4 py-1.5 rounded-full border ${isQuestionBank ? 'border-accent-amber/30 text-accent-amber bg-accent-amber/5' : 'border-info-blue/30 text-info-blue bg-info-blue/5'} text-[10px] font-black uppercase tracking-widest`}>
                            {isQuestionBank ? 'Simulation Mode Active' : 'JD Calibration Complete'}
                        </div>
                        <h2 className="text-4xl md:text-5xl font-serif font-black text-white tracking-tight">
                            Arena Blueprint
                        </h2>
                        <div className="flex items-center gap-6 mt-2 opacity-60">
                            <span className="text-xs font-bold text-white uppercase tracking-widest">{jdInsights.role || "Target Role"}</span>
                            <div className="w-1 h-1 rounded-full bg-white/20" />
                            <span className="text-xs font-bold text-action-teal uppercase tracking-widest">{jdInsights.level || "Expert"} Tier</span>
                        </div>
                    </div>
                </div>

                <div className="p-10 md:p-16 space-y-20">
                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">

                        {/* Primary Knowledge Pillars */}
                        <div className="lg:col-span-8 space-y-12">
                            <h3 className="text-xs font-black text-white uppercase tracking-[0.3em] opacity-20 border-b border-white/5 pb-4">Protocol Focus Areas</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                <BlueprintCategory title="Must-Have Skills" items={jdInsights.mustHaveSkills} colorClass="bg-action-teal" delay={0.1} />
                                <BlueprintCategory title="Domain Expertise" items={jdInsights.domains} colorClass="bg-info-blue" delay={0.2} />
                                <BlueprintCategory title="Technical Stack" items={jdInsights.tools} colorClass="bg-action-teal" delay={0.3} />
                                <BlueprintCategory title="Soft & Interpersonal" items={jdInsights.softSkills} colorClass="bg-accent-amber" delay={0.4} />
                            </div>
                        </div>

                        {/* Lateral Assessment Weights */}
                        <div className="lg:col-span-4 space-y-12">
                            <h3 className="text-xs font-black text-white uppercase tracking-[0.3em] opacity-20 border-b border-white/5 pb-4">Weight Distribution</h3>
                            <div className="space-y-8 bg-white/[0.02] p-8 rounded-3xl border border-white/5">
                                {weightData.map((item, i) => (
                                    <div key={i} className="space-y-3">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{item.label}</span>
                                            <span className="text-xs font-mono font-bold text-white/60">{item.percentage}%</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${item.percentage}%` }}
                                                transition={{ delay: 0.5 + (i * 0.1), duration: 1 }}
                                                className="h-full rounded-full"
                                                style={{ backgroundColor: item.color }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <div className="pt-6 border-t border-white/5 mt-4">
                                    <p className="text-[11px] text-text-secondary leading-relaxed italic opacity-50">
                                        Prioritizing <span className="text-white font-bold">{weightData.sort((a, b) => b.percentage - a.percentage)[0].label}</span> as the critical success vector.
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Simple Bottom Actions */}
                    <div className="flex flex-col sm:flex-row gap-6 pt-10 border-t border-white/5">
                        <button
                            onClick={onAdjustSpecs}
                            className="flex-1 bg-white/5 text-white/50 font-black py-5 rounded-2xl hover:bg-white/10 hover:text-white transition-all text-[11px] tracking-widest uppercase border border-white/5"
                        >
                            Adjust Parameters
                        </button>
                        <button
                            onClick={onInitialize}
                            className="flex-[1.5] bg-action-teal text-base-surface font-black py-5 rounded-2xl shadow-xl shadow-action-teal/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-[11px] tracking-[0.2em] uppercase"
                        >
                            Initialize Session Arena
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default ArenaBlueprint;
