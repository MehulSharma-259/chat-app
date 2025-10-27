/** @format */
import { Request, Response } from 'express';
import { messages } from '../models/Message';
import { chats } from '../models/Chat';

// Get messages for a chat
export const getChatMessages = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    // @ts-ignore - req.user is added by auth middleware
    const userId = req.user.id;
    
    // Check if chat exists and user is a participant
    const chat = chats.find(c => c._id === chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    if (!chat.participants.includes(userId)) {
      return res.status(403).json({ message: 'Not authorized to access this chat' });
    }
    
    // Get messages for the chat
    const chatMessages = messages
      .filter(m => m.chat === chatId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    res.json(chatMessages);
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send a message
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { chatId, content } = req.body;
    // @ts-ignore - req.user is added by auth middleware
    const userId = req.user.id;
    
    // Check if chat exists and user is a participant
    const chat = chats.find(c => c._id === chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    if (!chat.participants.includes(userId)) {
      return res.status(403).json({ message: 'Not authorized to access this chat' });
    }
    
    // Create new message
    const newMessage = {
      _id: Date.now().toString(),
      sender: userId,
      content,
      chat: chatId,
      status: 'sent',
      timestamp: new Date()
    };
    
    messages.push(newMessage);
    
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};