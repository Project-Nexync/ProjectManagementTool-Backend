import express from 'express';
import { editProgress, editduedate, addMember, addAssignee, editTaskDescription, deletetask } from "../controllers/edit.controller.js";
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/isRole.middleware.js';

const router = express.Router();

router.put('/:projectId/progress/:taskId',authenticateToken,authorize(["admin","manager","member"]), editProgress);
router.put('/:projectId/duedate/:taskId',authenticateToken,authorize(["admin","manager"]), editduedate);
router.post('/:projectId/addMember',authenticateToken,authorize(["admin","manager"]),addMember );
router.post('/:projectId/addMember/:taskId',authenticateToken,authorize(["admin","manager"]),addAssignee );
router.put('/:projectId/edittaskdes/:taskId',authenticateToken,authorize(["admin","manager"]), editTaskDescription);
router.put('/:projectId/deletetask/:taskId',authenticateToken,authorize(["admin","manager"]), deletetask);

export default router;
