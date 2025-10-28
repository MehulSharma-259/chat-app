import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

// --- Interfaces (Keep these as they were) ---
interface BaseWebSocketMessage { type: string; payload: any; }
interface SocketMessageFromServer extends BaseWebSocketMessage {
     payload: { id: string; sender: string; content: string; timestamp: string; status: 'sent' | 'delivered' | 'read'; chatId: string; }
}
interface TypingStatusFromServer extends BaseWebSocketMessage {
     payload: { userId: string; username: string; chatId: string; }
}
interface StopTypingFromServer extends BaseWebSocketMessage {
     payload: { userId: string; chatId: string; }
}
interface UserStatusUpdateFromServer extends BaseWebSocketMessage {
     payload: { userId: string; status: 'online' | 'offline'; }
}
interface OnlineUsersFromServer extends BaseWebSocketMessage {
     payload: string[];
}
interface MessageStatusUpdateFromServer extends BaseWebSocketMessage {
    payload: { messageId: string; chatId: string; status: 'delivered' | 'read'; readerId?: string; }
}
interface AuthSuccessFromServer extends BaseWebSocketMessage {
    payload: { userId: string; username: string; }
}
interface ErrorFromServer extends BaseWebSocketMessage {
    payload: { message: string; }
}

// --- Context Type (Keep as is) ---
interface WebSocketContextType {
  sendMessage: (chatId: string, content: string) => void;
  joinChat: (chatId: string) => void;
  sendTypingStatus: (chatId: string, isTyping: boolean) => void;
  sendReadReceipt: (messageId: string, senderId: string, chatId: string) => void;
  onlineUsers: Set<string>;
  typingUsers: Map<string, string>;
  messages: SocketMessageFromServer['payload'][];
  isConnected: boolean;
  lastError: string | null;
}

// --- Context Creation (Keep as is) ---
const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// --- Custom Hook (Keep the first definition, remove the duplicate) ---
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

// --- WebSocket Provider ---
interface WebSocketProviderProps { children: ReactNode; }

