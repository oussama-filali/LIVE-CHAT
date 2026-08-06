import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { useVoiceStore } from '../store/voiceStore';
import { useAuthStore } from '../store/authStore';
import { colorForName, initialsForName } from '../utils/avatar';

function RemoteAudio({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline />;
}

export default function VoiceChannelPanel({ channelId, channelName, serverId }) {
  const user = useAuthStore((state) => state.user);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isJoining, setIsJoining] = useState(false);

  const {
    activeChannelId,
    isMuted,
    participants,
    remoteStreams,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
  } = useVoiceStore();

  const isConnected = activeChannelId === channelId;
  const participantList = Object.entries(participants).map(([socketId, info]) => ({
    socketId,
    ...info,
  }));

  const handleJoin = async () => {
    setIsJoining(true);
    setErrorMessage(null);
    try {
      const result = await joinVoiceChannel(channelId, serverId);
      if (result && !result.success) {
        setErrorMessage(result.error || "Impossible de rejoindre le salon vocal.");
      }
    } catch (err) {
      console.error('[VoiceChannelPanel] Erreur au démarrage du vocal :', err);
      setErrorMessage("Une erreur est survenue lors de la connexion.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: '#20232a' }}>
      <div className="h-12 shrink-0 flex items-center px-4 border-b" style={{ borderColor: '#111217' }}>
        <span className="text-white text-sm font-semibold">🔊 {channelName}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        {!isConnected ? (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              disabled={isJoining}
              onClick={handleJoin}
              className="px-6 py-3 rounded-lg text-white font-semibold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#3ba55d' }}
            >
              {isJoining ? 'Connexion...' : 'Rejoindre le vocal'}
            </button>
            {errorMessage && (
              <span className="text-xs text-red-400 font-medium">{errorMessage}</span>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-6">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{
                    backgroundColor: colorForName(user?.username || ''),
                    outline: isMuted ? '3px solid #ed4245' : '3px solid #3ba55d',
                  }}
                >
                  {initialsForName(user?.username || '')}
                </div>
                <span className="text-white text-sm">{user?.username} (toi)</span>
              </div>

              {participantList.map((p) => (
                <div key={p.socketId} className="flex flex-col items-center gap-2">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: colorForName(p.username), outline: '3px solid #3ba55d' }}
                  >
                    {initialsForName(p.username)}
                  </div>
                  <span className="text-white text-sm">{p.username}</span>
                  {remoteStreams[p.socketId] && <RemoteAudio stream={remoteStreams[p.socketId]} />}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleMute}
                className="p-3 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                style={{ backgroundColor: isMuted ? '#ed4245' : '#2b2f38', color: '#ffffff' }}
                title={isMuted ? 'Réactiver le micro' : 'Couper le micro'}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={leaveVoiceChannel}
                className="p-3 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                style={{ backgroundColor: '#ed4245', color: '#ffffff' }}
                title="Quitter le vocal"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}