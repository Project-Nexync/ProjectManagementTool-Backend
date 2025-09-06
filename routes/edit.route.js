import express from 'express';
import { editProgress, editduedate, addMember } from "../controllers/edit.controller.js";
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/isRole.middleware.js';


const router = express.Router();

router.put('/:projectId/progress/:taskId',authenticateToken,authorize(["admin","manager","member"]), editProgress);
router.put('/:projectId/duedate/:taskId',authenticateToken,authorize(["admin","manager"]), editduedate);
router.post('/:projectId/addMember',authenticateToken,authorize(["admin","manager"]),addMember );

export default router;
