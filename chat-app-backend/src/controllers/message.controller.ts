/** @format */
import { Response } from 'express';
import { messages, IMessage } from '../models/Message';
import { chats } from '../models/Chat';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// Get messages for a chat
export const getChatMessages = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'User ID not found' });

    const chat = chats.find(c => c._id === chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    if (!chat.participants.includes(userId)) return res.status(403).json({ message: 'Not authorized' });

    const chatMessages = messages
      .filter(m => m.chatId === chatId) // **FIXED** chatId
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    console.log(`Fetched ${chatMessages.length} messages for chat ${chatId}`);

    // Mark messages as read by this user upon fetching
     chatMessages.forEach(msg => {
         if (msg.sender !== userId) {
             if (!msg.readBy) msg.readBy = []; // **FIXED** Initialize if undefined
             if (!msg.readBy.includes(userId)) {
                 msg.readBy.push(userId);
             }
         }
     });

    const formattedMessages = chatMessages.map(msg => ({
        id: msg._id,
        sender: msg.sender,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        status: msg.status,
        chatId: msg.chatId, // **FIXED** Ensure chatId is included if needed
        readBy: msg.readBy // **FIXED** Include readBy
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ message: 'Server error fetching messages' });
  }
};

// Send a message via HTTP (less common, usually via WebSocket)
export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId, content } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'User ID not found' });
    if (!chatId || !content) return res.status(400).json({ message: 'Chat ID and content required' });

    const chat = chats.find(c => c._id === chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    if (!chat.participants.includes(userId)) return res.status(403).json({ message: 'Not authorized' });

    const newMessage: IMessage = {
      _id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sender: userId,
      content,
      chatId: chatId, // **FIXED** chatId
      status: 'sent',
      timestamp: new Date(),
      readBy: [userId] // **FIXED** Initialize readBy
    };
    messages.push(newMessage);

    // **FIXED** Check if chat exists before updating
    if (chat) {
        chat.updatedAt = new Date(); // Update chat timestamp
    }

    console.log(`Message sent via HTTP by ${userId} in chat ${chatId}`);
    // NOTE: Need to emit this via WebSocket too for real-time update

    res.status(201).json({ // Return format consistent with getChatMessages
        id: newMessage._id,
        sender: newMessage.sender,
        content: newMessage.content,
        timestamp: newMessage.timestamp.toISOString(),
        status: newMessage.status,
        chatId: newMessage.chatId // **FIXED** chatId
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error sending message' });
  }
};