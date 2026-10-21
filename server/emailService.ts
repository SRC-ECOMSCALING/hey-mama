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
  private apiUrl = 'https://api.brevo.com/v3/smtp/email';

  // Read lazily so a missing BREVO_API_KEY degrades to "email unavailable"
  // (registration falls back to no-verification) instead of crashing at boot.
  private get apiKey(): string {
    const key = process.env.BREVO_API_KEY;
    if (!key) {
      throw new Error('BREVO_API_KEY environment variable is required');
    }
    return key;
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
        <title>Verifica la tua email - HeyMama</title>
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
          <h1>🌸 Benvenuta su HeyMama! 🌸</h1>
          <p>Conferma il tuo indirizzo email</p>
        </div>
        <div class="content">
          <h2>Ciao!</h2>
          <p>Grazie per esserti iscritta a HeyMama, la community dove le mamme si conoscono e scoprono insieme posti a misura di bambino!</p>
          <p>Per completare la registrazione, inserisci questo codice nell'app:</p>
          
          <div class="code-box">
            <div class="verification-code">${verificationCode}</div>
          </div>
          
          <p>Per sicurezza il codice scade tra 10 minuti.</p>
          <p>Se non hai creato tu un account HeyMama, ignora questa email.</p>
        </div>
        <div class="footer">
          <p>Con affetto,<br>Il team HeyMama 💕</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Benvenuta su HeyMama!
      
      Grazie per esserti iscritta alla nostra community di mamme!
      
      Per completare la registrazione, inserisci questo codice nell'app:
      
      ${verificationCode}
      
      Il codice scade tra 10 minuti.
      
      Se non hai creato tu un account HeyMama, ignora questa email.
      
      Con affetto,
      Il team HeyMama
    `;

    await this.sendEmail({
      to: email,
      subject: "Benvenuta su HeyMama! Conferma la tua email 🌸",
      htmlContent,
      textContent
    });
  }

  async sendPasswordResetEmail(email: string, resetCode: string): Promise<void> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reimposta la password - HeyMama</title>
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
          <h1>HeyMama</h1>
          <p>Reimposta la tua password</p>
        </div>
        <div class="content">
          <p>Ciao!</p>
          <p>Hai chiesto di reimpostare la password del tuo account HeyMama. Inserisci questo codice nell'app:</p>
          <div class="code-box">
            <div class="verification-code">${resetCode}</div>
          </div>
          <p>Il codice scade tra 15 minuti.</p>
          <p>Se non hai richiesto tu il reset, ignora questa email: la tua password resta invariata.</p>
        </div>
        <div class="footer">
          <p>HeyMama - La community delle mamme</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `Reimposta la tua password HeyMama\n\nCodice: ${resetCode}\nIl codice scade tra 15 minuti.\n\nSe non hai richiesto tu il reset, ignora questa email.`;

    await this.sendEmail({
      to: email,
      subject: "Reimposta la tua password HeyMama 🔑",
      htmlContent,
      textContent,
    });
  }
}

export const emailService = new EmailService();