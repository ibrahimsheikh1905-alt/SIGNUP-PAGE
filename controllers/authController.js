import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";

/* ================= SIGNUP ================= */
export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ msg: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const emailToken = crypto.randomBytes(32).toString("hex");

    await User.create({
      name,
      email,
      password: hashedPassword,
      emailToken,
      isVerified: false,
    });

    const verifyLink = `http://localhost:5000/api/auth/verify-email/${emailToken}`;

    // ✅ EMAIL SHOULD NOT BREAK SIGNUP
    try {
      await sendEmail({
        to: email,
        subject: "Verify your email",
        html: `
          <h2>Verify your account</h2>
          <p>Click the link below:</p>
          <a href="${verifyLink}">Verify Email</a>
        `,
      });
    } catch (emailErr) {
      console.error("EMAIL FAILED:", emailErr.message);
    }

    res.status(201).json({
      msg: "Account created. Please verify your email",
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ msg: "Signup failed" });
  }
};

/* ================= LOGIN ================= */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ msg: "Invalid credentials" });

    if (!user.isVerified)
      return res.status(403).json({
        msg: "Please verify your email first",
      });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ msg: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ msg: "Login failed" });
  }
};

/* ================= VERIFY EMAIL ================= */
export const verifyEmail = async (req, res) => {
  try {
    const user = await User.findOne({
      emailToken: req.params.token,
    });

    // ❌ FAIL CASE — SAME PAGE
    if (!user) {
      return res.send(`
        <html>
          <body style="font-family:Arial;background:#0a0a0c;color:white;display:flex;align-items:center;justify-content:center;height:100vh;">
            <div style="text-align:center;">
              <h2 style="color:#f87171;">❌ Verification failed or link expired</h2>
              <p>Please request a new verification email.</p>
            </div>
          </body>
        </html>
      `);
    }

    // ✅ SUCCESS CASE
    user.isVerified = true;
    user.emailToken = null;
    await user.save();

    return res.send(`
      <html>
        <body style="font-family:Arial;background:#0a0a0c;color:white;display:flex;align-items:center;justify-content:center;height:100vh;">
          <div style="text-align:center;">
            <h2 style="color:#4ade80;">✅ Email verified successfully</h2>
            <p>You can now login.</p>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    return res.send(`
      <html>
        <body style="font-family:Arial;background:#0a0a0c;color:white;display:flex;align-items:center;justify-content:center;height:100vh;">
          <h2 style="color:#f87171;">❌ Verification failed</h2>
        </body>
      </html>
    `);
  }
};

/* ================= RESEND VERIFICATION ================= */
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ msg: "User not found" });

    if (user.isVerified)
      return res.json({ msg: "Email already verified" });

    const emailToken = crypto.randomBytes(32).toString("hex");
    user.emailToken = emailToken;
    await user.save();

const verifyLink = `https://signup-page-production.up.railway.app/api/auth/verify-email/${emailToken}`;
    await sendEmail({
      to: email,
      subject: "Verify your email",
      html: `
        <h2>Email Verification</h2>
        <p>Click the link below:</p>
        <a href="${verifyLink}">Verify Email</a>
      `,
    });

    res.json({ msg: "Verification email resent" });
  } catch (err) {
    console.error("RESEND ERROR:", err);
    res.status(500).json({ msg: "Failed to resend verification email" });
  }
};