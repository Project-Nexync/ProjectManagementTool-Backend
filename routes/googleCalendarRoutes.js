import express from "express";
import { google } from "googleapis";
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import db from '../config/db.config.js';

dotenv.config();
const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:5000/api/auth/google/callback"
);

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

//Redirect to Google consent screen
router.get("/auth/google", (req, res) => {
  const { state } = req.query;
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state,
  });
  res.redirect(url);
});

//Handle callback
router.get("/auth/google/callback", async (req, res) => {
  try {
    const { code, state, redirect } = req.query;
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    const userId = decoded.id;

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    await db.query("UPDATE users SET google_tokens = $1 WHERE user_id = $2", [tokens, userId]);

    const redirectUrl = decodeURIComponent(
      redirect || "https://projectmanagementtool-frontend.onrender.com//settings"
    );
    return res.redirect(`${redirectUrl}?google=success`);
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return res.redirect("https://projectmanagementtool-frontend.onrender.com/settings?google=error");
  }
});

export default router;
