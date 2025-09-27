import db from '../config/db.config.js';

export const getChatHistory = async (projectId) => {
  const projectIdInt = parseInt(projectId);
  if (isNaN(projectIdInt)) throw new Error("Invalid projectId");

  const result = await db.query(
    `
    SELECT 
      cm.message_id,
      cm.sender_id,
      u.username AS sender_name,
      cm.message,
      cm.sent_at
    FROM chat_messages cm
    JOIN users u ON cm.sender_id = u.user_id
    WHERE cm.project_id = $1
    ORDER BY cm.sent_at ASC
    `,
    [projectIdInt]
  );

  return result.rows.map(row => ({
    id: row.message_id,
    message: row.message,
    timestamp: row.sent_at,
    senderId: row.sender_id,
    senderName: row.sender_name
  }));
};


export const saveMessage = async (projectId, senderId, message) => {
  // Insert the new message
  const result = await db.query(
    `INSERT INTO chat_messages (project_id, sender_id, message)
     VALUES ($1, $2, $3)
     RETURNING message_id, project_id, sender_id, message, sent_at`,
    [projectId, senderId, message]
  );

  const inserted = result.rows[0];

  // Fetch the username of the sender
  const userRes = await db.query(
    `SELECT username FROM users WHERE user_id = $1`,
    [inserted.sender_id]
  );

  const senderName = userRes.rows[0]?.username || "Unknown";

  return [
    {
      id: inserted.message_id,
      message: inserted.message,
      timestamp: inserted.sent_at,
      senderId: inserted.sender_id,
      senderName: senderName
    }
  ];
};
