import db from '../config/db.config.js';

export const editProgress = async (taskId, progress) => { 
  try {
    if (!taskId || !progress) {
      return { success: false, status: 400, message: "Required fields missing" };
    }

    // Validate progress value
    const validStatuses = ["Pending", "Ongoing", "Completed"];
    if (!validStatuses.includes(progress)) {
      return { success: false, status: 400, message: "Invalid progress value" };
    }

    // Update task status in the database
    const updateResult = await db.query(
      `UPDATE tasks 
       SET status = $1
       WHERE task_id = $2
       RETURNING task_id, task_name, status`,
      [progress, taskId]
    );

    if (updateResult.rows.length === 0) {
      return { success: false, status: 404, message: "Task not found" };
    }

    return {
      success: true,
      status: 200,
      message: "Progress updated successfully",
      task: updateResult.rows[0],
    };
  } catch (err) {
    console.error("editProgress error:", err);
    return { success: false, status: 500, message: "Internal server error" };
  }
};
