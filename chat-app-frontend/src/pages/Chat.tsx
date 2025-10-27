import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
}

interface Chat {
  id: string;
  name: string;
  isGroup?: boolean;
  participants?: {
    _id: string;
    username: string;
    email: string;
    profilePic: string;
    status: string;
  }[];
  lastMessage?: {
    id: string;
    content: string;
    timestamp: string;
    status: string;
  };
  unreadCount?: number;
}

const Chat = () => {
  const { user, token } = useAuth();
  const { sendMessage, joinChat, sendTypingStatus, sendReadReceipt, onlineUsers, typingUsers } = useWebSocket();
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chats on component mount
  useEffect(() => {
    if (!token || !user) return; // Add check for user
    fetchChats();
  }, [token, user]); // Add user to dependency array

  // Fetch user's chats
  const fetchChats = async () => {
    if (!user) return;

    try {
      // Create demo chats directly in the frontend for demonstration
      const demoChats = [
        {
          id: 'demo-chat-1',
          participants: ['demo-user-id', user.id],
          lastMessage: { content: 'Welcome to the chat app!', timestamp: new Date().toISOString(), sender: 'demo-user-id' },
          unreadCount: 1
        }
      ];

      setChats(demoChats);
      setLoading(false);
      return;
      
      // The following code is commented out as we're using demo data
      // const response = await fetch(`http://localhost:8000/api/chats?userId=${user.id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch chats');
      }
      
      const data = await response.json();
      console.log('Chats data:', data);
      
      // Map the response to match our Chat interface
      const formattedChats = data.map((chat: any) => ({
        id: chat._id || chat.id,
        participants: chat.participants || [],
        lastMessage: chat.lastMessage || { content: 'Welcome to the chat!', timestamp: new Date().toISOString() },
        unreadCount: chat.unreadCount || 0
      }));
      
      setChats(formattedChats);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching chats:', err);
      setError('Failed to load chats');
      setLoading(false);
    }
  };
  
  // Fetch messages for selected chat
  const fetchMessages = async (chatId: string) => {
    try {
      setLoading(true);
      
      // Create demo messages directly in the frontend for demonstration
      const demoMessages = [
        {
          id: 'msg-1',
          chatId: chatId,
          content: 'Welcome to the WhatsApp clone!',
          sender: 'demo-user-id',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          status: 'delivered'
        },
        {
          id: 'msg-2',
          chatId: chatId,
          content: 'This is a demo message.',
          sender: 'demo-user-id',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          status: 'delivered'
        }
      ];
      
      setMessages(demoMessages);
      
      // Join chat room via WebSocket
      joinChat(chatId);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle chat selection
  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    fetchMessages(chat.id);
    joinChat(chat.id);
  };
  
  // Handle sending message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedChat) return;
    
    // Send message via WebSocket
    const sentMessage = sendMessage(selectedChat.id, newMessage);
    
    // Add the sent message to the UI immediately
     if (sentMessage) {
       setMessages(prev => [...prev, sentMessage]);
     }
     
     // Clear the input field
       setNewMessage('');

  };
  
  // Handle typing indicator
  const handleTyping = (isTyping: boolean) => {
    if (!selectedChat) return;
    sendTypingStatus(selectedChat._id, isTyping);
  };
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Mark messages as read
    if (selectedChat && messages.length > 0 && user) { // Add check for user
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender !== user.id) { // Access user.id directly
        sendReadReceipt(lastMessage.id, lastMessage.sender, selectedChat.id);
      }
    }
  }, [messages, selectedChat, user, sendReadReceipt]);
  
  // Get chat name for display
  const getChatName = (chat: Chat) => {
    if (chat.isGroup) return chat.name || 'Group Chat';
    // For demo purposes, return a fixed name
    return 'Demo User';
  };
  
  // Get chat avatar
  const getChatAvatar = (chat: Chat) => {
    // For demo purposes, return a placeholder avatar
    return 'https://ui-avatars.com/api/?name=Demo+User&background=random';
  };
  
  // Check if user is online
  const isUserOnline = (userId: string) => {
    return onlineUsers.has(userId);
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar - Chats List */}
      <div className="w-1/3 border-r border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="p-4 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Chats</h2>
          <button className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div className="p-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search chats..."
              className="w-full p-2 pl-8 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-2 top-2.5 text-gray-500 dark:text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        
        <div className="overflow-y-auto h-[calc(100%-8rem)]">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500 dark:text-red-400">{error}</div>
          ) : chats.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">No chats found</div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => handleSelectChat(chat)}
                className={`flex items-center p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  selectedChat?.id === chat.id ? 'bg-gray-200 dark:bg-gray-700' : ''
                }`}
              >
                <div className="relative">
                  <img
                    src={getChatAvatar(chat)}
                    alt={getChatName(chat)}
                    className="w-12 h-12 rounded-full"
                  />
                  {chat.participants && chat.participants.some(p => p !== user?.id && isUserOnline(p)) && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <div className="flex justify-between">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">{getChatName(chat)}</h3>
                    {chat.lastMessage && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(chat.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {typingUsers.has(chat.id) ? (
                      <span className="text-green-500 dark:text-green-400">{typingUsers.get(chat.id)} is typing...</span>
                    ) : (
                      chat.lastMessage?.content || 'No messages yet'
                    )}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className="w-2/3 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center">
              <img
                src={getChatAvatar(selectedChat)}
                alt={getChatName(selectedChat)}
                className="w-10 h-10 rounded-full"
              />
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{getChatName(selectedChat)}</h3>
                {selectedChat.participants && selectedChat.participants.some(p => p !== user?.id && isUserOnline(p)) && (
                  <p className="text-xs text-green-500 dark:text-green-400">Online</p>
                )}
              </div>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
              {messages.length === 0 ? (
                <div className="flex justify-center items-center h-full text-gray-500 dark:text-gray-400">
                  No messages yet
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`mb-4 flex ${message.sender === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.sender === user?.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}
                    >
                      {message.content}
                      <div className="mt-1 text-xs flex justify-end">
                        <span className={message.sender === user?.id ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}>
                          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {message.sender === user?.id && (
                          <span className="ml-2">
                            {message.status === 'sent' && '✓'}
                            {message.status === 'delivered' && '✓✓'}
                            {message.status === 'read' && (
                              <span className="text-blue-300">✓✓</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Message Input */}
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700">
              <form onSubmit={handleSendMessage} className="flex items-center">
                <button
                  type="button"
                  className="p-2 text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onFocus={() => handleTyping(true)}
                  onBlur={() => handleTyping(false)}
                  placeholder="Type a message"
                  className="flex-1 mx-4 p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2 bg-blue-500 text-white rounded-full disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="mt-2 text-xl font-medium text-gray-900 dark:text-white">Welcome to WhatsApp Clone</h3>
              <p className="mt-1 text-gray-500 dark:text-gray-400">Select a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;