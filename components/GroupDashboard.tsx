import React, { useState, useEffect, useRef } from 'react';
import { Users, Plus, Trophy, Crown, Hash, Swords, Clock, Upload, Star, Check, X, Search, UserPlus, ChevronLeft, ChevronRight, Trash2, Download, Send, Pencil, Save, Camera, Hourglass } from 'lucide-react';
import { Group, User, GroupChallenge, MediaItem, FriendRequest } from '../types';
import { MediaLightbox, LightboxItem } from './MediaLightbox';
import { Avatar } from './Avatar';
import {
  createGroup,
  joinGroup,
  getUserGroups,
  getGroup,
  updateGroup,
  uploadGroupAvatar,
  deleteGroup,
  submitChallengeProof,
  transitionToVoting,
  rateSubmission,
  finishChallenge,
  addSubmissionComment,
  getUserById,
  getUserFriends,
  removeFriend,
  sendFriendRequest,
  addFriend,
  getFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  respondToFriendRequest,
  API_BASE
} from '../services/storageService';

interface GroupDashboardProps {
  currentUser: User;
  onUpdate: () => void;
  deepLink?: {
    screen: 'group' | 'friends';
    groupId?: string;
    nonce: number;
  } | null;
}

type Screen = 'list' | 'group' | 'create-group' | 'join-group' | 'friends';

