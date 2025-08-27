import express from 'express';
import { addProject } from "../controllers/user.controller.js";
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/addProject',authenticateToken, addProject);

export default router;
