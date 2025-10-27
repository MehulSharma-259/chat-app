/** @format */
import mongoose from 'mongoose';

// Message schema and model
const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true }
});

// In-memory data for demo
export interface IMessage {
  _id: string;
  sender: string;
  content: string;
  chat: string;
  status: string;
  timestamp: Date;
}

// Export the messages array for in-memory storage
export const messages: IMessage[] = [];

// Export the Message model
export const Message = mongoose.model('Message', messageSchema);

export default Message;