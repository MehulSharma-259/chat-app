/** @format */
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = Number(process.env.PORT) || 8000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection - commented out for demo purposes
// const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/whatsapp-clone';
// mongoose.connect(MONGO_URI)
//   .then(() => console.log('✅ Connected to MongoDB'))
//   .catch(err => console.error('❌ MongoDB connection error:', err));

// Mock database for demo purposes
console.log('✅ Using mock database for demonstration');

// User schema and model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePic: { type: String, default: '' },
  status: { type: String, default: 'Hey there! I am using WhatsApp Clone' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Chat schema and model
const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true }
});

const Message = mongoose.model('Message', messageSchema);

const chatSchema = new mongoose.Schema({
  name: { type: String, default: '' }, // For group chats
  isGroup: { type: Boolean, default: false },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const Chat = mongoose.model('Chat', chatSchema);

// In-memory data for demo
interface User {
  _id: string;
  username: string;
  email: string;
  password: string;
  profilePic: string;
  status: string;
}

interface Chat {
  _id: string;
  participants: string[];
  createdAt: Date;
}

interface Message {
  _id: string;
  sender: string;
  content: string;
  chat: string;
  status: string;
  timestamp: Date;
}

const users: User[] = [];
const chats: Chat[] = [];
const messages: Message[] = [];

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = users.find(u => u.email === email || u.username === username);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const newUser = {
      _id: Date.now().toString(),
      username,
      email,
      password: hashedPassword,
      profilePic: '',
      status: 'Hey there! I am using WhatsApp Clone'
    };
    
    users.push(newUser);
    
    // Generate JWT token
    const token = jwt.sign(
      { id: newUser._id, username: newUser.username },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        profilePic: newUser.profilePic,
        status: newUser.status
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Chat routes
app.get('/api/chats', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const chats = await Chat.find({ participants: userId })
      .populate('participants', 'username email profilePic status')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });
    
    res.json(chats);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/chats', async (req, res) => {
  try {
    const { userId, receiverId } = req.body;
    
    if (!userId || !receiverId) {
      return res.status(400).json({ message: 'Both user IDs are required' });
    }
    
    // Check if chat already exists
    const existingChat = await Chat.findOne({
      isGroup: false,
      $and: [
        { participants: { $elemMatch: { $eq: userId } } },
        { participants: { $elemMatch: { $eq: receiverId } } }
      ]
    }).populate('participants', 'username email profilePic status');
    
    if (existingChat) {
      return res.json(existingChat);
    }
    
    // Create new chat
    const newChat = new Chat({
      participants: [userId, receiverId],
      isGroup: false
    });
    
    const savedChat = await newChat.save();
    const populatedChat = await Chat.findById(savedChat._id)
      .populate('participants', 'username email profilePic status');
    
    res.status(201).json(populatedChat);
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

// Store active connections
const clients = new Map();

wss.on('connection', (ws) => {
  console.log('New client connected');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received message:', data);
      
      // Handle different message types
      switch (data.type) {
        case 'join_chat':
          // Store user and chat info with the connection
          clients.set(ws, { 
            userId: data.userId,
            chatId: data.chatId
          });
          
          // Create a demo chat if it doesn't exist
          if (!chats.find(c => c._id === data.chatId)) {
            const newChat = {
              _id: data.chatId,
              participants: [data.userId, 'demo-user-id'],
              createdAt: new Date()
            };
            chats.push(newChat);
            
            // Add some demo messages
            if (messages.filter(m => m.chat === data.chatId).length === 0) {
              messages.push({
                _id: 'msg1-' + Date.now(),
                sender: 'demo-user-id',
                content: 'Hello! Welcome to the chat app!',
                chat: data.chatId,
                status: 'delivered',
                timestamp: new Date(Date.now() - 60000)
              });
            }
          }
          break;
          
        case 'chat_message':
          // Create new message
          const newMessage = {
            _id: Date.now().toString(),
            sender: data.userId,
            content: data.content,
            chat: data.chatId,
            status: 'sent',
            timestamp: new Date()
          };
          
          // Save to in-memory store
          messages.push(newMessage);
          
          // Update message with ID and send to all clients in the chat
          const messageToSend = {
            type: 'new_message',
            message: {
              id: newMessage._id,
              sender: data.userId,
              content: data.content,
              timestamp: new Date(),
              status: 'sent'
            }
          };
          
          // Send to all clients in this chat
          clients.forEach((client, clientWs) => {
            if (client.chatId === data.chatId && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify(messageToSend));
              
              // If not the sender, update status to delivered
              if (client.userId !== data.userId) {
                clientWs.send(JSON.stringify({
                  type: 'message_delivered',
                  messageId: newMessage._id
                }));
              }
            }
          });
          
          // Update message status to delivered
          newMessage.status = 'delivered';
          break;
          
        case 'typing':
          // Broadcast typing status to other users in the chat
          clients.forEach((client, clientWs) => {
            if (client.chatId === data.chatId && 
                client.userId !== data.userId && 
                clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'user_typing',
                userId: data.userId,
                isTyping: data.isTyping
              }));
            }
          });
          break;
          
        case 'read_receipt':
          // Find message and update status
          const messageToUpdate = messages.find(m => m._id === data.messageId);
          if (messageToUpdate) {
            messageToUpdate.status = 'read';
          }
          
          // Notify sender that message was read
          clients.forEach((client, clientWs) => {
            if (client.userId === data.senderId && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'message_read',
                messageId: data.messageId,
                chatId: data.chatId
              }));
            }
          });
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
});

