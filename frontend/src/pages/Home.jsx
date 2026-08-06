import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, 
  Search, 
  Trash2, 
  Send, 
  MessageSquare, 
  User, 
  X,
  Loader2,
  Plus
} from 'lucide-react';
import ServerRail from '../components/ServerRail';
import ChannelSidebar from '../components/ChannelSidebar';
import ChatArea from '../components/ChatArea';
import MemberList from '../components/MemberList';
import CreateServerModal from '../components/CreateServerModal';
import { useServerStore } from '../store/serverStore';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { colorForName, initialsForName } from '../utils/avatar';

function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center text-white" style={{ backgroundColor: '#111217' }}>
      <Loader2 className="w-10 h-10 animate-spin text-[#5b6cf9]" />
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

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

  // --- États locaux pour la fonctionnalité de Chat Privé (Direct Messages) ---
  const [conversations, setConversations] = useState([]);
  const [activePrivateChat, setActivePrivateChat] = useState(null);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const [loadingPrivateMessages, setLoadingPrivateMessages] = useState(false);

  // --- États locaux pour le système d'invitations ---
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [showInviteDropdown, setShowInviteDropdown] = useState(false);
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState('');
  const [inviteErrorMessage, setInviteErrorMessage] = useState('');

  // Sockets & Refs pour les messages privés
  const typingTimeoutRef = useRef(null);
  const privateMessagesEndRef = useRef(null);
  const activePrivateChatRef = useRef(null);

  // Synchroniser la ref avec l'état
  useEffect(() => {
    activePrivateChatRef.current = activePrivateChat;
    setIsRecipientTyping(false); // Reset l'indicateur
  }, [activePrivateChat]);

  // 1. Démarrer la connexion Socket (Partagée avec useChatStore)
  useEffect(() => {
    fetchServers();
    connect(); // Connecte le socket via le store
  }, [fetchServers, connect]);

  // Sélection par défaut : si pas de serveur actif et que la liste est chargée
  useEffect(() => {
    if (!isLoading && activeServerId === null) {
      if (servers.length > 0) {
        // On sélectionne le premier serveur
        selectServer(servers[0].server.id);
      } else {
        // Aucun serveur disponible, on passe en mode Messages Privés par défaut
        selectServer('@me');
      }
    }
  }, [isLoading, servers, activeServerId, selectServer]);

  // Rejoindre un salon public s'il y en a un de sélectionné
  useEffect(() => {
    if (activeChannelId && activeServerId !== '@me') {
      joinChannel(activeChannelId);
    }
  }, [activeChannelId, activeServerId, joinChannel]);

  // 2. Écouter les événements temps réel du Chat Privé sur le Socket
  useEffect(() => {
    const socket = getSocket();

    const handleReceivePrivateMessage = (message) => {
      const currentActive = activePrivateChatRef.current;

      // Si le message appartient à la conversation active, on l'ajoute
      if (currentActive && message.conversationId === currentActive.id) {
        setPrivateMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
      }

      // Mettre à jour la liste des conversations
      setConversations((prevConversations) => {
        const index = prevConversations.findIndex((c) => c.id === message.conversationId);
        if (index !== -1) {
          const updated = [...prevConversations];
          updated[index] = {
            ...updated[index],
            lastMessage: {
              id: message._id,
              senderId: message.senderId,
              senderName: message.senderName,
              content: message.content,
              createdAt: message.createdAt,
            },
          };
          // Remonter la conversation en haut
          const item = updated.splice(index, 1)[0];
          return [item, ...updated];
        } else {
          fetchConversations();
          return prevConversations;
        }
      });
    };

    const handleUserTyping = (data) => {
      const currentActive = activePrivateChatRef.current;
      if (currentActive && data.conversationId === currentActive.id && data.userId !== user?.id) {
        setIsRecipientTyping(true);
      }
    };

    const handleUserStopTyping = (data) => {
      const currentActive = activePrivateChatRef.current;
      if (currentActive && data.conversationId === currentActive.id && data.userId !== user?.id) {
        setIsRecipientTyping(false);
      }
    };

    socket.on('receive_private_message', handleReceivePrivateMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);

    return () => {
      socket.off('receive_private_message', handleReceivePrivateMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
    };
  }, [user?.id]);

  // Faire défiler l'historique privé vers le bas
  useEffect(() => {
    privateMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [privateMessages, isRecipientTyping]);

  // Charger les conversations privées quand on passe sur l'onglet "@me"
  useEffect(() => {
    if (activeServerId === '@me') {
      fetchConversations();
      fetchPendingInvitations();
    }
  }, [activeServerId]);

  // Rechercher des utilisateurs
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(`/api/conversations/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data);
      } catch (err) {
        console.error('Erreur recherche utilisateurs', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // --- API Actions pour le Chat Privé ---

  const fetchConversations = async () => {
    try {
      const res = await api.get('/api/conversations');
      setConversations(res.data);
    } catch (err) {
      console.error('Erreur récupération conversations', err);
    }
  };

  const fetchPrivateMessages = async (convId) => {
    setLoadingPrivateMessages(true);
    try {
      const res = await api.get(`/api/conversations/${convId}/messages`);
      setPrivateMessages(res.data);
    } catch (err) {
      console.error('Erreur récupération messages privés', err);
    } finally {
      setLoadingPrivateMessages(false);
    }
  };

  const startConversation = async (recipientId) => {
    try {
      const res = await api.post('/api/conversations', { recipientId });
      const newConv = res.data;

      setConversations((prev) => {
        if (prev.some((c) => c.id === newConv.id)) return prev;
        return [newConv, ...prev];
      });

      selectConversation(newConv);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('Erreur création conversation', err);
    }
  };

  const selectConversation = (conv) => {
    setActivePrivateChat(conv);
    fetchPrivateMessages(conv.id);
  };

  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation();
    if (!confirm('Voulez-vous vraiment masquer cette conversation ?')) return;

    try {
      await api.delete(`/api/conversations/${convId}`);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activePrivateChat && activePrivateChat.id === convId) {
        setActivePrivateChat(null);
        setPrivateMessages([]);
      }
    } catch (err) {
      console.error('Erreur suppression conversation', err);
    }
  };

  const handleTyping = () => {
    if (!activePrivateChat) return;
    const socket = getSocket();
    socket.emit('typing', {
      conversationId: activePrivateChat.id,
      recipientId: activePrivateChat.recipient.id,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const stopTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (activePrivateChat) {
      const socket = getSocket();
      socket.emit('stop_typing', {
        conversationId: activePrivateChat.id,
        recipientId: activePrivateChat.recipient.id,
      });
    }
  };

  const handleSendPrivateMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !activePrivateChat) return;

    stopTyping();
    const socket = getSocket();
    socket.emit('send_private_message', {
      conversationId: activePrivateChat.id,
      recipientId: activePrivateChat.recipient.id,
      content: messageText.trim(),
    });

    setMessageText('');
  };

  const handleLogout = async () => {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
      await logout();
      navigate('/auth');
    }
  };

  // --- API Actions pour le système d'invitations ---

  const fetchPendingInvitations = async () => {
    try {
      const res = await api.get('/api/servers/invitations/pending');
      setPendingInvitations(res.data);
    } catch (err) {
      console.error('Erreur récupération invitations en attente', err);
    }
  };

  const handleRespondInvitation = async (id, accept) => {
    try {
      await api.post(`/api/servers/invitations/${id}/respond`, { accept });
      await fetchPendingInvitations();
      if (accept) {
        await fetchServers(); // Met à jour la liste des serveurs d'origine
      }
    } catch (err) {
      console.error('Erreur réponse invitation', err);
    }
  };

  const handleSendInvitation = async (serverId) => {
    if (!activePrivateChat) return;
    setInviteSuccessMessage('');
    setInviteErrorMessage('');
    try {
      await api.post('/api/servers/invitations/send', {
        serverId,
        receiverId: activePrivateChat.recipient.id
      });
      setInviteSuccessMessage('Invitation envoyée !');
      setTimeout(() => setShowInviteDropdown(false), 2000);
    } catch (err) {
      setInviteErrorMessage(err.response?.data?.error || 'Erreur lors de l\'envoi de l\'invitation');
    }
  };

  // --- Rendu JSX ---

  if (isLoading) {
    return <LoadingScreen />;
  }

  const isDM = activeServerId === '@me';

  return (
    <>
      <div className="h-screen w-screen flex overflow-hidden bg-[#111217]">
        {/* Barre des serveurs à l'extrême gauche (Toujours visible) */}
        <ServerRail
          servers={servers.map((m) => m.server)}
          activeServerId={activeServerId}
          onSelectServer={selectServer}
          onAddServer={() => setShowServerModal(true)}
        />

        {isDM ? (
          // --- LAYOUT CHAT PRIVÉ (Direct Messages) ---
          <div className="flex-1 flex overflow-hidden">
            {/* Barre latérale Direct Messages */}
            <aside className="w-60 shrink-0 h-full flex flex-col bg-[#1a1c22]">
              {/* Titre de l'espace */}
              <div className="h-12 shrink-0 flex items-center px-4 border-b border-[#111217]">
                <span className="text-white font-semibold text-sm">Messages privés</span>
              </div>

              {/* Recherche d'utilisateurs */}
              <div className="p-3 border-b border-[#111217] relative bg-[#131419]">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Chercher un ami..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#111217] border border-[#2b2f38] rounded-md pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#5b6cf9] transition-all"
                  />
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                    <Search size={12} />
                  </div>
                  {searchQuery && (
                    <button 
                      onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Dropdown de recherche flottant */}
                {searchQuery.trim() && (
                  <div className="absolute left-3 right-3 mt-1.5 bg-[#20232a] border border-[#2b2f38] rounded-md shadow-2xl z-50 max-h-52 overflow-y-auto divide-y divide-[#2b2f38]">
                    {isSearching ? (
                      <div className="p-3 flex items-center justify-center text-[10px] text-gray-400 gap-1.5">
                        <Loader2 size={12} className="animate-spin" />
                        <span>Recherche...</span>
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((u) => (
                        <div 
                          key={u.id}
                          onClick={() => startConversation(u.id)}
                          className="p-2.5 flex items-center justify-between hover:bg-[#2b2f38] cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="w-7 h-7 rounded-full bg-[#3b414e] flex items-center justify-center text-[10px] text-white font-semibold uppercase shrink-0">
                              {u.username.substring(0, 2)}
                            </div>
                            <div className="overflow-hidden text-left">
                              <p className="text-xs font-semibold text-white truncate">{u.username}</p>
                              <p className="text-[9px] text-gray-400 truncate">{u.email}</p>
                            </div>
                          </div>
                          <span className="text-[9px] bg-[#5b6cf9]/20 text-[#5b6cf9] px-1.5 py-0.5 rounded font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            Discuter
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-[10px] text-gray-400">
                        Aucun utilisateur trouvé
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Liste des invitations de serveurs en attente */}
              {pendingInvitations.length > 0 && (
                <div className="p-2 border-b border-[#111217] bg-[#1a1c22] max-h-48 overflow-y-auto space-y-1.5">
                  <p className="px-2 text-[9px] font-bold text-yellow-500 uppercase tracking-wider">
                    Invitations de serveurs ({pendingInvitations.length})
                  </p>
                  <div className="space-y-1.5">
                    {pendingInvitations.map((inv) => (
                      <div key={inv.id} className="p-2 rounded bg-[#20232a] text-[11px] flex flex-col gap-1.5 border border-[#2b2f38]">
                        <div className="text-left text-gray-300 leading-normal">
                          <span className="font-bold text-white">{inv.sender.username}</span> t'invite sur <span className="font-bold text-white">{inv.server.name}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleRespondInvitation(inv.id, true)}
                            className="flex-1 bg-[#5b6cf9] hover:bg-[#4b5be4] text-white py-1 rounded text-[10px] font-bold transition-all"
                          >
                            Accepter
                          </button>
                          <button
                            onClick={() => handleRespondInvitation(inv.id, false)}
                            className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-1 rounded text-[10px] font-bold border border-red-500/20 transition-all"
                          >
                            Refuser
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Liste des conversations actives */}
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                <p className="px-2 pt-1 pb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Discussions directes
                </p>

                {conversations.length > 0 ? (
                  conversations.map((conv) => {
                    const isSelected = activePrivateChat?.id === conv.id;
                    const otherUser = conv.recipient;

                    return (
                      <div
                        key={conv.id}
                        onClick={() => selectConversation(conv)}
                        className={`group p-2 rounded-md flex items-center justify-between cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-[#2b2f38] text-white' 
                            : 'hover:bg-[#20232a] text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden mr-1">
                          <div className="w-7 h-7 rounded-full bg-[#2b2f38] flex items-center justify-center text-[10px] text-white font-semibold uppercase shrink-0">
                            {otherUser?.username?.substring(0, 2) || <User size={12} />}
                          </div>
                          <div className="overflow-hidden text-left">
                            <p className="text-xs font-semibold text-white truncate">
                              {otherUser?.username || 'Utilisateur'}
                            </p>
                            <p className="text-[10px] text-gray-500 truncate">
                              {conv.lastMessage ? conv.lastMessage.content : 'Aucun message'}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDeleteConversation(e, conv.id)}
                          title="Masquer"
                          className="p-1 text-gray-500 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-gray-500">
                    Aucun chat actif. Recherchez un ami au-dessus pour lancer un chat !
                  </div>
                )}
              </div>

              {/* Profil de l'utilisateur connecté */}
              <div className="h-14 shrink-0 flex items-center justify-between px-3 bg-[#131419] border-t border-[#111217]">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-[#5b6cf9] flex items-center justify-center font-bold text-white shrink-0 uppercase text-xs">
                    {user?.username?.substring(0, 2)}
                  </div>
                  <div className="overflow-hidden text-left">
                    <p className="text-xs font-semibold text-white truncate">{user?.username}</p>
                    <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  title="Déconnexion"
                  className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors shrink-0"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </aside>

            {/* Zone d'affichage du Chat Privé */}
            <main className="flex-1 flex flex-col bg-[#20232a] h-full min-w-0">
              {activePrivateChat ? (
                <>
                  {/* En-tête avec bouton d'invitation de serveur */}
                  <header className="h-12 border-b border-[#111217] px-4 flex items-center justify-between bg-[#1a1c22]">
                    <div className="flex items-center gap-2 text-white text-sm font-semibold min-w-0">
                      <span className="text-gray-500">@</span>
                      <span className="truncate">{activePrivateChat.recipient?.username}</span>
                    </div>

                    {/* Système d'invitation de serveur */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowInviteDropdown(!showInviteDropdown);
                          setInviteSuccessMessage('');
                          setInviteErrorMessage('');
                        }}
                        className="text-xs bg-[#5b6cf9] hover:bg-[#4b5be4] text-white px-3 py-1.5 rounded font-bold transition-all flex items-center gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Inviter sur un serveur
                      </button>

                      {showInviteDropdown && (
                        <div className="absolute right-0 mt-2 w-56 bg-[#20232a] border border-[#2b2f38] rounded-md shadow-2xl z-50 p-2.5 text-xs text-left">
                          <p className="font-bold text-gray-400 mb-2 uppercase tracking-wide text-[9px]">Choisir un serveur</p>
                          
                          {inviteSuccessMessage && (
                            <p className="text-green-400 font-semibold mb-2">{inviteSuccessMessage}</p>
                          )}
                          {inviteErrorMessage && (
                            <p className="text-red-400 font-semibold mb-2">{inviteErrorMessage}</p>
                          )}

                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {servers.length > 0 ? (
                              servers.map((m) => (
                                <button
                                  key={m.server.id}
                                  onClick={() => handleSendInvitation(m.server.id)}
                                  className="w-full text-left p-1.5 rounded hover:bg-[#2b2f38] text-white truncate font-semibold flex items-center justify-between gap-2"
                                >
                                  <span className="truncate">{m.server.name}</span>
                                  <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">Inviter</span>
                                </button>
                              ))
                            ) : (
                              <p className="text-gray-500 text-[10px] py-1 text-center">Aucun serveur disponible</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </header>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {loadingPrivateMessages ? (
                      <div className="h-full flex flex-col items-center justify-center text-xs text-gray-500 gap-1.5">
                        <Loader2 size={20} className="animate-spin text-[#5b6cf9]" />
                        <span>Chargement...</span>
                      </div>
                    ) : privateMessages.length > 0 ? (
                      privateMessages.map((m) => {
                        const isOwn = m.senderId === user?.id;
                        return (
                          <div key={m._id} className="flex items-start gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ backgroundColor: colorForName(m.senderName) }}
                            >
                              {initialsForName(m.senderName)}
                            </div>
                            <div className="min-w-0 text-left">
                              <div className="flex items-baseline gap-2">
                                <span className="text-white text-sm font-semibold">{m.senderName}</span>
                                <span className="text-[11px] text-gray-500">
                                  {new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-gray-300 text-sm break-words leading-relaxed whitespace-pre-wrap">{m.content}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center gap-1.5">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2b2f38' }}>
                          <MessageSquare className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-white font-semibold">C'est le début de vos messages</p>
                        <p className="text-gray-500 text-xs">Dites bonjour à {activePrivateChat.recipient?.username} !</p>
                      </div>
                    )}

                    {/* Saisie en cours */}
                    {isRecipientTyping && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 italic">
                        <div className="flex gap-0.5">
                          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span>{activePrivateChat.recipient?.username} est en train d'écrire...</span>
                      </div>
                    )}
                    <div ref={privateMessagesEndRef} />
                  </div>

                  {/* Formulaire */}
                  <form onSubmit={handleSendPrivateMessage} className="px-4 pb-4">
                    <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ backgroundColor: '#2b2f38' }}>
                      <input
                        type="text"
                        value={messageText}
                        onChange={(e) => {
                          setMessageText(e.target.value);
                          handleTyping();
                        }}
                        onBlur={stopTyping}
                        placeholder={`Écrire à @${activePrivateChat.recipient?.username}`}
                        className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                      />
                      <button 
                        type="submit" 
                        disabled={!messageText.trim()}
                        className="shrink-0 text-white rounded-md p-1.5 disabled:opacity-50" 
                        style={{ backgroundColor: '#5b6cf9' }}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 bg-[#2b2f38]">
                    <MessageSquare className="w-7 h-7 text-[#5b6cf9]" />
                  </div>
                  <h2 className="text-white font-bold text-base">Vos messages privés</h2>
                  <p className="text-xs text-gray-500 mt-1 max-w-[280px]">
                    Sélectionnez une discussion à gauche ou cherchez un ami pour commencer à échanger instantanément !
                  </p>
                </div>
              )}
            </main>
          </div>
        ) : (
          // --- LAYOUT D'ORIGINE (SERVEURS & CANAUX PUBLICS) ---
          <div className="flex-1 flex overflow-hidden">
            {(() => {
              const activeMembership = servers.find((m) => m.server.id === activeServerId);
              const activeServer = activeMembership?.server;
              const activeChannel = activeServer?.channels.find((c) => c.id === activeChannelId);

              const channelMessages = messagesByChannel[activeChannelId] || [];
              const onlineUsers = onlineUsersByChannel[activeChannelId] || [];

              return (
                <>
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
                </>
              );
            })()}
          </div>
        )}
      </div>

      {showServerModal && <CreateServerModal onClose={() => setShowServerModal(false)} />}
    </>
  );
}
