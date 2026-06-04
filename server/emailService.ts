interface BrevoEmailResponse {
  messageId: string;
}

interface SendEmailParams {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export class EmailService {
  private apiKey: string;
  private apiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor() {
    this.apiKey = process.env.BREVO_API_KEY!;
    if (!this.apiKey) {
      throw new Error('BREVO_API_KEY environment variable is required');
    }
  }

  async sendEmail({ to, subject, htmlContent, textContent }: SendEmailParams): Promise<BrevoEmailResponse> {
    const emailData = {
      sender: {
        name: "HeyMama",
        email: "noreply@heymama.app"
      },
      to: [
        {
          email: to
        }
      ],
      subject,
      htmlContent,
      textContent: textContent || htmlContent.replace(/<[^>]*>/g, '') // Strip HTML tags for text version
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': this.apiKey
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send email: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  generateVerificationCode(): string {
    // Generate a 6-digit verification code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendVerificationEmail(email: string, verificationCode: string): Promise<void> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification - HeyMama</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ec4899, #a855f7); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
          .code-box { background: white; border: 2px dashed #ec4899; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .verification-code { font-size: 32px; font-weight: bold; color: #ec4899; letter-spacing: 8px; }
          .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🌸 Welcome to HeyMama! 🌸</h1>
          <p>Please verify your email address</p>
        </div>
        <div class="content">
          <h2>Hello!</h2>
          <p>Thank you for joining HeyMama, the community for mothers to connect and discover amazing places together!</p>
          <p>To complete your registration, please enter this verification code in the app:</p>
          
          <div class="code-box">
            <div class="verification-code">${verificationCode}</div>
          </div>
          
          <p>This code will expire in 10 minutes for security reasons.</p>
          <p>If you didn't create an account with HeyMama, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>With love,<br>The HeyMama Team 💕</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Welcome to HeyMama!
      
      Thank you for joining our community for mothers!
      
      To complete your registration, please enter this verification code in the app:
      
      ${verificationCode}
      
      This code will expire in 10 minutes.
      
      If you didn't create an account with HeyMama, please ignore this email.
      
      With love,
      The HeyMama Team
    `;

    await this.sendEmail({
      to: email,
      subject: "Welcome to HeyMama! Please verify your email 🌸",
      htmlContent,
      textContent
    });
  }
}

export const emailService = new EmailService();