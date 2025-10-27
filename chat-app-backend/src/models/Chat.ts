/** @format */
import mongoose from 'mongoose';

// Chat schema and model
const chatSchema = new mongoose.Schema({
  name: { type: String, default: '' }, // For group chats
  isGroup: { type: Boolean, default: false },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

// In-memory data for demo
export interface IChat {
  _id: string;
  participants: string[];
  createdAt: Date;
  isGroup?: boolean;
  name?: string;
  groupAdmin?: string;
}

// Export the chats array for in-memory storage
export const chats: IChat[] = [];

// Export the Chat model
export const Chat = mongoose.model('Chat', chatSchema);

export default Chat;