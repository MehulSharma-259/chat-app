# Project Structure

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
