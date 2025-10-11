import request from "supertest";
import app from "../../server.js";
import db from "../../config/db.config.js";

let token;
let createdProjectId;
let createdTaskId;

const testUser = {
  firstname: "View",
  lastname: "Tester",
  username: "viewuser",
  email: "viewuser@example.com",
  password: "ViewPass123!"
};

describe("Integration: View Project API", () => {
  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email = $1", [testUser.email]);

    await request(app).post("/auth/register").send(testUser);

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: testUser.email, password: testUser.password });

    token = loginRes.body.token;
    expect(token).toBeDefined();

    const projectRes = await request(app)
      .post("/project/addProject")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "View Project",
        description: "Project for testing /view",
        startdate: "2025-10-12",
        endate: "2025-10-20",
        assignee: []
      });

    expect(projectRes.statusCode).toBe(201);
    createdProjectId = projectRes.body.project.project_id;

    const taskRes = await request(app)
      .post(`/project/${createdProjectId}/createTask`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        tasks: [
          { taskName: "Test Task", status: "Pending", dueDate: "2025-10-15" },
        ],
      });

    expect(taskRes.statusCode).toBe(201);
    createdTaskId = taskRes.body.tasks[0].task_id;
  });

  afterAll(async () => {
    await db.query("DELETE FROM file_attachments WHERE task_id = $1", [createdTaskId]);
    await db.query("DELETE FROM tasks WHERE project_id = $1", [createdProjectId]);
    await db.query("DELETE FROM project_members WHERE project_id = $1", [createdProjectId]);
    await db.query("DELETE FROM projects WHERE project_id = $1", [createdProjectId]);
    await db.query("DELETE FROM users WHERE email = $1", [testUser.email]);
    await db.end();
  });

  it("should successfully fetch a project with valid token and projectId", async () => {
    const res = await request(app)
      .get(`/project/${createdProjectId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.project).toBeDefined();
    expect(res.body.project.name).toBe("View Project");
    expect(Array.isArray(res.body.project.tasks)).toBe(true);
    expect(res.body.userRole).toBe("Admin");
  });

  it("should fail when projectId is invalid", async () => {
    const res = await request(app)
      .get("/project/99999999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("should fail when Authorization token is missing", async () => {
    const res = await request(app).get(`/project/${createdProjectId}`);
    expect(res.statusCode).toBe(401);
  });

  it("should fail when Authorization token is invalid", async () => {
    const res = await request(app)
      .get(`/project/${createdProjectId}`)
      .set("Authorization", "Bearer invalid_token_here");

    expect(res.statusCode).toBe(403);
  });
});
