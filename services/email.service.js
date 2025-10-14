import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to, subject, text, html = null) {
  try {
    const info = await transporter.sendMail({
      from: `"Project Management Tool" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      ...(html && { html }),
    });
    return info;
  } catch (error) {
  }
}
