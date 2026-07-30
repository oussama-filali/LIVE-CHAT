import { Message } from './message.model.js';

export const getChannelMessages = async (req, res) => {
  try {
    const { channelId } = req.params;

    const messages = await Message.find({ channelId })
      .sort({ createdAt: 1 }) // Ordre chronologique
      .limit(50);

    return res.json(messages);
  } catch (error) {
    console.error('Erreur récuperation messages:', error);
    return res.status(500).json({ error: 'Impossible de récupérer les messages' });
  }
};