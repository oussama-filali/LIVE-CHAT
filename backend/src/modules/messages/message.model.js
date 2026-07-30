import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  channelId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Message = mongoose.model('Message', messageSchema);