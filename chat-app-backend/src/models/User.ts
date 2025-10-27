/** @format */
import mongoose from 'mongoose';

// User schema and model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePic: { type: String, default: '' },
  status: { type: String, default: 'Hey there! I am using WhatsApp Clone' },
  createdAt: { type: Date, default: Date.now }
});

// In-memory data for demo
export interface IUser {
  _id: string;
  username: string;
  email: string;
  password: string;
  profilePic: string;
  status: string;
}

// Export the users array for in-memory storage
export const users: IUser[] = [];

// Export the User model
export const User = mongoose.model('User', userSchema);

export default User;