import mongoose from 'mongoose';

const privateMessageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const PrivateMessage = mongoose.model('PrivateMessage', privateMessageSchema);
