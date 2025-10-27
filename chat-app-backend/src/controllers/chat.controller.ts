/** @format */
import { Request, Response } from 'express';
import { chats } from '../models/Chat';
import { messages } from '../models/Message';

// Get all chats for a user
export const getUserChats = async (req: Request, res: Response) => {
  try {
    // @ts-ignore - req.user is added by auth middleware
    const userId = req.user.id;
    
    // Get all chats where user is a participant
    const userChats = chats.filter(chat => 
      chat.participants.includes(userId)
    );
    
    // Format response with last message and other participant info
    const formattedChats = userChats.map(chat => {
      // For group chats, use the group name
      if (chat.isGroup) {
        const chatMessages = messages.filter(m => m.chat === chat._id);
        const lastMessage = chatMessages.length > 0 
          ? chatMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
          : null;
        
        return {
          id: chat._id,
          name: chat.name,
          isGroup: true,
          groupAdmin: chat.groupAdmin,
          lastMessage: lastMessage ? {
            id: lastMessage._id,
            content: lastMessage.content,
            timestamp: lastMessage.timestamp,
            status: lastMessage.status
          } : null,
          unreadCount: chatMessages.filter(m => 
            m.sender !== userId && m.status !== 'read'
          ).length
        };
      }
      
      // For 1:1 chats
      const otherParticipantId = chat.participants.find(id => id !== userId);
      const chatMessages = messages.filter(m => m.chat === chat._id);
      const lastMessage = chatMessages.length > 0 
        ? chatMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
        : null;
      
      return {
        id: chat._id,
        name: otherParticipantId === 'demo-user-id' ? 'Demo User' : `User ${otherParticipantId}`,
        isGroup: false,
        lastMessage: lastMessage ? {
          id: lastMessage._id,
          content: lastMessage.content,
          timestamp: lastMessage.timestamp,
          status: lastMessage.status
        } : null,
        unreadCount: chatMessages.filter(m => 
          m.sender !== userId && m.status !== 'read'
        ).length
      };
    });
    
    res.json(formattedChats);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new chat
export const createChat = async (req: Request, res: Response) => {
  try {
    const { receiverId, name, participants, isGroup } = req.body;
    // @ts-ignore - req.user is added by auth middleware
    const userId = req.user.id;
    
    if (isGroup) {
      if (!name || !participants || !Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json({ message: 'Group name and participants are required' });
      }
      
      // Create new group chat
      const newGroupChat = {
        _id: `chat-${Date.now()}`,
        name,
        isGroup: true,
        groupAdmin: userId,
        participants: [...new Set([userId, ...participants])], // Remove duplicates
        createdAt: new Date()
      };
      
      chats.push(newGroupChat);
      return res.status(201).json(newGroupChat);
    }
    
    // For 1:1 chat
    if (!receiverId) {
      return res.status(400).json({ message: 'Receiver ID is required' });
    }
    
    // Check if chat already exists
    const existingChat = chats.find(chat => 
      !chat.isGroup && 
      chat.participants.includes(userId) && 
      chat.participants.includes(receiverId)
    );
    
    if (existingChat) {
      return res.json(existingChat);
    }
    
    // Create new 1:1 chat
    const newChat = {
      _id: `chat-${Date.now()}`,
      participants: [userId, receiverId],
      isGroup: false,
      createdAt: new Date()
    };
    
    chats.push(newChat);
    
    res.status(201).json(newChat);
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};