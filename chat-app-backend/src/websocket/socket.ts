/** @format */
import { WebSocketServer, WebSocket, RawData } from 'ws';
import http from 'http';
import jwt from 'jsonwebtoken';
import url from 'url';
import { messages, IMessage } from '../models/Message';
import { chats, IChat } from '../models/Chat';
import { users, IUser } from '../models/User';

interface WebSocketWithAuth extends WebSocket {
    isAlive?: boolean;
    userId?: string;
    username?: string;
    currentChatId?: string;
}

const clients = new Map<string, WebSocketWithAuth>();
const chatRooms = new Map<string, Set<string>>();

// --- WebSocket Initialization ---
export const initializeWebSocket = (server: http.Server) => {
    const wss = new WebSocketServer({ server });

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
        console.error("FATAL ERROR: JWT_SECRET is not defined for WebSocket authentication.");
        process.exit(1);
    }

    wss.on('connection', (ws: WebSocketWithAuth, req) => {
        const requestUrl = req.url || '';
        const parameters = url.parse(requestUrl, true).query;
        const token = parameters.token as string;
        console.log(`WebSocket connection attempt from URL: ${requestUrl}`);

        if (!token) { /* ... handle missing token ... */ ws.close(1008, "Token required"); return; }

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
            const user = users.find(u => u._id === decoded.id);
            if (!user) { /* ... handle user not found ... */ ws.close(1008, "Invalid token: User not found"); return; }

            ws.userId = user._id;
            ws.username = user.username;
            ws.isAlive = true;

            if (clients.has(ws.userId)) { /* ... handle duplicate connection ... */ }
            clients.set(ws.userId, ws);
             // **FIXED**: Removed incorrect ws.id reference
            console.log(`WebSocket Client connected: ${ws.username} (ID: ${ws.userId})`);

            sendJson(ws, { type: 'auth_success', payload: { userId: ws.userId, username: ws.username } });
            sendJson(ws, { type: 'online_users', payload: Array.from(clients.keys()) });
            broadcast(ws, { type: 'user_status', payload: { userId: ws.userId, status: 'online' } });

            ws.on('message', (messageBuffer: Buffer) => handleMessage(ws, messageBuffer));
            ws.on('pong', () => { ws.isAlive = true; });
            ws.on('close', (code, reason) => handleClose(ws, code, reason.toString()));
            ws.on('error', (error: Error) => handleError(ws, error));

        } catch (error: unknown) { /* ... handle auth error ... */ }
    });

    // --- Heartbeat ---
     const interval = setInterval(() => {
        wss.clients.forEach((client) => {
            const ws = client as WebSocketWithAuth;
            if (!ws.userId) return; // Skip unauthenticated
            if (!ws.isAlive) {
                console.log(`WebSocket client ${ws.username} (ID: ${ws.userId}) timed out. Terminating.`);
                // Clean up before terminating
                if (ws.currentChatId) leaveChatRoom(ws.userId, ws.currentChatId);
                clients.delete(ws.userId);
                broadcast(ws, { type: 'user_status', payload: { userId: ws.userId, status: 'offline' } });
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => { clearInterval(interval); console.log('WebSocket Server closed.'); });
    console.log('WebSocket Server initialized.');
};

// --- Message Handling ---
const handleMessage = (ws: WebSocketWithAuth, messageBuffer: Buffer) => {
    if (!ws.userId) return;
    try {
        const message = JSON.parse(messageBuffer.toString());
        console.log(`Received message from ${ws.username}:`, message);
        switch (message.type) {
            case 'join_chat': handleJoinChat(ws, message.payload?.chatId); break;
            case 'chat_message': handleChatMessage(ws, message.payload); break;
            case 'typing': handleTyping(ws, message.payload, true); break;
            case 'stop_typing': handleTyping(ws, message.payload, false); break;
            case 'read_receipt': handleReadReceipt(ws, message.payload); break;
            default:
                console.warn(`Received unknown message type from ${ws.username}: ${message.type}`);
                 sendJson(ws, { type: 'error', payload: { message: `Unknown message type: ${message.type}` }});
        }
    } catch (error) {
        console.error(`Failed to parse message from ${ws.username} or handle message:`, error);
        sendJson(ws, { type: 'error', payload: { message: 'Invalid message format' }});
    }
};

// --- Specific Event Logic Definitions (Defined only ONCE here) ---
const handleJoinChat = (ws: WebSocketWithAuth, chatId: string | undefined) => {
     if (!ws.userId || !chatId) return;
     if (ws.currentChatId && ws.currentChatId !== chatId) {
         leaveChatRoom(ws.userId, ws.currentChatId);
         console.log(`User ${ws.username} left chat room: ${ws.currentChatId}`);
     }
     const chat = chats.find(c => c._id === chatId);
     if (!chat || !chat.participants.includes(ws.userId)) {
        console.warn(`User ${ws.username} denied joining unauthorized chat ${chatId}`);
        sendJson(ws, { type: 'error', payload: { message: `Not authorized for chat ${chatId}` }});
        return;
     }
    if (!chatRooms.has(chatId)) chatRooms.set(chatId, new Set());
    chatRooms.get(chatId)?.add(ws.userId);
    ws.currentChatId = chatId;
    console.log(`User ${ws.username} joined chat room: ${chatId}`);
    sendJson(ws, { type: 'joined_chat', payload: { chatId } });
};

const handleChatMessage = (ws: WebSocketWithAuth, payload: { chatId: string; content: string } | undefined) => {
    if (!ws.userId || !payload || !payload.chatId || !payload.content) return;
    const { chatId, content } = payload;
    if (ws.currentChatId !== chatId) {
        console.warn(`User ${ws.username} tried to send message to chat ${chatId} but is currently in ${ws.currentChatId}`);
        sendJson(ws, { type: 'error', payload: { message: 'Must join chat before sending message' }});
        return;
    }
     const chat = chats.find(c => c._id === chatId);
     if (!chat || !chat.participants.includes(ws.userId)) {
        console.warn(`User ${ws.username} attempted send to unauthorized chat ${chatId}`);
        sendJson(ws, { type: 'error', payload: { message: `Not authorized for chat ${chatId}` }});
        return;
    }
    const newMessage: IMessage = {
      _id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sender: ws.userId, content, chatId: chatId, status: 'sent', timestamp: new Date(), readBy: [ws.userId]
    };
    messages.push(newMessage);
    if (chat) chat.updatedAt = new Date();
    console.log(`Message from ${ws.username} in chat ${chatId}: "${content}"`);
    const messageToSend = {
        type: 'receive_message',
        payload: { id: newMessage._id, sender: newMessage.sender, content: newMessage.content, timestamp: newMessage.timestamp.toISOString(), status: newMessage.status, chatId: newMessage.chatId }
    };
    broadcastToChat(chatId, messageToSend); // Send to all including sender
    const deliveredUpdate = { type: 'message_status_update', payload: { messageId: newMessage._id, chatId: chatId, status: 'delivered' } };
    broadcastToChat(chatId, deliveredUpdate, ws.userId, true);
};

const handleTyping = (ws: WebSocketWithAuth, payload: { chatId: string } | undefined, isTyping: boolean) => {
    if (!ws.userId || !ws.username || !payload || !payload.chatId) return;
    const { chatId } = payload;
    if (ws.currentChatId !== chatId) return;
    const eventType = isTyping ? 'typing' : 'stop_typing';
    const message = { type: eventType, payload: { userId: ws.userId, username: ws.username, chatId: chatId } };
    console.log(`${ws.username} ${isTyping ? 'is' : 'stopped'} typing in chat ${chatId}`);
    broadcastToChat(chatId, message, ws.userId, true);
};

const handleReadReceipt = (ws: WebSocketWithAuth, payload: { messageId: string; senderId: string; chatId: string } | undefined) => {
   if (!ws.userId || !payload || !payload.messageId || !payload.senderId || !payload.chatId) return;
   const { messageId, senderId, chatId } = payload;
   const readerUserId = ws.userId;
   const messageIndex = messages.findIndex(m => m._id === messageId && m.chatId === chatId);
   if (messageIndex === -1) { console.warn(`Read receipt for non-existent message ${messageId} in chat ${chatId}`); return; }
   const message = messages[messageIndex];
   if (!message) return;
   if (message.sender === readerUserId) return;
   if (!message.readBy) message.readBy = [];
   if (message.readBy && !message.readBy.includes(readerUserId)) {
       message.readBy.push(readerUserId);
       const chat = chats.find(c => c._id === chatId);
       let allRead = false;
       if (chat) {
           const recipients = chat.participants.filter(pId => pId !== message.sender);
           allRead = recipients.every(rId => message.readBy?.includes(rId));
           if (allRead) message.status = 'read';
       }
       messages[messageIndex] = message;
       console.log(`User ${readerUserId} read message ${messageId} in chat ${chatId}. All read: ${allRead}`);
       const senderWs = clients.get(senderId);
       if (senderWs && senderWs.readyState === WebSocket.OPEN) {
           sendJson(senderWs, { type: 'message_status_update', payload: { messageId: messageId, chatId: chatId, status: message.status, readerId: readerUserId } });
       }
   }
};

const handleClose = (ws: WebSocketWithAuth, code: number, reason: string) => {
    if (ws.userId) {
        console.log(`WebSocket Client disconnected: ${ws.username} (ID: ${ws.userId}). Code: ${code}, Reason: ${reason}`);
        if (ws.currentChatId) leaveChatRoom(ws.userId, ws.currentChatId);
        clients.delete(ws.userId);
        broadcast(ws, { type: 'user_status', payload: { userId: ws.userId, status: 'offline' } });
    } else {
        console.log(`WebSocket Client disconnected (unauthenticated). Code: ${code}, Reason: ${reason}`);
    }
};
const handleError = (ws: WebSocketWithAuth, error: Error) => { console.error(`WebSocket error for ${ws.username || 'unauthenticated client'}:`, error.message); };

// --- Utility Functions (Defined only ONCE here) ---
const sendJson = (ws: WebSocket, data: object) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); };
const broadcast = (senderWs: WebSocketWithAuth, data: object) => { clients.forEach((client) => { if (client !== senderWs && client.readyState === WebSocket.OPEN) sendJson(client, data); }); };
const broadcastToChat = (chatId: string, data: object, senderUserId?: string, requireOnline: boolean = false) => {
    const roomMembers = chatRooms.get(chatId); if (!roomMembers) return;
    roomMembers.forEach(userId => {
        if (senderUserId && userId === senderUserId && requireOnline) return;
        const recipientWs = clients.get(userId);
        if (recipientWs && recipientWs.readyState === WebSocket.OPEN) sendJson(recipientWs, data);
    });
};
const leaveChatRoom = (userId: string, chatId: string) => {
    const roomMembers = chatRooms.get(chatId);
    if (roomMembers) { roomMembers.delete(userId); if (roomMembers.size === 0) chatRooms.delete(chatId); }
};

// --- REMOVED Duplicate function definitions from the end ---