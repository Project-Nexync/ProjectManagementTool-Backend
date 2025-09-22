import { generateProfilePicUrlService, getProfilePicUrlService, generateFileUrlService, getFileUrlService } from "../services/upload.service.js";

// Generate upload URL & update user table
export const generateProfilePicUrl = async (req, res) => {
    const { fileName, fileType } = req.body;
    const userId = req.user.id; // from authenticateToken
    const result = await generateProfilePicUrlService(fileName, fileType, userId);
    res.json({ message: "Profile pic URL generated", ...result });
};

// View profile picture
export const viewProfilePic = async (req, res) => {
    const userId = req.user.id;
    const url = await getProfilePicUrlService(userId);
    res.json({ url });
};


// Generate presigned URL and save file metadata
export const generateFileUrlController = async (req, res) => {
    const { taskId } = req.params;
    const { fileName, fileType } = req.body;
    const userId = req.user.id; // from authenticateToken
    const result = await generateFileUrlService(fileName, fileType, userId, taskId);
    res.json({ message: "Upload URL generated", ...result });
 
};

// Get signed URL to view/download a file
export const getFileUrlController = async (req, res) => {
    const fileId = req.params.file_id;
    const result = await getFileUrlService(fileId);
    res.json({ message: "File URL fetched", ...result });
};
