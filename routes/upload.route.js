import express from "express";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { generateProfilePicUrl, viewProfilePic, generateFileUrlController, getFileUrlController } from "../controllers/upload.controller.js";

const router = express.Router();

// Upload profile pic (generate presigned URL + update user table)
router.post("/profile-pic/generate-url",authenticateToken,  generateProfilePicUrl);
router.get("/profile-pic/view", authenticateToken, viewProfilePic);

// Generate presigned URL for file upload
router.post("/file/generate-url", authenticateToken, generateFileUrlController);
router.get("/file/:file_id", authenticateToken, getFileUrlController);

export default router;
