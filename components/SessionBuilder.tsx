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

const SkillSection: React.FC<{ title: string; items: string[]; delay?: number }> = ({ title, items, delay = 0 }) => {
    if (!items || items.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5 }}
            className="space-y-4"
        >
            <h3 className="text-base font-bold text-white mb-4">{title}</h3>
            <ul className="space-y-2.5">
                {items.map((item, idx) => (
                    <li key={idx} className="text-sm text-text-secondary pl-5 relative before:content-['•'] before:absolute before:left-0 before:text-action-teal">
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

    const isQuestionBank = jdInsights.source === 'questionBank';
    const sourceLabel = isQuestionBank ? 'Question Bank' : 'Job Description';

    // Ensure we always have data
    const skills = jdInsights.mustHaveSkills?.length > 0 ? jdInsights.mustHaveSkills : [];
    const niceToHave = jdInsights.niceToHave?.length > 0 ? jdInsights.niceToHave : [];
    const domains = jdInsights.domains?.length > 0 ? jdInsights.domains : [];
    const tools = jdInsights.tools?.length > 0 ? jdInsights.tools : [];
    const softSkills = jdInsights.softSkills?.length > 0 ? jdInsights.softSkills : [];

    return (
        <div className="w-full min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-5xl">
                {/* Header Section */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <h1 className="text-5xl font-bold text-white mb-4">Prepare Your Session</h1>
                    <p className="text-text-secondary text-base">
                        We've selected a recommended panel for you. Upload a JD or a Question Bank for a tailored plan.
                    </p>
                </motion.div>

                {/* Blueprint Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-[#0A192F]/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-12 space-y-10"
                >
                    {/* Blueprint Header */}
                    <div className="space-y-4 pb-8 border-b border-white/10">
                        <h2 className="text-2xl font-bold text-action-teal">Your Interview Blueprint</h2>
                        <p className="text-text-secondary">
                            We've analyzed your goal and generated a tailored interview plan. The source is a{' '}
                            <span className="text-white font-bold">{sourceLabel}</span>.
                        </p>
                    </div>

                    {/* Skills Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
                        <SkillSection title="Must-Have Skills" items={skills} delay={0.3} />
                        <SkillSection title="Nice-to-Have Skills" items={niceToHave} delay={0.4} />
                        <SkillSection title="Domains" items={domains} delay={0.5} />
                        <SkillSection title="Tools & Technologies" items={tools} delay={0.6} />
                        <SkillSection title="Soft Skills" items={softSkills} delay={0.7} />
                    </div>

                    {/* Competency Weights (Compact) */}
                    {competencyWeights && competencyWeights.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="pt-10 border-t border-white/10 space-y-6"
                        >
                            <h3 className="text-base font-bold text-white">Assessment Focus</h3>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                                {competencyWeights.map((w, i) => {
                                    const percentage = w.weight <= 1 ? Math.round(w.weight * 100) : Math.round(w.weight);
                                    const label = w.competency.replace(/([A-Z])/g, ' $1').trim();

                                    return (
                                        <div key={i} className="text-center space-y-2">
                                            <div className="text-2xl font-black text-action-teal font-mono">{percentage}%</div>
                                            <div className="text-xs text-text-secondary uppercase tracking-wider">{label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* Action Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1 }}
                        className="flex flex-col sm:flex-row gap-4 pt-8"
                    >
                        <button
                            onClick={onAdjustSpecs}
                            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/20 text-white font-bold py-4 px-6 rounded-xl transition-all text-sm"
                        >
                            ← Adjust Specs
                        </button>
                        <button
                            onClick={onInitialize}
                            className="flex-[2] bg-action-teal hover:bg-action-teal/90 text-base-surface font-bold py-4 px-6 rounded-xl shadow-lg shadow-action-teal/30 hover:shadow-action-teal/50 transition-all text-sm"
                        >
                            Launch Interview Session →
                        </button>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
};

export default ArenaBlueprint;
