import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Shuffle, ChevronLeft, RotateCcw, Swords, Users, ChevronDown, ChevronUp, Sparkles, Loader2, User as UserIcon } from 'lucide-react';
import { Milestone, MilestoneCategory, Difficulty } from '../types';
import { INITIAL_MILESTONES, CATEGORY_EMOJIS } from '../constants';
import { MilestoneCard } from './MilestoneCard';
import { generateCreativeMilestones } from '../services/geminiService';

// ─── PlayerDrumPicker ────────────────────────────────────────────────────────

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function buildLoop(arr: string[], count = 80): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(arr[i % arr.length]);
  return out;
}

interface PlayerDrumPickerProps {
  players: string[];
  spinKey: number; // increment to trigger a new spin; Strict-Mode safe
  onSpinComplete: (winner: string) => void;
}

const PlayerDrumPicker: React.FC<PlayerDrumPickerProps> = ({ players, spinKey, onSpinComplete }) => {
  const DRUM_DURATION = 2000;
  const VISIBLE = 7;

  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const loopRef = useRef<string[]>(buildLoop(players));
  const finalIndexRef = useRef(0);
  const winnerRef = useRef('');
  const onSpinCompleteRef = useRef(onSpinComplete);
  const playersRef = useRef(players);
  onSpinCompleteRef.current = onSpinComplete;
  playersRef.current = players;

  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (spinKey === 0) return;

    const currentPlayers = playersRef.current;
    const loop = buildLoop(currentPlayers, 80);
    loopRef.current = loop;

    const winnerIdx = Math.floor(Math.random() * currentPlayers.length);
    winnerRef.current = currentPlayers[winnerIdx];

    const baseOffset = 30 + Math.floor(Math.random() * 10);
    let landIdx = baseOffset;
    while (loop[landIdx] !== currentPlayers[winnerIdx]) landIdx++;
    finalIndexRef.current = landIdx;

    setOffset(0);
    startTimeRef.current = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const animate = (ts: number) => {
      if (!startTimeRef.current) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;
      const t = Math.min(elapsed / DRUM_DURATION, 1);
      setOffset(easeOut(t) * finalIndexRef.current);
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setOffset(finalIndexRef.current);
        onSpinCompleteRef.current(winnerRef.current);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [spinKey]);

  const half = Math.floor(VISIBLE / 2);
  const baseIdx = Math.round(offset);

  const rows = [];
  for (let i = -half; i <= half; i++) {
    const idx = Math.max(0, Math.min(baseIdx + i, loopRef.current.length - 1));
    const name = loopRef.current[idx] || '';
    const pos = i - (offset - baseIdx);
    const rad = (pos * 28 * Math.PI) / 180;
    const depth = 220;
    rows.push({
      name,
      y: Math.sin(rad) * depth,
      z: Math.cos(rad) * depth - depth,
      opacity: Math.max(0, Math.cos(rad)),
      scale: Math.max(0.5, Math.cos(rad * 0.5)),
      fontSize: 18 + (1 - Math.min(Math.abs(pos), 1)) * 22,
      fontWeight: Math.abs(pos) < 0.5 ? 700 : 300,
      isCenter: Math.abs(pos) < 0.55,
    });
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: 208, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: '600px', overflow: 'hidden' }}>
      {/* Selection highlight */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', height: 56, background: 'linear-gradient(90deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)', borderTop: '1px solid rgba(99,102,241,0.35)', borderBottom: '1px solid rgba(99,102,241,0.35)', borderRadius: 12, zIndex: 1, pointerEvents: 'none' }} />
      {/* Top fade */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 90, background: 'linear-gradient(to bottom, #f8fafc 0%, transparent 100%)', zIndex: 2, pointerEvents: 'none' }} />
      {/* Bottom fade */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, background: 'linear-gradient(to top, #f8fafc 0%, transparent 100%)', zIndex: 2, pointerEvents: 'none' }} />
      {/* 3D drum */}
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', transformStyle: 'preserve-3d' }}>
        {rows.map((row, i) => (
          <div key={i} style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', transform: `translateY(${row.y}px) translateZ(${row.z}px) scale(${row.scale})`, opacity: row.opacity, color: row.isCenter ? '#4f46e5' : '#94a3b8', fontSize: row.fontSize, fontWeight: row.fontWeight, whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none', lineHeight: 1, textShadow: row.isCenter ? '0 0 20px rgba(99,102,241,0.35)' : 'none' }}>
            {row.name}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

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
  const [generatorCategory, setGeneratorCategory] = useState<string>('ALL');
  const [generatorDifficulty, setGeneratorDifficulty] = useState<string>('ALL');
  const [aiChallenges, setAiChallenges] = useState<Milestone[]>([]);

  // Generator
  const [isGenerating, setIsGenerating] = useState(false);
  const [genContext, setGenContext] = useState('');
  const [genTeamMode, setGenTeamMode] = useState<'SOLO' | 'TEAM'>('SOLO');
  const [genAdvancedOpen, setGenAdvancedOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualCat, setManualCat] = useState(MilestoneCategory.FUNandCringe);
  const [manualDiff, setManualDiff] = useState(Difficulty.MEDIUM);
  const [manualTeamMode, setManualTeamMode] = useState<'SOLO' | 'TEAM'>('SOLO');

  // Result / Spin
  const [chosenPlayer, setChosenPlayer] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [spinKey, setSpinKey] = useState(0);

  const baseChallenges = feedChallenges.length > 0 ? feedChallenges : INITIAL_MILESTONES;
  const allChallenges = [...aiChallenges, ...baseChallenges];

  // ─── Generator ─────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const contextParts = [genContext, genTeamMode === 'TEAM' ? 'Im Team zu erledigen' : 'Solo zu erledigen'].filter(Boolean);
      const results = await generateCreativeMilestones(
        generatorCategory === 'ALL' ? 'MIX' : generatorCategory,
        generatorDifficulty === 'ALL' ? 'ALL' : generatorDifficulty,
        contextParts.join(', '),
        10
      );
      if (results.length > 0) setAiChallenges(prev => [...results, ...prev]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualCreate = () => {
    const title = manualTitle.trim();
    if (!title) return;

    const modeTag = manualTeamMode === 'TEAM' ? ' [Team]' : ' [Solo]';
    const newChallenge: Milestone = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      description: (manualDesc.trim() || title) + modeTag,
      category: manualCat,
      difficulty: manualDiff,
      proofType: 'PHOTO',
      completed: false,
    };

    setAiChallenges(prev => [newChallenge, ...prev]);
    setManualTitle('');
    setManualDesc('');
    setManualTeamMode('SOLO');
    setIsManualOpen(false);
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

  const spin = (challenge: Milestone) => {
    if (spinning || players.length < 1) return;
    setSelectedChallenge(challenge);
    setChosenPlayer('');
    setSpinning(true);
    setSpinKey(k => k + 1);
    setScreen('result');
  };

  const spinAgain = () => {
    if (!selectedChallenge || spinning) return;
    setChosenPlayer('');
    setSpinning(true);
    setSpinKey(k => k + 1);
  };

  const handleSpinComplete = (winner: string) => {
    setChosenPlayer(winner);
    setSpinning(false);
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
        </div>

        <form onSubmit={addPlayer} className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Name eingeben..."
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            maxLength={20}
            className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
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
            <p className="text-sm">Mindestens 1 Spieler wird benötigt.</p>
          </div>
        )}

        <button
          onClick={() => setScreen('challenge')}
          disabled={players.length < 1}
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
        <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-5 sm:p-8 mb-10 shadow-xl shadow-indigo-200 text-white">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-purple-500/30 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Challenge Generator</h2>
              <button
                onClick={() => setIsManualOpen(o => !o)}
                className="hidden md:flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all backdrop-blur-sm"
              >
                <Plus className="w-4 h-4" />
                Manuell erstellen
              </button>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="text-xs font-bold uppercase text-indigo-200 mb-1.5 block">Kategorie</label>
                  <select
                    value={generatorCategory}
                    onChange={e => setGeneratorCategory(e.target.value)}
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
                    value={generatorDifficulty}
                    onChange={e => setGeneratorDifficulty(e.target.value)}
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
        <div className="flex flex-col sm:flex-row justify-center items-stretch gap-3 mt-1 mb-8">
          <button
            onClick={() => setIsManualOpen(o => !o)}
            className="flex w-full sm:w-auto items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 px-4 py-3 rounded-full text-sm font-black shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" strokeWidth={2.75} />
            Eigene Challenge erstellen
          </button>
          <button
            onClick={() => {
              const pick = allChallenges[Math.floor(Math.random() * allChallenges.length)];
              if (pick) spin(pick);
            }}
            disabled={allChallenges.length === 0}
            className="flex w-full sm:w-auto items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-amber-900 px-4 py-3 rounded-full text-sm font-black shadow-lg shadow-amber-900/20 transition-all active:scale-95 disabled:opacity-40"
          >
            <Shuffle className="w-4 h-4" strokeWidth={2.75} />
            {'w\u00E4hle zuf\u00E4llige Challenge'}
          </button>
        </div>

        {isManualOpen && (
          <div className="mb-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="flex justify-between items-start mb-5">
              <h3 className="font-bold text-lg">Eigene Challenge erstellen</h3>
              <button onClick={() => setIsManualOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Titel</label>
                <input
                  placeholder="Name der Challenge"
                  className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  value={manualTitle}
                  onChange={e => setManualTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Kategorie</label>
                <select
                  className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  value={manualCat}
                  onChange={e => setManualCat(e.target.value as any)}
                >
                  {(Object.entries(MilestoneCategory) as [string, string][]).map(([key, label]) => (
                    <option key={key} value={key}>{CATEGORY_EMOJIS[key] || ''} {label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Level</label>
                <select
                  className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  value={manualDiff}
                  onChange={e => setManualDiff(e.target.value as Difficulty)}
                >
                  {Object.values(Difficulty).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Modus</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setManualTeamMode('SOLO')}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-sm border transition-all ${manualTeamMode === 'SOLO' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    <UserIcon className="w-4 h-4" /> Solo
                  </button>
                  <button
                    onClick={() => setManualTeamMode('TEAM')}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-sm border transition-all ${manualTeamMode === 'TEAM' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Users className="w-4 h-4" /> Team
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Beschreibung</label>
                <textarea
                  placeholder="Was muss gemacht werden?"
                  className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                  value={manualDesc}
                  onChange={e => setManualDesc(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={handleManualCreate}
              disabled={!manualTitle.trim()}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold rounded-xl transition-all"
            >
              Challenge hinzufügen
            </button>
          </div>
        )}

        {/* Feed-style card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {allChallenges.map(m => (
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
        onClick={() => { setScreen('challenge'); setChosenPlayer(''); }}
        className="flex items-center gap-1 text-slate-500 hover:text-slate-800 mb-8 text-sm"
      >
        <ChevronLeft className="w-4 h-4" /> Andere Challenge
      </button>

      {/* Challenge banner */}
      {selectedChallenge && (
        <div className="bg-slate-100 rounded-2xl p-4 mb-6 text-left">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Challenge</p>
          <p className="font-bold text-slate-800">{CATEGORY_EMOJIS[catKey]} {selectedChallenge.title}</p>
          <p className="text-sm text-slate-500 mt-0.5">{selectedChallenge.description}</p>
        </div>
      )}

      {/* Drum picker */}
      <div className="relative mb-2">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
          <PlayerDrumPicker
            players={players}
            spinKey={spinKey}
            onSpinComplete={handleSpinComplete}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-6">
        <button
          onClick={spinAgain}
          disabled={spinning}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
        >
          <RotateCcw className="w-5 h-5" />
          {spinning ? 'Dreht...' : 'Nochmal spinnen'}
        </button>
        <button
          onClick={() => { setScreen('challenge'); setChosenPlayer(''); }}
          className="w-full py-3 text-slate-600 hover:text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <Swords className="w-4 h-4" /> Neue Challenge wählen
        </button>
      </div>
    </div>
  );
};
