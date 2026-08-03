import { Message } from './message.model.js';

export const getChannelMessages = async (req, res, next) => {
  try {
    const { channelId } = req.params;

    // Les 100 messages les plus récents, remis dans l'ordre chronologique
    // pour l'affichage (sort desc + limit, puis reverse)
    const messages = await Message.find({ channelId })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(messages.reverse());
  } catch (error) {
    next(error);
  }
};