export const WebSocketProvider = ({ children }: WebSocketProviderProps) => {
  const { token, user } = useAuth();
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [messages, setMessages] = useState<SocketMessageFromServer['payload'][]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  // --- Utility Functions (Keep as is) ---
  const sendJson = useCallback((data: object): boolean => { // Added return type boolean
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
      return true; // Indicate success
    } else {
      console.warn("WebSocket not open. Message not sent:", data);
      setLastError("Connection lost. Trying to reconnect...");
      return false; // Indicate failure
    }
  }, []);

  const updateMessageStatus = useCallback((update: MessageStatusUpdateFromServer['payload']) => {
    setMessages(prevMessages =>
      prevMessages.map(msg => {
        if (msg.id === update.messageId && msg.chatId === update.chatId) {
           const currentStatusIndex = ['sent', 'delivered', 'read'].indexOf(msg.status);
           const newStatusIndex = ['sent', 'delivered', 'read'].indexOf(update.status);
           if (newStatusIndex > currentStatusIndex) {
              console.log(`Updating status for msg ${msg.id} to ${update.status}`);
              return { ...msg, status: update.status };
           }
        }
        return msg;
      })
    );
  }, []);

  // --- Connection Logic (Keep as is) ---
  const connectWebSocket = useCallback(() => {
    if (!token || ws.current) return;

    console.log("Attempting WebSocket connection...");
    const socketUrl = `ws://localhost:8000?token=${encodeURIComponent(token)}`;
    const newWs = new WebSocket(socketUrl);
    ws.current = newWs;

    newWs.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setLastError(null);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    newWs.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data) as BaseWebSocketMessage;
            console.log("WebSocket message received:", data);

            switch (data.type) {
                case 'auth_success': console.log("WebSocket authentication successful:", (data as AuthSuccessFromServer).payload); break;
                case 'online_users':
                    const userIds = (data as OnlineUsersFromServer).payload;
                    console.log("Received online users:", userIds);
                    setOnlineUsers(new Set(userIds));
                    break;
                case 'user_status':
                    const { userId, status } = (data as UserStatusUpdateFromServer).payload;
                    console.log(`User status update: ${userId} is ${status}`);
                    setOnlineUsers(prev => { const newSet = new Set(prev); if (status === 'online') newSet.add(userId); else newSet.delete(userId); return newSet; });
                    break;
                case 'receive_message':
                    const newMessage = (data as SocketMessageFromServer).payload;
                    console.log("Received new message:", newMessage);
                    setMessages(prev => { if (prev.some(m => m.id === newMessage.id)) return prev; return [...prev, newMessage]; });
                    break;
                case 'message_status_update':
                    const statusUpdate = (data as MessageStatusUpdateFromServer).payload;
                    console.log("Received status update:", statusUpdate);
                    updateMessageStatus(statusUpdate);
                    break;
                case 'typing':
                    const typingData = (data as TypingStatusFromServer).payload;
                    console.log(`${typingData.username} is typing in chat ${typingData.chatId}`);
                    if (typingData.userId !== user?.id) setTypingUsers(prev => new Map(prev).set(typingData.chatId, typingData.username));
                    break;
                case 'stop_typing':
                    const stopTypingData = (data as StopTypingFromServer).payload;
                    console.log(`Stop typing received for chat ${stopTypingData.chatId}`);
                    if (stopTypingData.userId !== user?.id) setTypingUsers(prev => { const newMap = new Map(prev); newMap.delete(stopTypingData.chatId); return newMap; });
                    break;
                case 'error':
                    const errorPayload = (data as ErrorFromServer).payload;
                    console.error("WebSocket Error Message:", errorPayload.message);
                    setLastError(errorPayload.message);
                    break;
                case 'joined_chat': console.log("Successfully joined chat:", data.payload.chatId); break;
                default: console.warn("Received unhandled WebSocket message type:", data.type);
            }
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error, event.data);
            setLastError("Received invalid message format from server.");
        }
    };

    newWs.onclose = (event) => {
        console.log(`WebSocket disconnected. Code: ${event.code}, Reason: "${event.reason}". Was clean: ${event.wasClean}`);
        setIsConnected(false);
        ws.current = null;
        setOnlineUsers(new Set());
        setTypingUsers(new Map());

        let errorMessage = "Connection lost.";
        if (event.code === 1008) errorMessage = `Connection closed: ${event.reason || 'Authentication Failed'}. Please log in again.`;
        else if (event.code !== 1000) errorMessage = "Connection lost. Trying to reconnect...";
        setLastError(errorMessage);

        if (event.code !== 1000 && event.code !== 1008 && token) {
            if (!reconnectTimeoutRef.current) {
                console.log('Attempting to reconnect WebSocket in 5 seconds...');
                reconnectTimeoutRef.current = setTimeout(() => { reconnectTimeoutRef.current = null; connectWebSocket(); }, 5000);
            }
        } else {
             if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
        }
    };

    newWs.onerror = (error) => { console.error('WebSocket error event:', error); };

  }, [token, user?.id, updateMessageStatus]); // Ensure dependencies are correct

  // --- useEffect for Connection (Keep as is) ---
  useEffect(() => {
    if (token && user) {
      connectWebSocket();
    } else {
      if (ws.current) {
        console.log("Closing WebSocket due to logout or token removal.");
        ws.current.close(1000, "User logged out");
        ws.current = null;
        setIsConnected(false);
        setOnlineUsers(new Set());
        setTypingUsers(new Map());
        setMessages([]);
        setLastError(null);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    }
    return () => { // Cleanup on provider unmount
      if (ws.current) { ws.current.close(1000, "Component unmounting"); ws.current = null; }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [token, user, connectWebSocket]);

  // --- WebSocket Actions (Keep as is) ---
  const sendMessageWrapper = useCallback((chatId: string, content: string) => {
     if (!user) return;
     const success = sendJson({ type: 'chat_message', payload: { chatId, content } });
     if (success) {
        const localMessage: SocketMessageFromServer['payload'] = {
            id: `temp-${Date.now()}`, sender: user.id, content: content,
            timestamp: new Date().toISOString(), status: 'sent', chatId: chatId,
        };
        setMessages(prev => [...prev, localMessage]);
     }
  }, [sendJson, user]);

  const joinChatWrapper = useCallback((chatId: string) => { sendJson({ type: 'join_chat', payload: { chatId } }); }, [sendJson]);
  const sendTypingStatusWrapper = useCallback((chatId: string, isTyping: boolean) => { sendJson({ type: isTyping ? 'typing' : 'stop_typing', payload: { chatId } }); }, [sendJson]);
  const sendReadReceiptWrapper = useCallback((messageId: string, senderId: string, chatId: string) => { if (!user || user.id === senderId) return; sendJson({ type: 'read_receipt', payload: { messageId, senderId, chatId } }); }, [sendJson, user]);

  // --- Context Value (Keep as is) ---
  const contextValue = {
    sendMessage: sendMessageWrapper,
    joinChat: joinChatWrapper,
    sendTypingStatus: sendTypingStatusWrapper,
    sendReadReceipt: sendReadReceiptWrapper,
    onlineUsers,
    typingUsers,
    messages,
    isConnected,
    lastError,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

// --- REMOVED Duplicate useWebSocket function ---