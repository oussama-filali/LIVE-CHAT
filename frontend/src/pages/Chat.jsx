import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, 
  Search, 
  Trash2, 
  Send, 
  MessageSquare, 
  User, 
  X,
  Loader2
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { getSocket } from '../services/socket';

export default function Chat() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  // États locaux
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Sockets & Refs
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const activeChatRef = useRef(null);

  // Synchroniser la ref activeChat avec l'état activeChat pour l'utiliser dans les callbacks socket
  useEffect(() => {
    activeChatRef.current = activeChat;
    setIsRecipientTyping(false); // Reset l'indicateur lors du changement de chat
  }, [activeChat]);

  // 1. Initialisation du Socket et récupération des conversations actives
  useEffect(() => {
    fetchConversations();

    const socket = getSocket();
    socketRef.current = socket;
    socket.connect();

    // Gestion de la réception de nouveaux messages privés
    socket.on('receive_private_message', (message) => {
      const currentActive = activeChatRef.current;

      // Si le message appartient à la conversation active, on l'ajoute
      if (currentActive && message.conversationId === currentActive.id) {
        setMessages((prev) => {
          // Éviter les doublons si le message a déjà été ajouté
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
      }

      // Mettre à jour la liste des conversations locales
      setConversations((prevConversations) => {
        const index = prevConversations.findIndex((c) => c.id === message.conversationId);
        if (index !== -1) {
          // On met à jour le dernier message et on déplace la conversation en haut
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
          // Remonter la conversation en haut de liste
          const item = updated.splice(index, 1)[0];
          return [item, ...updated];
        } else {
          // Si la conversation n'est pas présente dans la liste, on recharge tout
          fetchConversations();
          return prevConversations;
        }
      });
    });

    // Gestion de l'indicateur d'écriture
    socket.on('user_typing', (data) => {
      const currentActive = activeChatRef.current;
      if (currentActive && data.conversationId === currentActive.id && data.userId !== user?.id) {
        setIsRecipientTyping(true);
      }
    });

    socket.on('user_stop_typing', (data) => {
      const currentActive = activeChatRef.current;
      if (currentActive && data.conversationId === currentActive.id && data.userId !== user?.id) {
        setIsRecipientTyping(false);
      }
    });

    // Ping régulier pour maintenir la présence active
    const pingInterval = setInterval(() => {
      socket.emit('ping');
    }, 15000);

    return () => {
      clearInterval(pingInterval);
      if (socket) {
        socket.off('receive_private_message');
        socket.off('user_typing');
        socket.off('user_stop_typing');
        socket.disconnect();
      }
    };
  }, [user?.id]);

  // 2. Faire défiler la zone de messages vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRecipientTyping]);

  // Récupérer la liste des conversations actives
  const fetchConversations = async () => {
    try {
      const res = await api.get('/api/conversations');
      setConversations(res.data);
    } catch (err) {
      console.error('Erreur récupération conversations', err);
    }
  };

  // Récupérer les messages de la conversation sélectionnée
  const fetchMessages = async (convId) => {
    setLoadingMessages(true);
    try {
      const res = await api.get(`/api/conversations/${convId}/messages`);
      setMessages(res.data);
    } catch (err) {
      console.error('Erreur récupération messages', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // 3. Barre de recherche : recherche d'utilisateurs en temps réel
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
    }, 300); // 300ms de debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Lancer/Sélectionner une conversation avec un utilisateur recherché
  const startConversation = async (recipientId) => {
    try {
      const res = await api.post('/api/conversations', { recipientId });
      const newConv = res.data;

      // Ajouter à la liste locale si elle n'existe pas déjà
      setConversations((prev) => {
        if (prev.some((c) => c.id === newConv.id)) return prev;
        return [newConv, ...prev];
      });

      // Sélectionner la conversation active
      selectConversation(newConv);
      
      // Vider l'input et les résultats de recherche
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('Erreur création conversation', err);
    }
  };

  // Sélectionner une conversation de la liste
  const selectConversation = (conv) => {
    setActiveChat(conv);
    fetchMessages(conv.id);
  };

  // Suppression (soft-delete / masquage) d'une conversation
  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation(); // Éviter de sélectionner la conversation lors du clic sur la poubelle

    if (!confirm('Voulez-vous vraiment supprimer cette conversation ? Elle sera masquée de votre côté.')) {
      return;
    }

    try {
      await api.delete(`/api/conversations/${convId}`);
      
      // Retirer de la liste locale
      setConversations((prev) => prev.filter((c) => c.id !== convId));

      // Désélectionner si c'était le chat actif
      if (activeChat && activeChat.id === convId) {
        setActiveChat(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Erreur suppression conversation', err);
    }
  };

  // 4. Gestion de l'indicateur "en train d'écrire..."
  const handleTyping = () => {
    if (!activeChat || !socketRef.current) return;

    // Si on n'était pas déjà marqué en train de taper
    socketRef.current.emit('typing', {
      conversationId: activeChat.id,
      recipientId: activeChat.recipient.id,
    });

    // Reset le timeout d'inactivité
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Programmer un arrêt automatique après 2 secondes d'inactivité
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const stopTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (activeChat && socketRef.current) {
      socketRef.current.emit('stop_typing', {
        conversationId: activeChat.id,
        recipientId: activeChat.recipient.id,
      });
    }
  };

  // 5. Envoi d'un message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !activeChat || !socketRef.current) return;

    // Arrêter d'écrire immédiatement
    stopTyping();

    // Émettre le message via Sockets
    socketRef.current.emit('send_private_message', {
      conversationId: activeChat.id,
      recipientId: activeChat.recipient.id,
      content: messageText.trim(),
    });

    setMessageText('');
  };

  // Gérer la déconnexion
  const handleLogout = async () => {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
      await logout();
      navigate('/auth');
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#111217] overflow-hidden text-gray-200">
      
      {/* 1. BARRE LATÉRALE (SIDEBAR) */}
      <aside className="w-80 border-r border-[#2b2f38] flex flex-col bg-[#1e2027] h-full shrink-0">
        
        {/* Profil de l'utilisateur connecté */}
        <div className="p-4 border-b border-[#2b2f38] flex items-center justify-between bg-[#16181d]">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-[#5b6cf9] flex items-center justify-center font-bold text-white shrink-0 uppercase shadow-md">
              {user?.username?.substring(0, 2) || <User size={20} />}
            </div>
            <div className="overflow-hidden">
              <h3 className="font-semibold text-sm text-white truncate">{user?.username}</h3>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            title="Déconnexion"
            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Barre de recherche d'utilisateurs */}
        <div className="p-4 border-b border-[#2b2f38] relative bg-[#1c1e24]">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher un pseudo ou e-mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111217] border border-[#2b2f38] rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#5b6cf9] transition-all"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              <Search size={14} />
            </div>
            {searchQuery && (
              <button 
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Résultats de la recherche (Dropdown flottant ou liste) */}
          {searchQuery.trim() && (
            <div className="absolute left-4 right-4 mt-2 bg-[#20232a] border border-[#2b2f38] rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-[#2b2f38]">
              {isSearching ? (
                <div className="p-4 flex items-center justify-center text-xs text-gray-400 space-x-2">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Recherche en cours...</span>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((u) => (
                  <div 
                    key={u.id}
                    onClick={() => startConversation(u.id)}
                    className="p-3 flex items-center justify-between hover:bg-[#2b2f38] cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      <div className="w-8 h-8 rounded-lg bg-[#3b414e] flex items-center justify-center text-xs text-white font-semibold uppercase">
                        {u.username.substring(0, 2)}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold text-white truncate">{u.username}</p>
                        <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-[#5b6cf9]/20 text-[#5b6cf9] px-2 py-0.5 rounded font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Discuter
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-gray-400">
                  Aucun utilisateur trouvé
                </div>
              )}
            </div>
          )}
        </div>

        {/* Liste des conversations privées actives */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            CONVERSATIONS PRIVÉES
          </div>

          {conversations.length > 0 ? (
            conversations.map((conv) => {
              const isSelected = activeChat?.id === conv.id;
              const hasLastMessage = !!conv.lastMessage;
              const otherUser = conv.recipient;

              return (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`group p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-[#5b6cf9] text-white shadow-lg' 
                      : 'hover:bg-[#20232a] text-gray-300'
                  }`}
                  style={isSelected ? { boxShadow: '0 8px 15px -4px rgba(91, 108, 249, 0.3)' } : {}}
                >
                  <div className="flex items-center space-x-3 overflow-hidden mr-2">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold shrink-0 uppercase shadow-inner ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#2b2f38] text-gray-300'
                    }`}>
                      {otherUser?.username?.substring(0, 2) || <User size={16} />}
                    </div>
                    <div className="overflow-hidden">
                      <p className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-white'}`}>
                        {otherUser?.username || 'Utilisateur inconnu'}
                      </p>
                      <p className={`text-[11px] truncate ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                        {hasLastMessage ? conv.lastMessage.content : 'Aucun message'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                    title="Supprimer la conversation"
                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                      isSelected 
                        ? 'text-white/60 hover:text-white hover:bg-white/10' 
                        : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-gray-400">
              <MessageSquare size={24} className="mx-auto mb-2 text-gray-500 stroke-1" />
              <span>Vous n'avez pas encore de conversation active. Utilisez la barre de recherche ci-dessus pour trouver un correspondant.</span>
            </div>
          )}
        </div>
      </aside>

      {/* 2. ZONE DE CHAT PRINCIPALE (CHATAREA) */}
      <main className="flex-1 flex flex-col bg-[#111217] h-full min-w-0">
        {activeChat ? (
          <>
            {/* En-tête du Chat */}
            <header className="h-16 border-b border-[#2b2f38] px-6 flex items-center bg-[#16181d]">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-[#2b2f38] flex items-center justify-center font-bold text-white shrink-0 uppercase">
                  {activeChat.recipient?.username?.substring(0, 2) || <User size={18} />}
                </div>
                <div>
                  <h2 className="font-semibold text-sm text-white">{activeChat.recipient?.username}</h2>
                  <p className="text-[10px] text-gray-400">Discussion privée sécurisée</p>
                </div>
              </div>
            </header>

            {/* Zone d'affichage des messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingMessages ? (
                <div className="h-full flex flex-col items-center justify-center text-xs text-gray-400 space-y-2">
                  <Loader2 size={24} className="animate-spin text-[#5b6cf9]" />
                  <span>Chargement des messages...</span>
                </div>
              ) : messages.length > 0 ? (
                messages.map((m) => {
                  const isOwnMessage = m.senderId === user?.id;
                  const time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div 
                      key={m._id} 
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-md flex flex-col ${
                        isOwnMessage 
                          ? 'bg-[#5b6cf9] text-white rounded-tr-none' 
                          : 'bg-[#1e2027] text-gray-200 rounded-tl-none border border-[#2b2f38]'
                      }`}>
                        {!isOwnMessage && (
                          <span className="text-[10px] font-bold text-[#5b6cf9] mb-0.5">
                            {m.senderName}
                          </span>
                        )}
                        <p className="text-xs break-words leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        <span className={`text-[9px] mt-1 text-right self-end block ${
                          isOwnMessage ? 'text-white/60' : 'text-gray-400'
                        }`}>
                          {time}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs text-gray-400">
                  <MessageSquare size={36} className="text-gray-500 mb-2 stroke-1" />
                  <p className="font-semibold text-white">Aucun message pour l'instant</p>
                  <p className="mt-1 text-gray-400">Envoyez un message pour démarrer la conversation avec {activeChat.recipient?.username}.</p>
                </div>
              )}

              {/* Indicateur de saisie */}
              {isRecipientTyping && (
                <div className="flex justify-start">
                  <div className="bg-[#1e2027] border border-[#2b2f38] text-gray-400 rounded-2xl rounded-tl-none px-4 py-2 text-xs flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span>{activeChat.recipient?.username} est en train d'écrire...</span>
                  </div>
                </div>
              )}

              {/* Point de scroll automatique */}
              <div ref={messagesEndRef} />
            </div>

            {/* Zone de saisie */}
            <div className="p-4 border-t border-[#2b2f38] bg-[#16181d]">
              <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                <input
                  type="text"
                  placeholder={`Écrire à ${activeChat.recipient?.username}...`}
                  value={messageText}
                  onChange={(e) => {
                    setMessageText(e.target.value);
                    handleTyping();
                  }}
                  onBlur={stopTyping}
                  className="flex-1 bg-[#111217] border border-[#2b2f38] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#5b6cf9] transition-all"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim()}
                  className="p-3 bg-[#5b6cf9] hover:bg-[#4b5be4] text-white rounded-xl transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  style={{ boxShadow: '0 4px 12px rgba(91, 108, 249, 0.3)' }}
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-grid-pattern">
            <div 
              className="w-16 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
              style={{ backgroundColor: '#1e2027', border: '1px solid #2b2f38' }}
            >
              <MessageSquare className="w-8 h-8 text-[#5b6cf9] stroke-1" />
            </div>
            <h2 className="text-lg font-bold text-white">Vos messages privés</h2>
            <p className="text-xs text-gray-400 mt-1 max-w-[320px] leading-relaxed">
              Sélectionnez une conversation dans la liste latérale ou recherchez un ami pour commencer à discuter en temps réel.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
