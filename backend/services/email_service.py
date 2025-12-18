"""
Email Service for sending notifications

Handles sending emails for various system events like:
- New admin account creation
- Password reset
- Claim status updates
"""
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class EmailService:
    """Service for sending emails via SMTP"""
    
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """
        Send an email to a recipient.
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML body of the email
            text_content: Plain text alternative (optional)
        
        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = self.from_email
            message["To"] = to_email
            
            # Add plain text version
            if text_content:
                part1 = MIMEText(text_content, "plain")
                message.attach(part1)
            
            # Add HTML version
            part2 = MIMEText(html_content, "html")
            message.attach(part2)
            
            # Create secure connection and send
            context = ssl.create_default_context()
            
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, to_email, message.as_string())
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    def send_admin_welcome_email(
        self,
        to_email: str,
        tenant_name: str,
        temporary_password: str,
        login_url: str = "http://localhost:8080"
    ) -> bool:
        """
        Send welcome email to a new tenant administrator with their credentials.
        
        Args:
            to_email: Admin's email address
            tenant_name: Name of the tenant organization
            temporary_password: Temporary password for first login
            login_url: URL to the login page
        
        Returns:
            True if email sent successfully, False otherwise
        """
        subject = f"Welcome to Expense Report - Admin Access for {tenant_name}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }}
                .credentials {{ background-color: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; }}
                .credential-item {{ margin: 10px 0; }}
                .credential-label {{ font-weight: bold; color: #64748b; }}
                .credential-value {{ font-family: monospace; background-color: #f1f5f9; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 5px; }}
                .button {{ display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }}
                .warning {{ background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin-top: 20px; }}
                .footer {{ text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; padding: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Expense Report</h1>
                </div>
                <div class="content">
                    <p>Hello,</p>
                    <p>You have been assigned as an <strong>Administrator</strong> for <strong>{tenant_name}</strong> on the Expense Report platform.</p>
                    
                    <div class="credentials">
                        <h3 style="margin-top: 0;">Your Login Credentials</h3>
                        <div class="credential-item">
                            <div class="credential-label">Email / Username:</div>
                            <div class="credential-value">{to_email}</div>
                        </div>
                        <div class="credential-item">
                            <div class="credential-label">Temporary Password:</div>
                            <div class="credential-value">{temporary_password}</div>
                        </div>
                    </div>
                    
                    <p>As an administrator, you can:</p>
                    <ul>
                        <li>Configure designations and role mappings</li>
                        <li>Manage employees in your organization</li>
                        <li>Set up expense policies</li>
                        <li>Review and approve claims</li>
                    </ul>
                    
                    <a href="{login_url}" class="button">Login to Expense Report</a>
                    
                    <div class="warning">
                        <strong>⚠️ Important:</strong> Please change your password immediately after your first login for security purposes.
                    </div>
                </div>
                <div class="footer">
                    <p>This is an automated message from the Expense Report System.</p>
                    <p>If you did not expect this email, please contact your system administrator.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
Welcome to Expense Report

You have been assigned as an Administrator for {tenant_name} on the Expense Report platform.

Your Login Credentials:
- Email / Username: {to_email}
- Temporary Password: {temporary_password}

Login URL: {login_url}

IMPORTANT: Please change your password immediately after your first login for security purposes.

As an administrator, you can:
- Configure designations and role mappings
- Manage employees in your organization
- Set up expense policies
- Review and approve claims

This is an automated message from the Expense Report System.
If you did not expect this email, please contact your system administrator.
        """
        
        return self.send_email(to_email, subject, html_content, text_content)


# Singleton instance
_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Get or create the email service singleton"""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
