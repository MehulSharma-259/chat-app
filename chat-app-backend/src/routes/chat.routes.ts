/** @format */
import express from 'express';
import { getUserChats, createChat } from '../controllers/chat.controller';

const router = express.Router();

// Chat routes
router.get('/', getUserChats);
router.post('/', createChat);

export default router;