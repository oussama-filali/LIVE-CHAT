import { create } from 'zustand';
import { getVoiceSocket } from '../services/voiceSocket';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function createPeerConnection(get, set, socketId) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  const localStream = get().localStream;
  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      getVoiceSocket().emit('signal', {
        targetSocketId: socketId,
        signalData: { type: 'ice-candidate', candidate: event.candidate },
      });
    }
  };

  pc.ontrack = (event) => {
    set((state) => ({
      remoteStreams: { ...state.remoteStreams, [socketId]: event.streams[0] },
    }));
  };

  pc.onconnectionstatechange = () => {
    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
      get().removePeer(socketId);
    }
  };

  set((state) => ({ peers: { ...state.peers, [socketId]: pc } }));
  return pc;
}

function attachVoiceListeners(socket, get, set) {
  // Pairs déjà présents dans le salon : on initie une offre vers chacun
  socket.on('voice-peers', async (existingPeers) => {
    for (const peer of existingPeers) {
      set((state) => ({
        participants: {
          ...state.participants,
          [peer.socketId]: { userId: peer.userId, username: peer.username },
        },
      }));

      const pc = createPeerConnection(get, set, peer.socketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', {
        targetSocketId: peer.socketId,
        signalData: { type: 'offer', sdp: offer },
      });
    }
  });

  // Quelqu'un vient de nous rejoindre : on note son identité,
  // c'est lui qui va nous envoyer une offer
  socket.on('user-joined-voice', ({ socketId, userId, username }) => {
    set((state) => ({
      participants: { ...state.participants, [socketId]: { userId, username } },
    }));
  });

  socket.on('user-left-voice', ({ socketId }) => {
    get().removePeer(socketId);
  });

  socket.on('signal', async ({ senderSocketId, signalData }) => {
    let pc = get().peers[senderSocketId];

    if (signalData.type === 'offer') {
      if (!pc) pc = createPeerConnection(get, set, senderSocketId);
      await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('signal', {
        targetSocketId: senderSocketId,
        signalData: { type: 'answer', sdp: answer },
      });
    } else if (signalData.type === 'answer') {
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
    } else if (signalData.type === 'ice-candidate' && pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      } catch (err) {
        console.error('[Voice] Erreur ICE candidate :', err);
      }
    }
  });
}

export const useVoiceStore = create((set, get) => ({
  activeChannelId: null,
  localStream: null,
  isMuted: false,
  peers: {}, // socketId -> RTCPeerConnection
  participants: {}, // socketId -> { userId, username }
  remoteStreams: {}, // socketId -> MediaStream

  joinVoiceChannel: async (channelId, serverId) => {
    if (get().activeChannelId) {
      get().leaveVoiceChannel();
    }

    let localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('[Voice] Micro refusé ou indisponible :', err);
      return { success: false, error: "Impossible d'accéder au micro" };
    }

    set({ activeChannelId: channelId, localStream });

    const socket = getVoiceSocket();
    if (!socket.__voiceListenersAttached) {
      socket.__voiceListenersAttached = true;
      attachVoiceListeners(socket, get, set);
    }
    if (!socket.connected) socket.connect();

    // Le backend attend { channelId, serverId }, pas juste channelId
    socket.emit('join-voice-channel', { channelId, serverId });
    return { success: true };
  },

  leaveVoiceChannel: () => {
    const { activeChannelId, peers, localStream } = get();
    const socket = getVoiceSocket();

    if (activeChannelId) {
      // Le backend ne prend plus de paramètre pour cet événement
      socket.emit('leave-voice-channel');
    }

    Object.values(peers).forEach((pc) => pc.close());
    localStream?.getTracks().forEach((track) => track.stop());

    set({
      activeChannelId: null,
      localStream: null,
      peers: {},
      participants: {},
      remoteStreams: {},
      isMuted: false,
    });
  },

  toggleMute: () => {
    const { localStream, isMuted } = get();
    if (!localStream) return;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = isMuted; // si isMuted actuellement, on réactive le micro
    });
    set({ isMuted: !isMuted });
  },

  removePeer: (socketId) => {
    set((state) => {
      state.peers[socketId]?.close();
      const { [socketId]: _p, ...restPeers } = state.peers;
      const { [socketId]: _s, ...restStreams } = state.remoteStreams;
      const { [socketId]: _u, ...restParticipants } = state.participants;
      return { peers: restPeers, remoteStreams: restStreams, participants: restParticipants };
    });
  },
}));