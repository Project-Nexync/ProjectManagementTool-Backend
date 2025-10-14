import { sendEmail } from "../services/email.service.js";
import db from "../config/db.config.js";

/**
 * Handles sending different types of project-related emails.
 * 
 * @param {Object} project - The project data
 * @param {Array} membersAdded - Existing users added to the project
 * @param {Array} invitationsCreated - Invited users not yet registered
 */
export async function handleProjectEmails(project, membersAdded, invitationsCreated) {
  try {
    const { name } = project;

    // Send emails to existing members
    for (const member of membersAdded) {
      const { email, role } = member;
      await sendEmail(
        email,
        "Added to a new project",
        `You have been added to the project "${name}" as a ${role}.`,
        `<h3>New Project Assigned</h3>
         <p>Hi,</p>
         <p>You’ve been added to the project <b>${name}</b> as a <b>${role}</b>.</p>
         <p>Please log in to your account to view the details.</p>`
      );
    }

    // Send invitations to new users
    for (const invite of invitationsCreated) {
      const { email, role } = invite;
      await sendEmail(
        email,
        "Project Invitation",
        `You are invited to join the project "${name}" as a ${role}.`,
        `<h3>You're Invited!</h3>
         <p>Hello,</p>
         <p>You’ve been invited to join the project <b>${name}</b> as a <b>${role}</b>.</p>
         <p>Please Register to accept the invitation.</p>`
      );
    }

  } catch (error) {
    console.error("Error in sending project cretion email:", error);
  }
}

export async function handleTaskEmails(createdTasks, tasksData) {
  try {
    for (const task of createdTasks) {
      const projectRes = await db.query(
        `SELECT name FROM projects WHERE project_id = $1`,
        [task.project_id]
      );
      const projectName = projectRes.rows[0]?.name || "Unknown Project";

      const membersWithEmail = [];
      const originalTask = tasksData.find(
        t => t.taskName === task.task_name && t.projectId === task.project_id
      );
      const assignedMembers = originalTask?.assignedMembers || [];

      for (const username of assignedMembers) {
        const userRes = await db.query(
          `SELECT email FROM users WHERE username = $1`,
          [username]
        );
        if (userRes.rows.length > 0) {
          membersWithEmail.push({ email: userRes.rows[0].email });
        }
      }

      // Send emails to members
      for (const member of membersWithEmail) {
        sendEmail(
          member.email,
          `New Task Assigned: ${task.task_name}`,
          `You have been assigned a new task "${task.task_name}" in project "${projectName}".`
        );
      }
    }
  } catch (err) {
    console.error("Error sending create task emails:", err);
  }
}


export async function handleDueDateEmails(task) {
  try {
    const projectRes = await db.query(
      `SELECT name FROM projects WHERE project_id = $1`,
      [task.project_id]
    );
    const projectName = projectRes.rows[0]?.name || "Unknown Project";

    // Fetch assigned members' emails
    const membersRes = await db.query(
      `SELECT u.email 
       FROM task_assignments ta
       JOIN users u ON ta.user_id = u.user_id
       WHERE ta.task_id = $1`,
      [task.task_id]
    );

    const emails = membersRes.rows.map(r => r.email);

    // Send email to each member
    for (const email of emails) {
      sendEmail(
        email,
        `Task Due Date Updated: ${task.task_name}`,
        `The due date for your task "${task.task_name}" in project "${projectName}" has been updated to ${task.due_date}.`
      );
    }
  } catch (err) {
    console.error("Error sending due date emails:", err);
  }
}

export async function handleProgressEmails(task) {
  try {

    const taskRes = await db.query(
      `SELECT project_id FROM tasks WHERE task_id = $1`,
      [task.task_id]
    );

    const projectId = taskRes.rows[0].project_id;

    // Get project info
    const projectRes = await db.query(
      `SELECT name, created_by FROM projects WHERE project_id = $1`,
      [projectId]
    );

    // Get manager emails
    const managerRes = await db.query(
      `SELECT u.email 
       FROM project_members pm
       JOIN users u ON pm.user_id = u.user_id
       WHERE pm.project_id = $1 AND LOWER(pm.role) = 'manager'`,
      [projectId]
    );

    // Get admin email
    const adminRes = await db.query(
      `SELECT email FROM users WHERE user_id = $1`,
      [project.created_by]
    );

    const emails = [
      ...managerRes.rows.map(r => r.email),
      ...adminRes.rows.map(r => r.email),
    ];

    // Send email to each
    for (const email of emails) {
      await sendEmail(
        email,
        `Task Progress Updated: ${task.task_name}`,
        `The progress of task "${task.task_name}" in project "${project.name}" has been updated to "${task.status}".`
      );
    }

  } catch (err) {
    console.error("Error sending progress emails:", err);
  }
}
