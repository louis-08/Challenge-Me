import React, { useState } from 'react';
import { Zap, ArrowRight, Loader2 } from 'lucide-react';
import { loginUser, registerUser } from '../services/storageService';
import { User } from '../types';

interface AuthScreenProps {
  onSuccess: (user: User) => void;
  onPlayLocal?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess, onPlayLocal }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let user;
      if (isLogin) {
        user = await loginUser(username, password);
      } else {
        user = await registerUser(username, password);
      }
      onSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-8 pb-0 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 -rotate-12 transform">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold italic text-slate-800 tracking-tight uppercase">
              CHALLENGE<span className="text-indigo-600">ME</span>
            </h1>
          </div>
          <p className="text-slate-500 mt-2">
            Challenge deine Freunde und lacht euch kaputt!
          </p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Benutzername</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="Dein Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Passwort</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-lg">
                {error}
              </div>
            )}

            {!isLogin && (
              <p className="text-xs text-slate-500 text-center">
                Hiermit akzeptierst du die{' '}
                <a
                  href="/AGB.md"
                  download="AGB_ChallengeMe.md"
                  className="text-indigo-600 font-medium hover:underline"
                >
                  AGBs
                </a>
                .
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:active:scale-100"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {isLogin ? 'Einloggen' : 'Konto erstellen'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {onPlayLocal && (
            <div className="mt-6 space-y-4">
              
              <div className="text-center text-sm text-slate-600">
                <span>{isLogin ? 'Noch kein Konto?' : 'Bereits dabei?'}</span>
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError(null);
                  }}
                  className="ml-2 text-indigo-600 font-medium hover:underline focus:outline-none"
                >
                  {isLogin ? 'Registrieren' : 'Anmelden'}
                </button>
              </div>

              <hr className="border-slate-200" />

              <button
                type="button"
                onClick={onPlayLocal}
                className="
                  w-full
                  py-3
                  bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500
                  hover:opacity-90
                  text-white
                  font-bold
                  rounded-xl
                  shadow-md
                  transition-all
                  flex
                  items-center
                  justify-center
                  gap-2
                "
              >
                Lokal spielen – ohne Login →
              </button>
            </div>
          )}
          
        </div>
        
      </div>
    </div>
  );
};