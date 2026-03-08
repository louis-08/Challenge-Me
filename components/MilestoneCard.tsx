import React from 'react';
import { Sparkles, Zap, Camera, Video } from 'lucide-react';
import { Milestone, Difficulty } from '../types';
import { CATEGORY_COLORS, DIFFICULTY_COLORS, CATEGORY_EMOJIS } from '../constants';

interface MilestoneCardProps {
  milestone: Milestone;
  onChallenge: (milestone: Milestone) => void;
  onDelete?: (id: string) => void;
}

export const MilestoneCard: React.FC<MilestoneCardProps> = ({
  milestone,
  onChallenge,
}) => {
  const catColor = CATEGORY_COLORS[milestone.category] || '#64748b';
  const diffColor = DIFFICULTY_COLORS[milestone.difficulty || Difficulty.MEDIUM] || '#facc15';
  const catEmoji = CATEGORY_EMOJIS[milestone.category] || '📌';

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden">

      {/* Colored Header Block */}
      <div className="px-4 pt-4 pb-3" style={{ backgroundColor: `${catColor}18` }}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span
              className="text-2xl leading-none"
              role="img"
            >
              {catEmoji}
            </span>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: catColor }}
            >
              {milestone.category}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {milestone.isAiGenerated && (
              <div className="flex items-center gap-1 text-[10px] text-indigo-400">
                <Sparkles className="w-3 h-3" />
                <span>AI</span>
              </div>
            )}
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border"
              style={{ borderColor: diffColor, color: diffColor }}
            >
              {milestone.difficulty}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 flex-grow flex flex-col">
        {/* Title */}
        <h3 className="text-base font-bold text-slate-800 leading-snug mb-2 group-hover:text-indigo-600 transition-colors">
          {milestone.title}
        </h3>

        {/* Full description – no clamp */}
        <p className="text-sm text-slate-500 leading-relaxed flex-grow">
          {milestone.description}
        </p>

        {/* Proof type */}
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-400 border-t border-slate-50 pt-3">
          {milestone.proofType === 'VIDEO' ? <Video className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
          <span>{milestone.proofType === 'VIDEO' ? 'Video Beweis' : 'Foto Beweis'}</span>
        </div>
      </div>

      {/* Action Button */}
      <div className="px-4 pb-4">
        <button
          onClick={() => onChallenge(milestone)}
          className="w-full py-2.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200 group-hover:shadow-indigo-200"
        >
          <Zap className="w-4 h-4 fill-white" />
          Challenge starten
        </button>
      </div>
    </div>
  );
};
