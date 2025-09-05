import express from 'express';
import { addProject,viewAllProject,viewProject } from "../controllers/user.controller.js";
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/isRole.middleware.js';
//authorize(["manager"]),

const router = express.Router();
router.post('/addProject',authenticateToken, addProject);
router.get('/viewAllProject',authenticateToken, viewAllProject);
router.get('/:projectId',authenticateToken, viewProject);
export default router;
