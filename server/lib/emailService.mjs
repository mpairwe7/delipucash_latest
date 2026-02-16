/**
 * Email Service
 * 
 * Provides email sending functionality using Nodemailer
 * Used for 2FA codes, password reset, notifications, etc.
 */

import nodemailer from 'nodemailer';

// ===========================================
// Email Configuration
// ===========================================

/**
 * Create email transporter based on environment
 * Uses SMTP settings from environment variables
 */
const createTransporter = () => {
  // Check if email is configured
  const isConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
  
  if (!isConfigured) {
    console.warn('⚠️ Email service not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Initialize transporter
let transporter = createTransporter();

/**
 * Reinitialize transporter (useful if env vars change)
 */
export const reinitializeTransporter = () => {
  transporter = createTransporter();
};

// ===========================================
// Email Templates
// ===========================================

const APP_NAME = 'DelipuCash';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@delipucash.com';

/**
 * Generate 2FA OTP email HTML template
 */
const generate2FAEmailTemplate = (code, userName, expiryMinutes = 10) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ${APP_NAME} Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">🔐 Verification Code</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px;">
                Hi ${userName || 'there'},
              </p>
              <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.5;">
                You requested a verification code for your ${APP_NAME} account. Use the code below to complete your sign-in:
              </p>
              
              <!-- OTP Code Box -->
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #6366f1;">
                  ${code}
                </span>
              </div>
              
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">
                ⏱️ This code expires in <strong>${expiryMinutes} minutes</strong>
              </p>
              <p style="margin: 0 0 24px; color: #9ca3af; font-size: 13px;">
                If you didn't request this code, please ignore this email or contact support if you have concerns.
              </p>
              
              <!-- Security Notice -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 4px 4px 0;">
                <p style="margin: 0; color: #92400e; font-size: 13px;">
                  <strong>🔒 Security Tip:</strong> Never share this code with anyone. ${APP_NAME} will never ask for your code via phone or chat.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #6366f1;">${SUPPORT_EMAIL}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

/**
 * Generate password reset email HTML template
 *
 * The resetLink is always an HTTPS URL on the backend (e.g.
 * https://delipucashserver.vercel.app/reset-password?token=...&email=...).
 * On mobile, Android App Links / iOS Universal Links open the app directly.
 * If the app isn't installed, the URL serves a smart redirect page.
 *
 * @param {string} resetLink - HTTPS reset URL (works in all email clients)
 * @param {string} userName - User's first name
 * @param {number} expiryMinutes - Token expiry in minutes
 */
const generatePasswordResetTemplate = (resetLink, userName, expiryMinutes = 30) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your ${APP_NAME} Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">🔑 Password Reset</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px;">
                Hi ${userName || 'there'},
              </p>
              <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.5;">
                We received a request to reset the password for your ${APP_NAME} account. Tap the button below to reset your password:
              </p>
              
              <!-- Reset Button -->
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Reset Password
                </a>
              </div>
              
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">
                ⏱️ This link expires in <strong>${expiryMinutes} minutes</strong>
              </p>
              <p style="margin: 0 0 24px; color: #9ca3af; font-size: 13px;">
                If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
              </p>
              
              <!-- Link fallback -->
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px;">
                <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin: 0; color: #6366f1; font-size: 12px; word-break: break-all;">
                  ${resetLink}
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #6366f1;">${SUPPORT_EMAIL}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// ===========================================
// Email Functions
// ===========================================

/**
 * Send 2FA verification code via email
 * 
 * @param {string} to - Recipient email address
 * @param {string} code - 6-digit OTP code
 * @param {string} userName - User's name for personalization
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const send2FACode = async (to, code, userName = '') => {
  console.log(`📧 Sending 2FA code to: ${to}`);
  
  if (!transporter) {
    console.warn('⚠️ Email transporter not configured. Code:', code);
    return { 
      success: false, 
      error: 'Email service not configured',
      // In dev mode, return code for testing
      ...(process.env.NODE_ENV !== 'production' && { devCode: code })
    };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${APP_NAME}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject: `${code} is your ${APP_NAME} verification code`,
      text: `Your ${APP_NAME} verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`,
      html: generate2FAEmailTemplate(code, userName, 10),
    });

    console.log('✅ 2FA email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send 2FA email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send password reset email
 * 
 * @param {string} to - Recipient email address
 * @param {string} resetLink - HTTPS reset URL (will be handled by smart redirect page)
 * @param {string} userName - User's name for personalization
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendPasswordResetEmail = async (to, resetLink, userName = '') => {
  console.log(`📧 Sending password reset email to: ${to}`);
  
  if (!transporter) {
    console.warn('⚠️ Email transporter not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${APP_NAME}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject: `Reset your ${APP_NAME} password`,
      text: `You requested to reset your ${APP_NAME} password.\n\nClick this link to reset: ${resetLink}\n\nThis link expires in 30 minutes.\n\nIf you didn't request this, please ignore this email.`,
      html: generatePasswordResetTemplate(resetLink, userName, 30),
    });

    console.log('✅ Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send generic notification email
 * 
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 * @param {string} html - HTML content (optional)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export const sendEmail = async (to, subject, text, html = null) => {
  console.log(`📧 Sending email to: ${to}, subject: ${subject}`);
  
  if (!transporter) {
    console.warn('⚠️ Email transporter not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${APP_NAME}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      ...(html && { html }),
    });

    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if email service is configured
 * @returns {boolean}
 */
export const isEmailConfigured = () => {
  return transporter !== null;
};

export default {
  send2FACode,
  sendPasswordResetEmail,
  sendEmail,
  isEmailConfigured,
  reinitializeTransporter,
};
