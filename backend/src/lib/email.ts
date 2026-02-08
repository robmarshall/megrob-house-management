import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_EMAIL = process.env.SMTP_FROM || "noreply@example.com";
const APP_NAME = "Home Management";

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<void> {
  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: `Reset your ${APP_NAME} password`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Reset Your Password</h2>
          <p>You requested a password reset for your ${APP_NAME} account.</p>
          <p>Click the button below to set a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Reset Password
          </a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #666; word-break: break-all;">${resetUrl}</p>
          <p style="color: #999; font-size: 14px; margin-top: 24px;">
            If you didn't request this, you can safely ignore this email.
            This link will expire in 1 hour.
          </p>
        </div>
      `,
    });
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    // In development, log the reset URL as fallback
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV FALLBACK] Password reset URL for ${email}: ${resetUrl}`);
    }
    throw error;
  }
}
