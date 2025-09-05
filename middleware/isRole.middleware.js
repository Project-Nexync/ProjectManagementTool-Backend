import db from '../config/db.config.js';

export const authorize = (roles = []) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { projectId } = req.params;

      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized: no user id" });
      }

      // Step 1: Check if user is project Admin (created_by)
      const projectResult = await db.query(
        "select created_by from projects where project_id = $1",
        [projectId]
      );

      if (projectResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Project not found" });
      }

      const createdBy = projectResult.rows[0].created_by;

      if (createdBy === userId) {
        // User is Admin → always allow
        return next();
      }

      // Step 2: If not admin, check role from project_members
      const memberResult = await db.query(
        "select role from project_members where project_id = $1 and user_id = $2",
        [projectId, userId]
      );

      if (memberResult.rows.length === 0) {
        return res.status(403).json({ success: false, message: "Forbidden: not a project member" });
      }

      const userRole = memberResult.rows[0].role; // can be Manager, Member, Visitor

      // Step 3: Check if userRole is in allowed roles
      if (!roles.includes(userRole)) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }

      next();
    } catch (error) {
      console.error("authorize middleware error:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  };
};
