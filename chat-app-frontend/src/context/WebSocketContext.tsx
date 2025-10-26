import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  sendMessage: (chatId: string, content: string) => void;
  joinChat: (chatId: string) => void;
  sendTypingStatus: (chatId: string, isTyping: boolean) => void;
  sendReadReceipt: (messageId: string) => void;
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
  const ws = useRef<WebSocket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token || !user) return;
    
    const socket = new WebSocket('ws://localhost:8000');
    ws.current = socket;
    
    socket.onopen = () => {
      console.log('WebSocket connected');
      // Authenticate with token
      socket.send(JSON.stringify({
        type: 'auth',
        payload: { token }
      }));
    };
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'auth_success':
          setConnected(true);
          break;
          
        case 'user_status':
          if (data.payload.status === 'online') {
            setOnlineUsers(prev => new Set(prev).add(data.payload.userId));
          } else {
            setOnlineUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(data.payload.userId);
              return newSet;
            });
          }
          break;
          
        case 'typing':
          if (data.payload.isTyping) {
            setTypingUsers(prev => new Map(prev).set(data.payload.chatId, data.payload.username));
          } else {
            setTypingUsers(prev => {
              const newMap = new Map(prev);
              newMap.delete(data.payload.chatId);
              return newMap;
            });
          }
          break;
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    socket.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    };
    
    return () => {
      socket.close();
    };
  }, [token, user]);

  const sendMessage = (chatId: string, content: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN || !user) return;
    
    // For demo purposes, we'll simulate a successful message send
    console.log('Sending message:', { chatId, content, userId: user.id });
    
    // Still try to send via WebSocket if connected
    ws.current.send(JSON.stringify({
      type: 'chat_message',
      chatId,
      content,
      userId: user.id
    }));
    
    return {
      id: 'msg-' + Date.now(),
      chatId,
      content,
      sender: user.id,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };
  };

  const joinChat = (chatId: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN || !user) return;
    
    ws.current.send(JSON.stringify({
      type: 'join_chat',
      chatId,
      userId: user.id
    }));
  };

  const sendTypingStatus = (chatId: string, isTyping: boolean) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN || !user) return;
    
    ws.current.send(JSON.stringify({
      type: 'typing',
      chatId,
      isTyping,
      userId: user.id
    }));
  };

  const sendReadReceipt = (messageId: string, senderId: string, chatId: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN || !user) return;
    
    ws.current.send(JSON.stringify({
      type: 'read_receipt',
      messageId,
      senderId,
      chatId
    }));
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