import db from '../config/db.config.js';

export const isManager = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params; // assumes route like /projects/:projectId

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: no user id" });
    }

    const { rows } = await db.query(
      "SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2",
      [projectId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Membership not found" });
    }

    if (rows[0].role !== "Manager") {
      return res.status(403).json({ success: false, message: "Forbidden: not project member" });
    }

    next();
  } catch (error) {
    console.error("isMember middleware error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
