import db from '../config/db.config.js';

export const isAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id;          
    const { projectId } = req.params;    

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: no user id" });
    }  

    const { rows } = await db.query(
      "SELECT created_by FROM projects WHERE project_id = $1",
      [projectId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    if (rows[0].created_by !== userId) {
      return res.status(403).json({ success: false, message: "Forbidden: not project Admin" });
    }

    next();
  } catch (error) {
    console.error("isAdmin middleware error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
