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
    
    }

    await client.query("BEGIN");

    //Create project
    const { rows: [project] } = await client.query(
      `INSERT INTO projects (name, description, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING project_id, name, description, start_date, end_date, created_by`,
      [name, description ?? null, startdate, endate, createdby]
    );

    const membersAdded = [];
    const invitationsCreated = [];

    //Add members or create invitations
    for (const m of members) {
      const email = String(m.email).trim();
      const role = (m.role ? String(m.role).toLowerCase() : "viewer");

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

    //Get all projects for this user
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

    //For each project, fetch its members
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
      project.members = memberResult.rows; 
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

    //Get project details + created_by
    const projectResult = await db.query(
      `select project_id, name, description, end_date,created_by
       from projects where project_id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return { success: false, status: 404, message: "Project not found" };
    }

    const project = projectResult.rows[0];

    //Get all members (project_members + admin)
    const membersResult = await db.query(
      `select u.username, pm.role
      from project_members pm
      join users u on pm.user_id = u.user_id
      where pm.project_id = $1`,
      [projectId]
    );


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

    //Find role of logged-in user
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

    // Get all tasks
    const taskResult = await db.query(
  `SELECT 
    t.task_id, 
    t.task_name, 
    t.status, 
    u.username AS assigned_to,  
    t.priority, 
    t.due_date,
    COALESCE(
        json_agg(
            json_build_object(
                'file_id', f.file_id,
                'file_name', f.file_name
            )
        ) FILTER (WHERE f.file_id IS NOT NULL),
        '[]'
    ) AS attachments
FROM tasks t
LEFT JOIN task_assignments ta ON t.task_id = ta.task_id
LEFT JOIN users u ON ta.user_id = u.user_id
LEFT JOIN file_attachments f ON t.task_id = f.task_id
WHERE t.project_id = $1
GROUP BY t.task_id, t.task_name, t.status, u.username, t.priority, t.due_date
ORDER BY t.due_date ASC;
`,
  [projectId]
);


    project.tasks = taskResult.rows;

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

export const createTasks = async (tasksData) => {
  try {
    if (!tasksData || !Array.isArray(tasksData) || tasksData.length === 0) {
      return { success: false, status: 400, message: "No tasks provided" };
    }

    const validStatuses = ["Pending", "Ongoing", "Completed"];
    const createdTasks = [];

    await db.query('BEGIN');

    for (const task of tasksData) {
      const { projectId, taskName, status = 'Pending', fileAttachment = null, dueDate = null, assignedMembers = [] } = task;

      if (!projectId || !taskName) {
        await db.query('ROLLBACK');
        return { success: false, status: 400, message: "Project ID and task name are required for all tasks" };
      }

      if (!validStatuses.includes(status)) {
        await db.query('ROLLBACK');
        return { success: false, status: 400, message: `Invalid status value for task "${taskName}"` };
      }

      // Insert task
      const taskResult = await db.query(
        `INSERT INTO tasks (project_id, task_name, status, file_attachment, due_date)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING task_id, project_id, task_name, status, file_attachment, due_date, created_at`,
        [projectId, taskName, status, fileAttachment, dueDate]
      );

      const createdTask = taskResult.rows[0];

      // Convert usernames to user IDs
      const userIds = [];
      for (const username of assignedMembers) {
        const userRes = await db.query(
          `SELECT user_id FROM users WHERE username = $1`,
          [username]
        );
        if (userRes.rows.length > 0) {
          userIds.push(userRes.rows[0].user_id);
        }
      }

      // Assign members if they exist in project_members and are not visitors
      for (const memberId of userIds) {
        const memberCheck = await db.query(
          `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
          [projectId, memberId]
        );

        if (memberCheck.rows.length > 0 && memberCheck.rows[0].role !== 'viewer') {
          await db.query(
            `INSERT INTO task_assignments (task_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [createdTask.task_id, memberId]
          );
        }
      }

      createdTasks.push(createdTask);
    }

    await db.query('COMMIT');

    return {
      success: true,
      status: 201,
      message: "Tasks created successfully",
      tasks: createdTasks
    };

  } catch (err) {
    await db.query('ROLLBACK');
    console.error("createTasks error:", err);
    return { success: false, status: 500, message: "Internal server error" };
  }
};

// calculate project progress
export const progress = async (projectId) => {
  try {
    if (!projectId) {
      return { success: false, status: 400, message: "Required fields missing" };
    }

    const totalTaskRes = await db.query(
      `select count(task_name) as total 
       from tasks 
       where project_id = $1`,
      [projectId]
    );
    const totalTask = parseInt(totalTaskRes.rows[0].total, 10);

    const completedTaskRes = await db.query(
      `select count(task_name) as completed 
       from tasks 
       where project_id = $1 and status = $2`,
      [projectId, "Completed"]
    );
    const completedTask = parseInt(completedTaskRes.rows[0].completed, 10);

    const pendingTaskRes = await db.query(
      `select count(task_name) as completed 
       from tasks 
       where project_id = $1 and status = $2`,
      [projectId, "Pending"]
    );
    const pendingTask = parseInt(pendingTaskRes.rows[0].completed, 10);

    const ongoingTaskRes = await db.query(
      `select count(task_name) as completed 
       from tasks 
       where project_id = $1 and status = $2`,
      [projectId, "Ongoing"]
    );
    const ongoingTask = parseInt(ongoingTaskRes.rows[0].completed, 10);


    const perc = totalTask === 0 ? 0 : (completedTask / totalTask) * 100;

    return {
      success: true,
      status: 200,
      message: "Progress calculated successfully",
      progress: perc.toFixed(2),
      completedTask,
      pendingTask,
      ongoingTask,
      totalTask
   
    };
  } catch (err) {
    console.error("progress error:", err);
    return { success: false, status: 500, message: "Internal server error" };
  }
};


export const workload = async (projectId) => {
  try {
    if (!projectId) {
      return { success: false, status: 400, message: "Required fields missing" };
    }

    // Step 1: Get all users assigned to tasks in the project
    const { rows: data } = await db.query(
      `
      SELECT 
        u.user_id,
        u.username AS user_name,
        t.task_id
      FROM tasks t
      JOIN task_assignments ta ON t.task_id = ta.task_id
      JOIN users u ON ta.user_id = u.user_id
      WHERE t.project_id = $1
      `,
      [projectId]
    );

    if (data.length === 0) {
      return { success: false, status: 404, message: "No participants found for this project" };
    }

    // Step 2: Count total tasks in the project
    const totalTasks = [...new Set(data.map(row => row.task_id))].length;

    // Step 3: Count number of assigned tasks per user
    const userTaskCount = {};

    data.forEach(row => {
      if (!userTaskCount[row.user_id]) {
        userTaskCount[row.user_id] = {
          name: row.user_name,
          assigned: 0
        };
      }
      userTaskCount[row.user_id].assigned += 1;
    });

    // Step 4: Calculate contribution percentage
    const users = Object.values(userTaskCount).map(user => {
      const percent = totalTasks > 0 ? ((user.assigned / totalTasks) * 100).toFixed(2) : "0.00";
      return {
        name: user.name,
        contribution: percent
      };
    });

    return {
      success: true,
      status: 200,
      message: "Workload calculated successfully",
      totalParticipants: users.length,
      users
    };

  } catch (error) {
    console.error("Error calculating workload:", error);
    return { success: false, status: 500, message: "Internal server error" };
  }
};
