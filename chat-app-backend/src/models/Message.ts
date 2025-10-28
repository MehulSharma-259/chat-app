/** @format */
import mongoose from 'mongoose';

// Message schema for potential MongoDB use
const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true } // Consistent naming
});

// Interface for in-memory message data
export interface IMessage {
  _id: string;
  sender: string; // User ID
  content: string;
  chatId: string; // **CORRECTED** property name from 'chat' to 'chatId'
  status: 'sent' | 'delivered' | 'read'; // Added status types
  timestamp: Date;
  readBy?: string[]; // **ADDED** Optional readBy array
}

// In-memory message store
export const messages: IMessage[] = [];

// Export the Mongoose model
export const Message = mongoose.model('Message', messageSchema);

// export default Message; // Keep commented unless using Mongoose connection