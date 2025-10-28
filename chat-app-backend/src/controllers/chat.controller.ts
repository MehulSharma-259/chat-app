/** @format */
import { Response } from 'express';
import { chats, IChat } from '../models/Chat';
import { messages, IMessage } from '../models/Message';
import { users, IUser } from '../models/User';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// Get all chats for the authenticated user
export const getUserChats = async (req: AuthenticatedRequest, res: Response) => {
  // ... (function body remains the same as previous correct version)
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User ID not found in request' });
    }
    console.log(`Fetching chats for user: ${userId}`);

    // Simulate demo chat creation if none exist for the user
    const userHasChats = chats.some(chat => chat.participants.includes(userId));
    if (!userHasChats && !chats.some(chat => chat.participants.includes('demo-user-id') && chat.participants.includes(userId))) {
        const demoChat: IChat = {
            _id: `demo-chat-${Date.now()}`,
            participants: ['demo-user-id', userId],
            createdAt: new Date(),
            updatedAt: new Date(),
            isGroup: false,
        };
        chats.push(demoChat);
        console.log(`Created demo chat: ${demoChat._id}`);
        messages.push({
            _id: `welcome-msg-${Date.now()}`,
            sender: 'demo-user-id',
            content: 'Welcome to the chat app! This is a demo chat.',
            chatId: demoChat._id,
            status: 'delivered',
            timestamp: new Date(),
            readBy: [],
        });
    }

    const userChats = chats
      .filter(chat => chat.participants.includes(userId))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const formattedChats = userChats.map(chat => {
      const chatMessages = messages
          .filter(m => m.chatId === chat._id)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      const lastMessage = chatMessages[0] || null;

      const unreadCount = chatMessages.filter(m =>
          m.sender !== userId && (!m.readBy || !m.readBy.includes(userId))
        ).length;

      const participantDetails = chat.participants
             .map(pId => users.find(u => u._id === pId))
             .filter((u): u is IUser => !!u)
             .map(u => ({ _id: u._id, username: u.username, profilePic: u.profilePic, status: u.status }));

      if (chat.isGroup) {
        return {
          id: chat._id,
          name: chat.name || 'Unnamed Group',
          isGroup: true,
          participants: participantDetails,
          groupAdmin: chat.groupAdmin,
          lastMessage: lastMessage ? {
            id: lastMessage._id,
            sender: lastMessage.sender,
            content: lastMessage.content,
            timestamp: lastMessage.timestamp.toISOString(),
            status: lastMessage.status
          } : null,
          unreadCount: unreadCount
        };
      } else {
        const otherParticipant = participantDetails.find(p => p._id !== userId);
        return {
          id: chat._id,
          name: otherParticipant?.username || (chat.participants.includes('demo-user-id') ? 'Demo User' : `User ${chat.participants.find(id => id !== userId)}`),
          isGroup: false,
          participants: participantDetails,
          lastMessage: lastMessage ? {
            id: lastMessage._id,
            sender: lastMessage.sender,
            content: lastMessage.content,
            timestamp: lastMessage.timestamp.toISOString(),
            status: lastMessage.status
          } : null,
          unreadCount: unreadCount
        };
      }
    });
    res.json(formattedChats);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ message: 'Server error fetching chats' });
  }
};

// Create a new chat (1:1 or Group)
// **FIXED**: Ensure 'export' keyword is present
export const createChat = async (req: AuthenticatedRequest, res: Response) => {
  // ... (function body remains the same as previous correct version)
  try {
    const { receiverId, name, participants, isGroup } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'User ID not found' });

    if (isGroup) {
      if (!name || !participants || !Array.isArray(participants)) return res.status(400).json({ message: 'Group name and participants array required' });
      const allParticipants = [...new Set([userId, ...participants.filter((pId: string) => pId !== userId)])];
      if (allParticipants.length < 2) return res.status(400).json({ message: 'Group chat needs >= 2 unique participants.' });

      const newGroupChat: IChat = {
        _id: `group-chat-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name, isGroup: true, groupAdmin: userId, participants: allParticipants,
        createdAt: new Date(), updatedAt: new Date(),
      };
      chats.push(newGroupChat);
      console.log(`Created group chat: ${newGroupChat._id}`);

      const participantDetails = newGroupChat.participants
         .map(pId => users.find(u => u._id === pId)).filter((u): u is IUser => !!u)
         .map(u => ({ _id: u._id, username: u.username, profilePic: u.profilePic, status: u.status }));

      res.status(201).json({
        id: newGroupChat._id, name: newGroupChat.name, isGroup: true,
        participants: participantDetails, groupAdmin: newGroupChat.groupAdmin,
        lastMessage: null, unreadCount: 0
      });
    } else {
      if (!receiverId) return res.status(400).json({ message: 'Receiver ID required for 1:1 chat' });
      if (receiverId === userId) return res.status(400).json({ message: 'Cannot chat with yourself.' });

      const existingChat = chats.find(chat =>
        !chat.isGroup && chat.participants.length === 2 &&
        chat.participants.includes(userId) && chat.participants.includes(receiverId)
      );
      if (existingChat) {
         const participantDetails = existingChat.participants
            .map(pId => users.find(u => u._id === pId)).filter((u): u is IUser => !!u)
            .map(u => ({ _id: u._id, username: u.username, profilePic: u.profilePic, status: u.status }));
         const otherParticipant = participantDetails.find(p => p._id !== userId);
        return res.json({
            id: existingChat._id, name: otherParticipant?.username || 'Unknown User', isGroup: false,
            participants: participantDetails, lastMessage: null, unreadCount: 0
        });
      }

      const newChat: IChat = {
        _id: `1on1-chat-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        participants: [userId, receiverId], isGroup: false,
        createdAt: new Date(), updatedAt: new Date(),
      };
      chats.push(newChat);
      console.log(`Created 1:1 chat: ${newChat._id}`);

      const participantDetails = newChat.participants
         .map(pId => users.find(u => u._id === pId)).filter((u): u is IUser => !!u)
         .map(u => ({ _id: u._id, username: u.username, profilePic: u.profilePic, status: u.status }));
      const otherParticipant = participantDetails.find(p => p._id !== userId);

      res.status(201).json({
         id: newChat._id, name: otherParticipant?.username || 'Unknown User', isGroup: false,
         participants: participantDetails, lastMessage: null, unreadCount: 0
      });
    }
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ message: 'Server error creating chat' });
  }
};