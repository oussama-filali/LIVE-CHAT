import { useState, useRef } from 'react';
import { Hash, Search, Send, Plus } from 'lucide-react';
import { colorForName, initialsForName } from '../utils/avatar';

export default function ChatArea({ channelName, messages, onSendMessage, typingUsers, onTyping, onStopTyping }) {
  const [draft, setDraft] = useState('');
  const typingTimeoutRef = useRef(null);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setDraft(val);

    if (onTyping) {
      onTyping();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (onStopTyping) {
        onStopTyping();
      }
    }, 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    if (onStopTyping) {
      onStopTyping();
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    onSendMessage(text);
    setDraft('');
  };

  const handleBlur = () => {
    if (onStopTyping) {
      onStopTyping();
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: '#20232a' }}>
      <div
        className="h-12 shrink-0 flex items-center justify-between px-4 border-b"
        style={{ borderColor: '#111217' }}
      >
        <div className="flex items-center gap-2 text-white text-sm font-semibold min-w-0">
          <Hash className="w-4 h-4 text-gray-500 shrink-0" />
          <span className="truncate">{channelName}</span>
        </div>
        <div
          className="flex items-center gap-2 rounded-md px-2 py-1 border shrink-0"
          style={{ backgroundColor: '#16181d', borderColor: '#2b2f38' }}
        >
          <input
            type="text"
            placeholder="Rechercher"
            className="bg-transparent text-xs text-white placeholder-gray-500 outline-none w-32"
          />
          <Search className="w-3.5 h-3.5 text-gray-500" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2b2f38' }}>
              <Hash className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-white font-semibold">Bienvenue dans #{channelName}</p>
            <p className="text-gray-500 text-sm">C'est le début de ce salon. Envoie le premier message.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg._id} className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: colorForName(msg.senderName) }}
              >
                {initialsForName(msg.senderName)}
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-white text-sm font-semibold">{msg.senderName}</span>
                  <span className="text-[11px] text-gray-500">
                    {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-gray-300 text-sm break-words">{msg.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Indicateur de saisie */}
      {typingUsers && typingUsers.length > 0 && (
        <div className="px-4 pb-1 text-xs text-gray-400 italic flex items-center gap-1.5 text-left">
          <div className="flex gap-0.5">
            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <span>
            {typingUsers.map((u) => u.username).join(', ')} 
            {typingUsers.length === 1 ? " est en train d'écrire..." : " sont en train d'écrire..."}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="px-4 pb-4">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ backgroundColor: '#2b2f38' }}>
          <button type="button" className="text-gray-400 hover:text-gray-200 transition-colors shrink-0">
            <Plus className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={draft}
            onChange={handleInputChange}
            onBlur={handleBlur}
            placeholder={`Envoyer un message à #${channelName}`}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
          />
          <button type="submit" className="shrink-0 text-white rounded-md p-1.5" style={{ backgroundColor: '#5b6cf9' }}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}