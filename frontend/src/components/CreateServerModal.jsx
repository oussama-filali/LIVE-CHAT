import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { useServerStore } from '../store/serverStore';

export default function CreateServerModal({ onClose }) {
  const [mode, setMode] = useState('create');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdServer, setCreatedServer] = useState(null); // serveur qu'on vient de créer
  const [isCopied, setIsCopied] = useState(false);

  const createServer = useServerStore((state) => state.createServer);
  const joinServer = useServerStore((state) => state.joinServer);
  const error = useServerStore((state) => state.error);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const result =
      mode === 'create' ? await createServer(name.trim()) : await joinServer(inviteCode.trim());

    setIsSubmitting(false);

    if (result.success) {
      if (mode === 'create') {
        // On ne ferme pas tout de suite : on affiche le code d'invitation
        setCreatedServer(result.server);
      } else {
        onClose();
      }
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(createdServer.inviteCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (createdServer) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-6 border relative"
          style={{ backgroundColor: '#20232a', borderColor: '#2b2f38' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <p className="text-white font-semibold mb-1">"{createdServer.name}" est créé !</p>
          <p className="text-gray-400 text-sm mb-4">
            Partage ce code pour inviter des gens sur ton serveur.
          </p>

          <div
            className="flex items-center justify-between gap-2 rounded-lg px-4 py-3 border"
            style={{ backgroundColor: '#16181d', borderColor: '#2b2f38' }}
          >
            <span className="text-white text-sm font-mono truncate">{createdServer.inviteCode}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 p-1.5 rounded-md hover:bg-white/5 transition-colors"
              style={{ color: isCopied ? '#3ba55d' : '#8a8f9d' }}
              title="Copier le code"
            >
              {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full text-white font-semibold py-3 rounded-lg mt-4"
            style={{ backgroundColor: '#5b6cf9' }}
          >
            Terminer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 border relative"
        style={{ backgroundColor: '#20232a', borderColor: '#2b2f38' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex p-1 rounded-xl mb-5" style={{ backgroundColor: '#16181d' }}>
          <button
            type="button"
            onClick={() => setMode('create')}
            className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200"
            style={{
              backgroundColor: mode === 'create' ? '#5b6cf9' : 'transparent',
              color: mode === 'create' ? '#ffffff' : '#8a8f9d',
            }}
          >
            Créer
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className="flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200"
            style={{
              backgroundColor: mode === 'join' ? '#5b6cf9' : 'transparent',
              color: mode === 'join' ? '#ffffff' : '#8a8f9d',
            }}
          >
            Rejoindre
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'create' ? (
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Nom du serveur
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Mon super serveur"
                className="w-full rounded-lg px-4 py-3 text-white text-sm outline-none border placeholder-gray-600"
                style={{ backgroundColor: '#16181d', borderColor: '#2b2f38' }}
              />
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Code d'invitation
              </label>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                placeholder="ex : aZ3kT9"
                className="w-full rounded-lg px-4 py-3 text-white text-sm outline-none border placeholder-gray-600"
                style={{ backgroundColor: '#16181d', borderColor: '#2b2f38' }}
              />
            </div>
          )}

          {error && (
            <div
              className="text-xs rounded-lg px-3 py-2 border"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-white font-semibold py-3 rounded-lg disabled:opacity-60"
            style={{ backgroundColor: '#5b6cf9' }}
          >
            {isSubmitting ? 'Chargement...' : mode === 'create' ? 'Créer le serveur' : 'Rejoindre'}
          </button>
        </form>
      </div>
    </div>
  );
}