/**
 * Integration test for GET /project/viewAllProject
 * Ensures JWT protection and correct project listing.
 */

import request from "supertest";
import app from "../../server.js";
import db from "../../config/db.config.js";

let token;
let createdProjectId;

const testUser = {
  firstname: "Viewer",
  lastname: "Tester",
  username: "viewuser",
  email: "viewuser@example.com",
  password: "ViewPass123!",
};

describe("Integration: View All Projects API", () => {
  beforeAll(async () => {
    // Clean any old data
    await db.query("DELETE FROM users WHERE email = $1", [testUser.email]);

    // Register + Login
    await request(app).post("/auth/register").send(testUser);
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: testUser.email, password: testUser.password });
    token = loginRes.body.token;

    //Create a sample project
    const projectRes = await request(app)
      .post("/project/addProject")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "View Test Project",
        description: "For testing project listing",
        startdate: "2025-10-10",
        endate: "2025-10-12",
      });

    createdProjectId = projectRes.body.project.project_id;
  });

  afterAll(async () => {
    if (createdProjectId) {
      await db.query("DELETE FROM projects WHERE project_id = $1", [createdProjectId]);
    }
    await db.query("DELETE FROM users WHERE email = $1", [testUser.email]);
    await db.end();
  });

  //Unauthorized access
  it("should reject request without JWT", async () => {
    const res = await request(app).get("/project/viewAllProject");
    expect(res.statusCode).toBe(401);
  });

  //Authorized request
  it("should return all projects for logged-in user", async () => {
    const res = await request(app)
      .get("/project/viewAllProject")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.projects).toBeDefined();
    expect(Array.isArray(res.body.projects)).toBe(true);
    expect(res.body.projects[0]).toHaveProperty("project_id");
    expect(res.body.projects[0]).toHaveProperty("name");
    expect(res.body.projects[0]).toHaveProperty("members");
  });
});
