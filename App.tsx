import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trophy, Map, LayoutGrid, Zap, LogOut, Users, Ghost, UserPlus, Swords, X, Sparkles, Clock, Loader2, Search, CheckCircle2, PartyPopper, ChevronDown, ChevronUp, Shuffle, User as UserIcon, Bell, CheckCheck } from 'lucide-react';
import { Milestone, MilestoneCategory, User, Difficulty, Group, AppNotification } from './types';
import { MilestoneCard } from './components/MilestoneCard';
import { AuthScreen } from './components/AuthScreen';
import { GroupDashboard } from './components/GroupDashboard';
import { LocalMode } from './components/LocalMode';
import { ProfileModal } from './components/ProfileModal';
import { Avatar } from './components/Avatar';
import {
  getCurrentSessionUser,
  logoutUser,
  updateUserMilestones,
  getUserGroups,
  startGroupChallenge,
  createGroup,
  getUserFriends,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getPushPublicKey,
  subscribePush,
  unsubscribePush,
  API_BASE
} from './services/storageService';
import { INITIAL_MILESTONES, CATEGORY_EMOJIS } from './constants';
import { generateCreativeMilestones } from './services/geminiService';

// --- Challenge Setup Modal Component (Internal) ---
interface ChallengeSetupProps {
  milestone: Milestone | null;
  onClose: () => void;
  currentUser: User;
  onStart: () => void;
}

