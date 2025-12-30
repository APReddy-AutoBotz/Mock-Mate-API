
import React from 'react';
import { SessionControls } from '../types';

interface SessionControlsEditorProps {
    controls: SessionControls;
    onChange: (newControls: SessionControls) => void;
}

const ToggleSwitch: React.FC<{
    isOn: boolean;
    onToggle: () => void;
    activeColor?: string;
}> = ({ isOn, onToggle, activeColor = 'bg-info-blue' }) => (
    <button
        onClick={onToggle}
        className={`relative w-14 h-7 rounded-full transition-all duration-300 ease-in-out border-2 ${isOn
                ? `${activeColor} border-transparent shadow-[0_0_15px_rgba(56,189,248,0.4)]`
                : 'bg-[#0A192F] border-white/10'
            }`}
    >
        <div className={`
            absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-lg transition-all duration-300 ease-in-out
            ${isOn ? 'left-[30px]' : 'left-0.5'}
        `} />
    </button>
);

const SessionControlsEditor: React.FC<SessionControlsEditorProps> = ({ controls, onChange }) => {

    const setPresetCount = (difficulty: 'starter' | 'intermediate' | 'expert') => {
        let newCount = 15;
        if (difficulty === 'starter') newCount = 7;
        if (difficulty === 'expert') newCount = 25;

        onChange({
            ...controls,
            difficulty,
            totalQuestions: newCount
        });
    }

    return (
        <div className="space-y-12">
            {/* Mode Selection */}
            <div className="flex flex-col space-y-4 bg-white/[0.03] p-6 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center">
                    <div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">Preparation Mode</h4>
                        <p className="text-xs text-text-secondary mt-1">Choose how AI generates your session</p>
                    </div>
                    <div className="flex bg-[#0A192F] p-1 rounded-xl border border-white/10">
                        <button
                            onClick={() => onChange({ ...controls, sourceMode: 'job_description' })}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${controls.sourceMode === 'job_description' ? 'bg-info-blue text-[#0A192F]' : 'text-text-secondary hover:text-white'}`}
                        >
                            Role / JD Exploration
                        </button>
                        <button
                            onClick={() => onChange({ ...controls, sourceMode: 'question_bank' })}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${controls.sourceMode === 'question_bank' ? 'bg-accent-amber text-[#0A192F]' : 'text-text-secondary hover:text-white'}`}
                        >
                            Question Bank Sim
                        </button>
                    </div>
                </div>
                <p className="text-[11px] text-info-blue/80 italic border-t border-white/5 pt-3">
                    {controls.sourceMode === 'job_description'
                        ? "✨ AI will search the web for trending questions and mix them with JD requirements."
                        : "🔒 AI will strictly stick to your provided material/dump, ensuring exact phrasing variations."}
                </p>
            </div>

            {/* Volume and Sophistication Tier Row */}
            <div className="space-y-5">
                <div className="flex justify-between items-baseline px-1">
                    <label className="text-sm font-bold text-white tracking-tight">Difficulty & Volume</label>
                    <span className="text-sm font-bold text-info-blue">{controls.totalQuestions} Questions</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    {(['starter', 'intermediate', 'expert'] as const).map(d => (
                        <button
                            key={d}
                            onClick={() => setPresetCount(d)}
                            className={`flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border transition-all ${controls.difficulty === d
                                    ? 'bg-info-blue/10 border-info-blue text-white shadow-[0_0_20px_rgba(56,189,248,0.1)]'
                                    : 'bg-white/[0.03] text-text-secondary border-white/5 hover:border-white/10 hover:bg-white/[0.05]'
                                }`}
                        >
                            <span className="text-xs font-black uppercase tracking-widest">{d}</span>
                            <span className="text-[10px] opacity-60 font-mono">
                                {d === 'starter' ? '7 Qs (Basic)' : d === 'intermediate' ? '15 Qs (Mixed)' : '25 Qs (Adv)'}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Tactical Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col items-center justify-between p-6 bg-white/[0.03] rounded-2xl border border-white/5 transition-all hover:bg-white/[0.05]">
                    <div className="w-full flex justify-between items-center mb-4">
                        <label className="text-sm font-bold text-white tracking-tight">Coach Mode</label>
                        <ToggleSwitch
                            isOn={controls.sessionMode === 'coach'}
                            onToggle={() => onChange({ ...controls, sessionMode: controls.sessionMode === 'coach' ? 'exam' : 'coach' })}
                        />
                    </div>
                    <p className="text-[11px] text-text-secondary font-medium text-left w-full leading-relaxed">
                        If enabled, AI will provide hints and real-time feedback after every answer. Good for learning.
                    </p>
                </div>

                <div className="flex flex-col items-center justify-between p-6 bg-white/[0.03] rounded-2xl border border-white/5 transition-all hover:bg-white/[0.05]">
                    <div className="w-full flex justify-between items-center mb-4">
                        <label className="text-sm font-bold text-white tracking-tight">Coding Questions</label>
                        <ToggleSwitch
                            isOn={!!controls.includeCoding}
                            onToggle={() => onChange({ ...controls, includeCoding: !controls.includeCoding })}
                            activeColor="bg-action-teal"
                        />
                    </div>
                    <p className="text-[11px] text-text-secondary font-medium text-left w-full leading-relaxed">
                        Include algorithmic or system design challenges (requires switching to technical persona).
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SessionControlsEditor;
