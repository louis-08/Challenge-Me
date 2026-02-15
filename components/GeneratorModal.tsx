import React, { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { MilestoneCategory, Difficulty } from '../types';
import { generateCreativeMilestones } from '../services/geminiService';
import { Milestone } from '../types';

interface GeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (milestones: Milestone[]) => void;
}

export const GeneratorModal: React.FC<GeneratorModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(MilestoneCategory.ADVENTURE);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | 'ALL'>('ALL');
  const [additionalInfo, setAdditionalInfo] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<Milestone[]>([]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setGenerated([]);
    try {
      const results = await generateCreativeMilestones(selectedCategory, selectedDifficulty, additionalInfo);
      setGenerated(results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = (milestone: Milestone) => {
    onAdd([milestone]);
    setGenerated(prev => prev.filter(p => p.id !== milestone.id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              Lass dich inspirieren
            </h2>
            <p className="text-sm text-slate-500 mt-1">Die KI schlägt dir kreative Ziele vor.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Kategorie</label>
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                >
                  {Object.values(MilestoneCategory).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Schwierigkeit</label>
                <select 
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value as any)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                >
                  <option value="ALL">Zufall</option>
                  {Object.values(Difficulty).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Zusatz-Info (Optional)</label>
              <input 
                type="text"
                placeholder="z.B. 'Draußen', 'Mit Tieren', 'Im Büro'"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-medium transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? 'KI denkt nach...' : 'Ideen generieren'}
            </button>
          </div>

          {generated.length > 0 && (
            <div className="mt-8 space-y-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Vorschläge</h3>
              {generated.map(milestone => (
                <div key={milestone.id} className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all bg-white group">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h4 className="font-semibold text-slate-800">{milestone.title}</h4>
                      <p className="text-sm text-slate-600 mt-1">{milestone.description}</p>
                      <div className="mt-2 text-xs text-indigo-500 font-medium">
                        {milestone.difficulty} • {milestone.proofType}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAccept(milestone)}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 font-medium text-xs rounded-lg hover:bg-indigo-600 hover:text-white transition-colors"
                    >
                      Hinzufügen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};