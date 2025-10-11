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

ALTER TABLE chat_messages
ADD COLUMN message_id SERIAL PRIMARY KEY;

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

-- CREATE TABLE saved_project (
--     project_id INT,
--     user_id INT,
--     PRIMARY KEY (project_id, user_id),
--     FOREIGN KEY (project_id) REFERENCES projects(project_id),
--     FOREIGN KEY (user_id) REFERENCES users(user_id)
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
  manager_id INT;
BEGIN
  -- 🔹 1. Notify assigned members for tasks due today or tomorrow
  FOR r IN
    SELECT 
      t.task_id, t.task_name, t.project_id, t.due_date, ta.user_id
    FROM tasks t
    JOIN task_assignments ta ON ta.task_id = t.task_id
    WHERE DATE(t.due_date) = DATE(CURRENT_DATE + INTERVAL '1 day')
      AND t.status != 'Completed'
  LOOP
    -- Always fetch project name (safe)
    SELECT name INTO project_name 
    FROM projects WHERE project_id = r.project_id;

    -- Insert only if same message not exists
    IF NOT EXISTS (
      SELECT 1 FROM notifications 
      WHERE user_id = r.user_id
        AND type = 'Task Due Soon'
        AND content LIKE '%' || r.task_name || '%'
    ) THEN
      INSERT INTO notifications (user_id, type, content)
      VALUES (
        r.user_id,
        'Task Due Soon',
        'Reminder: The task "' || r.task_name || '" in project "' || project_name ||
        '" is due on ' || TO_CHAR(r.due_date, 'YYYY-MM-DD') || '.'
      );
    END IF;
  END LOOP;


  -- 🔹 2. Notify assigned members + project manager for overdue tasks
  FOR r IN
    SELECT 
      t.task_id, t.task_name, t.project_id, t.due_date, ta.user_id
    FROM tasks t
    JOIN task_assignments ta ON ta.task_id = t.task_id
    WHERE t.due_date < CURRENT_DATE
      AND t.status != 'Completed'
  LOOP
    -- Get project name (always exists)
    SELECT name INTO project_name 
    FROM projects WHERE project_id = r.project_id;

    -- Get manager ID (if any)
    SELECT pm.user_id INTO manager_id
    FROM project_members pm
    WHERE pm.project_id = r.project_id AND pm.role ILIKE 'Manager'
    LIMIT 1;

    -- Notify assigned member
    IF NOT EXISTS (
      SELECT 1 FROM notifications 
      WHERE user_id = r.user_id
        AND type = 'Task Overdue'
        AND content LIKE '%' || r.task_name || '%'
    ) THEN
      INSERT INTO notifications (user_id, type, content)
      VALUES (
        r.user_id,
        'Task Overdue',
        'The task "' || r.task_name || '" in project "' || project_name ||
        '" was due on ' || TO_CHAR(r.due_date, 'YYYY-MM-DD') || ' and is now overdue.'
      );
    END IF;

    -- Notify manager (if exists and not already notified)
    IF manager_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM notifications 
        WHERE user_id = manager_id
          AND type = 'Task Overdue Alert'
          AND content LIKE '%' || r.task_name || '%'
      ) THEN
        INSERT INTO notifications (user_id, type, content)
        VALUES (
          manager_id,
          'Task Overdue Alert',
          'Task "' || r.task_name || '" in project "' || project_name || '" is overdue.'
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;




CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the daily notification job




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

-- Project due
CREATE OR REPLACE FUNCTION notify_due_and_overdue_projects()
RETURNS void AS $$
DECLARE
    proj RECORD;
    manager RECORD;
    now_time DATE := CURRENT_DATE;
BEGIN
    -- Loop through projects that are overdue or due within 1 day
    FOR proj IN
        SELECT 
            p.project_id,
            p.name AS project_name,
            p.end_date,
            p.created_by AS owner_id
        FROM projects p
        WHERE p.end_date IS NOT NULL
          AND (
               p.end_date < now_time  -- overdue
               OR DATE(p.end_date) = DATE(CURRENT_DATE + INTERVAL '1 day')  -- due within 1 day
          )
    LOOP
        -- Identify project manager
        SELECT user_id INTO manager
        FROM project_members
        WHERE project_id = proj.project_id AND LOWER(role) = 'manager'
        LIMIT 1;

        -- Notify project owner
        INSERT INTO notifications (user_id, type, content)
        SELECT proj.owner_id,
               CASE 
                 WHEN proj.end_date < now_time THEN 'Project Overdue'
                 ELSE 'Project Due Soon'
               END,
               CASE 
                 WHEN proj.end_date < now_time THEN
                   FORMAT('Project %s is overdue. Please take necessary action.', proj.project_name)
                 ELSE
                   FORMAT('Project %s is due within the next day. Please ensure completion.', proj.project_name)
               END
        WHERE NOT EXISTS (
            SELECT 1 FROM notifications
            WHERE user_id = proj.owner_id
              AND DATE(created_at) = CURRENT_DATE
              AND type = CASE 
                           WHEN proj.end_date < now_time THEN 'Project Overdue'
                           ELSE 'Project Due Soon'
                         END
        );

        -- Notify project manager (if exists)
        IF manager.user_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, type, content)
            SELECT manager.user_id,
                   CASE 
                     WHEN proj.end_date < now_time THEN 'Project Overdue'
                     ELSE 'Project Due Soon'
                   END,
                   CASE 
                     WHEN proj.end_date < now_time THEN
                       FORMAT('Project %s is overdue. Please take necessary action.', proj.project_name)
                     ELSE
                       FORMAT('Project %s is due within the next day. Please ensure completion.', proj.project_name)
                   END
            WHERE NOT EXISTS (
                SELECT 1 FROM notifications
                WHERE user_id = manager.user_id
                  AND DATE(created_at) = CURRENT_DATE
                  AND type = CASE 
                               WHEN proj.end_date < now_time THEN 'Project Overdue'
                               ELSE 'Project Due Soon'
                             END
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;



--SELECT notify_due_and_overdue_tasks();

--SELECT notify_due_and_overdue_projects();


CREATE OR REPLACE FUNCTION notify_task_updates()
RETURNS trigger AS $$
DECLARE
    proj_manager_id INT;
    assigned_member RECORD;
    project_creator_id INT;
BEGIN
    -- Get project creator (admin/owner)
    SELECT created_by INTO project_creator_id
    FROM projects
    WHERE project_id = NEW.project_id;

    -- 🔹 1. Notify project manager if status changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        -- Get project manager
        SELECT user_id INTO proj_manager_id
        FROM project_members
        WHERE project_id = NEW.project_id
          AND LOWER(role) = 'manager'
        LIMIT 1;

        -- Notify manager
        IF proj_manager_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, type, content)
            VALUES (
                proj_manager_id,
                'Task Status Changed',
                'The task "' || NEW.task_name || '" in project "' ||
                (SELECT name FROM projects WHERE project_id = NEW.project_id) ||
                '" status has changed from "' || OLD.status || '" to "' || NEW.status || '".'
            );
        END IF;

        -- Notify project creator
        IF project_creator_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, type, content)
            VALUES (
                project_creator_id,
                'Task Status Changed',
                'The task "' || NEW.task_name || '" in project "' ||
                (SELECT name FROM projects WHERE project_id = NEW.project_id) ||
                '" status has changed from "' || OLD.status || '" to "' || NEW.status || '".'
            );
        END IF;
    END IF;

    -- 🔹 2. Notify assigned members if due_date changed
    IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
        FOR assigned_member IN
            SELECT user_id
            FROM task_assignments
            WHERE task_id = NEW.task_id
        LOOP
            INSERT INTO notifications (user_id, type, content)
            VALUES (
                assigned_member.user_id,
                'Task Due Date Changed',
                'The task "' || NEW.task_name || '" in project "' ||
                (SELECT name FROM projects WHERE project_id = NEW.project_id) ||
                '" due date has been changed to ' || TO_CHAR(NEW.due_date, 'YYYY-MM-DD HH24:MI:SS') || '.'
            );
        END LOOP;

        -- Notify project creator
        IF project_creator_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, type, content)
            VALUES (
                project_creator_id,
                'Task Due Date Changed',
                'The task "' || NEW.task_name || '" in project "' ||
                (SELECT name FROM projects WHERE project_id = NEW.project_id) ||
                '" due date has been changed to ' || TO_CHAR(NEW.due_date, 'YYYY-MM-DD HH24:MI:SS') || '.'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_update_notify
AFTER UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION notify_task_updates();