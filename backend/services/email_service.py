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

    def send_employee_welcome_email(
        self,
        to_email: str,
        employee_name: str,
        tenant_name: str,
        temporary_password: str,
        login_url: str = "http://localhost:8080"
    ) -> bool:
        """
        Send welcome email to a new employee with their login credentials.
        
        Args:
            to_email: Employee's email address
            employee_name: Employee's full name
            tenant_name: Name of the tenant organization
            temporary_password: Temporary password for first login
            login_url: URL to the login page
        
        Returns:
            True if email sent successfully, False otherwise
        """
        subject = f"Welcome to {tenant_name} - Your Easy Qlaim Account"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #00928F; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }}
                .credentials {{ background-color: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; }}
                .credential-item {{ margin: 10px 0; }}
                .credential-label {{ font-weight: bold; color: #64748b; }}
                .credential-value {{ font-family: monospace; background-color: #f1f5f9; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 5px; }}
                .button {{ display: inline-block; background-color: #00928F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }}
                .warning {{ background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin-top: 20px; }}
                .features {{ background-color: #f0fdfa; padding: 15px; border-radius: 6px; margin-top: 20px; }}
                .footer {{ text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; padding: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Easy Qlaim</h1>
                </div>
                <div class="content">
                    <p>Hello {employee_name},</p>
                    <p>Welcome to <strong>{tenant_name}</strong>! Your Easy Qlaim account has been created successfully.</p>
                    
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
                    
                    <div class="features">
                        <h4 style="margin-top: 0; color: #00928F;">What you can do with Easy Qlaim:</h4>
                        <ul style="margin-bottom: 0;">
                            <li>Submit expense claims quickly and easily</li>
                            <li>Track the status of your claims in real-time</li>
                            <li>Upload receipts and supporting documents</li>
                            <li>View your claim history and reports</li>
                        </ul>
                    </div>
                    
                    <a href="{login_url}" class="button">Login to Easy Qlaim</a>
                    
                    <div class="warning">
                        <strong>⚠️ Important:</strong> Please change your password immediately after your first login for security purposes.
                    </div>
                </div>
                <div class="footer">
                    <p>This is an automated message from Easy Qlaim.</p>
                    <p>If you did not expect this email, please contact your administrator.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
Welcome to Easy Qlaim

Hello {employee_name},

Welcome to {tenant_name}! Your Easy Qlaim account has been created successfully.

Your Login Credentials:
- Email / Username: {to_email}
- Temporary Password: {temporary_password}

Login URL: {login_url}

IMPORTANT: Please change your password immediately after your first login for security purposes.

What you can do with Easy Qlaim:
- Submit expense claims quickly and easily
- Track the status of your claims in real-time
- Upload receipts and supporting documents
- View your claim history and reports

This is an automated message from Easy Qlaim.
If you did not expect this email, please contact your administrator.
        """
        
        return self.send_email(to_email, subject, html_content, text_content)

    def send_claim_submitted_notification(
        self,
        to_email: str,
        approver_name: str,
        employee_name: str,
        claim_number: str,
        amount: float,
        category: str,
        description: str,
        login_url: str = "http://localhost:8080"
    ) -> bool:
        """
        Send notification to approver when a new claim is submitted.
        """
        subject = f"New Claim Pending Your Approval - {claim_number}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }}
                .claim-details {{ background-color: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; }}
                .detail-item {{ margin: 10px 0; display: flex; }}
                .detail-label {{ font-weight: bold; color: #64748b; width: 120px; }}
                .detail-value {{ color: #1e293b; }}
                .amount {{ font-size: 24px; font-weight: bold; color: #059669; }}
                .button {{ display: inline-block; background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }}
                .footer {{ text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; padding: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔔 New Claim Pending Approval</h1>
                </div>
                <div class="content">
                    <p>Hello {approver_name},</p>
                    <p>A new expense claim has been submitted and requires your approval.</p>
                    
                    <div class="claim-details">
                        <h3 style="margin-top: 0;">Claim Details</h3>
                        <div class="detail-item">
                            <span class="detail-label">Claim Number:</span>
                            <span class="detail-value">{claim_number}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Submitted By:</span>
                            <span class="detail-value">{employee_name}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Category:</span>
                            <span class="detail-value">{category}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Description:</span>
                            <span class="detail-value">{description}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Amount:</span>
                            <span class="amount">₹{amount:,.2f}</span>
                        </div>
                    </div>
                    
                    <p>Please review this claim at your earliest convenience.</p>
                    
                    <a href="{login_url}/approvals" class="button">Review Claim</a>
                </div>
                <div class="footer">
                    <p>This is an automated message from Easy Qlaim.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
New Claim Pending Your Approval

Hello {approver_name},

A new expense claim has been submitted and requires your approval.

Claim Details:
- Claim Number: {claim_number}
- Submitted By: {employee_name}
- Category: {category}
- Description: {description}
- Amount: ₹{amount:,.2f}

Please review this claim at: {login_url}/approvals

This is an automated message from Easy Qlaim.
        """
        
        return self.send_email(to_email, subject, html_content, text_content)

    def send_claim_returned_notification(
        self,
        to_email: str,
        employee_name: str,
        claim_number: str,
        amount: float,
        return_reason: str,
        returned_by: str,
        login_url: str = "http://localhost:8080"
    ) -> bool:
        """
        Send notification to employee when their claim is returned for correction.
        """
        subject = f"Action Required: Claim {claim_number} Returned for Correction"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #f97316; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }}
                .reason-box {{ background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0; }}
                .claim-details {{ background-color: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; }}
                .detail-item {{ margin: 10px 0; }}
                .detail-label {{ font-weight: bold; color: #64748b; }}
                .button {{ display: inline-block; background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }}
                .footer {{ text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; padding: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>↩️ Claim Returned for Correction</h1>
                </div>
                <div class="content">
                    <p>Hello {employee_name},</p>
                    <p>Your expense claim <strong>{claim_number}</strong> for <strong>₹{amount:,.2f}</strong> has been returned and requires your attention.</p>
                    
                    <div class="reason-box">
                        <h3 style="margin-top: 0; color: #92400e;">📝 Reason for Return</h3>
                        <p style="margin-bottom: 0;">{return_reason}</p>
                        <p style="margin-top: 10px; font-size: 14px; color: #78716c;">— {returned_by}</p>
                    </div>
                    
                    <p>Please make the necessary corrections and resubmit your claim.</p>
                    
                    <a href="{login_url}/claims" class="button">Edit & Resubmit Claim</a>
                </div>
                <div class="footer">
                    <p>This is an automated message from Easy Qlaim.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
Claim Returned for Correction

Hello {employee_name},

Your expense claim {claim_number} for ₹{amount:,.2f} has been returned and requires your attention.

Reason for Return:
{return_reason}
— {returned_by}

Please make the necessary corrections and resubmit your claim at: {login_url}/claims

This is an automated message from Easy Qlaim.
        """
        
        return self.send_email(to_email, subject, html_content, text_content)

    def send_claim_rejected_notification(
        self,
        to_email: str,
        employee_name: str,
        claim_number: str,
        amount: float,
        rejection_reason: str,
        rejected_by: str,
        login_url: str = "http://localhost:8080"
    ) -> bool:
        """
        Send notification to employee when their claim is rejected.
        """
        subject = f"Claim {claim_number} Has Been Rejected"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }}
                .reason-box {{ background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 20px 0; }}
                .claim-details {{ background-color: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; }}
                .detail-item {{ margin: 10px 0; }}
                .detail-label {{ font-weight: bold; color: #64748b; }}
                .button {{ display: inline-block; background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }}
                .footer {{ text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; padding: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>❌ Claim Rejected</h1>
                </div>
                <div class="content">
                    <p>Hello {employee_name},</p>
                    <p>We regret to inform you that your expense claim <strong>{claim_number}</strong> for <strong>₹{amount:,.2f}</strong> has been rejected.</p>
                    
                    <div class="reason-box">
                        <h3 style="margin-top: 0; color: #991b1b;">📋 Reason for Rejection</h3>
                        <p style="margin-bottom: 0;">{rejection_reason}</p>
                        <p style="margin-top: 10px; font-size: 14px; color: #78716c;">— {rejected_by}</p>
                    </div>
                    
                    <p>If you believe this decision was made in error or have questions, please contact your manager or HR department.</p>
                    
                    <a href="{login_url}/claims" class="button">View My Claims</a>
                </div>
                <div class="footer">
                    <p>This is an automated message from Easy Qlaim.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
Claim Rejected

Hello {employee_name},

We regret to inform you that your expense claim {claim_number} for ₹{amount:,.2f} has been rejected.

Reason for Rejection:
{rejection_reason}
— {rejected_by}

If you believe this decision was made in error or have questions, please contact your manager or HR department.

View your claims at: {login_url}/claims

This is an automated message from Easy Qlaim.
        """
        
        return self.send_email(to_email, subject, html_content, text_content)

    def send_claim_settled_notification(
        self,
        to_email: str,
        employee_name: str,
        claim_number: str,
        amount: float,
        payment_reference: str = None,
        payment_method: str = None,
        settled_date: str = None,
        login_url: str = "http://localhost:8080"
    ) -> bool:
        """
        Send notification to employee when their claim is settled/paid.
        """
        subject = f"🎉 Payment Processed: Claim {claim_number} - ₹{amount:,.2f}"
        
        payment_info = ""
        if payment_reference or payment_method:
            payment_info = f"""
                        <div class="detail-item">
                            <span class="detail-label">Payment Ref:</span>
                            <span class="detail-value">{payment_reference or 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Payment Method:</span>
                            <span class="detail-value">{payment_method or 'Bank Transfer'}</span>
                        </div>
            """
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }}
                .success-box {{ background-color: #d1fae5; padding: 20px; border-radius: 8px; border: 1px solid #059669; margin: 20px 0; text-align: center; }}
                .amount {{ font-size: 32px; font-weight: bold; color: #059669; }}
                .claim-details {{ background-color: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0; }}
                .detail-item {{ margin: 10px 0; display: flex; }}
                .detail-label {{ font-weight: bold; color: #64748b; width: 120px; }}
                .detail-value {{ color: #1e293b; }}
                .button {{ display: inline-block; background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }}
                .footer {{ text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; padding: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✅ Payment Processed</h1>
                </div>
                <div class="content">
                    <p>Hello {employee_name},</p>
                    <p>Great news! Your expense claim has been approved and payment has been processed.</p>
                    
                    <div class="success-box">
                        <p style="margin: 0; color: #065f46;">Amount Credited</p>
                        <p class="amount">₹{amount:,.2f}</p>
                    </div>
                    
                    <div class="claim-details">
                        <h3 style="margin-top: 0;">Payment Details</h3>
                        <div class="detail-item">
                            <span class="detail-label">Claim Number:</span>
                            <span class="detail-value">{claim_number}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Settled Date:</span>
                            <span class="detail-value">{settled_date or 'Today'}</span>
                        </div>
                        {payment_info}
                    </div>
                    
                    <p>The amount will be credited to your registered bank account within 2-3 business days.</p>
                    
                    <a href="{login_url}/claims" class="button">View Claim Details</a>
                </div>
                <div class="footer">
                    <p>This is an automated message from Easy Qlaim.</p>
                    <p>Thank you for using Easy Qlaim for your expense management.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
Payment Processed - Claim {claim_number}

Hello {employee_name},

Great news! Your expense claim has been approved and payment has been processed.

Amount Credited: ₹{amount:,.2f}

Payment Details:
- Claim Number: {claim_number}
- Settled Date: {settled_date or 'Today'}
- Payment Reference: {payment_reference or 'N/A'}
- Payment Method: {payment_method or 'Bank Transfer'}

The amount will be credited to your registered bank account within 2-3 business days.

View your claim at: {login_url}/claims

This is an automated message from Easy Qlaim.
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
