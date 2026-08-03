import { MessageSquare, Plus } from 'lucide-react';
import { colorForName, initialsForName } from '../utils/avatar';

export default function ServerRail({ servers, activeServerId, onSelectServer, onAddServer }) {
  return (
    <div
      className="w-[72px] shrink-0 h-full flex flex-col items-center py-3 gap-2 overflow-y-auto"
      style={{ backgroundColor: '#0d0e12' }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: '#5b6cf9' }}
        title="Live Chat"
      >
        <MessageSquare className="w-6 h-6 text-white fill-current" />
      </div>

      <div className="w-8 h-[2px] rounded-full shrink-0" style={{ backgroundColor: '#2b2f38' }} />

      {servers.map((server) => {
        const isActive = server.id === activeServerId;
        return (
          <button
            key={server.id}
            type="button"
            onClick={() => onSelectServer(server.id)}
            title={server.name}
            className="relative w-12 h-12 flex items-center justify-center text-white text-xs font-bold shrink-0 transition-all duration-200"
            style={{
              backgroundColor: colorForName(server.name),
              borderRadius: isActive ? '16px' : '24px',
            }}
          >
            <span
              className="absolute -left-[14px] rounded-r-full transition-all duration-200"
              style={{
                width: '4px',
                height: isActive ? '28px' : '0px',
                backgroundColor: '#ffffff',
              }}
            />
            {initialsForName(server.name)}
          </button>
        );
      })}

      <button
        type="button"
        onClick={onAddServer}
        className="w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 transition-colors duration-200"
        style={{ backgroundColor: '#16181d', borderColor: '#2b2f38', color: '#5b6cf9' }}
        title="Ajouter un serveur"
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
}