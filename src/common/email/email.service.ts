import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import { API_BASE_URL, PASSWORD_DEFAULT } from '../constants';
import { OperationType } from '../enums';

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
      const fromEmail = this.configService.get('SENDGRID_FROM_EMAIL', 'hola@metroprop.co');
      const fromName = this.configService.get('SENDGRID_FROM_NAME', 'MetroProp');
      const apiKey = this.configService.get('SENDGRID_API_KEY');
      const apiKeyShort = apiKey ? apiKey.substring(0, 6) + '...' : 'undefined';
      const msg = {
        to: options.to,
        from: {
          email: fromEmail,
          name: fromName
        },
        subject: options.subject,
        html: options.html,
        trackingSettings: {
          clickTracking: {
            enable: true,
          },
          openTracking: {
            enable: true,
          },
        },
      };

      this.logger.log('[EmailService] Attempting to send email with:', {
        apiKeyShort,
        fromEmail,
        fromName,
        to: options.to,
        subject: options.subject,
        html: options.html
      });

      const [response] = await sgMail.send(msg);

      this.logger.log(`Email sent successfully to ${options.to}. Status: ${response.statusCode}`);
    } catch (error) {
      const errorMessage = `Failed to send email to ${options.to}`;
      const fromEmail = this.configService.get('SENDGRID_FROM_EMAIL', 'hola@metroprop.co');
      const fromName = this.configService.get('SENDGRID_FROM_NAME', 'MetroProp');
      const apiKey = this.configService.get('SENDGRID_API_KEY');
      const apiKeyShort = apiKey ? apiKey.substring(0, 6) + '...' : 'undefined';
      this.logger.error('[EmailService] Error sending email. Details:', {
        apiKeyShort,
        fromEmail,
        fromName,
        to: options.to,
        subject: options.subject,
        html: options.html
      });
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
    const verificationUrl = `${this.configService.get('FRONTEND_URL')}/login?verifyMailToken=${verificationToken}`;
    
      const html = `
      <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Bienvenido a Metroprop</title>
        </head>
        <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#ffffff;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:20px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="overflow:hidden;">
                  <!-- Header -->
                  <tr>
                    <td align="center" style="padding:20px; background-color: #F5F5F5;">
                      <img src="${ this.configService.get('FRONTEND_URL')}/images/metropropLogo.png" alt="Metroprop Logo" width="150" style="display:block;">
                    </td>
                  </tr> 
                  <!-- Body -->
                  <tr style="border-bottom: 1px solid black;">
                    <td style="padding:20px; color:#333333; font-size:16px; line-height:1.5;text-align: center;">
                      <p style="margin:0; font-size:26px; font-weight:800;">¡Hola! Confirmamos que tu registro en Metroprop fue exitoso.</p>
                      <p>Desde ahora vas a poder:</p>
                      <ul style="list-style:none; padding: 15px;  background-color:#F5F5F5; margin:10px;border-radius: 8px;">
                        <li style="margin:8px 0;">
                          <img src="${ this.configService.get('FRONTEND_URL')}/icons/search.png" alt="icono" width="20" style="vertical-align:middle; margin-right:8px;"><br>
                          Guardar alertas de búsqueda
                        </li>
                        <li style="margin:8px 0;">
                          <img src="${ this.configService.get('FRONTEND_URL')}/icons/corazon.png" alt="icono" width="20" style="vertical-align:middle; margin-right:8px;"><br>
                          Seguir la evolución de tus propiedades favoritas
                        </li>
                        <li style="margin:8px 0;">
                          <img src="${ this.configService.get('FRONTEND_URL')}/icons/envelope.png" alt="icono" width="20" style="vertical-align:middle; margin-right:8px;"><br>
                          Contactar inmobiliarias
                        </li>
                      </ul>
                      <div style="margin:30px 10px;border-radius: 10px;background-color: #fff; padding: 30px;border: 2px solid #A8A8A8;">
                        <img src="${ this.configService.get('FRONTEND_URL')}/icons/megafono.png" alt="icono" width="20" style="vertical-align:middle; margin-right:8px;"><br>  
                        <p style="margin:15px 0;font-size:20px;font-weight:700;">Personalizá tus alertas según zonas, precios y tipos de propiedad.</p>
                        <p style="margin:15px 0;font-size:16px;">Es la forma más rápida de encontrar oportunidades que se ajusten a lo que buscás.</p>
                      </div>
                      <!-- CTA Button -->
                      <div style="text-align:center; margin:20px 0;">
                        <a href="${verificationUrl}" style="background-color:#007bff; color:#ffffff; text-decoration:none; padding:12px 80px; border-radius:4px; font-weight:bold; display:inline-block;">
                          Validar mi cuenta
                        </a>
                      </div>
                      <p style="margin:10px 0;">Si necesitás ayuda, escribinos cuando quieras.</p>
                      <p style="margin:0;">¡Gracias por sumarte!</p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td align="center" style="padding:20px; font-size:12px; color:#777777; background-color:#F5F5F5;">
                      <p style="margin:30px;">  
                      <img src="${ this.configService.get('FRONTEND_URL')}/icons/fb.png" alt="icono" width="20" style="vertical-align:middle; margin-right:50px;">
                      <img src="${ this.configService.get('FRONTEND_URL')}/icons/instagram.png" alt="icono" width="20" style="vertical-align:middle; margin-right:50px;">
                      <img src="${ this.configService.get('FRONTEND_URL')}/icons/youtube.png" alt="icono" width="20" style="vertical-align:middle;">
                      </p>
                      <p style="margin:0;">
                        <a href="#" style="color:#007bff; text-decoration:none;">Políticas de privacidad</a> | 
                        <a href="#" style="color:#007bff; text-decoration:none;">Términos y condiciones</a>
                      </p>
                      <p style="margin-top:30px;text-align:left;">Recibes este e-mail porque eres usuario registrado en Metroprop al amparo de nuestra Política de Privacidad. Este e-mail se ha enviado desde Metroprop.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
            `;


    await this.sendEmail({
      to,
      subject: '¡Bienvenido a MetroProp! - Confirma tu cuenta',
      html
    });
  }

  async sendProfessionalWelcomeEmail(to: string, name: string, verificationToken: string): Promise<void> {
    const verificationUrl = `${this.configService.get('FRONTEND_URL')}/login?verifyMailToken=${verificationToken}`;
    
    const html = `
      <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Bienvenido a Metroprop</title>
        </head>
        <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f7f7f7;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f7f7; padding:20px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
                  <!-- Header -->
                  <tr>
                    <td align="center" style="padding:20px;">
                      <img src="${ this.configService.get('FRONTEND_URL')}/images/metropropLogo.png" alt="Metroprop Logo" width="150" style="display:block;">
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:20px; color:#333333; font-size:16px; line-height:1.5;text-align: center;background-color: #EBF1FD;">
                      <p style="margin:0; font-size:26px; font-weight:800;">¡Hola ${name}!<br>Bienvenido a Metroprop.<br>Tu cuenta fue registrada con éxito.</p>
                      <p>Desde tu cuenta profesional vas a poder:</p>
                      <ul style="list-style:none; padding: 15px;  background-color: #fff; margin:0;border-radius: 10px;box-shadow: 0 4px 4px 0 rgba(0, 0, 0, .25);">
                        <li style="margin:8px 0;">
                          <img src="${ this.configService.get('FRONTEND_URL')}/icons/building.png" alt="icono" width="20" style="vertical-align:middle; margin-right:8px;"><br>
                          Publicar propiedades
                        </li>
                        <li style="margin:8px 0;">
                          <img src="${ this.configService.get('FRONTEND_URL')}/icons/envelope.png" alt="icono" width="20" style="vertical-align:middle; margin-right:8px;"><br>
                          Recibir consultas de interesados
                        </li>
                        <li style="margin:8px 0;">
                          <img src="${ this.configService.get('FRONTEND_URL')}/icons/message.png" alt="icono" width="20" style="vertical-align:middle; margin-right:8px;"><br>
                          Gestionar tus contactos
                        </li>
                        <li style="margin:8px 0;">
                          <img src="${ this.configService.get('FRONTEND_URL')}/icons/mis_publicaciones.png" alt="icono" width="20" style="vertical-align:middle; margin-right:8px;"><br>
                          Monitorear el rendimiento de tus publicaciones
                        </li>
                      </ul>
                      <div style="margin:50px 0;border-radius: 10px;box-shadow: 0 4px 4px 0 rgba(0, 0, 0, .25);background-color: #fff; padding: 30px;">
                        <img src="${ this.configService.get('FRONTEND_URL')}/icons/casareservada.png" alt="icono" width="20" style="vertical-align:middle; margin-right:8px;"><br>  
                        <p style="margin:15px 0;font-size:20px;font-weight:700;">Subí tu primer propiedad y empezá a recibir consultas.</p>
                      </div>
                      <!-- CTA Button -->
                      <div style="text-align:center; margin:20px 0;">
                        <a href="${verificationUrl}" style="background-color:#007bff; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:4px; font-weight:bold; display:inline-block;">
                          Validar mi cuenta
                        </a>
                      </div>
                      <p style="margin:10px 0;">Si necesitás ayuda, escribinos cuando quieras.</p>
                      <p style="margin:0;">¡Gracias por sumarte!</p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td align="center" style="padding:20px; font-size:12px; color:#777777; background-color:#ffffff;">
                      <p style="margin:30px;">  
                      <img src="${ this.configService.get('FRONTEND_URL')}/icons/fb.png" alt="icono" width="20" style="vertical-align:middle; margin-right:50px;">
                      <img src="${ this.configService.get('FRONTEND_URL')}/icons/instagram.png" alt="icono" width="20" style="vertical-align:middle; margin-right:50px;">
                      <img src="${ this.configService.get('FRONTEND_URL')}/icons/youtube.png" alt="icono" width="20" style="vertical-align:middle;">
                      </p>
                      <p style="margin:0;">
                        <a href="#" style="color:#007bff; text-decoration:none;">Políticas de privacidad</a> | 
                        <a href="#" style="color:#007bff; text-decoration:none;">Términos y condiciones</a>
                      </p>
                      <p style="margin:30px 0;text-align:left;">Recibes este e-mail porque eres usuario registrado en Metroprop al amparo de nuestra Política de Privacidad. Este e-mail se ha enviado desde Metroprop.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
     `
    ;

    await this.sendEmail({
      to,
      subject: 'MetroProp Professional - Activa tu cuenta avanzada',
      html
    });
  }

  async sendProfessionalWelcomeEmailValidated(to: string, name: string): Promise<void> {
    const loginUrl = `${this.configService.get('FRONTEND_URL')}/login`;
    
    const html = `
      <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Bienvenido a Metroprop</title>
        </head>
        <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f7f7f7;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f7f7; padding:20px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
                  <!-- Header -->
                  <tr>
                    <td align="center" style="padding:20px;">
                      <img src="${ this.configService.get('FRONTEND_URL')}/images/metropropLogo.png" alt="Metroprop Logo" width="150" style="display:block;">
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:20px; color:#333333; font-size:16px; line-height:1.5;text-align: center;background-color: #EBF1FD;">
                      <p style="margin:0; font-size:26px; font-weight:800;">¡Hola ${name}!<br>Bienvenido a Metroprop.<br>Tu usuario fue registrado con éxito. </p> 
                      <p style="margin:0; font-size:16px; font-weight:400;"> Ingresá a tu cuenta tu este mail: ${to} y la contraseña: ${PASSWORD_DEFAULT} </br>
                      Te recomendamos cambiar tu contraseña después de iniciar sesión por motivos de seguridad.</p>
                      <p>Desde tu cuenta profesional vas a poder:</p>
                      <ul style="list-style:none; padding: 15px;  background-color: #fff; margin:0;border-radius: 10px;box-shadow: 0 4px 4px 0 rgba(0, 0, 0, .25);">
                        <li style="margin:8px 0;">
                          <img src="${ this.configService.get('FRONTEND_URL')}/icons/building.png" alt="icono" width="20" style="vertical-align:middle; margin-right:8px;"><br>
                          Publicar propiedades
                        </li>
                        <li style="margin:8px 0;">
                          <img src="${ this.configService.get('FRONTEND_URL')}/icons/envelope.png" alt="icono" width="20" style="vertical-align:middle; margin-right:8px;"><br>
                          Recibir consultas de interesados
                        </li>
                        <li style="margin:8px 0;">
                          <img src="${ this.configService.get('FRONTEND_URL')}/icons/message.png" alt="icono" width="20" style="vertical-align:middle; margin-right:8px;"><br>
                          Gestionar tus contactos
                        </li>
                        <li style="margin:8px 0;">
                          <img src="${ this.configService.get('FRONTEND_URL')}/icons/mis_publicaciones.png" alt="icono" width="20" style="vertical-align:middle; margin-right:8px;"><br>
                          Monitorear el rendimiento de tus publicaciones
                        </li>
                      </ul>
                      <div style="margin:50px 0;border-radius: 10px;box-shadow: 0 4px 4px 0 rgba(0, 0, 0, .25);background-color: #fff; padding: 30px;">
                        <img src="${ this.configService.get('FRONTEND_URL')}/icons/casareservada.png" alt="icono" width="20" style="vertical-align:middle; margin-right:8px;"><br>  
                        <p style="margin:15px 0;font-size:20px;font-weight:700;">Subí tu primer propiedad y empezá a recibir consultas.</p>
                      </div>
                      <!-- CTA Button -->
                      <div style="text-align:center; margin:20px 0;">
                        <a href="${loginUrl}" style="background-color:#007bff; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:4px; font-weight:bold; display:inline-block;">
                          Ingresá a tu cuenta
                        </a>
                      </div>
                      <p style="margin:10px 0;">Si necesitás ayuda, escribinos cuando quieras.</p>
                      <p style="margin:0;">¡Gracias por sumarte!</p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td align="center" style="padding:20px; font-size:12px; color:#777777; background-color:#ffffff;">
                      <p style="margin:30px;">  
                      <img src="${ this.configService.get('FRONTEND_URL')}/icons/fb.png" alt="icono" width="20" style="vertical-align:middle; margin-right:50px;">
                      <img src="${ this.configService.get('FRONTEND_URL')}/icons/instagram.png" alt="icono" width="20" style="vertical-align:middle; margin-right:50px;">
                      <img src="${ this.configService.get('FRONTEND_URL')}/icons/youtube.png" alt="icono" width="20" style="vertical-align:middle;">
                      </p>
                      <p style="margin:0;">
                        <a href="#" style="color:#007bff; text-decoration:none;">Políticas de privacidad</a> | 
                        <a href="#" style="color:#007bff; text-decoration:none;">Términos y condiciones</a>
                      </p>
                      <p style="margin:30px 0;text-align:left;">Recibes este e-mail porque eres usuario registrado en Metroprop al amparo de nuestra Política de Privacidad. Este e-mail se ha enviado desde Metroprop.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
     `
    ;

    await this.sendEmail({
      to,
      subject: 'MetroProp - Portal profesional activado',
      html
    });


  }

  async sendPasswordResetEmail(to: string, name: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/resetPassword?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Bienvenido a Metroprop</title>
        </head>
        <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#ffffff;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:20px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="overflow:hidden;">
                  <!-- Header -->
                  <tr>
                    <td align="center" style="padding:20px; background-color: #F5F5F5;">
                      <img src="${ this.configService.get('FRONTEND_URL')}/images/metropropLogo.png" alt="Metroprop Logo" width="150" style="display:block;">
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:20px; color:#333333; font-size:16px; line-height:1.5;text-align: center;border-bottom: 2px solid black;">
                      <p style="margin:0; font-size:26px; font-weight:800;">Recibimos una solicitud para recuperar tu contraseña.</p>

                      <div style="margin:30px 10px;border-radius: 10px;background-color: #F5F5F5; padding: 30px;">
                        <p style="margin:15px 0;font-size:16px;">Para continuar hacé clic en el siguiente enlace:</p>
                        <!-- CTA Button -->
                        <a href="${resetUrl}" style="background-color:#007bff; color:#ffffff; text-decoration:none; padding:12px 80px; border-radius:4px; font-weight:bold; display:inline-block;">
                          Restablecer contraseña
                        </a>
                      </div>

                      <p style="margin:10px 0;">Por seguridad, este enlace es válido por 30 minutos.</p>
                      <p style="margin:0; font-weight:bold;">Si vos no pediste este cambio, simplemente ignorá este mensaje.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px; color:#333333; font-size:16px; line-height:1.5;text-align: center;">
                      <p style="margin:0; font-size:18px; font-weight:bold;">Equipo Metroprop</p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td align="center" style="padding:20px; font-size:12px; color:#777777; background-color:#F5F5F5;">
                      <p style="margin:30px;">  
                      <img src="${ this.configService.get('FRONTEND_URL')}/icons/fb.png" alt="icono" width="20" style="vertical-align:middle; margin-right:50px;">
                      <img src="${ this.configService.get('FRONTEND_URL')}/icons/instagram.png" alt="icono" width="20" style="vertical-align:middle; margin-right:50px;">
                      <img src="${ this.configService.get('FRONTEND_URL')}/icons/youtube.png" alt="icono" width="20" style="vertical-align:middle;">
                      </p>
                      <p style="margin:0;">
                        <a href="#" style="color:#007bff; text-decoration:none;">Políticas de privacidad</a> | 
                        <a href="#" style="color:#007bff; text-decoration:none;">Términos y condiciones</a>
                      </p>
                      <p style="margin-top:30px;text-align:left;">Recibes este e-mail porque eres usuario registrado en Metroprop al amparo de nuestra Política de Privacidad. Este e-mail se ha enviado desde Metroprop.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
    `;

    await this.sendEmail({
      to,
      subject: 'MetroProp - Restablecer contraseña (Acción requerida)',
      html
    });
  }

  async sendSearchAlertEmail(
    to: string,
    userName: string,
    alertTitle: string,
    properties: Array<{
      id: number;
      publication_title: string;
      street?: string;
      number?: string;
      operation_type: number;
      price: number;
      currency: string;
      total_surface?: number;
      room_amount?: number;
      bathroom_amount?: number;
      price_square_meter?: number;
      firstImageUrl?: string | null;
    }>,
  ): Promise<void> {
    const frontendUrl = this.configService.get('FRONTEND_URL', 'https://metroprop.co');

    const operationLabel = (type: number) => {
      if (type === OperationType.VENTA) return 'Venta';
      if (type === OperationType.ALQUILER) return 'Alquiler';
      if (type === OperationType.ALQUILER_TEMPORAL) return 'Alquiler Temporal';
      return '';
    };

    const formatPrice = (price: number, currency: string) => {
      const formatted = new Intl.NumberFormat('es-AR').format(price);
      return `${currency} ${formatted}`;
    };

    const cardHtmlArray = properties.map((p) => {
      const imageHtml = p.firstImageUrl
        ? `<img src="${p.firstImageUrl}" alt="${p.publication_title}" width="100%" style="display:block; border-radius:8px 8px 0 0; max-height:200px; object-fit:cover;">`
        : `<div style="width:100%;height:160px;background-color:#e9ecef;border-radius:8px 8px 0 0;"></div>`;

      const addressLine = [p.street, p.number].filter(Boolean).join(' ');
      const opLabel = operationLabel(p.operation_type);
      const priceLine = formatPrice(p.price, p.currency);
      const priceM2 = p.price_square_meter
        ? `<span style="font-size:12px;color:#888;"> · ${formatPrice(p.price_square_meter, p.currency)}/m²</span>`
        : '';
      const specs = [
        p.total_surface ? `${p.total_surface} m² tot.` : null,
        p.room_amount ? `${p.room_amount} amb.` : null,
        p.bathroom_amount ? `${p.bathroom_amount} baños` : null,
      ]
        .filter(Boolean)
        .join('&nbsp;&nbsp;·&nbsp;&nbsp;');

      return `
        <table width="280" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;display:inline-table;vertical-align:top;margin:8px;">
          <tr><td>${imageHtml}</td></tr>
          <tr>
            <td style="padding:14px;">
              <p style="margin:0 0 4px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">${opLabel}</p>
              <p style="margin:0 0 6px 0;font-size:14px;color:#333;font-weight:600;line-height:1.3;">${p.publication_title}</p>
              <p style="margin:0 0 8px 0;font-size:20px;font-weight:800;color:#1a1a1a;">${priceLine}${priceM2}</p>
              ${addressLine ? `<p style="margin:0 0 6px 0;font-size:13px;color:#555;">${addressLine}</p>` : ''}
              ${specs ? `<p style="margin:0 0 12px 0;font-size:13px;color:#555;">${specs}</p>` : ''}
              <a href="${frontendUrl}/property/${p.id}" style="display:inline-block;background-color:#007bff;color:#fff;text-decoration:none;padding:8px 20px;border-radius:4px;font-size:13px;font-weight:bold;">
                Ver propiedad
              </a>
            </td>
          </tr>
        </table>`;
    });

    const propertiesGrid = cardHtmlArray.join('');

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Nuevas propiedades para vos</title>
      </head>
      <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:20px 0;">
          <tr>
            <td align="center">
              <table width="620" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">

                <!-- Header -->
                <tr>
                  <td align="center" style="padding:24px 20px; background-color:#F5F5F5;">
                    <img src="${frontendUrl}/images/metropropLogo.png" alt="Metroprop Logo" width="150" style="display:block;">
                  </td>
                </tr>

                <!-- Saludo -->
                <tr>
                  <td style="padding:32px 32px 16px 32px; color:#333333; font-size:16px; line-height:1.6;">
                    <p style="margin:0 0 12px 0; font-size:24px; font-weight:800; color:#1a1a1a;">
                      ¡Hola, ${userName}!
                    </p>
                    <p style="margin:0 0 8px 0; font-size:16px; color:#555;">
                      Encontramos nuevas propiedades que podrían interesarte según tu alerta
                      <strong>"${alertTitle}"</strong>.
                    </p>
                    <p style="margin:0 0 24px 0; font-size:15px; color:#777;">
                      No dejes pasar estas oportunidades, ¡el mercado se mueve rápido!
                    </p>
                  </td>
                </tr>

                <!-- Propiedades -->
                <tr>
                  <td style="padding:0 24px 24px 24px; text-align:center;">
                    ${propertiesGrid}
                  </td>
                </tr>

                <!-- CTA final -->
                <tr>
                  <td align="center" style="padding:16px 32px 32px 32px;">
                    <a href="${frontendUrl}/propiedades" style="display:inline-block;background-color:#007bff;color:#fff;text-decoration:none;padding:14px 48px;border-radius:4px;font-size:15px;font-weight:bold;">
                      Ver todas las propiedades
                    </a>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e0e0e0;"></td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td align="center" style="padding:20px; font-size:12px; color:#777777; background-color:#F5F5F5;">
                    <p style="margin:0 0 16px 0;">
                      <img src="${frontendUrl}/icons/fb.png" alt="Facebook" width="20" style="vertical-align:middle; margin-right:50px;">
                      <img src="${frontendUrl}/icons/instagram.png" alt="Instagram" width="20" style="vertical-align:middle; margin-right:50px;">
                      <img src="${frontendUrl}/icons/youtube.png" alt="YouTube" width="20" style="vertical-align:middle;">
                    </p>
                    <p style="margin:0 0 8px 0;">
                      <a href="#" style="color:#007bff; text-decoration:none;">Políticas de privacidad</a> |
                      <a href="#" style="color:#007bff; text-decoration:none;">Términos y condiciones</a>
                    </p>
                    <p style="margin:12px 0 0 0; text-align:left; font-size:11px; color:#aaa;">
                      Recibís este e-mail porque tenés una alerta de búsqueda activa en Metroprop.<br>
                      Si ya no deseás recibirlos, podés desactivar tu alerta desde tu cuenta.
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

    await this.sendEmail({
      to,
      subject: `MetroProp · Nuevas propiedades para tu alerta "${alertTitle}"`,
      html,
    });
  }
}