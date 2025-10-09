import express from 'express';
import { editProgress, editduedate, addMember, addAssignee, editTaskDescription, deletetask,editProject,deleteProject } from "../controllers/edit.controller.js";
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/isRole.middleware.js';

const router = express.Router();

router.put('/:projectId/progress/:taskId',authenticateToken,authorize(["manager","member"]), editProgress);
router.put('/:projectId/duedate/:taskId',authenticateToken,authorize(["manager"]), editduedate);
router.post('/:projectId/addMember',authenticateToken,authorize(["manager"]),addMember );
router.post('/:projectId/addMember/:taskId',authenticateToken,authorize(["manager"]),addAssignee );
router.put('/:projectId/edittaskdes/:taskId',authenticateToken,authorize(["manager"]), editTaskDescription);
router.put('/:projectId/deletetask/:taskId',authenticateToken,authorize(["manager"]), deletetask);
router.put('/:projectId/editproject',authenticateToken,authorize(["manager"]), editProject);
router.delete('/:projectId/deleteproject',authenticateToken,authorize(["manager"]), deleteProject);

export default router;