const ChallengeSetupModal: React.FC<ChallengeSetupProps> = ({ milestone, onClose, currentUser, onStart }) => {
  const [target, setTarget] = useState<'GROUP' | 'FRIEND' | 'STRANGER'>('GROUP');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedFriendId, setSelectedFriendId] = useState<string>('');
  
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [userFriends, setUserFriends] = useState<User[]>([]);
  
  // Friend Search
  const [friendSearchTerm, setFriendSearchTerm] = useState('');

  // Time Selection
  const [weeks, setWeeks] = useState(0);
  const [days, setDays] = useState(1);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      getUserGroups(currentUser.id).then(setUserGroups);
      getUserFriends(currentUser.id).then(setUserFriends);
    }
  }, [currentUser]);

  if (!milestone) return null;

  const getTotalMinutes = () => {
    return (weeks * 7 * 24 * 60) + (days * 24 * 60) + (hours * 60) + minutes;
  };

  const handleStart = async () => {
    setLoading(true);
    const durationMins = getTotalMinutes();

    if (durationMins <= 0) {
      alert("Bitte wähle eine Dauer.");
      setLoading(false);
      return;
    }

    try {
      if (target === 'GROUP') {
        if (!selectedGroupId) return;
        await startGroupChallenge(selectedGroupId, milestone.title, milestone.description, durationMins);
      } else if (target === 'FRIEND') {
        if (!selectedFriendId) return;
        const friend = userFriends.find(f => f.id === selectedFriendId);
        const g = await createGroup(currentUser.id, `Battle vs ${friend?.username || 'Friend'}`, [selectedFriendId]);
        await startGroupChallenge(g.id, milestone.title, milestone.description, durationMins);
      } else if (target === 'STRANGER') {
        const g = await createGroup(currentUser.id, `Battle vs Unknown`);
        await startGroupChallenge(g.id, milestone.title, milestone.description, durationMins);
      }
      onStart();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isReady = () => {
      if (getTotalMinutes() <= 0) return false;
      if (target === 'GROUP' && !selectedGroupId) return false;
      if (target === 'FRIEND' && !selectedFriendId) return false;
      return true;
  };

  const filteredFriends = userFriends.filter(f => 
    f.username.toLowerCase().includes(friendSearchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-6 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white flex-shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Swords className="w-6 h-6 text-white/90" />
            Challenge Mode
          </h2>
          <p className="text-white/80 text-sm mt-1">Konfiguriere dein Battle</p>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <h3 className="font-bold text-indigo-900">{milestone.title}</h3>
            <p className="text-indigo-700 text-sm mt-1">{milestone.description}</p>
          </div>

          {/* Time Picker */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Clock className="w-4 h-4 text-slate-400" /> Zeitlimit
            </label>
            <div className="grid grid-cols-4 gap-2">
               <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Wochen</label>
                  <select value={weeks} onChange={e => setWeeks(Number(e.target.value))} className="w-full p-2 border rounded-lg bg-white cursor-pointer">
                    {[...Array(5)].map((_, i) => <option key={i} value={i}>{i}</option>)}
                  </select>
               </div>
               <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Tage</label>
                  <select value={days} onChange={e => setDays(Number(e.target.value))} className="w-full p-2 border rounded-lg bg-white cursor-pointer">
                    {[...Array(7)].map((_, i) => <option key={i} value={i}>{i}</option>)}
                  </select>
               </div>
               <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Std</label>
                  <select value={hours} onChange={e => setHours(Number(e.target.value))} className="w-full p-2 border rounded-lg bg-white cursor-pointer">
                    {[...Array(24)].map((_, i) => <option key={i} value={i}>{i}</option>)}
                  </select>
               </div>
               <div>
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Min</label>
                  <select value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="w-full p-2 border rounded-lg bg-white cursor-pointer">
                     <option value={0}>0</option>
                     <option value={15}>15</option>
                     <option value={30}>30</option>
                     <option value={45}>45</option>
                  </select>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <button 
              onClick={() => setTarget('GROUP')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${target === 'GROUP' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              <Users className="w-6 h-6" />
              <span className="text-xs font-bold">Gruppe</span>
            </button>
            <button 
              onClick={() => setTarget('FRIEND')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${target === 'FRIEND' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              <UserPlus className="w-6 h-6" />
              <span className="text-xs font-bold">Freund</span>
            </button>
            <button 
              onClick={() => setTarget('STRANGER')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${target === 'STRANGER' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              <Ghost className="w-6 h-6" />
              <span className="text-xs font-bold">Fremder</span>
            </button>
          </div>

          {target === 'GROUP' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Wähle eine Gruppe</label>
              {userGroups.length > 0 ? (
                <select 
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  value={selectedGroupId}
                >
                  <option value="" disabled>-- Bitte wählen --</option>
                  {userGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              ) : (
                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                  Keine Gruppen vorhanden.
                </div>
              )}
            </div>
          )}

          {target === 'FRIEND' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Wähle einen Freund</label>
              
              {userFriends.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                   <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                      <Search className="w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Freunde suchen..." 
                        value={friendSearchTerm}
                        onChange={(e) => setFriendSearchTerm(e.target.value)}
                        className="bg-transparent outline-none w-full text-sm"
                      />
                   </div>
                   <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                      {filteredFriends.length > 0 ? filteredFriends.map(f => (
                         <div 
                           key={f.id} 
                           onClick={() => setSelectedFriendId(f.id)}
                           className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedFriendId === f.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`}
                         >
                            <Avatar src={f.avatar} name={f.username} alt={f.username} className="w-8 h-8 border border-slate-200 bg-white flex-shrink-0" />
                            <span className={`text-sm font-medium ${selectedFriendId === f.id ? 'text-indigo-700' : 'text-slate-700'}`}>{f.username}</span>
                            {selectedFriendId === f.id && <CheckCircle2 className="w-4 h-4 text-indigo-500 ml-auto" />}
                         </div>
                      )) : (
                        <div className="text-xs text-slate-400 text-center py-4">Niemanden gefunden.</div>
                      )}
                   </div>
                </div>
              ) : (
                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                   Du hast noch keine Freunde hinzugefügt. (Gehe zu Community)
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 pt-0 mt-auto bg-white border-t border-slate-50">
            <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-50 rounded-xl">Abbrechen</button>
            <button 
              onClick={handleStart}
              disabled={loading || !isReady()}
              className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Starte...' : 'Challenge starten!'}
            </button>
          </div>
      </div>
    </div>
  );
};


function App() {
  const FEED_CACHE_KEY = 'challenge-me.feed-cache.v1';
  const loadCachedFeed = (): Milestone[] => {
    try {
      const raw = localStorage.getItem(FEED_CACHE_KEY);
      if (!raw) return INITIAL_MILESTONES;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_MILESTONES;
      return parsed.slice(0, 10);
    } catch {
      return INITIAL_MILESTONES;
    }
  };

  const persistFeed = (milestones: Milestone[]) => {
    try {
      localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(milestones.slice(0, 10)));
    } catch {
      // Ignore storage failures and keep the UI usable.
    }
  };

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const mobileProfileMenuRef = useRef<HTMLDivElement | null>(null);
  const desktopProfileMenuRef = useRef<HTMLDivElement | null>(null);

  // App State
  const [activeTab, setActiveTab] = useState<'feed' | 'groups' | 'local'>('feed');
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const [groupDeepLink, setGroupDeepLink] = useState<{ screen: 'group' | 'friends'; groupId?: string; nonce: number } | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushServerAvailable, setPushServerAvailable] = useState<boolean | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  
  // Feed Generator State
  const [genCategory, setGenCategory] = useState<string>('MIX');
  const [genDifficulty, setGenDifficulty] = useState<Difficulty | 'ALL'>('ALL');
  const [genContext, setGenContext] = useState('');
  const [genTeamMode, setGenTeamMode] = useState<'SOLO' | 'TEAM'>('SOLO');
  const [genAdvancedOpen, setGenAdvancedOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Feed Data
  const [feedMilestones, setFeedMilestones] = useState<Milestone[]>(() => loadCachedFeed());

  // Challenge Interaction
  const [selectedChallenge, setSelectedChallenge] = useState<Milestone | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Manual Creation State
  const [manualTitle, setManualTitle] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualCat, setManualCat] = useState(MilestoneCategory.FUNandCringe);
  const [manualDiff, setManualDiff] = useState(Difficulty.MEDIUM);
  const [manualTeamMode, setManualTeamMode] = useState<'SOLO' | 'TEAM'>('SOLO');

  useEffect(() => {
    getCurrentSessionUser().then(user => {
      if (user) setCurrentUser(user);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (feedMilestones.length > 0) {
      persistFeed(feedMilestones);
    }
  }, [feedMilestones]);

  useEffect(() => {
    if (currentUser) {
      updateUserMilestones(currentUser.id, currentUser.milestones);
    }
  }, [currentUser]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 320);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideMobile = mobileProfileMenuRef.current?.contains(target);
      const clickedInsideDesktop = desktopProfileMenuRef.current?.contains(target);

      if (!clickedInsideMobile && !clickedInsideDesktop) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
    if (typeof window !== 'undefined') {
      setPushSupported('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
    }
  }, []);

  const applyDeepLinkUrl = (rawUrl: string) => {
    try {
      const url = new URL(rawUrl, window.location.origin);
      const tab = url.searchParams.get('tab');
      const screen = url.searchParams.get('screen');
      const groupId = url.searchParams.get('groupId') || undefined;

      if (tab === 'groups') {
        setActiveTab('groups');
        if (screen === 'friends') {
          setGroupDeepLink({ screen: 'friends', nonce: Date.now() });
        } else if (screen === 'group' && groupId) {
          setGroupDeepLink({ screen: 'group', groupId, nonce: Date.now() });
        }
      }

      if (url.searchParams.toString()) {
        window.history.replaceState({}, '', '/');
      }
    } catch {
      // ignore invalid URLs
    }
  };

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch(() => {});

    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | undefined;
      if (data?.type === 'DEEP_LINK' && data.url) {
        applyDeepLinkUrl(data.url);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    applyDeepLinkUrl(window.location.href);
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    let es: EventSource | null = null;
    let retryTimeout: number | null = null;

    const connect = () => {
      es = new EventSource(`${API_BASE}/users/stream`, { withCredentials: true });

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            connected?: boolean;
            type?: string;
            payload?: AppNotification;
          };

          if (msg.connected) return;

          if (msg.type === 'NOTIFICATION_CREATED' && msg.payload) {
            setNotifications((prev: AppNotification[]) => [msg.payload!, ...prev].slice(0, 50));

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              const isVisible = document.visibilityState === 'visible';
              if (!isVisible) {
                new Notification(msg.payload.title, {
                  body: msg.payload.body,
                  tag: msg.payload.id
                });
              }
            }
          }
        } catch {
          // ignore malformed message
        }
      };

      es.onerror = () => {
        es?.close();
        retryTimeout = window.setTimeout(connect, 3000);
      };
    };

    getNotifications(50).then(setNotifications).catch(() => {});
    connect();

    return () => {
      es?.close();
      if (retryTimeout) window.clearTimeout(retryTimeout);
    };
  }, [currentUser?.id]);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const syncPushStatus = async () => {
    if (!currentUser || !pushSupported) {
      setPushSubscribed(false);
      return;
    }

    try {
      await getPushPublicKey();
      setPushServerAvailable(true);
    } catch {
      setPushServerAvailable(false);
      setPushSubscribed(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setPushSubscribed(!!existing);
    } catch {
      setPushSubscribed(false);
    }
  };

  const registerPushSubscription = async (forceResubscribe = false) => {
    if (!currentUser) return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const registration = await navigator.serviceWorker.ready;
    let existing = await registration.pushManager.getSubscription();

    if (existing && forceResubscribe) {
      try {
        await unsubscribePush(existing.endpoint);
      } catch {
        // ignore backend cleanup errors
      }
      await existing.unsubscribe();
      existing = null;
    }

    if (existing) {
      await subscribePush(existing);
      setPushSubscribed(true);
      return;
    }

    const publicKey = await getPushPublicKey();
    setPushServerAvailable(true);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    await subscribePush(subscription);
    setPushSubscribed(true);
  };

  const handleUnsubscribePush = async () => {
    if (!currentUser || !pushSupported) return;
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await unsubscribePush(existing.endpoint);
        await existing.unsubscribe();
      }
      setPushSubscribed(false);
    } finally {
      setPushBusy(false);
    }
  };

  const handleResubscribePush = async () => {
    setPushBusy(true);
    try {
      await registerPushSubscription(true);
      await syncPushStatus();
    } catch (error) {
      console.error('Push re-subscription failed', error);
    } finally {
      setPushBusy(false);
    }
  };

  const unreadCount = notifications.filter((n: AppNotification) => !n.isRead).length;

  useEffect(() => {
    if (!currentUser) return;
    if (browserPermission !== 'granted') return;

    registerPushSubscription().then(syncPushStatus).catch(() => {});
  }, [currentUser?.id, browserPermission, pushSupported]);

  useEffect(() => {
    if (!currentUser || !pushSupported) return;
    syncPushStatus().catch(() => {});
  }, [currentUser?.id, pushSupported]);

  const handleEnableBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Dieser Browser unterstützt keine System-Benachrichtigungen.');
      return;
    }
    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
    if (permission === 'granted') {
      try {
        await registerPushSubscription();
        await syncPushStatus();
      } catch (error) {
        console.error('Push subscription failed', error);
      }
    }
  };

  const handleOpenNotifications = () => {
    setNotificationPanelOpen((prev: boolean) => !prev);
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    try {
      if (!notification.isRead) {
        await markNotificationAsRead(notification.id);
      }
      setNotifications((prev: AppNotification[]) => prev.map((n: AppNotification) => n.id === notification.id ? { ...n, isRead: true } : n));

      const payload = notification.payload as Record<string, unknown>;
      if (
        notification.type === 'CHALLENGE_INVITED'
        || notification.type === 'CHALLENGE_VOTING_STARTED'
      ) {
        const groupId = typeof payload.groupId === 'string' ? payload.groupId : undefined;
        if (groupId) {
          setActiveTab('groups');
          setGroupDeepLink({ screen: 'group', groupId, nonce: Date.now() });
        }
      }

      if (
        notification.type === 'FRIEND_REQUEST_RECEIVED'
        || notification.type === 'FRIEND_REQUEST_ACCEPTED'
        || notification.type === 'FRIEND_REQUEST_DECLINED'
      ) {
        setActiveTab('groups');
        setGroupDeepLink({ screen: 'friends', nonce: Date.now() });
      }

      setNotificationPanelOpen(false);
    } catch {
      // ignore transient error
    }
  };

  useEffect(() => {
    if (activeTab !== 'groups' || !groupDeepLink) return;

    const friendTypes = new Set(['FRIEND_REQUEST_RECEIVED', 'FRIEND_REQUEST_ACCEPTED', 'FRIEND_REQUEST_DECLINED']);
    const challengeTypes = new Set(['CHALLENGE_INVITED', 'CHALLENGE_VOTING_STARTED']);

    let targets: AppNotification[] = [];
    if (groupDeepLink.screen === 'friends') {
      targets = notifications.filter((n: AppNotification) => !n.isRead && friendTypes.has(n.type));
    }

    if (groupDeepLink.screen === 'group' && groupDeepLink.groupId) {
      targets = notifications.filter((n: AppNotification) => {
        if (n.isRead || !challengeTypes.has(n.type)) return false;
        const payload = n.payload as Record<string, unknown>;
        return payload.groupId === groupDeepLink.groupId;
      });
    }

    if (targets.length === 0) return;

    setNotifications((prev: AppNotification[]) => prev.map((n: AppNotification) => targets.some((t) => t.id === n.id) ? { ...n, isRead: true } : n));
    Promise.all(targets.map((n: AppNotification) => markNotificationAsRead(n.id))).catch(() => {});
  }, [activeTab, groupDeepLink?.nonce, notifications]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev: AppNotification[]) => prev.map((n: AppNotification) => ({ ...n, isRead: true })));
    } catch {
      // ignore transient error
    }
  };

  const handleLogout = () => {
    logoutUser().catch(() => {});
    setShowProfileMenu(false);
    setCurrentUser(null);
  };

  const handleGenerateFeed = async () => {
    setIsGenerating(true);
    try {
      // Request 10 items
      const contextParts = [genContext, genTeamMode === 'TEAM' ? 'Im Team zu erledigen' : 'Solo zu erledigen'].filter(Boolean);
      const newFeed = await generateCreativeMilestones(genCategory, genDifficulty, contextParts.join(', '), 10);
      if (newFeed.length > 0) {
        setFeedMilestones(newFeed.slice(0, 10));
      }
    } catch (e) {
      console.error("Failed to generate feed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualCreate = () => {
    if (!currentUser || !manualTitle) return;
    const modeTag = manualTeamMode === 'TEAM' ? ' [Team]' : ' [Solo]';
    const newM: Milestone = {
      id: Math.random().toString(36).substr(2, 9),
      title: manualTitle,
      description: (manualDesc || manualTitle) + modeTag,
      category: manualCat,
      difficulty: manualDiff,
      proofType: 'PHOTO',
      completed: false
    };
    setCurrentUser({
      ...currentUser,
      milestones: [newM, ...currentUser.milestones]
    });
    setFeedMilestones(prev => [newM, ...prev]);

    setManualTitle('');
    setManualDesc('');
    setManualTeamMode('SOLO');
    setIsManualOpen(false);
  };

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">Lade Challenge Me...</div>;

  if (!currentUser && !guestMode) {
    return (
      <AuthScreen
        onSuccess={setCurrentUser}
        onPlayLocal={() => { setGuestMode(true); setActiveTab('local'); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md">
        <div className="px-3 sm:px-4">

          {/* Mobile: Logo-Zeile */}
          <div className="relative flex sm:hidden items-center justify-between pt-3">
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={handleOpenNotifications}
                  className="relative p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
                  title="Benachrichtigungen"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notificationPanelOpen && (
                  <div className="absolute left-0 mt-2 w-80 max-h-[70vh] overflow-y-auto bg-white border border-slate-200 shadow-xl rounded-2xl z-50">
                    <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                      <p className="font-bold text-slate-800 text-sm">Benachrichtigungen</p>
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> Alle gelesen
                      </button>
                    </div>

                    <div className="p-2 space-y-1.5">
                      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Push Einstellungen</p>
                        {!pushSupported && (
                          <p className="text-xs text-slate-500">Dieser Browser unterstützt Web Push nicht.</p>
                        )}

                        {pushSupported && (
                          <div className="space-y-2">
                            <p className="text-xs text-slate-600">
                              Status: <span className="font-semibold text-slate-800">{pushSubscribed ? 'Aktiv' : 'Inaktiv'}</span>
                            </p>
                            {pushServerAvailable === false && (
                              <p className="text-xs text-amber-700">Push Server ist nicht konfiguriert (fehlende VAPID Keys).</p>
                            )}
                            {browserPermission !== 'granted' && pushServerAvailable !== false && (
                              <button
                                onClick={handleEnableBrowserNotifications}
                                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-lg"
                                disabled={pushBusy}
                              >
                                Aktivieren
                              </button>
                            )}
                            {browserPermission === 'granted' && pushServerAvailable !== false && (
                              <div className="flex gap-2">
                                <button
                                  onClick={handleResubscribePush}
                                  className="text-xs bg-slate-800 hover:bg-slate-900 text-white px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                                  disabled={pushBusy}
                                >
                                  Neu abonnieren
                                </button>
                                <button
                                  onClick={handleUnsubscribePush}
                                  className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                                  disabled={pushBusy || !pushSubscribed}
                                >
                                  Abmelden
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {notifications.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6">Noch keine Benachrichtigungen.</p>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={`w-full text-left p-3 rounded-xl border transition-colors ${n.isRead ? 'bg-white border-slate-100' : 'bg-amber-50 border-amber-200'}`}
                          >
                            <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                            <p className="text-xs text-slate-600 mt-1">{n.body}</p>
                            <p className="text-[10px] text-slate-400 mt-2">{new Date(n.createdAt).toLocaleString()}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : <div className="w-9" />}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-200 transform -rotate-3">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-black italic tracking-tighter text-slate-900">
                CHALLENGE<span className="text-indigo-600">ME</span>
              </h1>
            </div>
            <div className="flex items-center">
              {currentUser ? (
                <div className="relative" ref={mobileProfileMenuRef}>
                  <button
                    onClick={() => setShowProfileMenu(prev => !prev)}
                    className="block rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
                    aria-label="Persönliches Menü öffnen"
                  >
                    <Avatar src={currentUser.avatar} name={currentUser.username} alt="Avatar" className="w-11 h-11 border-2 border-white shadow-md cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all" />
                  </button>
                  {showProfileMenu && (
                    <div className="absolute right-0 top-14 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowProfileModal(true);
                        }}
                        className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        Profil bearbeiten
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => setGuestMode(false)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all">
                  Anmelden
                </button>
              )}
            </div>
          </div>

          

          {/* Mobile: Tab-Zeile */}
          <div className="flex sm:hidden items-center justify-center pt-2 pb-4">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setActiveTab('feed')} className={`px-4 py-1 rounded-md text-sm font-bold transition-all ${activeTab === 'feed' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Feed</button>
              <button onClick={() => setActiveTab('groups')} className={`px-4 py-1 rounded-md text-sm font-bold transition-all ${activeTab === 'groups' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Community</button>
              <button onClick={() => setActiveTab('local')} className={`px-4 py-1 rounded-md text-sm font-bold transition-all ${activeTab === 'local' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Lokal</button>
            </div>
          </div>

          {/* Desktop: einzeilig */}
          <div className="hidden sm:flex items-center justify-between h-20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-200 transform -rotate-3">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-black italic tracking-tighter text-slate-900">
                CHALLENGE<span className="text-indigo-600">ME</span>
              </h1>
              <div className="flex ml-12 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setActiveTab('feed')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'feed' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Feed</button>
                <button onClick={() => setActiveTab('groups')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'groups' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Community</button>
                <button onClick={() => setActiveTab('local')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'local' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Lokal</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentUser && (
                <div className="relative">
                  <button
                    onClick={handleOpenNotifications}
                    className="relative p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
                    title="Benachrichtigungen"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {notificationPanelOpen && (
                    <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto bg-white border border-slate-200 shadow-xl rounded-2xl z-50">
                      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                        <p className="font-bold text-slate-800 text-sm">Benachrichtigungen</p>
                        <button
                          onClick={handleMarkAllRead}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
                        >
                          <CheckCheck className="w-3.5 h-3.5" /> Alle gelesen
                        </button>
                      </div>

                      <div className="p-2 space-y-1.5">
                        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Push Einstellungen</p>
                          {!pushSupported && (
                            <p className="text-xs text-slate-500">Dieser Browser unterstützt Web Push nicht.</p>
                          )}
                          {pushSupported && (
                            <div className="space-y-2">
                              <p className="text-xs text-slate-600">
                                Status: <span className="font-semibold text-slate-800">{pushSubscribed ? 'Aktiv' : 'Inaktiv'}</span>
                              </p>
                              {pushServerAvailable === false && (
                                <p className="text-xs text-amber-700">Push Server ist nicht konfiguriert (fehlende VAPID Keys).</p>
                              )}
                              {browserPermission !== 'granted' && pushServerAvailable !== false && (
                                <button
                                  onClick={handleEnableBrowserNotifications}
                                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-lg"
                                  disabled={pushBusy}
                                >
                                  Aktivieren
                                </button>
                              )}
                              {browserPermission === 'granted' && pushServerAvailable !== false && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleResubscribePush}
                                    className="text-xs bg-slate-800 hover:bg-slate-900 text-white px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                                    disabled={pushBusy}
                                  >
                                    Neu abonnieren
                                  </button>
                                  <button
                                    onClick={handleUnsubscribePush}
                                    className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                                    disabled={pushBusy || !pushSubscribed}
                                  >
                                    Abmelden
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {notifications.length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-6">Noch keine Benachrichtigungen.</p>
                        ) : (
                          notifications.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`w-full text-left p-3 rounded-xl border transition-colors ${n.isRead ? 'bg-white border-slate-100' : 'bg-amber-50 border-amber-200'}`}
                            >
                              <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {currentUser ? (
                <div className="relative" ref={desktopProfileMenuRef}>
                  <button
                    onClick={() => setShowProfileMenu(prev => !prev)}
                    className="block rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
                    aria-label="Persönliches Menü öffnen"
                  >
                    <Avatar src={currentUser.avatar} name={currentUser.username} alt="Avatar" className="w-12 h-12 border-2 border-white shadow-md cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all" />
                  </button>
                  {showProfileMenu && (
                    <div className="absolute right-0 top-14 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowProfileModal(true);
                        }}
                        className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        Profil bearbeiten
                      </button>
                      <button
                        onClick={handleLogout}
                        className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => setGuestMode(false)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all">
                  Anmelden
                </button>
              )}
            </div>
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        
        {activeTab === 'feed' && guestMode && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-200 mb-6 transform -rotate-3">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Login erforderlich</h2>
            <p className="text-slate-500 mb-6 max-w-sm">
              Melde dich an oder erstelle ein Konto, um den Feed zu nutzen und Challenges zu starten.
            </p>
            <button
              onClick={() => setGuestMode(false)}
              className="px-6 py-3 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 text-white font-bold rounded-xl shadow-lg transition-all"
            >
              Jetzt einloggen / registrieren
            </button>
          </div>
        )}

        {activeTab === 'feed' && !guestMode && (
          <>
            {/* BIG FEED GENERATOR HEADER */}
            <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-5 sm:p-8 mb-10 shadow-xl shadow-indigo-200 text-white">
               <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
               <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-purple-500/30 rounded-full blur-3xl"></div>

               <div className="relative z-10">
                 <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                      Challenge Generator
                    </h2>
                    
                 </div>

                 <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                       <div>
                          <label className="text-xs font-bold uppercase text-indigo-200 mb-1.5 block">Kategorie</label>
                          <select
                            value={genCategory}
                            onChange={(e) => setGenCategory(e.target.value)}
                            className="w-full bg-white text-slate-800 rounded-xl px-3 py-3 font-bold outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                          >
                             <option value="MIX">🎲 Bunter Mix</option>
                             {(Object.entries(MilestoneCategory) as [string, string][]).map(([key, label]) => (
                               <option key={key} value={key}>{CATEGORY_EMOJIS[key] || ''} {label}</option>
                             ))}
                          </select>
                       </div>
                       <div>
                          <label className="text-xs font-bold uppercase text-indigo-200 mb-1.5 block">Level</label>
                          <select
                            value={genDifficulty}
                            onChange={(e) => setGenDifficulty(e.target.value as any)}
                            className="w-full bg-white text-slate-800 rounded-xl px-3 py-3 font-bold outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                          >
                             <option value="ALL">🚀 Zufall</option>
                             {Object.values(Difficulty).map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                       </div>
                       <button
                        onClick={handleGenerateFeed}
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
                            onChange={(e) => setGenContext(e.target.value)}
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

            {/* Small toggle button below generator */}
            <div className="flex flex-col sm:flex-row justify-center items-stretch gap-3 -mt-6 mb-6">
              <button
                onClick={() => setIsManualOpen(o => !o)}
                className="flex w-full sm:w-auto sm:min-w-[240px] items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 px-4 py-3 rounded-full text-sm font-black shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" strokeWidth={2.75} />
                Eigene Challenge erstellen
              </button>
              <button
                onClick={() => {
                  const pick = feedMilestones[Math.floor(Math.random() * feedMilestones.length)];
                  if (pick) setSelectedChallenge(pick);
                }}
                disabled={feedMilestones.length === 0}
                className="flex w-full sm:w-auto sm:min-w-[240px] items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-amber-900 px-4 py-3 rounded-full text-sm font-black shadow-lg shadow-amber-900/20 transition-all active:scale-95 disabled:opacity-40"
              >
                <Shuffle className="w-4 h-4" strokeWidth={2.75} />
                Zufällig auswählen
              </button>
            </div>

            {/* Manual Creator Panel (Toggable) */}
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
                      value={manualTitle} onChange={e => setManualTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Kategorie</label>
                    <select
                      className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      value={manualCat} onChange={e => setManualCat(e.target.value as any)}
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
                      value={manualDiff} onChange={e => setManualDiff(e.target.value as any)}
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
                      value={manualDesc} onChange={e => setManualDesc(e.target.value)}
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

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {feedMilestones.map(m => (
                <div key={m.id} className="h-full">
                  <MilestoneCard 
                    milestone={m} 
                    onChallenge={setSelectedChallenge}
                  />
                </div>
              ))}
              {feedMilestones.length === 0 && (
                <div className="col-span-full py-20 text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Ghost className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Gähnende Leere</h3>
                  <p className="text-slate-500">Klick auf "10 NEUE KARTEN" um zu starten!</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'groups' && guestMode && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-200 mb-6 transform -rotate-3">
              <Users className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Login erforderlich</h2>
            <p className="text-slate-500 mb-6 max-w-sm">
              Melde dich an oder erstelle ein Konto, um der Community beizutreten und Gruppen zu nutzen.
            </p>
            <button
              onClick={() => setGuestMode(false)}
              className="px-6 py-3 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 text-white font-bold rounded-xl shadow-lg transition-all"
            >
              Jetzt einloggen / registrieren
            </button>
          </div>
        )}

        {activeTab === 'groups' && !guestMode && (
          <GroupDashboard
            currentUser={currentUser}
            deepLink={groupDeepLink}
            onUpdate={() => {
               getCurrentSessionUser().then(updated => {
                 if (updated) setCurrentUser(updated);
               });
            }}
          />
        )}

        {activeTab === 'local' && (
          <LocalMode feedChallenges={feedMilestones} />
        )}

      </main>

      {/* Modals */}
      
      {currentUser && showProfileModal && (
        <ProfileModal
          user={currentUser}
          onClose={() => setShowProfileModal(false)}
          onUpdated={(updated: User) => { setCurrentUser(updated); setShowProfileModal(false); }}
          onDeleted={() => { setCurrentUser(null); setGuestMode(false); }}
        />
      )}

      {currentUser && <ChallengeSetupModal
        milestone={selectedChallenge}
        onClose={() => setSelectedChallenge(null)}
        currentUser={currentUser}
        onStart={() => {
          setSelectedChallenge(null);
          setActiveTab('groups'); // Switch to community to see the new battle
        }}
      />}

      {activeTab === 'feed' && !guestMode && (
        <button
          type="button"
          onClick={handleScrollToTop}
          aria-label="Zurück nach oben"
          className={`fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-300 transition-all duration-300 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 ${
            showScrollTop ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-4 opacity-0 pointer-events-none'
          }`}
        >
          <ChevronUp className="h-4 w-4" />
          Nach oben
        </button>
      )}
      
    </div>
  );
}

export default App;
