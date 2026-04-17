import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST,
  port: process.env.MAILTRAP_PORT,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS,
  },
});

export const sendResetEmail = async (email, resetLink) => {
  const info = await transporter.sendMail({
    from: '"Dev System 🔐" <no-reply@yourapp.com>',
    to: email,
    subject: "Reset Your Password",
    html: `
      <div style="font-family:Arial;max-width:600px;margin:auto;">
        <h2 style="color:#142768;">Password Reset</h2>
        <p>You requested a password reset.</p>

        <a href="${resetLink}" 
           style="display:inline-block;padding:12px 20px;background:#142768;color:#fff;border-radius:8px;text-decoration:none;">
          Reset Password
        </a>

        <p style="margin-top:20px;">
          ⏱ This link expires in 15 minutes.
        </p>

        <p>If you did not request this, ignore this email.</p>
      </div>
    `,
  });

  console.log("📧 Mailtrap Message ID:", info.messageId);
};

export const sendVerificationEmail = async (email, verifyLink) => {
  await transporter.sendMail({
    from: '"Dev System 🔐" <no-reply@yourapp.com>',
    to: email,
    subject: "Verify Your Email ✅",
    html: `
      <div style="font-family:Arial;max-width:600px;margin:auto;">
        <h2 style="color:#142768;">Verify Your Account</h2>
        <p>Click below to verify your email:</p>

        <a href="${verifyLink}" 
           style="display:inline-block;padding:12px 20px;background:#142768;color:#fff;border-radius:8px;text-decoration:none;">
          Verify Email
        </a>

        <p style="margin-top:20px;">If you didn’t register, ignore this.</p>
      </div>
    `,
  });
};