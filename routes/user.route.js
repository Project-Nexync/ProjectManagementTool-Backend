import express from 'express';
import { addProject,viewAllProject,viewProject, createTasks, progress, workload, profile, updateProfile, getNotifications, isRead } from "../controllers/user.controller.js";
import { authenticateToken } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/isRole.middleware.js';


const router = express.Router();

router.post('/addProject',authenticateToken, addProject);
router.get('/viewAllProject',authenticateToken, viewAllProject);
router.get('/:projectId',authenticateToken,viewProject);
router.post('/:projectId/createTask',authenticateToken,authorize(["manager"]), createTasks);
router.get('/:projectId/progress',authenticateToken, progress);
router.get("/:projectId/workload",authenticateToken, workload);
router.get("/user/profile",authenticateToken, profile );
router.put("/user/profileupdate",authenticateToken, updateProfile);
router.get("/user/notification",authenticateToken, getNotifications);
router.put("/user/notification/isread",authenticateToken, isRead);


export default router;
