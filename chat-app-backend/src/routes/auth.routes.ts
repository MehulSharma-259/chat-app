/** @format */
import express from 'express';
import { register, login, getCurrentUser } from '../controllers/auth.controller';

const router = express.Router();

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.get('/me', getCurrentUser);

export default router;