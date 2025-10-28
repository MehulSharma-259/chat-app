/** @format */
import mongoose from 'mongoose';

// Chat schema for potential MongoDB use
const chatSchema = new mongoose.Schema({
  name: { type: String, default: '' }, // For group chats
  isGroup: { type: Boolean, default: false },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now } // Add updatedAt for sorting
});

// Update timestamp on save (Mongoose middleware)
chatSchema.pre('save', function (next) {
  // 'this' refers to the document being saved
  // Use type assertion if 'this' is not automatically typed correctly
  (this as any).updatedAt = new Date();
  next();
});


// Interface for in-memory chat data
export interface IChat {
  _id: string;
  participants: string[]; // Array of user IDs
  createdAt: Date;
  updatedAt: Date; // **ADDED** updatedAt to match usage
  isGroup?: boolean;
  name?: string;
  groupAdmin?: string; // User ID of admin
}

// In-memory chat store
export const chats: IChat[] = [];

// Export the Mongoose model
export const Chat = mongoose.model('Chat', chatSchema);

// export default Chat; // Keep commented unless using Mongoose connection