export const GroupDashboard: React.FC<GroupDashboardProps> = ({ currentUser, onUpdate, deepLink }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [usersCache, setUsersCache] = useState<Record<string, User>>({});
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('list');

  // Create/Join/Friend State
  const [newGroupName, setNewGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [friendSuccess, setFriendSuccess] = useState('');
  const [friendToRemove, setFriendToRemove] = useState<User | null>(null);
  const [isRemovingFriend, setIsRemovingFriend] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');
  const [editMemberIds, setEditMemberIds] = useState<string[]>([]);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState('');
  const [newGroupAvatarFile, setNewGroupAvatarFile] = useState<File | null>(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  // Submission State
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [proofComment, setProofComment] = useState('');
  const [isCompressingMedia, setIsCompressingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voting Comment State
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [commentLoading, setCommentLoading] = useState<string | null>(null);

  // Lightbox State
  const [lightboxItems, setLightboxItems] = useState<LightboxItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const selectedGroup = selectedGroupId ? groups.find(g => g.id === selectedGroupId) ?? null : null;
  const groupMembers = editMemberIds
    .map(memberId => usersCache[memberId] || friends.find(friend => friend.id === memberId) || (memberId === currentUser.id ? currentUser : undefined))
    .filter((member): member is User => !!member);
  const availableFriendsToAdd = friends.filter(friend => !editMemberIds.includes(friend.id));

  const openLightbox = (items: LightboxItem[], startIndex: number) => {
    setLightboxItems(items);
    setLightboxIndex(startIndex);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  // Timer
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const timerRef = useRef<number | null>(null);

  const selectedGroupIdRef = useRef<string | null>(null);
  useEffect(() => { selectedGroupIdRef.current = selectedGroupId; }, [selectedGroupId]);

  useEffect(() => { loadData(); }, [currentUser.id]);

  useEffect(() => {
    if (!deepLink) return;

    if (deepLink.screen === 'friends') {
      setScreen('friends');
      return;
    }

    if (deepLink.screen === 'group' && deepLink.groupId) {
      setSelectedGroupId(deepLink.groupId);
      setScreen('group');
    }
  }, [deepLink?.nonce]);

  // SSE real-time updates
  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimeout: number | null = null;

    const handleGroupUpdate = async (groupId: string) => {
      try {
        const updated = await getGroup(groupId);
        setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
        const missing = updated.memberIds.filter(id => !usersCache[id]);
        if (missing.length > 0) {
          const fetched = await Promise.all(missing.map(id => getUserById(id)));
          setUsersCache(prev => {
            const next = { ...prev };
            fetched.forEach(u => { if (u) next[u.id] = u; });
            return next;
          });
        }
      } catch { /* group may have been deleted */ }
    };

    const connect = () => {
      es = new EventSource(`${API_BASE}/groups/stream`, { withCredentials: true });

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { connected?: boolean; deleted?: boolean; id?: string; groupId?: string; friendRequest?: FriendRequest };
          if (msg.connected) return; // initial handshake, ignore
          if (msg.friendRequest) {
            setFriendRequests(prev => [...prev, msg.friendRequest!]);
          } else if (msg.deleted && msg.id) {
            setGroups(prev => prev.filter(g => g.id !== msg.id));
            if (selectedGroupIdRef.current === msg.id) {
              setSelectedGroupId(null);
              setScreen('list');
            }
          } else if (msg.groupId) {
            handleGroupUpdate(msg.groupId);
          }
        } catch { /* ignore malformed messages */ }
      };

      es.onerror = () => {
        es?.close();
        // Reload data to catch any missed events, then reconnect
        loadData();
        retryTimeout = window.setTimeout(connect, 3000);
      };
    };

    connect();

    // Polling fallback every 10s to catch any missed SSE events
    const poll = window.setInterval(loadData, 10_000);

    return () => {
      es?.close();
      if (retryTimeout) window.clearTimeout(retryTimeout);
      window.clearInterval(poll);
    };
  }, [currentUser.id]);

  const loadData = async () => {
    const [userGroups, userFriends, incoming, outgoing] = await Promise.all([
      getUserGroups(currentUser.id),
      getUserFriends(currentUser.id),
      getFriendRequests('incoming'),
      getFriendRequests('outgoing')
    ]);
    setGroups(userGroups);
    setFriends(userFriends);
    setFriendRequests(incoming.filter(r => r.status === 'PENDING'));
    setIncomingRequests(incoming.filter(r => r.status === 'PENDING'));
    setOutgoingRequests(outgoing.filter(r => r.status === 'PENDING'));

    const allMemberIds = [...new Set(userGroups.flatMap(g => g.memberIds))];
    const fetched = await Promise.all(allMemberIds.map(id => getUserById(id)));
    const cache: Record<string, User> = {};
    fetched.forEach(u => { if (u) cache[u.id] = u; });
    setUsersCache(cache);
  };

  useEffect(() => {
    if (!selectedGroupId) return;
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group?.activeChallenge || group.activeChallenge.status !== 'ACTIVE') {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }

    const updateTimer = () => {
      const deadline = new Date(group.activeChallenge!.deadline).getTime();
      const diff = deadline - Date.now();
      if (diff <= 0) {
        setTimeLeftStr('00:00:00');
        transitionToVoting(selectedGroupId).then(refreshGroup).catch(console.error);
        if (timerRef.current) window.clearInterval(timerRef.current);
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const parts = [];
      if (d > 0) parts.push(`${d}d`);
      parts.push(h.toString().padStart(2, '0'), m.toString().padStart(2, '0'), s.toString().padStart(2, '0'));
      setTimeLeftStr(parts.join(':'));
    };

    updateTimer();
    timerRef.current = window.setInterval(updateTimer, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [selectedGroupId, groups]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const group = await createGroup(currentUser.id, newGroupName);
      setGroups(prev => [...prev, group]);
      setSelectedGroupId(group.id);
      setNewGroupName('');
      setScreen('group');
      onUpdate();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const group = await joinGroup(currentUser.id, joinCode.toUpperCase());
      setGroups(prev => [...prev, group]);
      setSelectedGroupId(group.id);
      setJoinCode('');
      setScreen('group');
      onUpdate();
    } catch (e: any) {
      setError(e.message || 'Konnte Gruppe nicht beitreten');
    } finally { setLoading(false); }
  };

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFriendSuccess('');
    try {
      await sendFriendRequest(friendSearch);
      const [refreshedOutgoing] = await Promise.all([
        getFriendRequests('outgoing')
      ]);
      setOutgoingRequests(refreshedOutgoing.filter(r => r.status === 'PENDING'));
      setFriendSuccess(`Anfrage an ${friendSearch} gesendet!`);
      setFriendSearch('');
    } catch (e: any) {
      setError(e.message || 'Fehler beim Senden der Anfrage');
    } finally { setLoading(false); }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptFriendRequest(requestId);
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
      setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
      setFriends(await getUserFriends(currentUser.id));
    } catch (e: any) {
      setError(e.message || 'Fehler beim Annehmen');
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await declineFriendRequest(requestId);
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
      setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (e: any) {
      setError(e.message || 'Fehler beim Ablehnen');
    }
  };

  const handleRespondToRequest = async (requestId: string, action: 'ACCEPT' | 'DECLINE') => {
    setLoading(true);
    setError(null);
    try {
      await respondToFriendRequest(requestId, action);
      const [userFriends, incoming] = await Promise.all([
        getUserFriends(currentUser.id),
        getFriendRequests('incoming')
      ]);
      setFriends(userFriends);
      setFriendRequests(incoming.filter(r => r.status === 'PENDING'));
      setIncomingRequests(incoming.filter(r => r.status === 'PENDING'));
    } catch (e: any) {
      setError(e.message || 'Anfrage konnte nicht verarbeitet werden.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!friendToRemove) return;
    try {
      setIsRemovingFriend(true);
      setError(null);
      await removeFriend(friendToRemove.id);
      setFriends(prev => prev.filter(entry => entry.id !== friendToRemove.id));
      setFriendToRemove(null);
    } catch (e: any) {
      setError(e.message || 'Fehler beim Entfernen des Freundes');
    } finally {
      setIsRemovingFriend(false);
    }
  };

  const refreshGroup = async (updatedGroup: Group) => {
    setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
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

  const openGroupEditor = (group: Group) => {
    setError(null);
    setEditGroupName(group.name);
    setEditGroupDescription(group.description || '');
    setEditMemberIds(group.memberIds);
    setGroupAvatarPreview(group.avatar || '');
    setNewGroupAvatarFile(null);
    setIsEditGroupOpen(true);
  };

  const closeGroupEditor = () => {
    setIsEditGroupOpen(false);
    setNewGroupAvatarFile(null);
  };

  const handleGroupAvatarSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewGroupAvatarFile(file);
    setGroupAvatarPreview(URL.createObjectURL(file));
  };

  const toggleEditableMember = (memberId: string) => {
    setEditMemberIds(prev => {
      if (prev.includes(memberId)) {
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== memberId);
      }
      return [...prev, memberId];
    });
  };

  const handleSaveGroup = async () => {
    if (!selectedGroupId) return;
    setIsSavingGroup(true);
    setError(null);

    try {
      let updated = await updateGroup(selectedGroupId, {
        name: editGroupName,
        description: editGroupDescription,
        memberIds: editMemberIds
      });

      if (newGroupAvatarFile) {
        updated = await uploadGroupAvatar(selectedGroupId, newGroupAvatarFile);
      }

      await refreshGroup(updated);
      if (!updated.memberIds.includes(currentUser.id)) {
        setSelectedGroupId(null);
        setScreen('list');
      }
      closeGroupEditor();
      onUpdate();
    } catch (e: any) {
      setError(e.message || 'Gruppe konnte nicht gespeichert werden.');
    } finally {
      setIsSavingGroup(false);
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });

  const compressVideoTo480p = async (file: File): Promise<File> => {
    const objectUrl = URL.createObjectURL(file);
    try {
      const video = document.createElement('video');
      video.src = objectUrl; video.muted = true; video.playsInline = true; video.preload = 'metadata';
      await new Promise<void>((res, rej) => { video.onloadedmetadata = () => res(); video.onerror = () => rej(); });
      const scale = Math.min(1, 480 / (video.videoHeight || 360));
      const tw = Math.max(2, Math.floor(((video.videoWidth || 640) * scale) / 2) * 2);
      const th = Math.max(2, Math.floor(((video.videoHeight || 360) * scale) / 2) * 2);
      const canvas = document.createElement('canvas');
      canvas.width = tw; canvas.height = th;
      const ctx = canvas.getContext('2d')!;
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
      const recorder = new MediaRecorder(canvas.captureStream(20), { mimeType: mime, videoBitsPerSecond: 700_000 });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => { if (e.data?.size > 0) chunks.push(e.data); };
      const done = new Promise<void>(res => { recorder.onstop = () => res(); });
      let raf: number | null = null;
      const draw = () => { ctx.drawImage(video, 0, 0, tw, th); if (!video.ended && !video.paused) raf = requestAnimationFrame(draw); };
      recorder.start(250); await video.play(); draw();
      await new Promise<void>(res => { video.onended = () => res(); });
      if (raf !== null) cancelAnimationFrame(raf);
      recorder.stop(); await done;
      return new File([new Blob(chunks, { type: 'video/webm' })], file.name.replace(/\.[^/.]+$/, '') + '-480p.webm', { type: 'video/webm' });
    } finally { URL.revokeObjectURL(objectUrl); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setIsCompressingMedia(true);
    try {
      const items: MediaItem[] = [];
      for (const file of Array.from(files) as File[]) {
        if (file.type.startsWith('video')) {
          items.push({ type: 'VIDEO', url: await readFileAsDataUrl(await compressVideoTo480p(file)) });
        } else {
          items.push({ type: 'IMAGE', url: await readFileAsDataUrl(file) });
        }
      }
      setMediaItems(prev => [...prev, ...items]);
    } catch { alert('Video-Komprimierung fehlgeschlagen.'); }
    finally { setIsCompressingMedia(false); e.target.value = ''; }
  };

  const handleSubmitProof = async () => {
    if (!selectedGroupId || !mediaItems.length) return;
    setLoading(true);
    try {
      const updated = await submitChallengeProof(selectedGroupId, currentUser.id, mediaItems, proofComment);
      refreshGroup(updated);
      setMediaItems([]); setProofComment('');
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleVote = async (targetUserId: string, score: number) => {
    if (!selectedGroupId) return;
    try { refreshGroup(await rateSubmission(selectedGroupId, currentUser.id, targetUserId, score)); }
    catch (e) { console.error(e); }
  };

  const handleEndChallenge = async () => {
    if (!selectedGroupId) return;
    try { refreshGroup(await finishChallenge(selectedGroupId)); }
    catch (e) { console.error(e); }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroupId) return;
    try {
      setIsDeletingGroup(true);
      await deleteGroup(selectedGroupId);
      setGroups(prev => prev.filter(g => g.id !== selectedGroupId));
      setSelectedGroupId(null);
      setScreen('list');
      setGroupToDelete(null);
    } catch (e) { console.error(e); }
    finally { setIsDeletingGroup(false); }
  };

  const handleDownloadAllMedia = async (challenge: GroupChallenge) => {
    let index = 1;
    for (const sub of challenge.submissions) {
      const user = usersCache[sub.userId];
      const username = user?.username || 'user';
      for (const item of sub.media) {
        const url = item.url;
        const a = document.createElement('a');
        a.href = url;
        const extMatch = url.match(/data:(.*?);/);
        let ext = item.type === 'VIDEO' ? 'webm' : 'jpg';
        if (extMatch && extMatch[1]) {
          const mime = extMatch[1];
          if (mime.includes('png')) ext = 'png';
          else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
          else if (mime.includes('webm')) ext = 'webm';
          else if (mime.includes('mp4')) ext = 'mp4';
        }
        a.download = `${challenge.title.replace(/[^a-z0-9]/gi, '_')}_${username}_${index++}.${ext}`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        await new Promise(r => setTimeout(r, 200));
      }
    }
  };

  // ─── Screens ───────────────────────────────────────────────────────────────

  const renderList = () => (
    <div className="max-w-lg mx-auto">
      {/* Actions */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => { setError(null); setScreen('create-group'); }}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all"
        >
          <Plus className="w-4 h-4" /> Gruppe erstellen
        </button>
        <button
          onClick={() => { setError(null); setScreen('join-group'); }}
          className="flex-1 flex items-center justify-center gap-2 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all"
        >
          <Hash className="w-4 h-4" /> Beitreten
        </button>
        <button
          onClick={() => { setError(null); setFriendSuccess(''); setScreen('friends'); }}
          className="py-3 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all"
          title="Freunde"
        >
          <Users className="w-4 h-4" />
        </button>
      </div>

      {/* Group List */}
      {groups.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Swords className="w-12 h-12 mx-auto mb-3 text-slate-200" />
          <p className="font-medium">Noch keine Gruppen</p>
          <p className="text-sm mt-1">Erstelle eine oder tritt einer bei!</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {groups.map(group => {
            const hasChallenge = !!group.activeChallenge;
            const isVoting = group.activeChallenge?.status === 'VOTING';
            return (
              <button
                key={group.id}
                onClick={() => { setSelectedGroupId(group.id); setScreen('group'); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
              >
                <Avatar
                  src={group.avatar}
                  name={group.name}
                  alt={group.name}
                  className="w-11 h-11 border border-slate-200 bg-indigo-100 flex-shrink-0"
                  fallbackClassName="bg-indigo-100 text-indigo-600"
                />
                <div className="flex-grow min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{group.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {hasChallenge
                      ? (isVoting ? '⭐ Voting läuft' : `⚔️ ${group.activeChallenge!.title}`)
                      : `${group.memberIds.length} Mitglied${group.memberIds.length !== 1 ? 'er' : ''}`
                    }
                  </p>
                </div>
                {hasChallenge && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderGroupDetail = () => {
    const group = selectedGroup;
    if (!group) { setScreen('list'); return null; }

    return (
      <div className="max-w-lg mx-auto">
        {/* Back + Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setScreen('list')} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 flex-grow min-w-0">
            <Avatar
              src={group.avatar}
              name={group.name}
              alt={group.name}
              className="w-10 h-10 border border-slate-200 bg-indigo-100 flex-shrink-0"
              fallbackClassName="bg-indigo-600 text-white"
            />
            <div className="min-w-0">
              <p className="font-bold text-slate-900 text-base leading-tight">{group.name}</p>
              <p className="text-xs text-slate-400">{group.memberIds.length} Mitglieder · Code: <span className="font-mono">{group.code}</span></p>
            </div>
          </div>
          <button
            onClick={() => openGroupEditor(group)}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0"
            title="Gruppe bearbeiten"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setGroupToDelete(group)}
            className="p-2 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0"
            title="Gruppe löschen"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Challenge Area */}
        {!group.activeChallenge
          ? renderCreateChallengePanel()
          : group.activeChallenge.status === 'VOTING'
            ? renderVotingPhase(group, group.activeChallenge)
            : renderChallengeActive(group, group.activeChallenge)
        }

        {/* Past Challenges */}
        {group.pastChallenges?.length > 0 && !group.activeChallenge && (
          <div className="mt-6">
            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm">
              <Trophy className="w-4 h-4 text-amber-500" /> Ruhmeshalle
            </h3>
            <div className="space-y-2">
              {group.pastChallenges.map(past => {
                const winner = past.winnerId ? usersCache[past.winnerId] : null;
                const hasMedia = past.submissions.some(s => s.media && s.media.length > 0);
                return (
                  <div key={past.id} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{past.title}</p>
                        <p className="text-xs text-slate-400">{new Date(past.deadline).toLocaleDateString()}</p>
                      </div>
                      {winner && (
                        <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                          <Crown className="w-3 h-3 text-amber-500" />
                          <span className="text-xs font-bold text-amber-800">{winner.username}</span>
                        </div>
                      )}
                    </div>
                    {hasMedia && (
                      <>
                        {/* Media preview grid */}
                        <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
                          {past.submissions.flatMap((s, si) =>
                            (s.media || []).map((item, mi) => {
                              const allPastItems: LightboxItem[] = past.submissions.flatMap(sub =>
                                (sub.media || []).map(m => ({
                                  media: m,
                                  uploaderName: usersCache[sub.userId]?.username || 'Unbekannt',
                                }))
                              );
                              const flatIdx = past.submissions.slice(0, si).reduce((acc, sub) => acc + (sub.media?.length || 0), 0) + mi;
                              return (
                                <div
                                  key={`${si}-${mi}`}
                                  className="aspect-square cursor-pointer relative group"
                                  onClick={() => openLightbox(allPastItems, flatIdx)}
                                >
                                  {item.type === 'VIDEO'
                                    ? <video src={item.url} className="w-full h-full object-cover" />
                                    : <img src={item.url} className="w-full h-full object-cover" />
                                  }
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                    <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold" style={{textShadow: '0 1px 4px rgba(0,0,0,0.5)'}}>Vergrößern</span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                        <button
                          onClick={() => handleDownloadAllMedia(past)}
                          className="flex items-center justify-center gap-2 w-full py-2 mt-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-sm font-medium transition-colors border border-slate-200"
                        >
                          <Download className="w-4 h-4" /> Media herunterladen
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCreateChallengePanel = () => (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Swords className="w-7 h-7 text-slate-400" />
      </div>
      <h3 className="font-bold text-slate-700">Kein aktives Battle</h3>
      <p className="text-slate-400 text-sm mt-2">
        Gehe zum <span className="font-semibold text-indigo-600">Feed</span>, wähle eine Challenge aus und starte sie für diese Gruppe.
      </p>
    </div>
  );

  const renderChallengeActive = (group: Group, challenge: GroupChallenge) => {
    const hasSubmitted = challenge.submissions.some(s => s.userId === currentUser.id);
    const isExpired = Date.now() > new Date(challenge.deadline).getTime();

    return (
      <div className="space-y-4">
        {/* Challenge Info + Timer */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex justify-between items-start gap-3 mb-4">
            <div className="min-w-0">
              <h3 className="font-bold text-amber-900 flex items-center gap-2">
                <Swords className="w-4 h-4 text-amber-600 flex-shrink-0" /> {challenge.title}
              </h3>
              <p className="text-amber-700 text-sm mt-1">{challenge.description}</p>
            </div>
            <div className="text-right flex-shrink-0 bg-white/60 px-3 py-2 rounded-xl border border-amber-100">
              <p className="text-[10px] font-bold uppercase text-amber-500 flex items-center gap-1 justify-end mb-1">
                <Clock className="w-3 h-3" /> Zeit
              </p>
              <p className={`text-lg font-mono font-bold ${isExpired ? 'text-rose-500' : 'text-slate-800'}`}>
                {isExpired ? '00:00:00' : timeLeftStr}
              </p>
            </div>
          </div>

          {/* Member Status */}
          <div className="space-y-2">
            {group.memberIds.map(memberId => {
              const member = usersCache[memberId];
              const submitted = challenge.submissions.some(s => s.userId === memberId);
              return (
                <div key={memberId} className="flex items-center justify-between bg-white rounded-xl p-2.5 border border-amber-50">
                  <div className="flex items-center gap-2.5">
                    <Avatar src={member?.avatar} name={member?.username} alt={member?.username} className="w-8 h-8 flex-shrink-0" />
                    <span className="font-medium text-sm text-slate-700">{member?.username}</span>
                  </div>
                  {submitted ? (
                    <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                      <Check className="w-3 h-3" /> Bereit
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-400 text-xs font-bold bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                      <Hourglass className="w-3 h-3" /> Wartend
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-amber-600/70 mt-3 text-center">
            Voting startet automatisch wenn alle eingereicht haben oder die Zeit abläuft.
          </p>
        </div>

        {/* Submission */}
        {!hasSubmitted && !isExpired && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm">
              <Upload className="w-4 h-4 text-indigo-500" /> Dein Beitrag
            </h4>
            <div className="space-y-3">
              {mediaItems.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {mediaItems.map((item, i) => {
                    const previewItems: LightboxItem[] = mediaItems.map(m => ({
                      media: m,
                      uploaderName: currentUser.username,
                    }));
                    return (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
                        <div
                          className="w-full h-full cursor-pointer"
                          onClick={() => openLightbox(previewItems, i)}
                        >
                          {item.type === 'VIDEO'
                            ? <video src={item.url} className="w-full h-full object-cover" />
                            : <img src={item.url} className="w-full h-full object-cover" />
                          }
                        </div>
                        <button onClick={() => setMediaItems(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all ${isCompressingMedia ? 'border-slate-200 bg-slate-50 cursor-not-allowed' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50 cursor-pointer'}`}
              >
                <Upload className="w-6 h-6 text-indigo-400 mb-1.5" />
                <span className="text-sm text-slate-600 font-medium">Fotos/Videos hinzufügen</span>
                {isCompressingMedia && <span className="text-xs text-indigo-500 mt-1">Komprimiere...</span>}
                <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileChange} disabled={isCompressingMedia} />
              </div>
              <input
                type="text"
                placeholder="Kommentar (optional)"
                value={proofComment}
                onChange={e => setProofComment(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <button
                onClick={handleSubmitProof}
                disabled={!mediaItems.length || loading || isCompressingMedia}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all"
              >
                {isCompressingMedia ? 'Komprimiere...' : loading ? 'Sende...' : 'Einreichen'}
              </button>
            </div>
          </div>
        )}

        {hasSubmitted && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
              <Check className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-emerald-800">Stark! Du bist dabei.</h3>
            <p className="text-emerald-600 text-sm mt-1">Warte auf die anderen...</p>
          </div>
        )}
      </div>
    );
  };

  const renderVotingPhase = (group: Group, challenge: GroupChallenge) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500 fill-amber-500" /> Voting Phase
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadAllMedia(challenge)}
            className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 font-bold"
            title="Alle Bilder/Videos herunterladen"
          >
            <Download className="w-4 h-4" />
          </button>
          {group.memberIds[0] === currentUser.id && (
            <button onClick={handleEndChallenge} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 font-bold">
              Voting abschließen
            </button>
          )}
        </div>
      </div>
      {challenge.submissions.map(sub => {
        const user = usersCache[sub.userId];
        const isMe = sub.userId === currentUser.id;
        const myVote = sub.ratings.find(r => r.voterId === currentUser.id)?.score || 0;
        const avgScore = sub.ratings.reduce((a, c) => a + c.score, 0) / (sub.ratings.length || 1);
        const subComments = sub.comments || [];
        const commentKey = sub.userId;
        const commentText = commentTexts[commentKey] || '';

        const handleAddComment = async () => {
          if (!selectedGroupId || !commentText.trim()) return;
          setCommentLoading(commentKey);
          try {
            const updated = await addSubmissionComment(selectedGroupId, sub.userId, commentText.trim());
            refreshGroup(updated);
            setCommentTexts(prev => ({ ...prev, [commentKey]: '' }));
          } catch (e) { console.error(e); }
          finally { setCommentLoading(null); }
        };

        return (
          <div key={sub.userId} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {sub.media.length > 0 && (
              <div className="grid grid-cols-2 gap-1 bg-slate-100">
                {sub.media.map((item, idx) => {
                  const allItems: LightboxItem[] = sub.media.map(m => ({
                    media: m,
                    uploaderName: user?.username || 'Unbekannt',
                  }));
                  return (
                    <div
                      key={idx}
                      className="aspect-video cursor-pointer relative group"
                      onClick={() => openLightbox(allItems, idx)}
                    >
                      {item.type === 'VIDEO'
                        ? <video src={item.url} className="w-full h-full object-cover" />
                        : <img src={item.url} className="w-full h-full object-cover" />
                      }
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-bold" style={{textShadow: '0 1px 4px rgba(0,0,0,0.5)'}}>Vergrößern</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar src={user?.avatar} name={user?.username} alt={user?.username} className="w-9 h-9 border border-slate-100 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-sm">{user?.username}</p>
                  {sub.comment && <p className="text-slate-500 text-xs truncate">{sub.comment}</p>}
                </div>
              </div>
              {isMe ? (
                <div className="text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl flex-shrink-0">
                  Ø <span className="font-bold text-amber-500">{avgScore.toFixed(1)}</span> ⭐
                </div>
              ) : (
                <div className="flex gap-0.5 flex-shrink-0">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} onClick={() => handleVote(sub.userId, star)} className="focus:outline-none active:scale-110 transition-transform">
                      <Star className={`w-7 h-7 ${star <= myVote ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Comments Section */}
            <div className="border-t border-slate-100 px-4 py-3">
              {subComments.length > 0 && (
                <div className="space-y-2 mb-3">
                  {subComments.map((c, ci) => {
                    const commenter = usersCache[c.userId];
                    const time = new Date(c.timestamp);
                    const timeStr = `${time.getHours().toString().padStart(2,'0')}:${time.getMinutes().toString().padStart(2,'0')}`;
                    return (
                      <div key={ci} className="flex items-start gap-2">
                        <Avatar src={commenter?.avatar} name={commenter?.username} alt={commenter?.username} className="w-6 h-6 border border-slate-100 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-bold text-slate-700">{commenter?.username}</span>
                            <span className="text-[10px] text-slate-400">{timeStr}</span>
                          </div>
                          <p className="text-xs text-slate-600 break-words">{c.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Kommentar schreiben..."
                  value={commentText}
                  onChange={e => setCommentTexts(prev => ({ ...prev, [commentKey]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && commentText.trim()) handleAddComment(); }}
                  className="flex-grow p-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={commentLoading === commentKey}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || commentLoading === commentKey}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-all flex-shrink-0"
                  title="Kommentar senden"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderCreateGroup = () => (
    <div className="max-w-sm mx-auto pt-8">
      <button onClick={() => setScreen('list')} className="flex items-center gap-1 text-slate-500 hover:text-slate-800 mb-6 text-sm">
        <ChevronLeft className="w-4 h-4" /> Zurück
      </button>
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-600">
          <Users className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Neue Gruppe</h2>
        <p className="text-slate-500 text-sm mt-1">Gib deiner Crew einen Namen.</p>
      </div>
      <form onSubmit={handleCreateGroup} className="space-y-3">
        <input
          type="text"
          placeholder="Gruppenname"
          value={newGroupName}
          onChange={e => setNewGroupName(e.target.value)}
          className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          required autoFocus
        />
        <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Erstelle...' : 'Gruppe erstellen'}
        </button>
      </form>
    </div>
  );

  const renderJoinGroup = () => (
    <div className="max-w-sm mx-auto pt-8">
      <button onClick={() => setScreen('list')} className="flex items-center gap-1 text-slate-500 hover:text-slate-800 mb-6 text-sm">
        <ChevronLeft className="w-4 h-4" /> Zurück
      </button>
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
          <Hash className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Gruppe beitreten</h2>
        <p className="text-slate-500 text-sm mt-1">Gib den Einladungscode ein.</p>
      </div>
      <form onSubmit={handleJoinGroup} className="space-y-3">
        <input
          type="text"
          placeholder="CODE"
          value={joinCode}
          onChange={e => setJoinCode(e.target.value)}
          className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none uppercase text-center font-mono text-xl tracking-widest"
          required autoFocus
        />
        {error && <p className="text-rose-500 text-sm text-center">{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50">
          {loading ? 'Suche...' : 'Beitreten'}
        </button>
      </form>
    </div>
  );

  const renderFriends = () => (
    <div className="max-w-lg mx-auto">
      <button onClick={() => setScreen('list')} className="flex items-center gap-1 text-slate-500 hover:text-slate-800 mb-6 text-sm">
        <ChevronLeft className="w-4 h-4" /> Zurück
      </button>
      <h2 className="text-xl font-bold text-slate-800 mb-4">Freunde</h2>

      <form onSubmit={handleSendFriendRequest} className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Benutzername..."
              value={friendSearch}
              onChange={e => setFriendSearch(e.target.value)}
              className="w-full pl-9 p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
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

      {friendRequests.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Eingehende Anfragen</h3>
          <div className="space-y-2">
            {friendRequests.map(req => (
              <div key={req.id} className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <Avatar src={req.avatar} name={req.username} alt={req.username} className="w-10 h-10 border border-slate-200 flex-shrink-0" />
                <span className="font-semibold text-slate-700 text-sm flex-grow">{req.username}</span>
                <button
                  onClick={() => handleAcceptRequest(req.id)}
                  className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
                  title="Annehmen"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeclineRequest(req.id)}
                  className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"
                  title="Ablehnen"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {incomingRequests.length > 0 && (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 font-bold mb-2">Eingehende Anfragen</p>
            <div className="space-y-2">
              {incomingRequests.map((req) => (
                <div key={req.id} className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <img src={req.otherUser?.avatar} className="w-10 h-10 rounded-full border border-amber-200 bg-white" />
                  <div className="min-w-0 flex-grow">
                    <span className="font-semibold text-slate-700 text-sm">{req.otherUser?.username || 'Unbekannt'}</span>
                    <p className="text-xs text-amber-700">möchte mit dir befreundet sein</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleRespondToRequest(req.id, 'ACCEPT')}
                      className="px-2.5 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                      disabled={loading}
                    >
                      Annehmen
                    </button>
                    <button
                      onClick={() => handleRespondToRequest(req.id, 'DECLINE')}
                      className="px-2.5 py-1.5 text-xs bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                      disabled={loading}
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {outgoingRequests.length > 0 && (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 font-bold mb-2">Ausstehende Anfragen</p>
            <div className="space-y-2">
              {outgoingRequests.map((req) => (
                <div key={req.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <img src={req.otherUser?.avatar} className="w-10 h-10 rounded-full border border-slate-200 bg-white" />
                  <div className="min-w-0 flex-grow">
                    <span className="font-semibold text-slate-700 text-sm">{req.otherUser?.username || 'Unbekannt'}</span>
                    <p className="text-xs text-slate-500">Anfrage ausstehend</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {friends.length === 0
          ? <p className="text-slate-400 text-sm">Noch keine Freunde hinzugefügt.</p>
          : friends.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
              <Avatar src={f.avatar} name={f.username} alt={f.username} className="w-10 h-10 border border-slate-200 flex-shrink-0" />
              <span className="font-semibold text-slate-700 text-sm flex-grow">{f.username}</span>
              <button
                onClick={() => setFriendToRemove(f)}
                className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100"
                title={`${f.username} entfernen`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        }
      </div>
    </div>
  );

  // ─── Root ───────────────────────────────────────────────────────────────────

  return (
    <div className="py-2">
      {screen === 'list'         && renderList()}
      {screen === 'group'        && renderGroupDetail()}
      {screen === 'create-group' && renderCreateGroup()}
      {screen === 'join-group'   && renderJoinGroup()}
      {screen === 'friends'      && renderFriends()}

      {isEditGroupOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4">
          <div className="min-h-full flex items-start justify-center py-6">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Gruppe bearbeiten</h3>
                <p className="text-sm text-slate-500 mt-1">Name, Beschreibung, Mitglieder und Profilbild anpassen.</p>
              </div>
              <button
                onClick={closeGroupEditor}
                disabled={isSavingGroup}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"
                title="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => groupAvatarInputRef.current?.click()}
                  className="relative"
                  disabled={isSavingGroup}
                >
                  <Avatar
                    src={groupAvatarPreview}
                    name={editGroupName}
                    alt="Gruppenbild"
                    className="w-20 h-20 border-2 border-slate-200 bg-indigo-100"
                    fallbackClassName="bg-indigo-600 text-white"
                  />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center border-4 border-white">
                    <Camera className="w-4 h-4" />
                  </div>
                </button>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">Profilbild</p>
                  <p className="text-sm text-slate-500">Tippe auf das Bild, um ein neues Gruppenfoto hochzuladen.</p>
                </div>
                <input
                  ref={groupAvatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleGroupAvatarSelection}
                  disabled={isSavingGroup}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                <input
                  type="text"
                  value={editGroupName}
                  onChange={e => setEditGroupName(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  maxLength={80}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Beschreibung</label>
                <textarea
                  value={editGroupDescription}
                  onChange={e => setEditGroupDescription(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-h-[110px] resize-none"
                  maxLength={500}
                  placeholder="Worum geht es in eurer Gruppe?"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block text-sm font-medium text-slate-700">Mitglieder</label>
                  <span className="text-xs text-slate-400">{editMemberIds.length} ausgewählt</span>
                </div>
                <div className="space-y-2">
                  {groupMembers.map(member => {
                    const isSelf = member.id === currentUser.id;
                    const canRemove = editMemberIds.length > 1;
                    return (
                      <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                        <Avatar src={member.avatar} name={member.username} alt={member.username} className="w-10 h-10 border border-slate-200 flex-shrink-0" />
                        <div className="flex-grow min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">{member.username}</p>
                          <p className="text-xs text-slate-400">{isSelf ? 'Du' : 'Mitglied'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleEditableMember(member.id)}
                          disabled={!canRemove || isSavingGroup}
                          className="px-3 py-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          Entfernen
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block text-sm font-medium text-slate-700">Freunde hinzufügen</label>
                  <span className="text-xs text-slate-400">{availableFriendsToAdd.length} verfügbar</span>
                </div>
                {availableFriendsToAdd.length === 0 ? (
                  <div className="p-3 rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                    Keine weiteren Freunde verfügbar.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableFriendsToAdd.map(friend => (
                      <div key={friend.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white">
                        <Avatar src={friend.avatar} name={friend.username} alt={friend.username} className="w-10 h-10 border border-slate-200 flex-shrink-0" />
                        <span className="font-semibold text-slate-700 text-sm flex-grow">{friend.username}</span>
                        <button
                          type="button"
                          onClick={() => toggleEditableMember(friend.id)}
                          disabled={isSavingGroup}
                          className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium"
                        >
                          Hinzufügen
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-rose-500">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeGroupEditor}
                  disabled={isSavingGroup}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleSaveGroup}
                  disabled={isSavingGroup || !editGroupName.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSavingGroup ? 'Speichert...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
          </div>
      )}

      {friendToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Freund entfernen?</h3>
            <p className="text-sm text-slate-600 mb-6">
              {friendToRemove.username} wird aus deiner Freundesliste entfernt.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setFriendToRemove(null)}
                disabled={isRemovingFriend}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60"
              >
                Abbrechen
              </button>
              <button
                onClick={handleRemoveFriend}
                disabled={isRemovingFriend}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {isRemovingFriend ? 'Entfernen...' : 'Entfernen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Gruppe löschen?</h3>
            <p className="text-sm text-slate-600 mb-6">
              Die Gruppe {groupToDelete.name} wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setGroupToDelete(null)}
                disabled={isDeletingGroup}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={isDeletingGroup}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {isDeletingGroup ? 'Löschen...' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxOpen && (
        <MediaLightbox
          items={lightboxItems}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
};
