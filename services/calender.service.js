import { google } from "googleapis";
import db from '../config/db.config.js';

/**
 * Add tasks with deadlines to Google Calendar for multiple users
 * @param {Array} tasks - Array of tasks {task_name, due_date, project_id}
 * @param {Array} assignedUserIds - Array of user IDs
 */
export async function addDeadlineToGoogleCalendar(tasks, assignedUserIds) {
  try {
    if (!tasks || tasks.length === 0 || !assignedUserIds || assignedUserIds.length === 0) return;

    for (const task of tasks) {
      if (!task.due_date) continue; 

      for (const userId of assignedUserIds) {
        // Fetch Google tokens from DB
        const userRes = await db.query(
          `SELECT google_tokens FROM users WHERE user_id = $1`,
          [userId]
        );

        if (userRes.rows.length === 0 || !userRes.rows[0].google_tokens) {
          console.log(`No Google tokens found for user ${userId}, skipping.`);
          continue;
        }

        const userTokens = userRes.rows[0].google_tokens;

        const maskedTokens = {
          access_token: userTokens.access_token ? userTokens.access_token.slice(0, 10) + '...' : null,
          refresh_token: userTokens.refresh_token ? userTokens.refresh_token.slice(0, 10) + '...' : null,
          scope: userTokens.scope,
          token_type: userTokens.token_type,
          expiry_date: userTokens.expiry_date
        };

        //OAuth2 client
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials(userTokens);

        const calendar = google.calendar({ version: "v3", auth: oauth2Client });

        const event = {
          summary: task.task_name,
          description: `Deadline for project ID: ${task.project_id}`,
          start: {
            dateTime: new Date(task.due_date).toISOString(),
            timeZone: 'Asia/Colombo'
          },
          end: {
            dateTime: new Date(new Date(task.due_date).getTime() + 60 * 60 * 1000).toISOString(), // 1 hour
            timeZone: 'Asia/Colombo'
          }
        };
        try {
          // Insert event in Google Calendar
          const response = await calendar.events.insert({
            calendarId: "primary",
            requestBody: event
          });
        } catch (err) {
          console.error(`Failed to insert event for user ${userId}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error("Failed to add tasks to Google Calendar:", err.message);
  }
}
