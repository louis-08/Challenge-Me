import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Shuffle, ChevronLeft, RotateCcw, Swords, Users, ChevronDown, ChevronUp, Sparkles, Loader2, User as UserIcon } from 'lucide-react';
import { Milestone, MilestoneCategory, Difficulty } from '../types';
import { INITIAL_MILESTONES, CATEGORY_EMOJIS } from '../constants';
import { MilestoneCard } from './MilestoneCard';
import { generateCreativeMilestones } from '../services/geminiService';

type Screen = 'players' | 'challenge' | 'result';

interface LocalModeProps {
  feedChallenges: Milestone[];
}

export const LocalMode: React.FC<LocalModeProps> = ({ feedChallenges }) => {
  const [screen, setScreen] = useState<Screen>('players');

  // Players
  const [players, setPlayers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('localMode_players');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [nameInput, setNameInput] = useState('');
  const [playerPanelOpen, setPlayerPanelOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('localMode_players', JSON.stringify(players));
  }, [players]);

  // Challenge
  const [selectedChallenge, setSelectedChallenge] = useState<Milestone | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('ALL');
  const [aiChallenges, setAiChallenges] = useState<Milestone[]>([]);

  // Generator
  const [isGenerating, setIsGenerating] = useState(false);
  const [genContext, setGenContext] = useState('');
  const [genTeamMode, setGenTeamMode] = useState<'SOLO' | 'TEAM'>('SOLO');
  const [genAdvancedOpen, setGenAdvancedOpen] = useState(false);

  // Result / Spin
  const [chosenPlayer, setChosenPlayer] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [spinning, setSpinning] = useState(false);
  const spinRef = useRef<number | null>(null);

  useEffect(() => () => { if (spinRef.current) clearTimeout(spinRef.current); }, []);

  const baseChallenges = feedChallenges.length > 0 ? feedChallenges : INITIAL_MILESTONES;
  const allChallenges = [...aiChallenges, ...baseChallenges];

  const filteredChallenges = allChallenges.filter(c => {
    const key = Object.entries(MilestoneCategory).find(([, v]) => v === c.category)?.[0] ?? '';
    const catOk = categoryFilter === 'ALL' || key === categoryFilter;
    const diffOk = difficultyFilter === 'ALL' || c.difficulty === difficultyFilter;
    return catOk && diffOk;
  });

  // ─── Generator ─────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const contextParts = [genContext, genTeamMode === 'TEAM' ? 'Im Team zu erledigen' : 'Solo zu erledigen'].filter(Boolean);
      const results = await generateCreativeMilestones(categoryFilter === 'ALL' ? 'MIX' : categoryFilter, difficultyFilter === 'ALL' ? 'ALL' : difficultyFilter, contextParts.join(', '), 10);
      if (results.length > 0) setAiChallenges(prev => [...results, ...prev]);
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Players ───────────────────────────────────────────────────────────────

  const addPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name || players.includes(name) || players.length >= 100) return;
    setPlayers(prev => [...prev, name]);
    setNameInput('');
  };

  const removePlayer = (name: string) => {
    setPlayers(prev => prev.filter(p => p !== name));
  };

  // ─── Spin ──────────────────────────────────────────────────────────────────

  const startSpinAnimation = () => {
    const winner = players[Math.floor(Math.random() * players.length)];
    let tick = 0;
    const total = 30; // Amount of steps
    let delay = 30;   // Start fast (every 30ms)

    const runSpin = () => {
      // Pick a random player for the spinning visual
      setDisplayName(players[Math.floor(Math.random() * players.length)]);
      tick++;
      
      if (tick >= total) {
        setDisplayName(winner);
        setChosenPlayer(winner);
        setSpinning(false);
      } else {
        // Slow down increasingly
        delay = Math.floor(delay * 1.12); // exponential slowdown
        spinRef.current = window.setTimeout(runSpin, delay) as unknown as number;
      }
    };
    
    spinRef.current = window.setTimeout(runSpin, delay) as unknown as number;
  };

  const spin = (challenge: Milestone) => {
    if (spinning || players.length < 1) return;
    setSelectedChallenge(challenge);
    setSpinning(true);
    setChosenPlayer('');
    setDisplayName('');
    setScreen('result');

    startSpinAnimation();
  };

  const spinAgain = () => {
    if (!selectedChallenge) return;
    setDisplayName('');
    setChosenPlayer('');
    setSpinning(true);

    startSpinAnimation();
  };

  // ─── Player panel (shown on challenge + result screens) ────────────────────

  const playerPanel = (
    <div className="bg-white border border-slate-200 rounded-2xl mb-6 overflow-hidden">
      <button
        onClick={() => setPlayerPanelOpen(p => !p)}
        className="w-full flex items-start justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 flex-1 mr-2">
          <Users className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <span className="text-sm font-bold text-slate-700 flex-shrink-0">
            {players.length} Spieler
          </span>
          <div className="flex flex-wrap gap-1">
            {players.slice(0, 5).map(p => (
              <span key={p} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{p}</span>
            ))}
            {players.length > 5 && (
              <span className="text-xs text-slate-400">+{players.length - 5}</span>
            )}
          </div>
        </div>
        {playerPanelOpen ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>

      {playerPanelOpen && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <form onSubmit={addPlayer} className="flex gap-2 mt-3 mb-3">
            <input
              type="text"
              placeholder="Spieler hinzufügen..."
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              maxLength={20}
              className="flex-1 p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <button
              type="submit"
              disabled={!nameInput.trim() || players.length >= 100}
              className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            {players.map(p => (
              <span
                key={p}
                className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full text-sm font-medium"
              >
                {p}
                <button onClick={() => removePlayer(p)} className="text-slate-400 hover:text-rose-500 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ─── Screens ───────────────────────────────────────────────────────────────

  if (screen === 'players') {
    return (
      <div className="max-w-sm mx-auto py-4">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-2xl font-black text-slate-900">Party Modus</h2>
          <p className="text-slate-500 text-sm mt-1">Gebt alle Spielernamen ein.</p>
        </div>

        <form onSubmit={addPlayer} className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Name eingeben..."
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            maxLength={20}
            className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            autoFocus
          />
          <button
            type="submit"
            disabled={!nameInput.trim() || players.length >= 100}
            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        {players.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-8">
            {players.map(p => (
              <span
                key={p}
                className="flex items-center gap-1.5 bg-indigo-50 text-indigo-800 border border-indigo-100 px-3 py-1.5 rounded-full text-sm font-semibold"
              >
                {p}
                <button onClick={() => removePlayer(p)} className="text-indigo-400 hover:text-rose-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-300">
            <p className="text-sm">Mindestens 2 Spieler werden benötigt.</p>
          </div>
        )}

        <button
          onClick={() => setScreen('challenge')}
          disabled={players.length < 2}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black rounded-xl transition-all text-base shadow-lg shadow-indigo-200"
        >
          Weiter → Challenge wählen
        </button>
      </div>
    );
  }

  if (screen === 'challenge') {
    return (
      <div>
        {playerPanel}

        {/* Challenge Generator — identisch mit Feed */}
        <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-8 mb-10 shadow-xl shadow-indigo-200 text-white">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-purple-500/30 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-3xl font-black tracking-tight">Challenge Generator</h2>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="text-xs font-bold uppercase text-indigo-200 mb-1.5 block">Kategorie</label>
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="w-full bg-white text-slate-800 rounded-xl px-3 py-3 font-bold outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                  >
                    <option value="ALL">🎲 Alle Kategorien</option>
                    {(Object.entries(MilestoneCategory) as [string, string][]).map(([key, label]) => (
                      <option key={key} value={key}>{CATEGORY_EMOJIS[key] || ''} {label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-indigo-200 mb-1.5 block">Level</label>
                  <select
                    value={difficultyFilter}
                    onChange={e => setDifficultyFilter(e.target.value)}
                    className="w-full bg-white text-slate-800 rounded-xl px-3 py-3 font-bold outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                  >
                    <option value="ALL">🚀 Zufall</option>
                    {Object.values(Difficulty).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full bg-amber-400 hover:bg-amber-300 text-amber-900 rounded-xl px-4 py-3 font-black text-center shadow-lg shadow-amber-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {isGenerating ? 'Generiere...' : '10 NEUE KARTEN'}
                </button>
              </div>

              {/* Erweiterte Einstellungen */}
              <button
                onClick={() => setGenAdvancedOpen(o => !o)}
                className="mt-3 flex items-center gap-1.5 text-xs font-bold text-indigo-200 hover:text-white transition-colors"
              >
                {genAdvancedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Erweiterte Einstellungen
              </button>

              {genAdvancedOpen && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-indigo-200 mb-1.5 block">Kontext (Optional)</label>
                    <input
                      type="text"
                      placeholder="z.B. 'Im Büro', 'Regenwetter'"
                      value={genContext}
                      onChange={e => setGenContext(e.target.value)}
                      className="w-full bg-white/90 text-slate-800 placeholder-slate-400 rounded-xl px-3 py-3 font-medium outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-indigo-200 mb-1.5 block">Modus</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setGenTeamMode('SOLO')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-bold text-sm transition-all ${genTeamMode === 'SOLO' ? 'bg-white text-slate-800' : 'bg-white/20 text-white hover:bg-white/30'}`}
                      >
                        <UserIcon className="w-4 h-4" /> Solo
                      </button>
                      <button
                        onClick={() => setGenTeamMode('TEAM')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-bold text-sm transition-all ${genTeamMode === 'TEAM' ? 'bg-white text-slate-800' : 'bg-white/20 text-white hover:bg-white/30'}`}
                      >
                        <Users className="w-4 h-4" /> Team
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Zufällig starten */}
        <div className="flex justify-center -mt-6 mb-6">
          <button
            onClick={() => {
              const pick = filteredChallenges[Math.floor(Math.random() * filteredChallenges.length)];
              if (pick) spin(pick);
            }}
            disabled={filteredChallenges.length === 0}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-amber-900 px-4 py-2 rounded-full text-sm font-bold shadow-lg shadow-amber-900/20 transition-all active:scale-95 disabled:opacity-40"
          >
            <Shuffle className="w-4 h-4" />
            {'w\u00E4hle zuf\u00E4llige Challenge'}
          </button>
        </div>

        {/* Feed-style card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredChallenges.map(m => (
            <div key={m.id} className="h-full">
              <MilestoneCard
                milestone={m}
                onChallenge={(c) => spin(c)}
              />
            </div>
          ))}
        </div>

      </div>
    );
  }

  // ─── Result screen ─────────────────────────────────────────────────────────

  const catKey = selectedChallenge
    ? Object.entries(MilestoneCategory).find(([, v]) => v === selectedChallenge.category)?.[0] ?? ''
    : '';

  return (
    <div className="max-w-sm mx-auto py-4 text-center">
      {playerPanel}

      <button
        onClick={() => { setScreen('challenge'); setDisplayName(''); setChosenPlayer(''); }}
        className="flex items-center gap-1 text-slate-500 hover:text-slate-800 mb-8 text-sm"
      >
        <ChevronLeft className="w-4 h-4" /> Andere Challenge
      </button>

      {/* Challenge banner */}
      {selectedChallenge && (
        <div className="bg-slate-100 rounded-2xl p-4 mb-8 text-left">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Challenge</p>
          <p className="font-bold text-slate-800">{CATEGORY_EMOJIS[catKey]} {selectedChallenge.title}</p>
          <p className="text-sm text-slate-500 mt-0.5">{selectedChallenge.description}</p>
        </div>
      )}

      {/* Spin circle */}
      <div className="relative mb-6">
        <div className={`w-48 h-48 rounded-full mx-auto flex items-center justify-center border-8 transition-all duration-100 ${spinning ? 'border-indigo-400 bg-indigo-50 scale-105' : chosenPlayer ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
          {displayName ? (
            <p className={`text-2xl font-black px-4 text-center leading-tight break-words ${spinning ? 'text-indigo-600' : 'text-amber-700'}`}>
              {displayName}
            </p>
          ) : (
            <p className="text-slate-300 text-sm font-medium">Dreht...</p>
          )}
        </div>
        {!spinning && chosenPlayer && (
          <div className="absolute -top-2 right-12 text-3xl animate-bounce">🏆</div>
        )}
      </div>

      {!spinning && chosenPlayer && (
        <p className="text-slate-500 text-sm mb-8">muss die Challenge machen!</p>
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={spinAgain}
          disabled={spinning}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
        >
          <RotateCcw className="w-5 h-5" />
          {spinning ? 'Dreht...' : 'Nochmal spinnen'}
        </button>
        <button
          onClick={() => { setScreen('challenge'); setDisplayName(''); setChosenPlayer(''); }}
          className="w-full py-3 text-slate-600 hover:text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <Swords className="w-4 h-4" /> Neue Challenge wählen
        </button>
      </div>
    </div>
  );
};
