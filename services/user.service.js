import db from '../config/db.config.js';

export const addProject = async ({ name, description, startdate, endate, createdby, assignee }) => {
  const client = await db.connect();
  try {
    if (!name || !startdate || !endate || !createdby) {
      return { success: false, status: 400, message: "Required fields missing" };
    }

    const members = Array.isArray(assignee) ? assignee : [];
    for (const m of members) {
      if (!m?.email) {
        return { success: false, status: 400, message: "Each assignee must include email" };
      }
      // ✅ no role validation here
    }

    await client.query("BEGIN");

    // 1) Create project
    const { rows: [project] } = await client.query(
      `INSERT INTO projects (name, description, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING project_id, name, description, start_date, end_date, created_by`,
      [name, description ?? null, startdate, endate, createdby]
    );

    const membersAdded = [];
    const invitationsCreated = [];

    // 2) Add members or create invitations
    for (const m of members) {
      const email = String(m.email).trim();
      const role = (m.role ? String(m.role).toLowerCase() : "visitor"); // default visitor

      const { rows: userRows } = await client.query(
        "SELECT user_id FROM users WHERE email = $1",
        [email]
      );

      if (userRows.length > 0) {
        const userId = userRows[0].user_id;

        await client.query(
          `INSERT INTO project_members (project_id, user_id, role,invited_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
          [project.project_id, userId, role,createdby]
        );

        membersAdded.push({ email, userId, role });
      } else {
        await client.query(
          `INSERT INTO project_invitations (project_id, email, role, invited_by)
           VALUES ($1, $2, $3, $4)`,
          [project.project_id, email, role, createdby]
        );

        invitationsCreated.push({ email, role });
      }
    }

    await client.query("COMMIT");

    return {
      success: true,
      status: 201,
      message: "Project created successfully",
      project,
      membersAdded,
      invitationsCreated
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Add project error:", err);
    return { success: false, status: 500, message: "Internal server error" };
  } finally {
    client.release();
  }
};
