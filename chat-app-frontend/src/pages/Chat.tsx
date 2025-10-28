/** @format */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import axios from 'axios'; // Keep axios for initial chat/message loading

// Interfaces should match the WebSocketContext/Backend shapes
interface Message {
  id: string;
  sender: string; // User ID
  content: string;
  timestamp: string; // ISO String
  status: 'sent' | 'delivered' | 'read';
  chatId?: string;
}

interface Participant {
    _id: string;
    username: string;
    profilePic?: string;
    status?: string;
}

interface Chat {
  id: string;
  name: string;
  isGroup?: boolean;
  participants?: Participant[];
  lastMessage?: {
    id: string;
    sender: string;
    content: string;
    timestamp: string;
    status: 'sent' | 'delivered' | 'read';
  } | null;
  unreadCount?: number;
}


const ChatPage = () => {
  const { user, token, logout } = useAuth();
  const {
      sendMessage,
      joinChat,
      sendTypingStatus,
      sendReadReceipt,
      onlineUsers,
      typingUsers,
      messages: wsMessages, // Get messages directly from WebSocket context state
      isConnected, // Use connection status from context
      lastError: wsError // Use error from context
    } = useWebSocket();

  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false); // Still useful for initial load
  const [httpError, setHttpError] = useState<string | null>(null); // Separate error for HTTP requests

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Data Fetching ---
  const fetchChats = useCallback(async () => {
    if (!token) return;
    setLoadingChats(true);
    setHttpError(null);
    console.log("Fetching chats via HTTP...");
    try {
      const response = await axios.get<Chat[]>('http://localhost:8000/api/chats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Chats data received:', response.data);
      const sortedChats = response.data.sort((a, b) => {
            const timeA = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
            const timeB = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;
            return timeB - timeA;
        });
      setChats(sortedChats);
    } catch (err) {
      console.error('Error fetching chats:', err);
      setHttpError('Failed to load chats. Please try again.');
       if (axios.isAxiosError(err) && err.response?.status === 401) {
            logout();
        }
    } finally {
      setLoadingChats(false);
    }
  }, [token, logout]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Fetch historical messages for a selected chat
  const fetchMessages = useCallback(async (chatId: string) => {
    if (!token) return;
    setLoadingMessages(true);
    setHttpError(null);
    console.log(`Fetching historical messages for chat: ${chatId} via HTTP...`);
    try {
      const response = await axios.get<Message[]>(`http://localhost:8000/api/messages/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Historical messages received:', response.data);
      // Now, integrate these with WebSocket messages (WebSocketContext should be source of truth)
      // This part needs careful handling to avoid duplicates and maintain order.
      // For simplicity, we might just rely on WebSocket context to populate messages eventually.
      // OR: Initialize WebSocket context's message state here? (Depends on context design)
      // setMessages(response.data); // If ChatPage manages messages independently (less ideal with context)

    } catch (err) {
      console.error('Error fetching messages:', err);
      setHttpError('Failed to load messages for this chat.');
      if (axios.isAxiosError(err) && err.response?.status === 401) {
            logout();
        }
    } finally {
      setLoadingMessages(false);
    }
  }, [token, logout]);


  // --- Event Handlers ---
  const handleSelectChat = useCallback((chat: Chat) => {
    console.log(`Selected chat: ${chat.name} (${chat.id})`);
    if (selectedChat?.id !== chat.id) { // Only if changing chat
        setSelectedChat(chat);
        joinChat(chat.id); // Tell backend we are focusing on this chat
        // fetchMessages(chat.id); // Fetch historical messages for the new chat
    }
  }, [joinChat, selectedChat?.id]); // Add selectedChat?.id

  // Filter messages from context state for the currently selected chat
  const currentChatMessages = wsMessages.filter(msg => msg.chatId === selectedChat?.id)
                                        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()); // Ensure sorted

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !user) return;
    sendMessage(selectedChat.id, newMessage);
    setNewMessage('');
    // Clear typing indicator immediately after sending
    if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
        sendTypingStatus(selectedChat.id, false); // Explicitly send stop typing
    }
  };

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!selectedChat || !isConnected) return; // Only send if connected

    // Send typing=true if not already sent recently
    if (!typingTimeoutRef.current) {
        sendTypingStatus(selectedChat.id, true);
    } else {
        clearTimeout(typingTimeoutRef.current); // Reset timeout on new input
    }
    // Set a timeout to send typing=false
    typingTimeoutRef.current = setTimeout(() => {
        sendTypingStatus(selectedChat.id, false);
        typingTimeoutRef.current = null;
    }, 2000); // 2 seconds delay
};


 // --- Effects ---
  useEffect(() => { // Scroll to bottom
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentChatMessages]); // Trigger only when messages for the *current* chat change

  // Mark messages as read effect
 useEffect(() => {
    if (!selectedChat || !user || !isConnected || currentChatMessages.length === 0) return;

    // Find the latest message *in the current view* not sent by the user and not read
     const lastMessageFromOther = currentChatMessages
        .slice()
        .reverse()
        .find(msg => msg.sender !== user.id); // Find the actual last message displayed from someone else


    // Check if the latest message *overall* in the chat (even if not displayed yet) needs a read receipt
    const latestOverallMessage = wsMessages
        .filter(msg => msg.chatId === selectedChat.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];


    if (latestOverallMessage && latestOverallMessage.sender !== user.id && latestOverallMessage.status !== 'read') {
        // Debounce read receipts slightly? Or send immediately.
        console.log(`Found latest unread message ${latestOverallMessage.id}, sending read receipt.`);
        sendReadReceipt(latestOverallMessage.id, latestOverallMessage.sender, selectedChat.id);
    }

}, [selectedChat, user, isConnected, currentChatMessages, sendReadReceipt, wsMessages]); // Depend on currentChatMessages and wsMessages


  // --- Helper Functions ---
  const getChatName = useCallback((chat: Chat | null): string => {
    if (!chat) return '';
    if (chat.isGroup) return chat.name || 'Group Chat';
    const otherParticipant = chat.participants?.find(p => p._id !== user?.id);
    return otherParticipant?.username || 'Chat';
  }, [user?.id]); // Depend on user.id

  const getChatAvatar = useCallback((chat: Chat | null): string => {
     if (!chat) return 'https://ui-avatars.com/api/?name=?&background=ededed&color=888';
    const name = getChatName(chat);
     if (!chat.isGroup) {
         const otherParticipant = chat.participants?.find(p => p._id !== user?.id);
         if (otherParticipant?.profilePic) return otherParticipant.profilePic;
     }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`; // White text
  }, [user?.id, getChatName]); // Depend on user.id and getChatName

  const isParticipantOnline = useCallback((userId: string | undefined): boolean => {
    return !!userId && onlineUsers.has(userId);
  }, [onlineUsers]);

  const isOtherUserOnline = selectedChat?.participants?.some(p => p._id !== user?.id && onlineUsers.has(p._id));

  // Determine current typing user for the selected chat
  const typingUsername = selectedChat ? typingUsers.get(selectedChat.id) : null;


  // --- Render ---
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar */}
      <div className="w-full md:w-1/3 border-r border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
         {/* Header */}
         <div className="p-4 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
           <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Chats</h2>
           {/* Connection Status Indicator */}
           <div className={`text-xs px-2 py-1 rounded ${isConnected ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
           </div>
           <button onClick={logout} className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400" title="Logout">
             {/* Logout Icon */}
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
           </button>
         </div>
          {/* WS Error Display */}
         {wsError && (
             <div className="p-2 text-center text-xs text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900">
                 {wsError}
             </div>
         )}
         {/* Search */}
        <div className="p-2 flex-shrink-0"> {/* Search Input */} </div>
        {/* Chats List */}
        <div className="overflow-y-auto flex-grow">
          {loadingChats ? (
            <div className="p-4 text-center text-gray-500">Loading chats...</div>
          ) : httpError && chats.length === 0 ? ( // Show HTTP error if chats failed
            <div className="p-4 text-center text-red-500">{httpError}</div>
          ) : chats.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No chats yet.</div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => handleSelectChat(chat)}
                className={`flex items-center p-3 cursor-pointer border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 ${ selectedChat?.id === chat.id ? 'bg-gray-200 dark:bg-gray-600' : '' }`}
              >
                {/* Avatar & Online Status */}
                <div className="relative flex-shrink-0">
                  <img src={getChatAvatar(chat)} alt={getChatName(chat)} className="w-12 h-12 rounded-full object-cover" />
                  {!chat.isGroup && isParticipantOnline(chat.participants?.find(p => p._id !== user?.id)?._id) && (
                     <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-800"></span>
                  )}
                </div>
                {/* Chat Info */}
                 <div className="ml-3 flex-1 min-w-0">
                   <div className="flex justify-between items-center">
                     <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{getChatName(chat)}</h3>
                     {chat.lastMessage && <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">{new Date(chat.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                   </div>
                   <div className="flex justify-between items-center mt-1">
                     <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex-grow">
                       {typingUsers.has(chat.id) && typingUsers.get(chat.id) !== user?.username ? (
                         <span className="text-green-500 dark:text-green-400 italic">{typingUsers.get(chat.id)} is typing...</span>
                       ) : (
                         chat.lastMessage?.content || <span className="italic">No messages yet</span>
                       )}
                     </p>
                     {chat.unreadCount && chat.unreadCount > 0 && <span className="ml-2 flex-shrink-0 bg-blue-500 text-white text-xs font-semibold rounded-full px-2 py-0.5">{chat.unreadCount}</span>}
                   </div>
                 </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="w-full md:w-2/3 flex flex-col bg-gray-50 dark:bg-gray-900">
        {selectedChat ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center flex-shrink-0">
              <img src={getChatAvatar(selectedChat)} alt={getChatName(selectedChat)} className="w-10 h-10 rounded-full object-cover"/>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{getChatName(selectedChat)}</h3>
                <p className="text-xs">
                     {typingUsername && typingUsername !== user?.username ? (
                        <span className="text-green-500 dark:text-green-400 italic">typing...</span>
                     ) : isOtherUserOnline ? (
                         <span className="text-green-500 dark:text-green-400">Online</span>
                     ): (
                          <span className="text-gray-500 dark:text-gray-400">Offline</span>
                     )}
                 </p>
              </div>
            </div>
             {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2"> {/* Added space-y-2 */}
              {loadingMessages ? ( // Show loading indicator for historical messages
                 <div className="text-center py-4 text-gray-500">Loading messages...</div>
              ) : httpError ? ( // Show error if historical messages failed
                  <div className="text-center py-4 text-red-500">{httpError}</div>
              ): (
                currentChatMessages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender === user?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-lg shadow-sm ${ message.sender === user?.id ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none' }`}>
                      <p className="text-sm break-words">{message.content}</p> {/* Added break-words */}
                      <div className="mt-1 text-xs flex justify-end items-center space-x-1 opacity-80">
                        <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {message.sender === user?.id && (
                          <span>
                            {message.status === 'sent' && '✓'}
                            {message.status === 'delivered' && '✓✓'}
                            {message.status === 'read' && <span className="text-blue-300 dark:text-sky-300">✓✓</span>}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
               {/* No Messages Placeholder (if not loading and array is empty) */}
               {!loadingMessages && !httpError && currentChatMessages.length === 0 && (
                   <div className="text-center py-10 text-gray-500 dark:text-gray-400">No messages in this chat yet.</div>
               )}
              <div ref={messagesEndRef} />
            </div>
            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700 flex-shrink-0">
               <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                 {/* Input */}
                 <input
                   type="text"
                   value={newMessage}
                   onChange={handleInputChange}
                   placeholder="Type a message..."
                   className="flex-1 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                   autoComplete="off"
                   disabled={!isConnected} // Disable input if not connected
                 />
                 {/* Send Button */}
                 <button type="submit" disabled={!newMessage.trim() || !isConnected} className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed">
                   {/* Send Icon */}
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 16.571V11.5a1 1 0 112 0v5.071a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                 </button>
               </form>
             </div>
          </>
        ) : (
           // Placeholder
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-center p-4">
             {/* Placeholder Icon/Image */}
             <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <h3 className="text-xl font-medium text-gray-900 dark:text-white">Welcome{user ? `, ${user.username}` : ''}!</h3>
            <p className="mt-1 text-gray-500 dark:text-gray-400">Select a chat from the left to start messaging.</p>
             {!isConnected && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{wsError || 'Connecting...'}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;