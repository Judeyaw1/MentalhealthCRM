import nodemailer from "nodemailer";

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface InvitationEmailData {
  to: string;
  firstName: string;
  lastName: string;
  role: string;
  message?: string;
  inviteUrl: string;
}

interface PasswordResetEmailData {
  to: string;
  firstName: string;
  lastName: string;
  resetUrl?: string;
  defaultPassword?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = this.createTransporter();
  }

  private createTransporter(): nodemailer.Transporter {
    const isDevelopment = process.env.NODE_ENV === "development";

    if (isDevelopment) {
      // Use Ethereal Email for development/testing
      return nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: process.env.ETHEREAL_USER || "test@ethereal.email",
          pass: process.env.ETHEREAL_PASS || "test123",
        },
      });
    } else {
      // Production SMTP configuration
      const config: EmailConfig = {
        host: process.env.EMAIL_HOST || "smtp.gmail.com",
        port: parseInt(process.env.EMAIL_PORT || "587"),
        secure: false,
        auth: {
          user: process.env.EMAIL_USER || "",
          pass: process.env.EMAIL_PASS || "",
        },
      };

      return nodemailer.createTransport(config);
    }
  }

  async sendStaffInvitation(data: InvitationEmailData): Promise<boolean> {
    try {
      const roleDisplayNames = {
        admin: "Administrator",
        therapist: "Therapist",
        staff: "Staff Member",
      };

      const roleDescription = {
        admin:
          "Full system access including user management, patient records, and administrative functions.",
        therapist:
          "Access to patient records, treatment plans, and appointment scheduling.",
        staff:
          "Basic access to patient information and appointment management.",
      };

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to NewLife Mental Health</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f8f9fa;
            }
            .container {
              background-color: white;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 10px;
            }
            .subtitle {
              color: #6b7280;
              font-size: 16px;
            }
            .content {
              margin-bottom: 30px;
            }
            .welcome {
              font-size: 20px;
              font-weight: 600;
              margin-bottom: 15px;
              color: #1f2937;
            }
            .role-info {
              background-color: #f3f4f6;
              border-left: 4px solid #2563eb;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .role-title {
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 5px;
            }
            .role-description {
              color: #6b7280;
              font-size: 14px;
            }
            .message {
              background-color: #fef3c7;
              border: 1px solid #f59e0b;
              border-radius: 6px;
              padding: 15px;
              margin: 20px 0;
            }
            .cta-button {
              display: inline-block;
              background-color: #2563eb;
              color: white;
              text-decoration: none;
              padding: 12px 24px;
              border-radius: 6px;
              font-weight: 500;
              margin: 20px 0;
            }
            .cta-button:hover {
              background-color: #1d4ed8;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 14px;
            }
            .security-note {
              background-color: #fef2f2;
              border: 1px solid #fecaca;
              border-radius: 6px;
              padding: 15px;
              margin: 20px 0;
              font-size: 14px;
              color: #991b1b;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">NewLife Mental Health</div>
              <div class="subtitle">Professional Mental Health Management System</div>
            </div>
            
            <div class="content">
              <div class="welcome">Welcome, ${data.firstName}!</div>
              
              <p>You have been invited to join the NewLife Mental Health team as a <strong>${roleDisplayNames[data.role as keyof typeof roleDisplayNames]}</strong>.</p>
              
              <div class="role-info">
                <div class="role-title">Your Role: ${roleDisplayNames[data.role as keyof typeof roleDisplayNames]}</div>
                <div class="role-description">${roleDescription[data.role as keyof typeof roleDescription]}</div>
              </div>
              
              ${
                data.message
                  ? `
                <div class="message">
                  <strong>Personal Message:</strong><br>
                  ${data.message}
                </div>
              `
                  : ""
              }
              
              <p>To get started, please click the button below to access your account:</p>
              
              <div style="text-align: center;">
                <a href="${data.inviteUrl}" class="cta-button">Access Your Account</a>
              </div>
              
              <div class="security-note">
                <strong>Security Note:</strong> This invitation link is unique to you and should not be shared. 
                If you did not expect this invitation, please contact your administrator immediately.
              </div>
            </div>
            
            <div class="footer">
              <p>This is an automated message from NewLife Mental Health.</p>
              <p>If you have any questions, please contact your system administrator.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
Welcome to NewLife Mental Health!

Hi ${data.firstName},

You have been invited to join the NewLife Mental Health team as a ${roleDisplayNames[data.role as keyof typeof roleDisplayNames]}.

Your Role: ${roleDisplayNames[data.role as keyof typeof roleDisplayNames]}
${roleDescription[data.role as keyof typeof roleDescription]}

${data.message ? `Personal Message: ${data.message}\n` : ""}
To access your account, visit: ${data.inviteUrl}

Security Note: This invitation is unique to you and should not be shared.

Best regards,
The NewLife Mental Health Team
      `;

      const mailOptions = {
        from:
          process.env.FROM_EMAIL ||
          '"NewLife Mental Health" <noreply@newlife.com>',
        to: data.to,
        subject: `Welcome to NewLife Mental Health - You're Invited!`,
        text: textContent,
        html: htmlContent,
      };

      const info = await this.transporter.sendMail(mailOptions);

      if (process.env.NODE_ENV === "development") {
        console.log("Development email sent to Ethereal:");
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
      }

      return true;
    } catch (error) {
      console.error("Error sending invitation email:", error);
      return false;
    }
  }

  async sendPasswordReset(data: PasswordResetEmailData): Promise<boolean> {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - NewLife Mental Health</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f8f9fa;
            }
            .container {
              background-color: white;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 10px;
            }
            .subtitle {
              color: #6b7280;
              font-size: 16px;
            }
            .content {
              margin-bottom: 30px;
            }
            .title {
              font-size: 20px;
              font-weight: 600;
              margin-bottom: 15px;
              color: #1f2937;
            }
            .password-box {
              background-color: #f3f4f6;
              border: 2px solid #d1d5db;
              border-radius: 6px;
              padding: 20px;
              margin: 20px 0;
              text-align: center;
              font-family: monospace;
              font-size: 20px;
              font-weight: bold;
              color: #1f2937;
              letter-spacing: 2px;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 14px;
            }
            .warning {
              background-color: #fef3c7;
              border: 1px solid #f59e0b;
              border-radius: 6px;
              padding: 15px;
              margin: 20px 0;
              font-size: 14px;
              color: #92400e;
            }
            .info {
              background-color: #dbeafe;
              border: 1px solid #3b82f6;
              border-radius: 6px;
              padding: 15px;
              margin: 20px 0;
              font-size: 14px;
              color: #1e40af;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">NewLife Mental Health</div>
              <div class="subtitle">Professional Mental Health Management System</div>
            </div>
            
            <div class="content">
              <div class="title">Password Reset</div>
              
              <p>Hello ${data.firstName} ${data.lastName},</p>
              
              <p>Your password has been reset by an administrator. Here is your new temporary password:</p>
              
              <div class="password-box">
                ${data.defaultPassword}
              </div>
              
              <div class="warning">
                <strong>Important:</strong> 
                <ul>
                  <li>You will be required to change this password on your next login</li>
                  <li>Please choose a strong password that you can remember</li>
                  <li>Do not share this password with anyone</li>
                </ul>
              </div>
              
              <div class="info">
                <strong>To log in:</strong>
                <ol>
                  <li>Go to the NewLife Mental Health portal</li>
                  <li>Enter your email address and the temporary password above</li>
                  <li>You will be prompted to change your password immediately</li>
                </ol>
              </div>
              
              <p>If you have any questions, please contact your system administrator.</p>
            </div>
            
            <div class="footer">
              <p>This is an automated message from NewLife Mental Health.</p>
              <p>If you have any questions, please contact your system administrator.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
Password Reset - NewLife Mental Health

Hello ${data.firstName} ${data.lastName},

Your password has been reset by an administrator. Here is your new temporary password:

${data.defaultPassword}

IMPORTANT:
- You will be required to change this password on your next login
- Please choose a strong password that you can remember
- Do not share this password with anyone

To log in:
1. Go to the NewLife Mental Health portal
2. Enter your email address and the temporary password above
3. You will be prompted to change your password immediately

If you have any questions, please contact your system administrator.

Best regards,
The NewLife Mental Health Team
      `;

      const mailOptions = {
        from:
          process.env.FROM_EMAIL ||
          '"NewLife Mental Health" <noreply@newlife.com>',
        to: data.to,
        subject: `Password Reset Request - NewLife Mental Health`,
        text: textContent,
        html: htmlContent,
      };

      const info = await this.transporter.sendMail(mailOptions);

      if (process.env.NODE_ENV === "development") {
        console.log("Development password reset email sent to Ethereal:");
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
      }

      return true;
    } catch (error) {
      console.error("Error sending password reset email:", error);
      return false;
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error("Email service connection failed:", error);
      return false;
    }
  }
}

export const emailService = new EmailService();
