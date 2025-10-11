/**
 * @file edit.test.mjs
 * Integration tests for Project Edit APIs (Positive + Negative cases)
 */

import request from "supertest";
import app from "../../server.js";
import db from "../../config/db.config.js";

let token;
let createdProjectId;
let createdTaskId;

const testUser = {
  firstname: "Edit",
  lastname: "Tester",
  username: "edituser",
  email: "edituser@example.com",
  password: "EditPass123!",
};

describe("Integration: Edit APIs (Positive + Negative)", () => {
  beforeAll(async () => {
    // Cleanup any old data
    await db.query("DELETE FROM users WHERE email = $1", [testUser.email]);

    //Register & login test user
    await request(app).post("/auth/register").send(testUser);

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: testUser.email, password: testUser.password });

    token = loginRes.body.token;
    expect(token).toBeDefined();

    //Create a project where user is MANAGER
    const projectRes = await request(app)
      .post("/project/addProject")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Edit Test Project",
        description: "Testing edit APIs",
        startdate: "2025-10-10",
        endate: "2025-10-20",
        assignee: [{ email: testUser.email, role: "manager" }],
      });

    expect([200, 201]).toContain(projectRes.statusCode);
    createdProjectId = projectRes.body.project.project_id;

    //Create a task for testing
    const taskRes = await request(app)
      .post(`/project/${createdProjectId}/createTask`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        tasks: [
          {
            taskName: "Initial Task",
            status: "Pending",
            dueDate: "2025-10-12",
            assignedMembers: [testUser.username],
          },
        ],
      });

    createdTaskId = taskRes.body.tasks[0].task_id;
  });

  afterAll(async () => {
    await db.query("DELETE FROM tasks WHERE project_id = $1", [createdProjectId]);
    await db.query("DELETE FROM projects WHERE project_id = $1", [createdProjectId]);
    await db.query("DELETE FROM users WHERE email = $1", [testUser.email]);
    await db.end();
  });


  // Edit Progress

  it("should update task progress successfully", async () => {
    const res = await request(app)
      .put(`/edit/${createdProjectId}/progress/${createdTaskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ progress: "Ongoing" });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should fail when invalid progress value given", async () => {
    const res = await request(app)
      .put(`/edit/${createdProjectId}/progress/${createdTaskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ progress: "InvalidStatus" });

    expect(res.statusCode).toBe(400);
  });

  it("should fail when no progress is provided", async () => {
    const res = await request(app)
      .put(`/edit/${createdProjectId}/progress/${createdTaskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.statusCode).toBe(400);
  });

  //Edit Due Date

  it("should update due date successfully", async () => {
    const res = await request(app)
      .put(`/edit/${createdProjectId}/duedate/${createdTaskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ duedate: "2025-10-18" });

    expect(res.statusCode).toBe(200);
  });

  it("should fail updating due date without body", async () => {
    const res = await request(app)
      .put(`/edit/${createdProjectId}/duedate/${createdTaskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.statusCode).toBe(400);
  });


  // Add Member

  it("should add a valid member successfully", async () => {
    const res = await request(app)
      .post(`/edit/${createdProjectId}/addMember`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        assignee: [{ email: "newmember@example.com", role: "viewer" }],
      });

    expect([200, 201]).toContain(res.statusCode);
  });

  it("should fail adding member with missing email", async () => {
    const res = await request(app)
      .post(`/edit/${createdProjectId}/addMember`)
      .set("Authorization", `Bearer ${token}`)
      .send({ assignee: [{ role: "viewer" }] });

    expect(res.statusCode).toBe(400);
  });


  // Add Assignee

  it("should fail to add assignee missing parameters", async () => {
    const res = await request(app)
      .post(`/edit/${createdProjectId}/addMember/${createdTaskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.statusCode).toBe(400);
  });


  //Edit Task Description

  it("should edit task description successfully", async () => {
    const res = await request(app)
      .put(`/edit/${createdProjectId}/edittaskdes/${createdTaskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ task_name: "Updated Task Title" });

    expect(res.statusCode).toBe(200);
  });

  it("should fail editing task name when empty", async () => {
    const res = await request(app)
      .put(`/edit/${createdProjectId}/edittaskdes/${createdTaskId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.statusCode).toBe(400);
  });


  //Delete Task

  it("should fail deleting task with invalid id", async () => {
    const res = await request(app)
      .put(`/edit/${createdProjectId}/deletetask/999999`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(404);
  });

  it("should delete the task successfully", async () => {
    const newTask = await request(app)
      .post(`/project/${createdProjectId}/createTask`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        tasks: [
          { taskName: "Temp Delete Task", status: "Pending", dueDate: "2025-10-20" },
        ],
      });

    const tempTaskId = newTask.body.tasks[0].task_id;
    const res = await request(app)
      .put(`/edit/${createdProjectId}/deletetask/${tempTaskId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });


  //Edit Project

  it("should update project details successfully", async () => {
    const res = await request(app)
      .put(`/edit/${createdProjectId}/editproject`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated Project Name", description: "Edited Desc" });

    expect(res.statusCode).toBe(200);
  });

  it("should fail editing project with invalid ID", async () => {
    const res = await request(app)
      .put(`/edit/99999/editproject`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Invalid Project" });
    expect(res.statusCode).toBe(404);
  });

  
  // Delete Project

  it("should fail deleting project with invalid id", async () => {
    const res = await request(app)
      .delete(`/edit/99999/deleteproject`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(404);
  });

  it("should delete the project successfully", async () => {
    const newProj = await request(app)
      .post("/project/addProject")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Temporary Project",
        description: "To delete later",
        startdate: "2025-10-10",
        endate: "2025-10-12",
        assignee: [{ email: testUser.email, role: "manager" }],
      });

    const newProjId = newProj.body.project.project_id;

    const res = await request(app)
      .delete(`/edit/${newProjId}/deleteproject`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
  });
});
