import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3, BUCKET_NAME } from "../config/aws.config.js";
import client from "../config/db.config.js";

// Generate presigned URL for profile pic upload
export const generateProfilePicUrlService = async (fileName, fileType, userId) => {
  const key = `profile-pics/${Date.now()}_${fileName}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: fileType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1h

  // Update user's profile_pic field immediately with the key
  await client.query(
    "UPDATE users SET profile_pic = $1 WHERE user_id = $2",
    [key, userId]
  );

  return { url, key };
};

// Get profile pic URL
export const getProfilePicUrlService = async (userId) => {
  const { rows } = await client.query(
    "SELECT profile_pic FROM users WHERE user_id = $1",
    [userId]
  );
  if (rows.length === 0 || !rows[0].profile_pic) {
    throw new Error("Profile picture not found");
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: rows[0].profile_pic,
  });

  return await getSignedUrl(s3, command, { expiresIn: 7200 }); // 2h
};

/// Generate presigned URL for file upload
export const generateFileUrlService = async (fileName, fileType, userId, taskId) => {
  const key = `fileuploads/${Date.now()}_${fileName}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: fileType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1h

  // Save file metadata into DB
  await client.query(
    `INSERT INTO file_attachments(file_path, file_name, uploaded_by, task_id)
     VALUES ($1, $2, $3, $4)`,
    [key, fileName, userId, taskId]
  );

  return { url, key };
};

// Get file URL by fileId
export const getFileUrlService = async (fileId) => {
  const { rows } = await client.query(
    "SELECT file_path, file_name FROM file_attachments WHERE file_id = $1",
    [fileId]
  );

  if (rows.length === 0 || !rows[0].file_path) {
    throw new Error("File not found");
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: rows[0].file_path,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 7200 }); // 2h
  return { url, fileName: rows[0].file_name };
};

