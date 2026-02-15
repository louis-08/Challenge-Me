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
  onDelete 
}) => {
  const catColor = CATEGORY_COLORS[milestone.category] || '#64748b';
  const diffColor = DIFFICULTY_COLORS[milestone.difficulty || Difficulty.MEDIUM] || '#facc15';
  const catEmoji = CATEGORY_EMOJIS[milestone.category] || '📌';

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full overflow-hidden">
      
      {/* Top Stripe */}
      <div className="h-2 w-full" style={{ backgroundColor: catColor }}></div>
      
      <div className="p-5 flex-grow flex flex-col">
        {/* Header Tags */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex gap-2">
            <span 
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1"
              style={{ backgroundColor: `${catColor}15`, color: catColor }}
            >
              <span>{catEmoji}</span>
              {milestone.category}
            </span>
            <span 
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border"
              style={{ borderColor: diffColor, color: diffColor }}
            >
              {milestone.difficulty}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow">
          <h3 className="text-lg font-bold text-slate-800 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
            {milestone.title}
          </h3>
          <p className="text-sm text-slate-500 line-clamp-3">
            {milestone.description}
          </p>
        </div>

        {/* Info Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
           <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              {milestone.proofType === 'VIDEO' ? <Video className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
              <span>{milestone.proofType === 'VIDEO' ? 'Video Beweis' : 'Foto Beweis'}</span>
           </div>

           {/* AI Badge */}
           {milestone.isAiGenerated && (
            <div className="flex items-center gap-1 text-[10px] text-indigo-400">
              <Sparkles className="w-3 h-3" />
              <span>AI</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 pt-0 mt-auto">
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