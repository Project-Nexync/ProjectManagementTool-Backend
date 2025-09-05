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

//view Project

export const viewAllProject = async (userId) => {
  try {
    if (!userId) {
      return { success: false, status: 400, message: "Required fields missing" };
    }

    // Step 1: Get all projects for this user (either admin or member)
    const projectResult = await db.query(
      `
      select p.project_id, p.name, p.description, p.end_date, p.created_by
      from projects p
      left join project_members pm on p.project_id = pm.project_id
      where p.created_by = $1 or pm.user_id = $1
      group by p.project_id
      `,
      [userId]
    );

    const projects = projectResult.rows;

    // Step 2: For each project, fetch its members
    for (let project of projects) {
      const memberResult = await db.query(
        `
        select u.username as user_name
        from project_members pm
        join users u on pm.user_id = u.user_id
        where pm.project_id = $1
        `,
        [project.project_id]
      );
      project.members = memberResult.rows; // attach members
    }

    return {
      success: true,
      status: 200,
      message: "Projects fetched successfully",
      projects,
    };
  } catch (err) {
    console.error("viewProject error:", err);
    return { success: false, status: 500, message: "Internal server error" };
  }
};


//view project one by one

export const viewProject = async (userId, projectId) => {
  try {
    if (!projectId || !userId) {
      return { success: false, status: 400, message: "Required fields missing" };
    }

    // Step 1: Get project details + created_by
    const projectResult = await db.query(
      `select project_id, name, description, end_date,created_by
       from projects where project_id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return { success: false, status: 404, message: "Project not found" };
    }

    const project = projectResult.rows[0];

    // Step 2: Get all members (project_members + admin)
    const membersResult = await db.query(
      `select u.username, pm.role
      from project_members pm
      join users u on pm.user_id = u.user_id
      where pm.project_id = $1`,
      [projectId]
    );

    // Fetch admin (creator)
    const adminResult = await db.query(
      `select username from users where user_id = $1`,
      [project.created_by]
    );

    if (adminResult.rows.length > 0) {
      membersResult.rows.unshift({
        user_id: adminResult.rows[0].user_id,
        username: adminResult.rows[0].username,
        role: "Admin"
      });
    }

    project.members = membersResult.rows;

    // Step 3: Find role of logged-in user
    let userRole = "Visitor";
    if (project.created_by === userId) {
      userRole = "Admin";
    } else {
      const roleResult = await db.query(
        `select role from project_members where project_id = $1 and user_id = $2`,
        [projectId, userId]
      );
      if (roleResult.rows.length > 0) {
        userRole = roleResult.rows[0].role;
      }
    }

    // Step 4: Get all tasks
    const taskResult = await db.query(
      ` SELECT 
            t.task_id, 
            t.task_name, 
            t.description, 
            t.status, 
            ta.user_id AS assigned_to,  -- Fetch assigned user
            t.priority, 
            t.due_date
        FROM tasks t
        LEFT JOIN task_assignments ta ON t.task_id = ta.task_id  -- LEFT JOIN to include all tasks, even if no user is assigned
        WHERE t.project_id = $1; `,
      [projectId]
    );

    project.tasks = taskResult.rows;

    // Final response
    return {
      success: true,
      status: 200,
      message: "Project fetched successfully",
      project,
      userRole,
    };
  } catch (err) {
    console.error("viewProject error:", err);
    return { success: false, status: 500, message: "Internal server error" };
  }
};
