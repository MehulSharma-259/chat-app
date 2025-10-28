/** @format */
import http from 'http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './app'; // Your Express app
import { initializeWebSocket } from './websocket/socket'; // Import ws initializer

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 8000;

// MongoDB connection (Optional - Uncomment if using a real DB)
/*
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI environment variable is not set.');
  process.exit(1);
}
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err)
    process.exit(1);
  });
*/
console.log('✅ Using mock database for demonstration');

// Create HTTP server using the Express app
const server = http.createServer(app);

// Initialize WebSocket server and attach it to the HTTP server
initializeWebSocket(server);

// Start the HTTP server
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ WebSocket server initialized on ws://localhost:${PORT}`);
});

export default server;