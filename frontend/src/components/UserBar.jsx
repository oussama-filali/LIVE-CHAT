import { Mic, Headphones, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { colorForName, initialsForName } from '../utils/avatar';

export default function UserBar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const username = user?.username || '...';

  return (
    <div className="h-14 shrink-0 flex items-center gap-2 px-2" style={{ backgroundColor: '#16181d' }}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ backgroundColor: colorForName(username) }}
      >
        {initialsForName(username)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-semibold truncate">{username}</p>
        <p className="text-[11px] truncate" style={{ color: '#3ba55d' }}>En ligne</p>
      </div>

      <button
        type="button"
        className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
        style={{ color: '#8a8f9d' }}
        title="Micro (bientôt disponible)"
      >
        <Mic className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
        style={{ color: '#8a8f9d' }}
        title="Casque (bientôt disponible)"
      >
        <Headphones className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={logout}
        className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
        style={{ color: '#8a8f9d' }}
        title="Déconnexion"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}
