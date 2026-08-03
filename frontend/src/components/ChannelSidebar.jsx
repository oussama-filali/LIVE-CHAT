import { useState } from 'react';
import { ChevronDown, Hash, Volume2, Plus } from 'lucide-react';
import UserBar from './UserBar';

function ChannelSection({ title, channels, type, activeChannelId, onSelectChannel, onCreateChannel }) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');

  const filtered = channels.filter((c) => c.type === type);

  const handleCreate = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateChannel(trimmed, type);
    setName('');
    setIsAdding(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between px-2 mb-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{title}</p>
        <button
          type="button"
          onClick={() => setIsAdding((v) => !v)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          title={`Ajouter un salon ${type === 'VOICE' ? 'vocal' : 'texte'}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="px-2 mb-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => !name && setIsAdding(false)}
            placeholder="nom-du-salon"
            className="w-full text-xs rounded-md px-2 py-1.5 text-white outline-none border placeholder-gray-600"
            style={{ backgroundColor: '#111217', borderColor: '#2b2f38' }}
          />
        </form>
      )}

      <div className="space-y-0.5">
        {filtered.map((channel) => {
          const isActive = channel.id === activeChannelId;
          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => onSelectChannel(channel.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors duration-150"
              style={{
                backgroundColor: isActive ? '#2b2f38' : 'transparent',
                color: isActive ? '#ffffff' : '#8a8f9d',
              }}
            >
              {type === 'VOICE' ? (
                <Volume2 className="w-4 h-4 shrink-0" />
              ) : (
                <Hash className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate">{channel.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ChannelSidebar({ serverName, channels, activeChannelId, onSelectChannel, onCreateChannel }) {
  return (
    <div className="w-60 shrink-0 h-full flex flex-col" style={{ backgroundColor: '#1a1c22' }}>
      <div
        className="h-12 shrink-0 flex items-center justify-between px-4 border-b cursor-pointer"
        style={{ borderColor: '#111217' }}
      >
        <span className="text-white font-semibold text-sm truncate">{serverName}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        <ChannelSection
          title="Salons texte"
          channels={channels}
          type="TEXT"
          activeChannelId={activeChannelId}
          onSelectChannel={onSelectChannel}
          onCreateChannel={onCreateChannel}
        />
        <ChannelSection
          title="Salons vocaux"
          channels={channels}
          type="VOICE"
          activeChannelId={activeChannelId}
          onSelectChannel={onSelectChannel}
          onCreateChannel={onCreateChannel}
        />
      </div>

      <UserBar />
    </div>
  );
}