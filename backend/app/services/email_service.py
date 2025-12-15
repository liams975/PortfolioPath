"""Email service for sending verification and notification emails."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import asyncio
from concurrent.futures import ThreadPoolExecutor
from app.config import settings

_executor = ThreadPoolExecutor(max_workers=2)


class EmailService:
    """Service for sending emails."""
    
    @staticmethod
    def _send_email_sync(
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send email synchronously (called in thread pool)."""
        # Check if email settings are configured
        smtp_host = getattr(settings, 'SMTP_HOST', None)
        smtp_port = getattr(settings, 'SMTP_PORT', 587)
        smtp_user = getattr(settings, 'SMTP_USER', None)
        smtp_password = getattr(settings, 'SMTP_PASSWORD', None)
        from_email = getattr(settings, 'FROM_EMAIL', None)
        
        if not all([smtp_host, smtp_user, smtp_password, from_email]):
            # Email not configured - log and return
            print(f"[EMAIL] Would send to {to_email}: {subject}")
            print(f"[EMAIL] Content: {text_content or html_content[:200]}...")
            return True  # Return True to not block the flow
        
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = from_email
            msg['To'] = to_email
            
            # Attach text and HTML versions
            if text_content:
                msg.attach(MIMEText(text_content, 'plain'))
            msg.attach(MIMEText(html_content, 'html'))
            
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(from_email, to_email, msg.as_string())
            
            return True
        except Exception as e:
            print(f"[EMAIL ERROR] Failed to send email to {to_email}: {e}")
            return False
    
    @staticmethod
    async def send_email(
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send email asynchronously."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            EmailService._send_email_sync,
            to_email,
            subject,
            html_content,
            text_content
        )
    
    @staticmethod
    async def send_verification_email(to_email: str, verification_token: str) -> bool:
        """Send email verification email."""
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        verification_link = f"{frontend_url}/verify-email?token={verification_token}"
        
        subject = "Verify your PortfolioPath account"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .logo {{ font-size: 24px; font-weight: bold; color: #e11d48; }}
                .content {{ background: #f4f4f5; border-radius: 12px; padding: 30px; margin-bottom: 30px; }}
                .button {{ display: inline-block; background: #e11d48; color: white !important; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; }}
                .footer {{ text-align: center; color: #71717a; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">📈 PortfolioPath</div>
                </div>
                <div class="content">
                    <h2>Welcome to PortfolioPath!</h2>
                    <p>Thanks for signing up. Please verify your email address to complete your registration.</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="{verification_link}" class="button">Verify Email Address</a>
                    </p>
                    <p style="font-size: 14px; color: #71717a;">
                        If the button doesn't work, copy and paste this link into your browser:<br>
                        <code style="word-break: break-all;">{verification_link}</code>
                    </p>
                    <p style="font-size: 14px; color: #71717a;">
                        This link will expire in 24 hours.
                    </p>
                </div>
                <div class="footer">
                    <p>© 2024 PortfolioPath. All rights reserved.</p>
                    <p>If you didn't create this account, you can safely ignore this email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Welcome to PortfolioPath!
        
        Thanks for signing up. Please verify your email address by clicking the link below:
        
        {verification_link}
        
        This link will expire in 24 hours.
        
        If you didn't create this account, you can safely ignore this email.
        """
        
        return await EmailService.send_email(to_email, subject, html_content, text_content)
    
    @staticmethod
    async def send_password_reset_email(to_email: str, reset_token: str) -> bool:
        """Send password reset email."""
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        reset_link = f"{frontend_url}/reset-password?token={reset_token}"
        
        subject = "Reset your PortfolioPath password"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .logo {{ font-size: 24px; font-weight: bold; color: #e11d48; }}
                .content {{ background: #f4f4f5; border-radius: 12px; padding: 30px; margin-bottom: 30px; }}
                .button {{ display: inline-block; background: #e11d48; color: white !important; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; }}
                .footer {{ text-align: center; color: #71717a; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">📈 PortfolioPath</div>
                </div>
                <div class="content">
                    <h2>Reset Your Password</h2>
                    <p>We received a request to reset your password. Click the button below to create a new password.</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="{reset_link}" class="button">Reset Password</a>
                    </p>
                    <p style="font-size: 14px; color: #71717a;">
                        If the button doesn't work, copy and paste this link into your browser:<br>
                        <code style="word-break: break-all;">{reset_link}</code>
                    </p>
                    <p style="font-size: 14px; color: #71717a;">
                        This link will expire in 1 hour.
                    </p>
                </div>
                <div class="footer">
                    <p>© 2024 PortfolioPath. All rights reserved.</p>
                    <p>If you didn't request this, you can safely ignore this email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Reset Your Password
        
        We received a request to reset your password. Click the link below to create a new password:
        
        {reset_link}
        
        This link will expire in 1 hour.
        
        If you didn't request this, you can safely ignore this email.
        """
        
        return await EmailService.send_email(to_email, subject, html_content, text_content)
    
    @staticmethod
    async def send_welcome_email(to_email: str, username: str) -> bool:
        """Send welcome email after verification."""
        subject = "Welcome to PortfolioPath!"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .logo {{ font-size: 24px; font-weight: bold; color: #e11d48; }}
                .content {{ background: #f4f4f5; border-radius: 12px; padding: 30px; margin-bottom: 30px; }}
                .footer {{ text-align: center; color: #71717a; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">📈 PortfolioPath</div>
                </div>
                <div class="content">
                    <h2>Your account is verified! 🎉</h2>
                    <p>Hi {username},</p>
                    <p>Your email has been verified and your PortfolioPath account is now fully active.</p>
                    <p>Here's what you can do now:</p>
                    <ul>
                        <li>Run Monte Carlo simulations on your portfolio</li>
                        <li>Compare different allocation strategies</li>
                        <li>Analyze risk metrics and potential outcomes</li>
                        <li>Save and track multiple portfolios</li>
                    </ul>
                    <p>Happy investing!</p>
                </div>
                <div class="footer">
                    <p>© 2024 PortfolioPath. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Your account is verified!
        
        Hi {username},
        
        Your email has been verified and your PortfolioPath account is now fully active.
        
        Here's what you can do now:
        - Run Monte Carlo simulations on your portfolio
        - Compare different allocation strategies
        - Analyze risk metrics and potential outcomes
        - Save and track multiple portfolios
        
        Happy investing!
        """
        
        return await EmailService.send_email(to_email, subject, html_content, text_content)
