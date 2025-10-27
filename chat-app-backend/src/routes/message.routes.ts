/** @format */
import express from 'express';
import { getChatMessages, sendMessage } from '../controllers/message.controller';

const router = express.Router();

// Message routes
router.get('/:chatId', getChatMessages);
router.post('/', sendMessage);

export default router;