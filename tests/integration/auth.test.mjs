/**
 * @file auth.test.js
 * Integration tests for /auth/register and /auth/login endpoints
 */

import request from 'supertest';
import app from '../../server.js';  // adjust path if needed
import db from '../../config/db.config.js';

// Mock user data for testing
const testUser = {
  firstname: "Test",
  lastname: "User",
  username: "testuser",
  email: "testuser@example.com",
  password: "Password123!",
  notification: true
};

describe("Integration: Auth API", () => {
  beforeAll(async () => {
    await db.query("DELETE FROM users WHERE email = $1", [testUser.email]);
  });

  afterAll(async () => {
    await db.query("DELETE FROM users WHERE email = $1", [testUser.email]);
    await db.end(); 
  });

  //Test user registration
  it("should register a new user successfully", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send(testUser);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("User registered successfully");
  });

  //Test duplicate registration
  it("should fail when user already exists", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send(testUser);

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("User already exists");
  });

  //Test login success
  it("should login successfully with correct credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
  });

  //Test login with wrong password
  it("should fail login with invalid credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({
        email: testUser.email,
        password: "wrongPassword!"
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid credentials");
  });
});
