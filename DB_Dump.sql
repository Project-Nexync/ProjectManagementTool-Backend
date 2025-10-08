-- -- Users Table
-- CREATE TABLE users (
--     user_id SERIAL PRIMARY KEY,
--     firstname VARCHAR(100),
--     lastname VARCHAR(100),
--     profile_pic VARCHAR(255),
--     email VARCHAR(255) UNIQUE NOT NULL,
--     password VARCHAR(255) NOT NULL,
--     notification BOOLEAN DEFAULT FALSE
-- );

-- -- Projects Table
-- CREATE TABLE projects (
--     project_id SERIAL PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     description TEXT,
--     start_date DATE,
--     end_date DATE,
--     created_by INT REFERENCES users(user_id) ON DELETE CASCADE,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- -- Project Members Table
-- CREATE TABLE project_members (
--     project_id INT REFERENCES projects(project_id) ON DELETE CASCADE,
--     user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
--     role VARCHAR(100),
--     invited_by INT REFERENCES users(user_id) ON DELETE SET NULL,
--     PRIMARY KEY (project_id, user_id)
-- );

-- -- Tasks Table
-- CREATE TABLE tasks (
--     task_id SERIAL PRIMARY KEY,
--     project_id INT REFERENCES projects(project_id) ON DELETE CASCADE,
--     task_name VARCHAR(255) NOT NULL,
--     description TEXT,
--     status VARCHAR(20) DEFAULT 'Pending' 
--         CHECK (status IN ('Pending','Ongoing','Completed')),
--     file_attachment VARCHAR(255),
--     priority VARCHAR(20) DEFAULT 'Medium' 
--         CHECK (priority IN ('Low','Medium','High')),
--     due_date DATE,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- -- Task Assignments Table
-- CREATE TABLE task_assignments (
--     task_id INT REFERENCES tasks(task_id) ON DELETE CASCADE,
--     user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
--     assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     PRIMARY KEY (task_id, user_id)
-- );

-- -- Project Invitations Table
-- CREATE TABLE project_invitations (
--     invite_id SERIAL PRIMARY KEY,
--     project_id INT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
--     email VARCHAR(255) NOT NULL,
--     role VARCHAR(100),
--     invited_by INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
--     invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     accepted_by INT REFERENCES users(user_id) ON DELETE SET NULL,
--     accepted_at TIMESTAMP
-- );

-- -- Notifications Table
-- CREATE TABLE notifications (
--     notification_id SERIAL PRIMARY KEY,
--     user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
--     type VARCHAR(50),
--     content TEXT,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- -- Chat Messages Table
-- CREATE TABLE chat_messages (
--     message_id SERIAL PRIMARY KEY,
--     project_id INT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
--     sender_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
--     message TEXT NOT NULL,
--     file_attachment VARCHAR(255),
--     sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- -- File Attachments Table
-- CREATE TABLE file_attachments (
--     file_id SERIAL PRIMARY KEY,
--     task_id INT REFERENCES tasks(task_id) ON DELETE CASCADE,
--     message_id INT REFERENCES chat_messages(message_id) ON DELETE CASCADE,
--     uploaded_by INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
--     file_path VARCHAR(255) NOT NULL,
--     uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     CONSTRAINT chk_attachment_parent CHECK (task_id IS NOT NULL OR message_id IS NOT NULL)
-- );


-- -- Auto-update tasks.updated_at on any UPDATE
-- CREATE OR REPLACE FUNCTION set_updated_at()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at := NOW();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER trg_tasks_updated_at
-- BEFORE UPDATE ON tasks
-- FOR EACH ROW
-- EXECUTE FUNCTION set_updated_at();


-- 1) Trigger function for invitation
CREATE OR REPLACE FUNCTION accept_invitations_after_user_insert()
RETURNS TRIGGER AS $$
BEGIN
  
  UPDATE project_invitations
  SET accepted_by = NEW.user_id,
      accepted_at = NOW()
  WHERE LOWER(email) = LOWER(NEW.email)
    AND accepted_by IS NULL;

  INSERT INTO project_members (project_id, user_id, role, invited_by)
  SELECT pi.project_id, NEW.user_id, pi.role, pi.invited_by
  FROM project_invitations pi
  WHERE LOWER(pi.email) = LOWER(NEW.email)
    AND pi.accepted_by = NEW.user_id
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Trigger on users
CREATE TRIGGER after_user_register_all_invites
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION accept_invitations_after_user_insert();


-- Trigers for notification
CREATE OR REPLACE FUNCTION notify_project_member_added()
RETURNS TRIGGER AS $$
DECLARE
  project_name TEXT;
BEGIN
  -- Get project name
  SELECT name INTO project_name
  FROM projects
  WHERE project_id = NEW.project_id;

  -- Insert notification with project name
  INSERT INTO notifications (user_id, type, content)
  VALUES (
    NEW.user_id,
    'Project Member Added',
    'You have been added to the project "' || project_name ||
    COALESCE('" as ' || NEW.role, '"') || '.'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate Trigger
DROP TRIGGER IF EXISTS trg_project_member_added ON project_members;

CREATE TRIGGER trg_project_member_added
AFTER INSERT ON project_members
FOR EACH ROW
EXECUTE FUNCTION notify_project_member_added();


CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
DECLARE
  task_name TEXT;
  project_name TEXT;
BEGIN
  -- Get task name and project name
  SELECT t.task_name, p.name
  INTO task_name, project_name
  FROM tasks t
  JOIN projects p ON t.project_id = p.project_id
  WHERE t.task_id = NEW.task_id;

  -- Insert notification without quotes
  INSERT INTO notifications (user_id, type, content)
  VALUES (
    NEW.user_id,
    'Task Assigned',
    'You have been assigned to task ' || task_name || ' in project ' || project_name || '.'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate Trigger
DROP TRIGGER IF EXISTS trg_task_assigned ON task_assignments;

CREATE TRIGGER trg_task_assigned
AFTER INSERT ON task_assignments
FOR EACH ROW
EXECUTE FUNCTION notify_task_assigned();

--task due_date
CREATE OR REPLACE FUNCTION notify_due_and_overdue_tasks()
RETURNS void AS $$
DECLARE
  r RECORD;
  project_name TEXT;
BEGIN
  -- 🔹 1. Notify members for tasks due today or tomorrow
  FOR r IN
    SELECT t.task_id, t.task_name, t.project_id, t.due_date, pm.user_id
    FROM tasks t
    JOIN project_members pm ON pm.project_id = t.project_id
    WHERE t.due_date <= CURRENT_DATE + INTERVAL '1 day'
      AND t.status != 'Completed'
  LOOP
    -- Get project name
    SELECT name INTO project_name FROM projects WHERE project_id = r.project_id;

    INSERT INTO notifications (user_id, type, content)
    VALUES (
      r.user_id,
      'Task Due Soon',
      'Reminder: The task ' || r.task_name || ' in project ' || project_name ||
      ' is due on ' || TO_CHAR(r.due_date, 'YYYY-MM-DD HH24:MI:SS') || '.'
    );
  END LOOP;

  -- 🔹 2. Notify members for overdue tasks (still not completed)
  FOR r IN
    SELECT t.task_id, t.task_name, t.project_id, t.due_date, pm.user_id
    FROM tasks t
    JOIN project_members pm ON pm.project_id = t.project_id
    WHERE t.due_date < CURRENT_DATE
      AND t.status != 'Completed'
  LOOP
    -- Get project name
    SELECT name INTO project_name FROM projects WHERE project_id = r.project_id;

    INSERT INTO notifications (user_id, type, content)
    VALUES (
      r.user_id,
      'Task Overdue',
      'The task ' || r.task_name || ' in project ' || project_name ||
      ' was due on ' || TO_CHAR(r.due_date, 'YYYY-MM-DD HH24:MI:SS') || ' and is now overdue.'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;



CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the daily notification job
SELECT cron.schedule(
    'daily_task_due_check',          -- job name
    '0 0 * * *',                     -- every day at 00:00 (midnight)
    'SELECT notify_due_and_overdue_tasks();'
);

--SELECT notify_due_and_overdue_tasks();

-- ALTER TABLE users
-- ADD COLUMN username VARCHAR(100);


-- ALTER TABLE tasks
-- ALTER COLUMN due_date TYPE TIMESTAMP;


-- Step 1: Drop the message_id column
ALTER TABLE file_attachments
DROP COLUMN message_id;

-- Step 2: Add the file_name column
ALTER TABLE file_attachments
ADD COLUMN file_name VARCHAR(255) NOT NULL;

-- Step 3: Add a new CHECK constraint (optional) if needed
-- This constraint will ensure that either task_id or file_name is not null.
ALTER TABLE file_attachments
ADD CONSTRAINT chk_attachment_parent CHECK (task_id IS NOT NULL OR file_name IS NOT NULL);


ALTER TABLE chat_messages
DROP COLUMN message_id;

ALTER TABLE notifications
ADD COLUMN is_read BOOLEAN DEFAULT FALSE;