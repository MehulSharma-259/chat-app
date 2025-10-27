/** @format */
import { Server, Socket } from 'socket.io';
import http from 'http';
import { messages } from '../models/Message';

// Initialize Socket.IO
export const initializeSocket = (server: http.Server) => {
  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:5173', // Frontend URL
      methods: ['GET', 'POST']
    }
  });

  // Socket.IO connection handler
  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);
    
    // Handle socket events
    handleJoinChat(socket);
    handleSendMessage(socket, io);
    handleTyping(socket);
    handleDisconnect(socket);
  });

  return io;
};

// Handle join chat event
const handleJoinChat = (socket: Socket) => {
  socket.on('join_chat', (chatId: string) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat: ${chatId}`);
  });
};

// Handle send message event
const handleSendMessage = (socket: Socket, io: Server) => {
  socket.on('send_message', (messageData: any) => {
    // Add message to in-memory store
    const newMessage = {
      _id: Date.now().toString(),
      sender: messageData.sender,
      content: messageData.content,
      chat: messageData.chatId,
      status: 'sent',
      timestamp: new Date()
    };
    
    messages.push(newMessage);
    
    // Broadcast to all users in the chat
    io.to(messageData.chatId).emit('receive_message', newMessage);
  });
};

// Handle typing indicator
const handleTyping = (socket: Socket) => {
  socket.on('typing', (data: { userId: string; chatId: string }) => {
    socket.to(data.chatId).emit('typing', {
      userId: data.userId,
      chatId: data.chatId
    });
  });

  socket.on('stop_typing', (data: { userId: string; chatId: string }) => {
    socket.to(data.chatId).emit('stop_typing', {
      userId: data.userId,
      chatId: data.chatId
    });
  });
};

// Handle disconnect
const handleDisconnect = (socket: Socket) => {
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
};