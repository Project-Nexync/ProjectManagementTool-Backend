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


//edit duedate
export const editduedate = async (taskId, duedate) => {
  try {
    if (!taskId || !duedate) {
      return { success: false, status: 400, message: "Required fields missing" };
    }

    const checkQuery = `select * from tasks where task_id = $1;`;
    const checkResult = await db.query(checkQuery, [taskId]);

    if (checkResult.rowCount === 0) {
      return { success: false, status: 404, message: "Task not found" };
    }

    const updateQuery = `
      update tasks
      set due_date = $1
      where task_id = $2
      returning *;
    `;
    const updateResult = await db.query(updateQuery, [duedate, taskId]);

    return {
      success: true,
      status: 200,
      message: "Due date updated successfully",
      task: updateResult.rows[0],
    };
  } catch (err) {
    console.error("editduedate error:", err);
    return { success: false, status: 500, message: "Internal server error" };
  }
};

//add member

export const addMember = async (projectId, assignee, invitedby) => {
  const client = await db.connect();
  try {
    if (!projectId || !assignee) {
      return { success: false, status: 400, message: "Required fields missing" };
    }

    const members = Array.isArray(assignee) ? assignee : [];
    for (const m of members) {
      if (!m?.email) {
        return { success: false, status: 400, message: "Each assignee must include email" };
      }
    }

    await client.query("BEGIN");

    // Get project (ensure it exists)
    const { rows: projectRows } = await client.query(
      "SELECT * FROM projects WHERE project_id = $1",
      [projectId]
    );
    if (projectRows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, status: 404, message: "Project not found" };
    }
    const project = projectRows[0];

    const membersAdded = [];
    const invitationsCreated = [];

    // Add members or create invitations
    for (const m of members) {
      const email = String(m.email).trim();
      const role = (m.role ? String(m.role).toLowerCase() : "visitor");

      const { rows: userRows } = await client.query(
        "SELECT user_id FROM users WHERE email = $1",
        [email]
      );

      if (userRows.length > 0) {
        const userId = userRows[0].user_id;

        await client.query(
          `INSERT INTO project_members (project_id, user_id, role, invited_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
          [projectId, userId, role, invitedby]
        );

        membersAdded.push({ email, userId, role });
      } else {
        await client.query(
          `INSERT INTO project_invitations (project_id, email, role, invited_by)
           VALUES ($1, $2, $3, $4)`,
          [projectId, email, role, invitedby]
        );

        invitationsCreated.push({ email, role });
      }
    }

    await client.query("COMMIT");

    return {
      success: true,
      status: 201,
      message: "Members processed successfully",
      project,
      membersAdded,
      invitationsCreated
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Add member error:", err);
    return { success: false, status: 500, message: "Internal server error" };
  } finally {
    client.release();
  }
};
