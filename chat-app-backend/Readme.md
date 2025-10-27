# Chat App Backend

A real-time chat application backend built with Express, Socket.IO, and TypeScript.

## Project Structure

```
chat-app-backend/
│
├── src/
│   ├── config/
│   │   └── db.ts                 # MongoDB connection setup
│   │
│   ├── models/
│   │   ├── user.model.ts         # User schema
│   │   ├── message.model.ts      # Message schema
│   │   └── conversation.model.ts # Conversation schema
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts    # Register, login, logout
│   │   ├── message.controller.ts # Save & get messages
│   │   └── user.controller.ts    # Get users, update status
│   │
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   └── message.routes.ts
│   │
│   ├── websocket/
│   │   └── socket.ts             # All ws logic (connection, broadcast)
│   │
│   ├── middleware/
│   │   └── authMiddleware.ts     # JWT verification, etc.
│   │
│   ├── utils/
│   │   └── generateToken.ts      # JWT token helper
│   │
│   ├── app.ts                    # Express app setup
│   └── server.ts                 # Entry point (Express + WS + Mongo)
│
├── .env                          # Secrets (Mongo URI, JWT secret, etc.)
├── .gitignore
├── package.json
└── README.md
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
  - Body: `{ username: string, email: string, password: string }`
  - Returns: `{ id: string, username: string, email: string, token: string }`

- `POST /api/auth/login` - Login with existing credentials
  - Body: `{ email: string, password: string }`
  - Returns: `{ id: string, username: string, email: string, token: string }`

### Chats

- `GET /api/chats` - Get all chats for the authenticated user
  - Headers: `Authorization: Bearer {token}`
  - Returns: Array of chats with last message and unread count
  ```typescript
  {
    id: string;
    name: string;
    lastMessage?: {
      id: string;
      content: string;
      timestamp: Date;
      status: string;
    };
    unreadCount: number;
  }[]
  ```

- `POST /api/chats` - Create a new chat with another user
  - Headers: `Authorization: Bearer {token}`
  - Body: `{ receiverId: string }`
  - Returns: Created chat object

### Messages

- `GET /api/messages/:chatId` - Get all messages for a specific chat
  - Headers: `Authorization: Bearer {token}`
  - Returns: Array of messages
  ```typescript
  {
    id: string;
    sender: string;
    content: string;
    timestamp: Date;
    status: string;
  }[]
  ```

- `POST /api/messages` - Send a new message in a chat
  - Headers: `Authorization: Bearer {token}`
  - Body: `{ chatId: string, content: string }`
  - Returns: Created message object

## WebSocket Events

- `connection` - Client connects to WebSocket server
- `join_chat` - Join a specific chat room
  - Data: `{ userId: string, chatId: string }`
- `send_message` - Send a message to a chat
  - Data: `{ userId: string, chatId: string, content: string }`
- `typing` - Indicate user is typing
  - Data: `{ userId: string, chatId: string, isTyping: boolean }`
- `stop_typing` - Indicate user stopped typing
  - Data: `{ userId: string, chatId: string }`
- `disconnect` - Client disconnects from WebSocket server

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

4. Start production server:
   ```bash
   npm start
   ```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=8000
JWT_SECRET=your_jwt_secret_here
MONGO_URI=your_mongodb_uri_here
```
