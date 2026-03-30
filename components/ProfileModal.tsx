import React, { useState, useRef } from 'react';
import { X, Camera, User as UserIcon, Lock, Trash2, Check, AlertTriangle, Upload } from 'lucide-react';
import { User } from '../types';
import { updateProfile, deleteAccount, logoutUser, uploadAvatar, API_BASE } from '../services/storageService';

interface Props {
  user: User;
  onClose: () => void;
  onUpdated: (user: User) => void;
  onDeleted: () => void;
}

type Tab = 'avatar' | 'username' | 'password' | 'delete';

export const ProfileModal: React.FC<Props> = ({ user, onClose, onUpdated, onDeleted }) => {
  const [tab, setTab] = useState<Tab>('avatar');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Avatar
  const [preview, setPreview] = useState<string>(user.avatar);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Username
  const [newUsername, setNewUsername] = useState(user.username);

  // Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const reset = () => { setError(''); setSuccess(''); };

  const resolveAvatar = (url: string) =>
    url.startsWith('/uploads/') ? `${API_BASE}${url}` : url;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    reset();
  };

  const handleSaveAvatar = async () => {
    if (!selectedFile) return;
    reset();
    setLoading(true);
    try {
      const avatarUrl = await uploadAvatar(selectedFile);
      const updated = await updateProfile({ avatar: avatarUrl });
      onUpdated(updated);
      setSelectedFile(null);
      setSuccess('Profilbild gespeichert!');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUsername = async () => {
    reset();
    if (newUsername.trim().length < 3 || newUsername.trim().length > 30) { setError('Benutzername muss 3–30 Zeichen lang sein.'); return; }
    if (!/^[a-zA-Z0-9_\-]+$/.test(newUsername.trim())) { setError('Nur Buchstaben, Zahlen, _ und - erlaubt.'); return; }
    setLoading(true);
    try {
      const updated = await updateProfile({ username: newUsername.trim() });
      onUpdated(updated);
      setSuccess('Benutzername gespeichert!');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassword = async () => {
    reset();
    if (newPassword.length < 4) { setError('Passwort muss mind. 4 Zeichen haben.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwörter stimmen nicht überein.'); return; }
    setLoading(true);
    try {
      await updateProfile({ password: newPassword });
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Passwort geändert!');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== user.username) { setError('Benutzername stimmt nicht überein.'); return; }
    reset();
    setLoading(true);
    try {
      await deleteAccount();
      await logoutUser().catch(() => {});
      onDeleted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fehler');
      setLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'avatar', label: 'Bild', icon: <Camera className="w-4 h-4" /> },
    { id: 'username', label: 'Name', icon: <UserIcon className="w-4 h-4" /> },
    { id: 'password', label: 'Passwort', icon: <Lock className="w-4 h-4" /> },
    { id: 'delete', label: 'Löschen', icon: <Trash2 className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <img src={resolveAvatar(user.avatar)} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-indigo-100 object-cover" />
            <div>
              <p className="font-black text-slate-900">{user.username}</p>
              <p className="text-xs text-slate-400">Profil bearbeiten</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); reset(); }}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-bold transition-colors ${
                tab === t.id
                  ? t.id === 'delete' ? 'text-rose-600 border-b-2 border-rose-500' : 'text-indigo-600 border-b-2 border-indigo-500'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5">

          {error && (
            <div className="mb-4 px-3 py-2 bg-rose-50 text-rose-600 text-sm rounded-lg">{error}</div>
          )}
          {success && (
            <div className="mb-4 px-3 py-2 bg-emerald-50 text-emerald-600 text-sm rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4" /> {success}
            </div>
          )}

          {/* Avatar Tab */}
          {tab === 'avatar' && (
            <div className="flex flex-col items-center gap-4">
              {/* Preview */}
              <div
                className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-indigo-100 cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <img src={resolveAvatar(preview)} alt="Vorschau" className="w-full h-full object-contain bg-slate-50" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-7 h-7 text-white" />
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 hover:border-indigo-400 text-slate-500 hover:text-indigo-600 rounded-xl text-sm font-medium transition-all"
              >
                <Upload className="w-4 h-4" />
                Foto auswählen
              </button>

              {selectedFile && (
                <p className="text-xs text-slate-400 truncate max-w-full px-2">{selectedFile.name}</p>
              )}

              <button
                onClick={handleSaveAvatar}
                disabled={loading || !selectedFile}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? 'Hochladen...' : 'Speichern'}
              </button>
            </div>
          )}

          {/* Username Tab */}
          {tab === 'username' && (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="Neuer Benutzername"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button
                onClick={handleSaveUsername}
                disabled={loading || newUsername.trim() === user.username}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          )}

          {/* Password Tab */}
          {tab === 'password' && (
            <div className="flex flex-col gap-3">
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Neues Passwort"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Passwort bestätigen"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button
                onClick={handleSavePassword}
                disabled={loading || !newPassword}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? 'Ändern...' : 'Passwort ändern'}
              </button>
            </div>
          )}

          {/* Delete Tab */}
          {tab === 'delete' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 p-3 bg-rose-50 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-rose-700">
                  Dein Account wird <strong>unwiderruflich</strong> gelöscht. Alle Daten, Challenges und Freundschaften werden entfernt.
                </p>
              </div>
              <p className="text-sm text-slate-500">Bestätige mit deinem Benutzernamen:</p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={user.username}
                className="w-full px-4 py-2.5 border border-rose-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
              <button
                onClick={handleDelete}
                disabled={loading || deleteConfirm !== user.username}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? 'Wird gelöscht...' : 'Account löschen'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
