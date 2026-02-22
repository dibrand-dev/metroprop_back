import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get('SENDGRID_API_KEY');
    
    if (!apiKey) {
      throw new Error('SENDGRID_API_KEY must be provided');
    }
    
    sgMail.setApiKey(apiKey);
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const msg = {
        to: options.to,
        from: {
          email: this.configService.get('SENDGRID_FROM_EMAIL', 'noreply@metroprop.com'),
          name: this.configService.get('SENDGRID_FROM_NAME', 'MetroProp')
        },
        subject: options.subject,
        html: options.html,
        // Optional: Add tracking settings
        trackingSettings: {
          clickTracking: {
            enable: true,
          },
          openTracking: {
            enable: true,
          },
        },
      };

      const [response] = await sgMail.send(msg);

      this.logger.log(`Email sent successfully to ${options.to}. Status: ${response.statusCode}`);
    } catch (error) {
      const errorMessage = `Failed to send email to ${options.to}`;
      
      if (error && typeof error === 'object' && 'response' in error) {
        const sendGridError = error as any;
        this.logger.error(errorMessage, {
          statusCode: sendGridError.code,
          message: sendGridError.message,
          response: sendGridError.response?.body
        });
        
        throw new Error(`SendGrid error: ${sendGridError.message} (Code: ${sendGridError.code})`);
      } else {
        const errorStack = error instanceof Error ? error.stack : String(error);
        this.logger.error(errorMessage, errorStack);
        throw new Error(`Email delivery failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  async sendWelcomeEmail(to: string, name: string, verificationToken: string): Promise<void> {
    const verificationUrl = `${this.configService.get('FRONTEND_URL')}/verify-email?token=${verificationToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">¡Bienvenido ${name}!</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Gracias por registrarte en MetroProp. Para completar tu registro, por favor verifica tu dirección de email haciendo clic en el botón de abajo.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Validar Email
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:<br>
          <a href="${verificationUrl}">${verificationUrl}</a>
        </p>
        <hr style="border: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          Este enlace no expira. Si no solicitaste este registro, puedes ignorar este email.
        </p>
      </div>
    `;

    await this.sendEmail({
      to,
      subject: 'Bienvenido a MetroProp - Verifica tu cuenta',
      html
    });
  }

  async sendProfessionalWelcomeEmail(to: string, name: string, verificationToken: string): Promise<void> {
    const verificationUrl = `${this.configService.get('FRONTEND_URL')}/verify-email?token=${verificationToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">¡Bienvenido ${name}!</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Gracias por unirte a MetroProp como <strong>usuario profesional</strong>. Para completar tu registro profesional, por favor verifica tu dirección de email haciendo clic en el botón de abajo.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Validar Email Profesional
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:<br>
          <a href="${verificationUrl}">${verificationUrl}</a>
        </p>
        <hr style="border: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          Como usuario profesional tendrás acceso a funcionalidades avanzadas para gestión de propiedades. Este enlace no expira.
        </p>
      </div>
    `;

    await this.sendEmail({
      to,
      subject: 'Bienvenido a MetroProp - Cuenta Profesional',
      html
    });
  }

  async sendPasswordResetEmail(to: string, name: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/resetPassword?token=${resetToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Hola ${name}</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta en MetroProp.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Restablecer Contraseña
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:<br>
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
        <hr style="border: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          Este enlace expirará en 1 hora. Si no solicitaste este cambio, puedes ignorar este email y tu contraseña no será modificada.
        </p>
      </div>
    `;

    await this.sendEmail({
      to,
      subject: 'Restablecer contraseña - MetroProp',
      html
    });
  }
}