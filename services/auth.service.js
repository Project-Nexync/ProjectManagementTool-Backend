import jwt from 'jsonwebtoken';
import db from '../config/db.config.js';
import bcrypt from "bcrypt";

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

export const register = async ({ firstname, lastname, profile_pic, email, password, notification }) => {
  try {
    if (!firstname || !lastname || !email || !password) {
      return { success: false, status: 400, message: "Required fields missing" };
    }

    const {rows} = await db.query("SELECT user_id FROM users WHERE email = $1", [email]);
    if (rows.length > 0) {
      return { success: false, status: 409, message: "User already exists" };
    }

    const hash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (firstname, lastname, password, email, notification, profile_pic) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id `,
      [firstname, lastname, hash, email, notification ?? false, profile_pic ?? null]
    );

    return {
      success: true,
      status: 201,
      message: "User registered successfully",
      user: { firstname, email }
    };
  } catch (err) {
    console.error("Register error:", err);
    return { success: false, status: 500, message: "Internal server error" };
  }
};


export const login = async ({ email, password }) => {
  try {
    if (!email || !password) {
      return { success: false, status: 400, message: "Email and password are required" };
    }

    const {rows} = await db.query(
      "SELECT user_id, firstname, email, password FROM users WHERE email = $1",
      [email]
    );

    if (rows.length === 0) {
      return { success: false, status: 404, message: "User not found" };
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return { success: false, status: 401, message: "Invalid credentials" };
    }

    const token = jwt.sign({ id: user.user_id, email: user.email },JWT_SECRET,{ expiresIn: "1d" });

    return {
      success: true,
      status: 200,
      message: "Login successful",
      token,
      user: {
        id: user.user_id,
        firstname: user.firstname,
        email: user.email
      }
    };
  } catch (err) {
    console.error("Login error:", err);
    return { success: false, status: 500, message: "Internal server error" };
  }
};