// Helper function for user status is not needed with our simplified implementation

// Chat routes
app.get('/api/chats', (req, res) => {
  try {
    console.log('Fetching chats for user:', req.query.userId);
    
    // Create a demo chat if none exists
    if (chats.length === 0) {
      const demoChat = {
        _id: 'demo-chat-' + Date.now(),
        participants: ['demo-user-id', req.query.userId as string || 'unknown-user'],
        createdAt: new Date()
      };
      chats.push(demoChat);
      
      // Add a welcome message
      messages.push({
        _id: 'welcome-msg-' + Date.now(),
        sender: 'demo-user-id',
        content: 'Welcome to the chat app! This is a demo chat.',
        chat: demoChat._id,
        status: 'delivered',
        timestamp: new Date()
      });
    }
    
    // Return chats that the user is part of
    const userChats = chats.filter(chat => 
      chat.participants.includes(req.query.userId as string)
    );
    
    // Format response
    const formattedChats = userChats.map(chat => {
      // Find the other participant (for 1:1 chats)
      const otherParticipantId = chat.participants.find(id => id !== req.query.userId);
      
      // Get last message
      const chatMessages = messages.filter(m => m.chat === chat._id);
      const lastMessage = chatMessages.length > 0 
        ? chatMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]
        : null;
      
      return {
        id: chat._id,
        name: otherParticipantId === 'demo-user-id' ? 'Demo User' : 'User ' + otherParticipantId,
        lastMessage: lastMessage ? {
          id: lastMessage._id,
          content: lastMessage.content,
          timestamp: lastMessage.timestamp,
          status: lastMessage.status
        } : null,
        unreadCount: chatMessages.filter(m => 
          m.sender !== req.query.userId && m.status !== 'read'
        ).length
      };
    });
    
    res.json(formattedChats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Messages route
app.get('/api/messages/:chatId', (req, res) => {
  try {
    const { chatId } = req.params;
    
    // Get messages for this chat
    const chatMessages = messages
      .filter(m => m.chat === chatId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Format response
    const formattedMessages = chatMessages.map(message => ({
      id: message._id,
      sender: message.sender,
      content: message.content,
      timestamp: message.timestamp,
      status: message.status
    }));
    
    res.json(formattedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ WebSocket server running on ws://localhost:${PORT}`);
});
