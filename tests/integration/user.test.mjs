/**
 * @file projectFlow.test.mjs
 * Full integration tests for project-related APIs.
 * Covers both positive and negative cases for:
 *   - addProject
 *   - viewAllProject
 *   - createTask
 *   - viewProject
 *   - progress
 *   - workload
 */

import request from "supertest";
import app from "../../server.js";
import db from "../../config/db.config.js";

let token;
let createdProjectId;
let createdTaskIds = [];

const testUser = {
  firstname: "Flow",
  lastname: "Tester",
  username: "flowuser",
  email: "flowuser@example.com",
  password: "FlowPass123!",
};

describe("Integration: Project Flow API (Positive + Negative)", () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await db.query("DELETE FROM users WHERE email = $1", [testUser.email]);

    // Register and login user
    const reg = await request(app).post("/auth/register").send(testUser);
    expect([200, 201]).toContain(reg.statusCode);

    const login = await request(app)
      .post("/auth/login")
      .send({ email: testUser.email, password: testUser.password });

    expect(login.statusCode).toBe(200);
    token = login.body.token;
    expect(token).toBeDefined();
  });

  afterAll(async () => {
    // Clean up test data
    if (createdTaskIds.length > 0)
      await db.query("DELETE FROM tasks WHERE task_id = ANY($1::int[])", [createdTaskIds]);
    if (createdProjectId)
      await db.query("DELETE FROM projects WHERE project_id = $1", [createdProjectId]);
    await db.query("DELETE FROM users WHERE email = $1", [testUser.email]);
    await db.end();
  });


  // ADD PROJECT


  it("should reject project creation without JWT", async () => {
    const res = await request(app)
      .post("/project/addProject")
      .send({
        name: "Unauthorized Project",
        startdate: "2025-10-10",
        endate: "2025-10-12",
      });
    expect(res.statusCode).toBe(401);
  });

  it("should fail to create project with missing required fields", async () => {
    const res = await request(app)
      .post("/project/addProject")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/missing/i);
  });

  it("should create a new project successfully", async () => {
    const res = await request(app)
      .post("/project/addProject")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Integration Project",
        description: "Testing lifecycle",
        startdate: "2025-10-10",
        endate: "2025-10-15",
        assignee: [
          { email: "viewer@example.com", role: "viewer" },
          { email: "editor@example.com", role: "editor" },
        ],
      });

    expect([200, 201]).toContain(res.statusCode);
    expect(res.body.success).toBe(true);
    createdProjectId = res.body.project.project_id;
  });


  // VIEW ALL PROJECTS


  it("should reject viewing all projects without JWT", async () => {
    const res = await request(app).get("/project/viewAllProject");
    expect(res.statusCode).toBe(401);
  });

  it("should list all projects for the logged-in user", async () => {
    const res = await request(app)
      .get("/project/viewAllProject")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.projects)).toBe(true);

    const found = res.body.projects.some(p => p.project_id === createdProjectId);
    expect(found).toBe(true);
  });


  // CREATE TASKS


  it("should fail creating tasks without JWT", async () => {
    const res = await request(app)
      .post(`/project/${createdProjectId}/createTask`)
      .send({
        tasks: [{ taskName: "Unauthorized Task", status: "Pending" }],
      });
    expect(res.statusCode).toBe(401);
  });

  it("should fail creating tasks with empty array", async () => {
    const res = await request(app)
      .post(`/project/${createdProjectId}/createTask`)
      .set("Authorization", `Bearer ${token}`)
      .send({ tasks: [] });
    expect(res.statusCode).toBe(400);
  });

  it("should create multiple tasks successfully", async () => {
    const res = await request(app)
      .post(`/project/${createdProjectId}/createTask`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        tasks: [
          {
            taskName: "Setup Backend",
            status: "Pending",
            dueDate: "2025-10-12",
            assignedMembers: [testUser.username],
          },
          {
            taskName: "Setup Frontend",
            status: "Ongoing",
            dueDate: "2025-10-14",
            assignedMembers: [testUser.username],
          },
        ],
      });

    expect([200, 201]).toContain(res.statusCode);
    expect(res.body.success).toBe(true);
    createdTaskIds = res.body.tasks.map(t => t.task_id);
  });

  it("should fail creating task with invalid status", async () => {
    const res = await request(app)
      .post(`/project/${createdProjectId}/createTask`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        tasks: [
          {
            taskName: "Invalid Task",
            status: "INVALID_STATUS",
            dueDate: "2025-10-14",
          },
        ],
      });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/invalid/i);
  });


  //VIEW SINGLE PROJECT


  it("should fail viewing project without JWT", async () => {
    const res = await request(app).get(`/project/${createdProjectId}`);
    expect(res.statusCode).toBe(401);
  });

  it("should fail viewing project with invalid projectId", async () => {
    const res = await request(app)
      .get(`/project/999999`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("should fetch project details with tasks and members", async () => {
    const res = await request(app)
      .get(`/project/${createdProjectId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.project).toBeDefined();
    expect(Array.isArray(res.body.project.tasks)).toBe(true);
  });

  // PROJECT PROGRESS


  it("should fail to calculate progress without JWT", async () => {
    const res = await request(app).get(`/project/${createdProjectId}/progress`);
    expect(res.statusCode).toBe(401);
  });

  it("should calculate project progress successfully", async () => {
    const res = await request(app)
      .get(`/project/${createdProjectId}/progress`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("progress");
  });


  it("should fail to calculate workload without JWT", async () => {
    const res = await request(app).get(`/project/${createdProjectId}/workload`);
    expect(res.statusCode).toBe(401);
  });

  it("should calculate workload successfully", async () => {
    const res = await request(app)
      .get(`/project/${createdProjectId}/workload`)
      .set("Authorization", `Bearer ${token}`);

    if (res.statusCode === 404) {
      expect(res.body.message).toMatch(/no participants/i);
    } else {
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.users)).toBe(true);
    }
  });
});
