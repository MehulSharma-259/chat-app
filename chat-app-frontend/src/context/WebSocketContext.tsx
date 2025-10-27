import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import io, { Socket } from 'socket.io-client';

interface WebSocketContextType {
  sendMessage: (chatId: string, content: string) => void;
  joinChat: (chatId: string) => void;
  sendTypingStatus: (chatId: string, isTyping: boolean) => void;
  sendReadReceipt: (messageId: string, senderId: string, chatId: string) => void;
  onlineUsers: Set<string>;
  typingUsers: Map<string, string>;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider = ({ children }: WebSocketProviderProps) => {
  const { token, user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!token || !user) return;

    const newSocket = io('http://localhost:8000', {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Socket.IO connected');
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
    });

    newSocket.on('user_status', (data: { userId: string; status: 'online' | 'offline' }) => {
      if (data.status === 'online') {
        setOnlineUsers(prev => new Set(prev).add(data.userId));
      } else {
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.userId);
          return newSet;
        });
      }
    });

    newSocket.on('typing', (data: { userId: string; chatId: string; username: string }) => {
      setTypingUsers(prev => new Map(prev).set(data.chatId, data.username));
    });

    newSocket.on('stop_typing', (data: { userId: string; chatId: string }) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.chatId);
        return newMap;
      });
    });

    newSocket.on('receive_message', (message: any) => {
      console.log('Received message:', message);
      // Handle incoming messages (e.g., update chat state)
    });

    return () => {
      newSocket.disconnect();
    };
  }, [token, user]);

  const sendMessage = (chatId: string, content: string) => {
    if (!socketRef.current || !user) return;
    const messageData = {
      chatId,
      content,
      sender: user.id,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };
    socketRef.current.emit('send_message', messageData);
    return { ...messageData, id: 'msg-' + Date.now() };
  };

  const joinChat = (chatId: string) => {
    if (!socketRef.current || !user) return;
    socketRef.current.emit('join_chat', chatId);
  };

  const sendTypingStatus = (chatId: string, isTyping: boolean) => {
    if (!socketRef.current || !user) return;
    socketRef.current.emit(isTyping ? 'typing' : 'stop_typing', { chatId, userId: user.id, username: user.username });
  };

  const sendReadReceipt = (messageId: string, senderId: string, chatId: string) => {
    if (!socketRef.current || !user) return;
    socketRef.current.emit('read_receipt', { messageId, senderId, chatId });
  };

  const value = {
    sendMessage,
    joinChat,
    sendTypingStatus,
    sendReadReceipt,
    onlineUsers,
    typingUsers
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};