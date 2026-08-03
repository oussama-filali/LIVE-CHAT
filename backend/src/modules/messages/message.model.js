import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  channelId: String,
  senderId: String,
  senderName: String,
  content: String,
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

export const Message = mongoose.model('Message', messageSchema);