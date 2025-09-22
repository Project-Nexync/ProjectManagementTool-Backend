import db from '../config/db.config.js';

export const authorize = (roles = []) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { projectId,taskId } = req.params;

      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized: no user id" });
      }

      //Check if user is project Admin (created_by)
      const projectResult = await db.query(
        "select created_by from projects where project_id = $1",
        [projectId]
      );

      if (projectResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Project not found" });
      }

      const createdBy = projectResult.rows[0].created_by;

      if (createdBy === userId) {
        return next();
      }

      //If not admin, check role from project_members
      const memberResult = await db.query(
        "select role from project_members where project_id = $1 and user_id = $2",
        [projectId, userId]
      );

      if (memberResult.rows.length === 0) {
        return res.status(403).json({ success: false, message: "Forbidden: not a project member" });
      }

      const userRole = memberResult.rows[0].role; 

      //Check if userRole is in allowed roles
      if (!roles.includes(userRole)) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }

      if (userRole === "member") {
        if (!taskId) {
          return res.status(403).json({ success: false, message: "Task ID required for members" });
        }

        const taskAssignment = await db.query(
          "SELECT * FROM task_assignments WHERE task_id = $1 AND user_id = $2",
          [taskId, userId]
        );

        if (taskAssignment.rows.length === 0) {
          return res.status(403).json({ success: false, message: "Forbidden: member not assigned to this task" });
        }
      }

      next();
    } catch (error) {
      console.error("authorize middleware error:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  };
};
