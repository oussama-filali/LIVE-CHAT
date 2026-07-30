import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = 'http://localhost:3000/api';
const SOCKET_URL = 'http://localhost:3000/chat';

// Utilisation d'un timestamp pour générer des emails/usernames uniques à chaque lancement
const runId = Date.now();

const user1Data = {
  username: `alice_${runId}`,
  email: `alice_${runId}@example.com`,
  password: 'password123',
};

const user2Data = {
  username: `bob_${runId}`,
  email: `bob_${runId}@example.com`,
  password: 'password123',
};

// Fonction utilitaire pour extraire les cookies de réponse
const extractCookies = (response) => {
  const setCookieHeader = response.headers['set-cookie'];
  if (!setCookieHeader) return '';
  return setCookieHeader.map(c => c.split(';')[0]).join('; ');
};

async function runFullScenario() {
  console.log('🚀 Début du scénario de test complet...\n');

  try {
    // ==========================================
    // 1. INSCRIPTION & CONNEXION USER 1 (Alice)
    // ==========================================
    console.log('1️⃣ Inscription et connexion de User 1 (Alice)...');
    await axios.post(`${API_URL}/auth/register`, user1Data);
    
    const loginUser1Res = await axios.post(`${API_URL}/auth/login`, {
      email: user1Data.email,
      password: user1Data.password,
    });
    
    const aliceCookie = extractCookies(loginUser1Res);
    const aliceUser = loginUser1Res.data;
    console.log(`   ✅ Alice connectée (ID: ${aliceUser.id})`);

    // ==========================================
    // 2. INSCRIPTION & CONNEXION USER 2 (Bob)
    // ==========================================
    console.log('2️⃣ Inscription et connexion de User 2 (Bob)...');
    await axios.post(`${API_URL}/auth/register`, user2Data);
    
    const loginUser2Res = await axios.post(`${API_URL}/auth/login`, {
      email: user2Data.email,
      password: user2Data.password,
    });
    
    const bobCookie = extractCookies(loginUser2Res);
    const bobUser = loginUser2Res.data;
    console.log(`   ✅ Bob connecté (ID: ${bobUser.id})`);

    // ==========================================
    // 3. CRÉATION DU SERVEUR ET DU SALON PAR ALICE
    // ==========================================
    console.log('3️⃣ Alice crée un serveur et un salon...');
    const createServerRes = await axios.post(
      `${API_URL}/servers`,
      { name: `Serveur d'Alice ${runId}` },
      { headers: { Cookie: aliceCookie } }
    );
    
    const server = createServerRes.data;
    console.log(`   ✅ Serveur créé (ID: ${server.id}, Code invitation: ${server.inviteCode})`);

    const createChannelRes = await axios.post(
      `${API_URL}/servers/${server.id}/channels`,
      { name: 'general-chat', type: 'TEXT' },
      { headers: { Cookie: aliceCookie } }
    );
    
    const channel = createChannelRes.data;
    console.log(`   ✅ Salon créé (ID: ${channel.id}, Nom: ${channel.name})`);

    // ==========================================
    // 4. BOB REJOINT LE SERVEUR D'ALICE
    // ==========================================
    console.log('4️⃣ Bob rejoint le serveur via le code d\'invitation...');
    await axios.post(
      `${API_URL}/servers/join`,
      { inviteCode: server.inviteCode },
      { headers: { Cookie: bobCookie } }
    );
    console.log('   ✅ Bob a rejoint le serveur avec succès !');

    // ==========================================
    // 5. COMMUNICATION WEBSOCKET DANS LE SALON
    // ==========================================
    console.log('\n5️⃣ Connexion au WebSocket et échange de messages...');

    const socketAlice = io(SOCKET_URL);
    const socketBob = io(SOCKET_URL);

    // Alice et Bob rejoignent la room du salon créé
    socketAlice.emit('join-channel', channel.id);
    socketBob.emit('join-channel', channel.id);

    // Alice écoute les messages
    socketAlice.on('receive-message', (msg) => {
      console.log(`   📩 [Alice sur Socket] ${msg.senderName}: ${msg.content}`);
    });

    // Bob écoute les messages et répond
    socketBob.on('receive-message', (msg) => {
      console.log(`   📩 [Bob sur Socket] ${msg.senderName}: ${msg.content}`);

      // Si le message provient d'Alice, Bob répond
      if (msg.senderId === aliceUser.id) {
        setTimeout(() => {
          console.log('\n   📤 Bob envoie sa réponse...');
          socketBob.emit('send-message', {
            channelId: channel.id,
            senderId: bobUser.id,
            senderName: bobUser.username,
            content: `Salut Alice ! Merci pour l'invitation sur le serveur ${server.name} !`,
          });
        }, 1200);
      } else if (msg.senderId === bobUser.id) {
        // Fin de l'échange
        setTimeout(async () => {
          console.log('\n6️⃣ Vérification de la persistance en BDD (historique HTTP)...');
          const historyRes = await axios.get(`${API_URL}/messages/channel/${channel.id}`);
          console.log(`   ✅ Total de messages enregistrés en BDD : ${historyRes.data.length}`);
          
          console.log('\n🎉 TEST COMPLET RÉUSSI AVEC SUCCÈS !');
          socketAlice.disconnect();
          socketBob.disconnect();
          process.exit(0);
        }, 1200);
      }
    });

    // Alice initie le premier message
    setTimeout(() => {
      console.log('   📤 Alice envoie le premier message...');
      socketAlice.emit('send-message', {
        channelId: channel.id,
        senderId: aliceUser.id,
        senderName: aliceUser.username,
        content: `Bienvenue dans le salon ${channel.name} Bob !`,
      });
    }, 1000);

  } catch (error) {
    console.error('❌ Erreur durant le test :', error.response?.data || error.message);
    process.exit(1);
  }
}

runFullScenario();