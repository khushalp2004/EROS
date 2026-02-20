import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime

class EmailService:
    """
    Email service for EROS system
    Handles sending verification emails, password reset emails, and admin notifications
    """
    
    def __init__(self):
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_username = os.getenv('SMTP_USERNAME', '')
        self.smtp_password = os.getenv('SMTP_PASSWORD', '').replace(' ', '')
        self.from_email = os.getenv('FROM_EMAIL', 'noreply@eros.local')
        self.from_name = os.getenv('FROM_NAME', 'EROS System')
        self.admin_email = os.getenv('ADMIN_EMAIL', '')
        self.frontend_base_url = os.getenv('FRONTEND_BASE_URL', 'http://localhost:3000')

    def send_email(self, to_email, subject, html_content, text_content=None):
        """
        Send email using SMTP
        
        Args:
            to_email (str): Recipient email
            subject (str): Email subject
            html_content (str): HTML content
            text_content (str): Plain text content (optional)
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            if not self.smtp_username or not self.smtp_password:
                return False, "SMTP credentials are not configured"

            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            # Add plain text content
            if text_content:
                text_part = MIMEText(text_content, 'plain')
                msg.attach(text_part)
            
            # Add HTML content
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            return True, "Email sent successfully"
            
        except Exception as e:
            return False, f"Failed to send email: {str(e)}"
    
    def send_verification_email(self, user, verification_token):
        """
        Send email verification email to user
        
        Args:
            user (User): User object
            verification_token (str): Verification token
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            verification_url = f"{self.frontend_base_url}/verify-email/{verification_token}"
            
            subject = "Verify Your Email - EROS System"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .button {{ display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                    .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚨 EROS System</h1>
                        <p>Emergency Response Operating System</p>
                    </div>
                    <div class="content">
                        <h2>Welcome to EROS!</h2>
                        <p>Hello {user.first_name or user.email},</p>
                        <p>Thank you for registering with the EROS (Emergency Response Operating System). To complete your registration and access all features, please verify your email address.</p>
                        
                        <p><strong>What happens next?</strong></p>
                        <ul>
                            <li>Click the verification button below</li>
                            <li>You'll be redirected to the login page</li>
                            <li>Wait for admin approval (you'll be notified)</li>
                            <li>Start using EROS to report emergencies and track units</li>
                        </ul>
                        
                        <div style="text-align: center;">
                            <a href="{verification_url}" class="button">Verify Email Address</a>
                        </div>
                        
                        <p><strong>Note:</strong> This verification link will expire in 24 hours for security reasons.</p>
                        
                        <p>If the button doesn't work, copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">{verification_url}</p>
                        
                        <p>If you didn't create an account with EROS, please ignore this email.</p>
                    </div>
                    <div class="footer">
                        <p>© 2024 EROS - Emergency Response Operating System</p>
                        <p>This is an automated message. Please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            text_content = f"""
            Welcome to EROS!

            Hello {user.first_name or user.email},

            Thank you for registering with the EROS (Emergency Response Operating System). To complete your registration, please verify your email address by visiting:

            {verification_url}

            This verification link will expire in 24 hours.

            If you didn't create an account with EROS, please ignore this email.

            Best regards,
            EROS Team
            """
            
            return self.send_email(user.email, subject, html_content, text_content)
            
        except Exception as e:
            return False, f"Failed to send verification email: {str(e)}"
    
    def send_password_reset_email(self, user, reset_token):
        """
        Send password reset email to user
        
        Args:
            user (User): User object
            reset_token (str): Password reset token
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            reset_url = f"{self.frontend_base_url}/reset-password/{reset_token}"
            
            subject = "Password Reset - EROS System"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .button {{ display: inline-block; background: #ff6b6b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                    .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚨 EROS System</h1>
                        <p>Password Reset Request</p>
                    </div>
                    <div class="content">
                        <h2>Password Reset Request</h2>
                        <p>Hello {user.first_name or user.email},</p>
                        <p>We received a request to reset your password for your EROS account. If you made this request, click the button below to set a new password.</p>
                        
                        <div style="text-align: center;">
                            <a href="{reset_url}" class="button">Reset Password</a>
                        </div>
                        
                        <p><strong>Security Note:</strong> This password reset link will expire in 1 hour for security reasons.</p>
                        
                        <p>If the button doesn't work, copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">{reset_url}</p>
                        
                        <p><strong>If you didn't request a password reset:</strong> Please ignore this email. Your password will remain unchanged.</p>
                        
                        <p>For security reasons, never share this email or the reset link with anyone.</p>
                    </div>
                    <div class="footer">
                        <p>© 2024 EROS - Emergency Response Operating System</p>
                        <p>This is an automated message. Please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            text_content = f"""
            Password Reset Request

            Hello {user.first_name or user.email},

            We received a request to reset your password for your EROS account. If you made this request, visit:

            {reset_url}

            This password reset link will expire in 1 hour.

            If you didn't request a password reset, please ignore this email.

            Best regards,
            EROS Team
            """
            
            return self.send_email(user.email, subject, html_content, text_content)
            
        except Exception as e:
            return False, f"Failed to send password reset email: {str(e)}"
    
    def send_admin_new_user_notification(self, user):
        """
        Send notification to admin about new user registration
        
        Args:
            user (User): Newly registered user
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            subject = "New User Request - Approval Needed - EROS System"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .button {{ display: inline-block; background: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                    .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
                    .user-info {{ background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }}
                    .urgent {{ background: #FFF3CD; border: 1px solid #FFEAA7; padding: 15px; border-radius: 5px; margin: 15px 0; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚨 EROS Admin Notification</h1>
                        <p>New User Request Pending Approval</p>
                    </div>
                    <div class="content">
                        <div class="urgent">
                            <h2>⚠️ New User Request Requires Your Approval</h2>
                            <p>A new user has requested access to the EROS system and is waiting for your approval to proceed.</p>
                        </div>
                        
                        <div class="user-info">
                            <h3>📋 User Request Details:</h3>
                            <p><strong>👤 Full Name:</strong> {user.first_name or 'N/A'} {user.last_name or ''}</p>
                            <p><strong>📧 Email Address:</strong> {user.email}</p>
                            <p><strong>🏢 Role:</strong> {user.role.title()}</p>
                            <p><strong>🏛️ Organization:</strong> {user.organization or 'N/A'}</p>
                            <p><strong>📱 Phone:</strong> {user.phone or 'N/A'}</p>
                            <p><strong>📅 Request Time:</strong> {user.created_at.strftime('%Y-%m-%d %H:%M:%S')}</p>
                            <p><strong>✅ Email Status:</strong> {'✅ Verified' if user.is_verified else '⏳ Pending Verification'}</p>
                            <p><strong>🔒 Account Status:</strong> {'🔓 Ready for Approval' if user.is_verified else '⏳ Waiting for Email Verification'}</p>
                        </div>
                        
                        <h3>🎯 Action Required:</h3>
                        <p><strong>Admin Panel Review</strong></p>
                        <p>Please log into the admin panel to review this user request and approve if appropriate:</p>
                        
                        <div style="text-align: center; margin: 20px 0;">
                            <a href="{self.frontend_base_url}" class="button">🔑 Log into Admin System</a>
                        </div>
                        
                        <p><strong>Next Steps After Approval:</strong></p>
                        <ol>
                            <li>✅ The user will receive an approval notification email</li>
                            <li>🔓 They can then log into the EROS system</li>
                            <li>📊 You'll see updated statistics in your admin dashboard</li>
                            <li>🛡️ All system access will be granted based on their role</li>
                        </ol>
                        
                        <p><em>🔒 Security Note: The user must verify their email address before approval can be granted.</em></p>
                        
                        <hr style="margin: 30px 0; border: 1px solid #ddd;">
                        
                        <p><strong>❓ Need Help?</strong></p>
                        <p>If you have questions about this request or need assistance, please contact the system administrator.</p>
                    </div>
                    <div class="footer">
                        <p>© 2024 EROS - Emergency Response Operating System</p>
                        <p>🔔 This is an automated notification - Please respond promptly to user requests</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            text_content = f"""
            🚨 EROS Admin Notification - New User Request

            A new user has requested access to the EROS system and is waiting for your approval.

            📋 User Request Details:
            - Full Name: {user.first_name or 'N/A'} {user.last_name or ''}
            - Email: {user.email}
            - Role: {user.role.title()}
            - Organization: {user.organization or 'N/A'}
            - Phone: {user.phone or 'N/A'}
            - Request Time: {user.created_at.strftime('%Y-%m-%d %H:%M:%S')}
            - Email Status: {'✅ Verified' if user.is_verified else '⏳ Pending Verification'}

            🎯 Action Required:
            Please log into the admin panel to review this user request: http://localhost:3000/login

            After approval, the user will receive a notification and can log into the system.

            🔒 Security Note: The user must verify their email address before approval can be granted.

            Best regards,
            EROS System Administrator
            """
            
            return self.send_email(self.admin_email, subject, html_content, text_content)
            
        except Exception as e:
            return False, f"Failed to send admin notification: {str(e)}"
    
    def send_user_approval_notification(self, user):
        """
        Send notification to user about approval
        
        Args:
            user (User): Approved user
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            subject = "Account Approved - Welcome to EROS!"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .button {{ display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                    .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 Account Approved!</h1>
                        <p>Welcome to EROS</p>
                    </div>
                    <div class="content">
                        <h2>Your EROS Account is Ready!</h2>
                        <p>Hello {user.first_name or user.email},</p>
                        <p>Great news! Your EROS account has been approved by our administrator. You can now log in and start using all the features of the Emergency Response Operating System.</p>
                        
                        <p><strong>What you can now do:</strong></p>
                        <ul>
                            <li>Log in to your account</li>
                            <li>Access the Dashboard for system overview</li>
                            <li>Track emergency response units in real-time</li>
                            <li>View notifications and system updates</li>
                        </ul>
                        
                        <div style="text-align: center;">
                            <a href="http://localhost:3000/login" class="button">Log In to EROS</a>
                        </div>
                        
                        <p><strong>Your Account Details:</strong></p>
                        <ul>
                            <li>Email: {user.email}</li>
                            <li>Role: {user.role.title()}</li>
                            <li>Organization: {user.organization or 'N/A'}</li>
                        </ul>
                        
                        <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                        
                        <p>Welcome to EROS! 🚨</p>
                    </div>
                    <div class="footer">
                        <p>© 2024 EROS - Emergency Response Operating System</p>
                        <p>Built with ❤️ for public safety</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            text_content = f"""
            Account Approved - Welcome to EROS!

            Hello {user.first_name or user.email},

            Great news! Your EROS account has been approved by our administrator. You can now log in and start using all the features of the Emergency Response Operating System.

            You can now:
            - Log in to your account
            - Access the Dashboard for system overview
            - Track emergency response units in real-time
            - Report emergencies and track their status
            - View notifications and system updates

            Log in here: http://localhost:3000/login

            Your Account Details:
            - Email: {user.email}
            - Role: {user.role.title()}
            - Organization: {user.organization or 'N/A'}

            Welcome to EROS!

            Best regards,
            EROS Team
            """
            
            return self.send_email(user.email, subject, html_content, text_content)
            
        except Exception as e:
            return False, f"Failed to send approval notification: {str(e)}"
    
    def send_welcome_email(self, user):
        """
        Send welcome email to new user (after approval)
        
        Args:
            user (User): User object
            
        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            subject = "Welcome to EROS - Emergency Response System"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .button {{ display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                    .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
                    .feature-box {{ background: white; padding: 20px; margin: 15px 0; border-radius: 5px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚨 Welcome to EROS!</h1>
                        <p>Emergency Response Operating System</p>
                    </div>
                    <div class="content">
                        <h2>Welcome {user.first_name or user.email}!</h2>
                        <p>We're thrilled to have you join the EROS community! You're now part of a powerful emergency response system designed to improve public safety and emergency management.</p>
                        
                        <div class="feature-box">
                            <h3>🌟 Key Features Available to You:</h3>
                            <ul>
                                <li><strong>Emergency Reporting:</strong> Quickly report emergencies with detailed information</li>
                                <li><strong>Real-time Unit Tracking:</strong> Monitor emergency response units on interactive maps</li>
                                <li><strong>Dashboard Analytics:</strong> Get insights into emergency response patterns</li>
                                <li><strong>Live Notifications:</strong> Stay updated with real-time system notifications</li>
                                <li><strong>Route Optimization:</strong> AI-powered routing for fastest response times</li>
                            </ul>
                        </div>
                        
                        <div class="feature-box">
                            <h3>🎯 Getting Started:</h3>
                            <ol>
                                <li>Log in to your account</li>
                                <li>Explore the Dashboard for system overview</li>
                                <li>Try reporting a test emergency (optional)</li>
                                <li>Check out the Units Tracking feature</li>
                                <li>Customize your notification preferences</li>
                            </ol>
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="http://localhost:3000" class="button">Start Using EROS</a>
                        </div>
                        
                        <p><strong>Need Help?</strong></p>
                        <p>If you have any questions or need assistance, our support team is here to help. You can reach out through the system or contact us directly.</p>
                        
                        <p>Thank you for being part of making our communities safer! 🛡️</p>
                    </div>
                    <div class="footer">
                        <p>© 2024 EROS - Emergency Response Operating System</p>
                        <p>Built with ❤️ for public safety</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            text_content = f"""
            Welcome to EROS!

            Hello {user.first_name or user.email},

            We're thrilled to have you join the EROS community! You're now part of a powerful emergency response system designed to improve public safety and emergency management.

            Key Features Available to You:
            - Emergency Reporting: Quickly report emergencies with detailed information
            - Real-time Unit Tracking: Monitor emergency response units on interactive maps
            - Dashboard Analytics: Get insights into emergency response patterns
            - Live Notifications: Stay updated with real-time system notifications
            - Route Optimization: AI-powered routing for fastest response times

            Getting Started:
            1. Log in to your account
            2. Explore the Dashboard for system overview
            3. Try reporting a test emergency (optional)
            4. Check out the Units Tracking feature
            5. Customize your notification preferences

            Start using EROS: http://localhost:3000

            If you have any questions or need assistance, our support team is here to help.

            Thank you for being part of making our communities safer!

            Best regards,
            EROS Team
            """
            
            return self.send_email(user.email, subject, html_content, text_content)
            
        except Exception as e:
            return False, f"Failed to send welcome email: {str(e)}"

# Create a global instance
email_service = EmailService()
