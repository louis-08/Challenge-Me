import React, { useState, useEffect, useRef } from 'react';
import { Users, Plus, Trophy, Crown, Hash, RefreshCcw, Swords, Clock, Upload, Star, Check, Video, Image as ImageIcon, Trash2, Search, UserPlus, X, Hourglass } from 'lucide-react';
import { Group, User, GroupChallenge, MediaItem } from '../types';
import { 
  createGroup, 
  joinGroup, 
  getUserGroups, 
  startGroupChallenge,
  submitChallengeProof,
  transitionToVoting,
  rateSubmission,
  finishChallenge,
  getUserById,
  getUserFriends,
  addFriend
} from '../services/storageService';

interface GroupDashboardProps {
  currentUser: User;
  onUpdate: () => void;
}

export const GroupDashboard: React.FC<GroupDashboardProps> = ({ currentUser, onUpdate }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [usersCache, setUsersCache] = useState<Record<string, User>>({});
  const [view, setView] = useState<'list' | 'create' | 'join' | 'friends'>('list');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  
  // Create/Join/Friend State
  const [newGroupName, setNewGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [friendSuccess, setFriendSuccess] = useState('');

  // Challenge Creation State
  const [chalTitle, setChalTitle] = useState('');
  const [chalDesc, setChalDesc] = useState('');
  
  // Duration Picker State
  const [chalWeeks, setChalWeeks] = useState(0);
  const [chalDays, setChalDays] = useState(1);
  const [chalHours, setChalHours] = useState(0);
  const [chalMinutes, setChalMinutes] = useState(0);

  // Submission State
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [proofComment, setProofComment] = useState('');
  const [isCompressingMedia, setIsCompressingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Timer State
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  const loadData = async () => {
    const [userGroups, userFriends] = await Promise.all([
      getUserGroups(currentUser.id),
      getUserFriends(currentUser.id)
    ]);
    setGroups(userGroups);
    setFriends(userFriends);

    // Pre-fetch all member users for display
    const allMemberIds = [...new Set(userGroups.flatMap(g => g.memberIds))];
    const fetched = await Promise.all(allMemberIds.map(id => getUserById(id)));
    const cache: Record<string, User> = {};
    fetched.forEach(u => { if (u) cache[u.id] = u; });
    setUsersCache(cache);

    if (userGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(userGroups[0].id);
    }
  };

  // Timer & Auto-Transition Logic
  useEffect(() => {
    if (!selectedGroupId) return;
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group?.activeChallenge || group.activeChallenge.status !== 'ACTIVE') {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }

    const updateTimer = () => {
      const deadline = new Date(group.activeChallenge!.deadline).getTime();
      const now = new Date().getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeLeftStr("00:00:00");
        // Trigger voting phase automatically when time is up
        transitionToVoting(selectedGroupId)
          .then((updated) => refreshGroup(updated))
          .catch(e => console.error("Auto transition failed", e));
        
        if (timerRef.current) window.clearInterval(timerRef.current);
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      const parts = [];
      if (d > 0) parts.push(`${d}d`);
      parts.push(h.toString().padStart(2, '0'));
      parts.push(m.toString().padStart(2, '0'));
      parts.push(s.toString().padStart(2, '0'));

      setTimeLeftStr(parts.join(':'));
    };

    updateTimer(); // Initial call
    timerRef.current = window.setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [selectedGroupId, groups]);


  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const group = await createGroup(currentUser.id, newGroupName);
      setGroups([...groups, group]);
      setSelectedGroupId(group.id);
      setView('list');
      setNewGroupName('');
      onUpdate();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const group = await joinGroup(currentUser.id, joinCode.toUpperCase());
      setGroups([...groups, group]);
      setSelectedGroupId(group.id);
      setView('list');
      setJoinCode('');
      onUpdate();
    } catch (e: any) {
      setError(e.message || 'Konnte Gruppe nicht beitreten');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFriendSuccess('');
    try {
      await addFriend(currentUser.id, friendSearch);
      setFriends(await getUserFriends(currentUser.id));
      setFriendSuccess(`Freund ${friendSearch} hinzugefügt!`);
      setFriendSearch('');
    } catch (e: any) {
      setError(e.message || 'Fehler beim Hinzufügen');
    } finally {
      setLoading(false);
    }
  };

  // --- Challenge Handlers ---

  const refreshGroup = async (updatedGroup: Group) => {
    setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
    // Fetch any new members not yet in cache
    const missing = updatedGroup.memberIds.filter(id => !usersCache[id]);
    if (missing.length > 0) {
      const fetched = await Promise.all(missing.map(id => getUserById(id)));
      setUsersCache(prev => {
        const next = { ...prev };
        fetched.forEach(u => { if (u) next[u.id] = u; });
        return next;
      });
    }
  };

  const handleStartChallenge = async () => {
    if (!selectedGroupId || !chalTitle) return;
    
    const totalMinutes = (chalWeeks * 7 * 24 * 60) + (chalDays * 24 * 60) + (chalHours * 60) + chalMinutes;
    if (totalMinutes <= 0) {
      alert("Bitte Dauer wählen");
      return;
    }

    setLoading(true);
    try {
      const updated = await startGroupChallenge(selectedGroupId, chalTitle, chalDesc, totalMinutes);
      refreshGroup(updated);
      setChalTitle('');
      setChalDesc('');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
      reader.readAsDataURL(file);
    });
  };

  const compressVideoTo480p = async (file: File): Promise<File> => {
    const objectUrl = URL.createObjectURL(file);

    try {
      const video = document.createElement('video');
      video.src = objectUrl;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Video-Metadaten konnten nicht geladen werden.'));
      });

      const sourceWidth = video.videoWidth || 640;
      const sourceHeight = video.videoHeight || 360;
      const scale = Math.min(1, 480 / sourceHeight);
      const targetWidth = Math.max(2, Math.floor((sourceWidth * scale) / 2) * 2);
      const targetHeight = Math.max(2, Math.floor((sourceHeight * scale) / 2) * 2);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas-Kontext konnte nicht erstellt werden.');
      }

      const stream = canvas.captureStream(20);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 700_000
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const recordingDone = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      let rafId: number | null = null;
      const renderFrame = () => {
        context.drawImage(video, 0, 0, targetWidth, targetHeight);
        if (!video.ended && !video.paused) {
          rafId = requestAnimationFrame(renderFrame);
        }
      };

      recorder.start(250);
      await video.play();
      renderFrame();

      await new Promise<void>((resolve) => {
        video.onended = () => resolve();
      });

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      recorder.stop();
      await recordingDone;

      const blob = new Blob(chunks, { type: 'video/webm' });
      const fileName = file.name.replace(/\.[^/.]+$/, '') + '-480p.webm';
      return new File([blob], fileName, { type: 'video/webm' });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setIsCompressingMedia(true);
      try {
        const itemsToAdd: MediaItem[] = [];

        for (const file of Array.from(files as FileList)) {
          if (file.type.startsWith('video')) {
            const compressedVideo = await compressVideoTo480p(file);
            const url = await readFileAsDataUrl(compressedVideo);
            itemsToAdd.push({ type: 'VIDEO', url });
          } else {
            const url = await readFileAsDataUrl(file);
            itemsToAdd.push({ type: 'IMAGE', url });
          }
        }

        setMediaItems(prev => [...prev, ...itemsToAdd]);
      } catch (error) {
        console.error(error);
        alert('Video-Komprimierung fehlgeschlagen. Bitte versuche es mit einer kürzeren Datei erneut.');
      } finally {
        setIsCompressingMedia(false);
        e.target.value = '';
      }
    }
  };

  const removeMedia = (index: number) => {
    setMediaItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitProof = async () => {
    if (!selectedGroupId || mediaItems.length === 0) return;
    setLoading(true);
    try {
      const updated = await submitChallengeProof(selectedGroupId, currentUser.id, mediaItems, proofComment);
      refreshGroup(updated);
      setMediaItems([]);
      setProofComment('');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (targetUserId: string, score: number) => {
    if (!selectedGroupId) return;
    try {
      const updated = await rateSubmission(selectedGroupId, currentUser.id, targetUserId, score);
      refreshGroup(updated);
    } catch (e) { console.error(e); }
  };

  const handleEndChallenge = async () => {
    if (!selectedGroupId) return;
    try {
      const updated = await finishChallenge(selectedGroupId);
      refreshGroup(updated);
    } catch (e) { console.error(e); }
  };

  // --- Renders ---

  const renderSidebar = () => (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-800">Community</h3>
        <button 
          onClick={() => setView(view === 'friends' ? 'list' : 'friends')}
          className={`p-1.5 rounded-lg transition-colors ${view === 'friends' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-500'}`}
          title="Freunde verwalten"
        >
          <Users className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-2 overflow-y-auto flex-grow">
        {groups.map(group => (
          <button
            key={group.id}
            onClick={() => {
              setSelectedGroupId(group.id);
              setView('list');
            }}
            className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors ${
              selectedGroupId === group.id && view === 'list'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                : 'hover:bg-slate-50 text-slate-600'
            }`}
          >
            <div className="min-w-0">
              <span className="font-medium truncate block">{group.name}</span>
              {group.activeChallenge && (
                <span className="text-[10px] flex items-center gap-1 text-amber-500 font-bold uppercase mt-0.5">
                  <Swords className="w-3 h-3" /> Battle läuft
                </span>
              )}
            </div>
          </button>
        ))}
        {groups.length === 0 && <div className="text-sm text-slate-400 text-center py-4">Keine Gruppen</div>}
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
        <div className="grid grid-cols-2 gap-2">
            <button 
            onClick={() => setView('create')}
            className="py-2 px-2 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1"
            >
            <Plus className="w-3 h-3" /> Erstellen
            </button>
            <button 
            onClick={() => setView('join')}
            className="py-2 px-2 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1"
            >
            <Hash className="w-3 h-3" /> Beitreten
            </button>
        </div>
      </div>
    </div>
  );

  const renderChallengeActive = (group: Group, challenge: GroupChallenge) => {
    const hasSubmitted = challenge.submissions.some(s => s.userId === currentUser.id);
    const timeLeft = new Date(challenge.deadline).getTime() - new Date().getTime();
    const isExpired = timeLeft <= 0;

    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-6 mb-6 sticky top-0 z-20 shadow-sm">
           <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-amber-900 flex items-center gap-2">
                  <Swords className="w-6 h-6 text-amber-600" />
                  {challenge.title}
                </h3>
                <p className="text-amber-700 mt-1">{challenge.description}</p>
              </div>
              <div className="text-right bg-white/50 p-2 rounded-lg border border-amber-100/50">
                <div className="text-xs font-bold uppercase text-amber-500 tracking-wider mb-1 flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3" /> Zeit
                </div>
                <div className={`text-2xl font-mono font-bold ${isExpired ? 'text-rose-500' : 'text-slate-800'}`}>
                  {isExpired ? '00:00:00' : timeLeftStr}
                </div>
              </div>
           </div>

           {/* Participant Status List */}
           <div className="mt-6 bg-white/60 rounded-xl p-4 border border-amber-100">
              <h4 className="text-xs font-bold uppercase text-amber-800 tracking-wider mb-3">Teilnehmer Status</h4>
              <div className="space-y-2">
                 {group.memberIds.map(memberId => {
                    const member = usersCache[memberId];
                    const submitted = challenge.submissions.some(s => s.userId === memberId);
                    
                    return (
                       <div key={memberId} className="flex items-center justify-between p-2 rounded-lg bg-white border border-amber-50">
                          <div className="flex items-center gap-3">
                             <img src={member?.avatar} className="w-8 h-8 rounded-full bg-slate-100" />
                             <span className="font-bold text-slate-700">{member?.username}</span>
                          </div>
                          <div>
                             {submitted ? (
                                <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                                   <Check className="w-3 h-3" /> Bereit
                                </span>
                             ) : (
                                <span className="flex items-center gap-1 text-slate-400 text-xs font-bold bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                   <Hourglass className="w-3 h-3" /> Wartend
                                </span>
                             )}
                          </div>
                       </div>
                    );
                 })}
              </div>
              <p className="text-[10px] text-amber-600/70 mt-3 text-center">
                 Das Voting startet automatisch, sobald alle Teilnehmer eingereicht haben oder die Zeit abgelaufen ist.
              </p>
           </div>
        </div>

        {!hasSubmitted && !isExpired && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-500" />
              Dein Beitrag
            </h4>
            
            <div className="space-y-4">
              {/* Gallery Preview */}
              {mediaItems.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                      {mediaItems.map((item, index) => (
                          <div key={index} className="relative aspect-square rounded-lg overflow-hidden group">
                              {item.type === 'VIDEO' ? (
                                  <video src={item.url} className="w-full h-full object-cover" />
                              ) : (
                                  <img src={item.url} className="w-full h-full object-cover" />
                              )}
                              <button 
                                onClick={() => removeMedia(index)}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                  <X className="w-3 h-3" />
                              </button>
                          </div>
                      ))}
                  </div>
              )}

              <div 
                onClick={() => fileInputRef.current?.click()}
                 className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all ${isCompressingMedia ? 'border-slate-200 bg-slate-50 cursor-not-allowed' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50 cursor-pointer'}`}
              >
                 <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-3">
                   <Upload className="w-6 h-6" />
                 </div>
                  <span className="text-slate-600 font-medium">Fotos/Videos hinzufügen</span>
                  <span className="text-xs text-slate-400 mt-1">Videos werden schnell auf 480p komprimiert</span>
                  {isCompressingMedia && <span className="text-xs text-indigo-500 mt-1">Komprimiere Videos...</span>}
                 <input 
                    ref={fileInputRef} 
                    type="file" 
                    accept="image/*,video/*" 
                    multiple 
                    className="hidden" 
                    onChange={handleFileChange} 
                    disabled={isCompressingMedia}
                 />
              </div>

              <input 
                type="text"
                placeholder="Kommentar (optional)"
                value={proofComment}
                onChange={(e) => setProofComment(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <button 
                onClick={handleSubmitProof}
                disabled={mediaItems.length === 0 || loading || isCompressingMedia}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-medium transition-all"
              >
                {isCompressingMedia ? 'Komprimiere...' : loading ? 'Sende...' : 'Einreichen'}
              </button>
            </div>
          </div>
        )}

        {hasSubmitted && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-8 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-emerald-800 text-lg">Stark! Du bist dabei.</h3>
            <p className="text-emerald-600 mt-1">Warte auf die anderen Teilnehmer...</p>
          </div>
        )}
      </div>
    );
  };

  const renderVotingPhase = (group: Group, challenge: GroupChallenge) => {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
            Voting Phase
          </h3>
          {group.memberIds[0] === currentUser.id && (
            <button 
              onClick={handleEndChallenge}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
            >
              Voting beenden
            </button>
          )}
        </div>
        
        <div className="space-y-8">
          {challenge.submissions.map(sub => {
             const user = usersCache[sub.userId];
             const isMe = sub.userId === currentUser.id;
             const myVote = sub.ratings.find(r => r.voterId === currentUser.id)?.score || 0;
             const avgScore = sub.ratings.reduce((acc, curr) => acc + curr.score, 0) / (sub.ratings.length || 1);

             return (
               <div key={sub.userId} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  {/* Media Gallery in Voting */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1 bg-slate-100">
                    {sub.media.map((item, idx) => (
                        <div key={idx} className="aspect-video relative">
                            {item.type === 'VIDEO' ? (
                                <video src={item.url} controls className="w-full h-full object-cover" />
                            ) : (
                                <img src={item.url} className="w-full h-full object-cover" />
                            )}
                        </div>
                    ))}
                  </div>

                  <div className="p-4 flex items-center justify-between bg-white">
                      <div className="flex items-center gap-3">
                        <img src={user?.avatar} className="w-10 h-10 rounded-full border border-slate-100" />
                        <div>
                            <span className="font-bold text-slate-800 block">{user?.username}</span>
                            {sub.comment && <p className="text-slate-500 text-sm">{sub.comment}</p>}
                        </div>
                      </div>
                  
                    <div>
                        {isMe ? (
                        <div className="text-center text-slate-500 text-sm px-4 py-2 bg-slate-50 rounded-lg">
                            Dein Schnitt: <span className="font-bold text-amber-500">{avgScore.toFixed(1)}</span> ⭐
                        </div>
                        ) : (
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(star => (
                            <button 
                                key={star}
                                onClick={() => handleVote(sub.userId, star)}
                                className="focus:outline-none transition-transform active:scale-110"
                            >
                                <Star 
                                className={`w-8 h-8 ${star <= myVote ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} 
                                />
                            </button>
                            ))}
                        </div>
                        )}
                    </div>
                  </div>
               </div>
             );
          })}
        </div>
      </div>
    );
  };

  const renderCreateChallenge = () => (
    <div className="p-8 flex flex-col items-center justify-center h-full text-center">
      <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
        <Swords className="w-10 h-10 text-indigo-600" />
      </div>
      <h3 className="text-2xl font-bold text-slate-800 mb-2">Starte ein Battle</h3>
      <p className="text-slate-500 max-w-md mb-8">
        Fordere deine Gruppe heraus.
      </p>
      
      <div className="w-full max-w-md space-y-4 bg-white p-6 rounded-xl border border-slate-100 shadow-lg">
        <input 
          type="text" 
          placeholder="Titel (z.B. Bester Burger)" 
          className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
          value={chalTitle}
          onChange={(e) => setChalTitle(e.target.value)}
        />
        <textarea 
          placeholder="Beschreibung der Regeln..." 
          className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
          rows={3}
          value={chalDesc}
          onChange={(e) => setChalDesc(e.target.value)}
        />
        
        {/* Time Picker */}
        <div className="grid grid-cols-4 gap-2 text-left">
               <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Wochen</label>
                  <select value={chalWeeks} onChange={e => setChalWeeks(Number(e.target.value))} className="w-full p-2 border rounded-lg bg-slate-50">
                    {[...Array(5)].map((_, i) => <option key={i} value={i}>{i}</option>)}
                  </select>
               </div>
               <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Tage</label>
                  <select value={chalDays} onChange={e => setChalDays(Number(e.target.value))} className="w-full p-2 border rounded-lg bg-slate-50">
                    {[...Array(7)].map((_, i) => <option key={i} value={i}>{i}</option>)}
                  </select>
               </div>
               <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Std</label>
                  <select value={chalHours} onChange={e => setChalHours(Number(e.target.value))} className="w-full p-2 border rounded-lg bg-slate-50">
                    {[...Array(24)].map((_, i) => <option key={i} value={i}>{i}</option>)}
                  </select>
               </div>
               <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Min</label>
                  <select value={chalMinutes} onChange={e => setChalMinutes(Number(e.target.value))} className="w-full p-2 border rounded-lg bg-slate-50">
                     <option value={0}>0</option>
                     <option value={15}>15</option>
                     <option value={30}>30</option>
                     <option value={45}>45</option>
                  </select>
               </div>
            </div>

        <button 
          onClick={handleStartChallenge}
          disabled={!chalTitle || loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md shadow-indigo-200 transition-all"
        >
          {loading ? 'Starte...' : 'Battle eröffnen!'}
        </button>
      </div>
    </div>
  );

  const renderFriendsView = () => (
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm h-full flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">Deine Freunde</h2>
            <button onClick={() => setView('list')} className="text-sm text-slate-500 hover:text-indigo-600">Zurück</button>
          </div>
          
          {/* Add Friend */}
          <form onSubmit={handleAddFriend} className="mb-8">
             <label className="block text-sm font-medium text-slate-700 mb-2">Freund hinzufügen (Benutzername)</label>
             <div className="flex gap-2">
                 <div className="relative flex-grow">
                    <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Benutzername suchen..."
                        value={friendSearch}
                        onChange={(e) => setFriendSearch(e.target.value)}
                        className="w-full pl-9 p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                    />
                 </div>
                 <button type="submit" disabled={loading} className="px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
                     {loading ? '...' : <UserPlus className="w-5 h-5" />}
                 </button>
             </div>
             {error && <p className="text-rose-500 text-sm mt-2">{error}</p>}
             {friendSuccess && <p className="text-emerald-500 text-sm mt-2">{friendSuccess}</p>}
          </form>

          {/* List */}
          <div className="space-y-3 overflow-y-auto">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Freundesliste ({friends.length})</h3>
              {friends.map(f => (
                  <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <img src={f.avatar} className="w-10 h-10 rounded-full bg-white border border-slate-200" />
                      <span className="font-bold text-slate-700">{f.username}</span>
                  </div>
              ))}
              {friends.length === 0 && (
                  <div className="text-slate-400 text-sm italic">Du hast noch keine Freunde hinzugefügt.</div>
              )}
          </div>
      </div>
  );

  // --- Main Render Switch ---

  if (view === 'create') {
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-600">
              <Users className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Neue Gruppe gründen</h2>
            <form onSubmit={handleCreateGroup} className="w-full max-w-sm space-y-4 mt-4">
              <input 
                type="text" 
                placeholder="Gruppenname" 
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium">Erstellen</button>
              <button type="button" onClick={() => setView('list')} className="text-slate-400 text-sm">Abbrechen</button>
            </form>
          </div>
        );
      }
  
      if (view === 'join') {
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm h-full flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600">
              <Hash className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Gruppe beitreten</h2>
            <form onSubmit={handleJoinGroup} className="w-full max-w-sm space-y-4 mt-4">
              <input 
                type="text" 
                placeholder="Code" 
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none uppercase text-center font-mono"
                required
              />
              {error && <p className="text-rose-500 text-sm">{error}</p>}
              <button type="submit" className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium">Beitreten</button>
              <button type="button" onClick={() => setView('list')} className="text-slate-400 text-sm">Abbrechen</button>
            </form>
          </div>
        );
      }

    if (view === 'friends') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[800px]">
                <div className="md:col-span-4 h-full">{renderSidebar()}</div>
                <div className="md:col-span-8 h-full">{renderFriendsView()}</div>
            </div>
        )
    }

    // Default View (Selected Group)
    const selectedGroup = groups.find(g => g.id === selectedGroupId);

    return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[800px]">
      <div className="md:col-span-4 h-full">
        {renderSidebar()}
      </div>
      <div className="md:col-span-8 h-full">
         {!selectedGroupId ? (
             <div className="h-full flex items-center justify-center text-slate-400 p-8 border-2 border-dashed border-slate-200 rounded-xl">
                <p>Wähle eine Gruppe aus oder erstelle eine neue.</p>
             </div>
         ) : selectedGroup ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                <div className="flex justify-between items-start">
                    <div>
                    <h2 className="text-2xl font-bold">{selectedGroup.name}</h2>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="bg-white/10 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-mono">
                            Code: {selectedGroup.code}
                        </div>
                        <div className="text-indigo-100 text-sm flex items-center gap-1">
                            <Users className="w-4 h-4" /> {selectedGroup.memberIds.length} Mitglieder
                        </div>
                    </div>
                    </div>
                </div>
                </div>

                {/* Challenge Area */}
                <div className="flex-grow overflow-y-auto bg-slate-50/50">
                {!selectedGroup.activeChallenge ? (
                    renderCreateChallenge()
                ) : (
                    selectedGroup.activeChallenge.status === 'VOTING' 
                    ? renderVotingPhase(selectedGroup, selectedGroup.activeChallenge)
                    : renderChallengeActive(selectedGroup, selectedGroup.activeChallenge)
                )}
                
                {/* Past Winners / History simplified */}
                {selectedGroup.pastChallenges?.length > 0 && !selectedGroup.activeChallenge && (
                    <div className="p-6 border-t border-slate-100">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" /> Ruhmeshalle
                    </h3>
                    <div className="space-y-3">
                        {selectedGroup.pastChallenges.map(past => {
                            const winner = past.winnerId ? usersCache[past.winnerId] : null;
                            return (
                            <div key={past.id} className="bg-white p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                                <div>
                                    <span className="font-medium text-slate-800">{past.title}</span>
                                    <span className="text-xs text-slate-400 block">{new Date(past.deadline).toLocaleDateString()}</span>
                                </div>
                                {winner && (
                                <div className="flex items-center gap-2 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                                    <Crown className="w-3 h-3 text-amber-500" />
                                    <span className="text-sm font-bold text-amber-800">{winner.username}</span>
                                </div>
                                )}
                            </div>
                            )
                        })}
                    </div>
                    </div>
                )}
                </div>
            </div>
         ) : null}
      </div>
    </div>
  );
};