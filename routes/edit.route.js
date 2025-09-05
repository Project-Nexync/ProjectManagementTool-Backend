import express from 'express';
import { editProgress } from "../controllers/edit.controller.js";
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/isRole.middleware.js';

const router = express.Router();

router.put('/:projectId/progress/:taskId',authenticateToken,authorize(["manager","member"]), editProgress);


export default router;
