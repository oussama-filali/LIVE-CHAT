import { useEffect, useState } from 'react';
import ServerRail from '../components/ServerRail';
import ChannelSidebar from '../components/ChannelSidebar';
import ChatArea from '../components/ChatArea';
import MemberList from '../components/MemberList';
import CreateServerModal from '../components/CreateServerModal';
import { useServerStore } from '../store/serverStore';
import { useChatStore } from '../store/chatStore';

function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center text-white" style={{ backgroundColor: '#111217' }}>
      Chargement...
    </div>
  );
}

export default function Home() {
  const {
    servers,
    activeServerId,
    activeChannelId,
    isLoading,
    fetchServers,
    selectServer,
    selectChannel,
    createChannel,
  } = useServerStore();

  const { connect, joinChannel, messagesByChannel, onlineUsersByChannel, sendMessage } = useChatStore();

  const [showServerModal, setShowServerModal] = useState(false);

  useEffect(() => {
    fetchServers();
    connect();
  }, [fetchServers, connect]);

  useEffect(() => {
    if (activeChannelId) {
      joinChannel(activeChannelId);
    }
  }, [activeChannelId, joinChannel]);

  // Le contenu principal change selon l'état (chargement / aucun serveur / app),
  // mais la modale est rendue une seule fois, à un endroit stable, en dehors
  // de ce switch : comme ça React ne la démonte/remonte jamais entre-temps,
  // et son état interne (ex: le code d'invitation affiché) n'est pas perdu.
  let content;

  if (isLoading) {
    content = <LoadingScreen />;
  } else if (servers.length === 0) {
    content = (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 text-white" style={{ backgroundColor: '#111217' }}>
        <p className="text-gray-400">Tu n'as encore rejoint aucun serveur.</p>
        <button
          type="button"
          onClick={() => setShowServerModal(true)}
          className="px-4 py-2.5 rounded-lg font-semibold"
          style={{ backgroundColor: '#5b6cf9' }}
        >
          Créer ou rejoindre un serveur
        </button>
      </div>
    );
  } else {
    const activeMembership = servers.find((m) => m.server.id === activeServerId);
    const activeServer = activeMembership?.server;
    const activeChannel = activeServer?.channels.find((c) => c.id === activeChannelId);

    const channelMessages = messagesByChannel[activeChannelId] || [];
    const onlineUsers = onlineUsersByChannel[activeChannelId] || [];

    content = (
      <div className="h-screen w-screen flex overflow-hidden" style={{ backgroundColor: '#111217' }}>
        <ServerRail
          servers={servers.map((m) => m.server)}
          activeServerId={activeServerId}
          onSelectServer={selectServer}
          onAddServer={() => setShowServerModal(true)}
        />
        <ChannelSidebar
          serverName={activeServer?.name}
          channels={activeServer?.channels || []}
          activeChannelId={activeChannelId}
          onSelectChannel={selectChannel}
          onCreateChannel={createChannel}
        />
        <ChatArea
          channelName={activeChannel?.name || ''}
          messages={channelMessages}
          onSendMessage={(text) => sendMessage(activeChannelId, text)}
        />
        <MemberList onlineUsers={onlineUsers} />
      </div>
    );
  }

  return (
    <>
      {content}
      {showServerModal && <CreateServerModal onClose={() => setShowServerModal(false)} />}
    </>
  );
}