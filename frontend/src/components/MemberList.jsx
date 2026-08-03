import { colorForName, initialsForName } from '../utils/avatar';

// Affiche les utilisateurs actuellement connectés au salon (présence socket).
// Pas encore la liste complète des membres du serveur avec leurs rôles :
// ça demanderait un nouvel endpoint backend (voir explication).
export default function MemberList({ onlineUsers }) {
  return (
    <div className="w-60 shrink-0 h-full overflow-y-auto px-3 py-4" style={{ backgroundColor: '#1a1c22' }}>
      <p className="px-1 mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
        En ligne — {onlineUsers.length}
      </p>
      <div className="space-y-1">
        {onlineUsers.length === 0 && (
          <p className="px-1 text-sm text-gray-500">Personne d'autre pour l'instant.</p>
        )}
        {onlineUsers.map((user) => (
          <div
            key={user.userId}
            className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-white/5 transition-colors"
          >
            <div className="relative shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: colorForName(user.username) }}
              >
                {initialsForName(user.username)}
              </div>
              <span
                className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                style={{ backgroundColor: '#3ba55d', borderColor: '#1a1c22' }}
              />
            </div>
            <span className="text-sm truncate text-white">{user.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
}