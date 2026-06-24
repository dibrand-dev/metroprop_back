import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import { API_BASE_URL, OPERATION_TYPE_LABELS, PASSWORD_DEFAULT, PROPERTY_TYPE_LABELS } from '../constants';
import { OperationType, PropertyType } from '../enums';

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

  /**
   * Convierte URLs virtual-hosted de S3 (bucket.s3.region.amazonaws.com) a
   * path-style (s3.region.amazonaws.com/bucket). Cuando el bucket contiene
   * puntos (ej: "www.metroprop.co"), el certificado wildcard de S3
   * (*.s3.region.amazonaws.com) no valida y los proxys de imágenes de los
   * clientes de correo (Gmail) no pueden descargar la imagen.
   */
  toPathStyleS3(url: string): string {
    const match = url.match(
      /^https?:\/\/([^/]+)\.s3\.([^.]+)\.amazonaws\.com\/(.+)$/i,
    );
    if (!match) return url;
    const [, bucket, region, key] = match;
    return `https://s3.${region}.amazonaws.com/${bucket}/${key}`;
  }

  /**
   * Resuelve una imagen de S3 a una URL utilizable en emails: si recibe una
   * key relativa la antepone con el bucket configurado, y siempre normaliza la
   * URL a path-style para evitar fallos de certificado SSL.
   */
  resolveS3ImageUrl(raw: string): string {
    const full = raw.startsWith('http')
      ? raw
      : `${this.configService.get('AWS_S3_BUCKET_URL')}/${raw}`;
    return this.toPathStyleS3(full);
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
                      <img src="${ this.configService.get('FRONTEND_URL')}/images/metroprop.png" alt="Metroprop Logo" width="150" style="display:block;">
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
                        <a href="https://www.metroprop.co/policy" style="color:#007bff; text-decoration:none;">Políticas de privacidad</a> | 
                        <a href="https://www.metroprop.co/terms" style="color:#007bff; text-decoration:none;">Términos y condiciones</a>
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
                      <img src="${ this.configService.get('FRONTEND_URL')}/images/metroprop.png" alt="Metroprop Logo" width="150" style="display:block;">
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
                        <a href="https://www.metroprop.co/policy" style="color:#007bff; text-decoration:none;">Políticas de privacidad</a> | 
                        <a href="https://www.metroprop.co/terms" style="color:#007bff; text-decoration:none;">Términos y condiciones</a>
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
      subject: 'MetroProp Profesional - Activá tu cuenta avanzada',
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
                      <img src="${ this.configService.get('FRONTEND_URL')}/images/metroprop.png" alt="Metroprop Logo" width="150" style="display:block;">
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
                        <a href="https://www.metroprop.co/policy" style="color:#007bff; text-decoration:none;">Políticas de privacidad</a> | 
                        <a href="https://www.metroprop.co/terms" style="color:#007bff; text-decoration:none;">Términos y condiciones</a>
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
                      <img src="${ this.configService.get('FRONTEND_URL')}/images/metroprop.png" alt="Metroprop Logo" width="150" style="display:block;">
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
                        <a href="https://www.metroprop.co/policy" style="color:#007bff; text-decoration:none;">Políticas de privacidad</a> | 
                        <a href="https://www.metroprop.co/terms" style="color:#007bff; text-decoration:none;">Términos y condiciones</a>
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
      subject: 'MetroProp - Restablecer contraseña',
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
      property_type: number;
      price: number;
      currency: string;
      total_surface?: number;
      room_amount?: number;
      bathroom_amount?: number;
      price_square_meter?: number;
      firstImageUrl?: string | null;
    }>,
    queryStringParams: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get('FRONTEND_URL', 'https://metroprop.co');

    const formatPrice = (price: number, currency: string) => {
      const formatted = new Intl.NumberFormat('es-AR').format(price);
      return `${currency} ${formatted}`;
    };

    const cardHtmlArray = properties.map((p) => {
      const imageSrc = p.firstImageUrl
        ? this.resolveS3ImageUrl(p.firstImageUrl)
        : `${frontendUrl}/images/property-noimage.jpg`;
      const imageHtml = `<img src="${imageSrc}" alt="${p.publication_title}" width="200" style="border:none;aspect-ratio: 3 / 2;display:block;width:200px;">`;

      const addressLine = [p.street, p.number].filter(Boolean).join(' ');
      const opLabel = OPERATION_TYPE_LABELS[p.operation_type as OperationType] ;
      const propertyType = PROPERTY_TYPE_LABELS[p.property_type as PropertyType] ;
      const priceLine = formatPrice(p.price, p.currency);
      const priceM2 = p.price_square_meter
        ? `<span style="font-size:13px;color:#999;font-weight:600;">&nbsp;|&nbsp;${formatPrice(p.price_square_meter, p.currency)} m²</span>`
        : '';
      const specs = [
        p.total_surface ? `${p.total_surface} m² tot.` : null,
        p.room_amount ? `${p.room_amount} amb.` : null,
        p.bathroom_amount ? `${p.bathroom_amount} baños` : null,
      ]
        .filter(Boolean)
        .join('&nbsp;&nbsp;');

      return `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;margin:0 0 16px 0;">
          <tr>
            <td width="200" valign="top" style="width:200px;padding:0;font-size:0;line-height:0;">${imageHtml}</td>
            <td valign="top" style="padding:16px 18px;">
              <p style="margin:0 0 8px 0;font-size:13px;color:#333;font-weight:600;">${opLabel} - ${propertyType}</p>
              <p style="margin:0 0 4px 0;font-size:19px;font-weight:800;color:#1a1a1a;line-height:1.2;">${priceLine}${priceM2}</p>
              <hr style="border:none;border-top:1px solid #ececec;margin:12px 0;">
              ${addressLine ? `<p style="margin:0 0 6px 0;font-size:14px;color:#333;font-weight:600;">${addressLine}</p>` : ''}
              ${specs ? `<p style="margin:0 0 6px 0;font-size:13px;color:#555;">${specs}</p>` : ''}
              <p style="margin:0 0 14px 0;font-size:13px;color:#777;line-height:1.4;">${p.publication_title}</p>
              <a href="${frontendUrl}/propertyDetail/${p.id}" style="display:block;text-align:center;background-color:#3b5bfd;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:bold;">
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
      <body style="margin:0; padding:0; font-family: Arial, Helvetica, sans-serif; background-color:#2b2b2b;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:24px 0; background-color:#2b2b2b;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:10px; overflow:hidden;">

                <!-- Header -->
                <tr>
                  <td align="center" style="padding:22px 20px; background-color:#ffffff;">
                    <img src="${frontendUrl}/images/metroprop.png" alt="Metroprop Logo" width="170" style="display:block;">
                  </td>
                </tr>

                <!-- Saludo -->
                <tr>
                  <td align="center" style="padding:24px 32px 8px 32px; color:#333333;">
                    <p style="margin:0 0 10px 0; font-size:24px; font-weight:800; color:#1a1a1a;">
                      ¡Hola ${userName}!
                    </p>
                    <p style="margin:0; font-size:15px; color:#555;">
                      Se publicaron nuevas propiedades que coinciden con tu alerta:
                    </p>
                  </td>
                </tr>

                <!-- Título de la alerta -->
                <tr>
                  <td style="padding:18px 28px 4px 28px;">
                    <p style="margin:0; font-size:15px; font-weight:700; color:#3b5bfd;">${alertTitle}</p>
                  </td>
                </tr>

                <!-- Propiedades -->
                <tr>
                  <td style="padding:14px 28px 8px 28px;">
                    ${propertiesGrid}
                  </td>
                </tr>

                <!-- CTA final -->
                <tr>
                  <td align="center" style="padding:8px 32px 28px 32px;">
                    <a href="${frontendUrl}/results?q=${queryStringParams}" style="display:inline-block;background-color:#3b5bfd;color:#fff;text-decoration:none;padding:13px 44px;border-radius:6px;font-size:15px;font-weight:bold;">
                      Ver todas las propiedades
                    </a>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td align="center" style="padding:24px 20px; font-size:12px; color:#777777; background-color:#f7f7f7; border-top:1px solid #ececec;">
                    <p style="margin:0 0 16px 0;">
                      <img src="${frontendUrl}/icons/fb.png" alt="Facebook" width="22" style="vertical-align:middle; margin:0 18px;">
                      <img src="${frontendUrl}/icons/instagram.png" alt="Instagram" width="22" style="vertical-align:middle; margin:0 18px;">
                      <img src="${frontendUrl}/icons/youtube.png" alt="YouTube" width="22" style="vertical-align:middle; margin:0 18px;">
                    </p>
                    <p style="margin:0 0 12px 0;">
                      <a href="https://www.metroprop.co/policy" style="color:#777777; text-decoration:none;">Políticas de privacidad</a>&nbsp;|&nbsp;
                      <a href="https://www.metroprop.co/terms" style="color:#777777; text-decoration:none;">Términos y condiciones</a>
                    </p>
                    <p style="margin:0; font-size:11px; color:#aaa; line-height:1.5;">
                      Recibís este e-mail porque tenés una alerta de búsqueda activa en Metroprop.
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

  async sendEmailChangedEmail(to: string, name: string): Promise<void> {
    const frontendUrl = this.configService.get('FRONTEND_URL', 'https://metroprop.co');

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Email actualizado - Metroprop</title>
      </head>
      <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#ffffff;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:20px; background-color:#F5F5F5;">
                    <img src="${frontendUrl}/images/metroprop.png" alt="Metroprop Logo" width="150" style="display:block;">
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 40px; color:#333333; font-size:16px; line-height:1.6; text-align:center;">
                    <p style="margin:0 0 16px 0; font-size:24px; font-weight:800;">¡Hola, ${name}!</p>
                    <p style="margin:0 0 16px 0;">Te confirmamos que el email de tu cuenta en <strong>Metroprop</strong> ha sido actualizado correctamente.</p>
                    <p style="margin:0 0 24px 0;">A partir de ahora podés iniciar sesión con esta dirección de email.</p>
                    <a href="${frontendUrl}/login" style="display:inline-block; background-color:#007bff; color:#fff; text-decoration:none; padding:14px 48px; border-radius:4px; font-size:15px; font-weight:bold;">
                      Iniciar sesión
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 40px; background-color:#F5F5F5; text-align:center; font-size:12px; color:#888;">
                    <p style="margin:0;">Si no realizaste este cambio, contactanos de inmediato.</p>
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
      subject: 'MetroProp · Tu email ha sido actualizado',
      html,
    });
  }

  async sendLeadNotificationEmail(params: {
    to: string;
    recipientName: string;
    propertyLabel: string;
    propertyZone: string;
    lead: { name: string; email: string; phone?: string; country_code?: string };
    partnerName?: string;
    message: string;
    contactsUrl: string;
  }): Promise<void> {
    const { to, recipientName, propertyLabel, propertyZone, lead, partnerName, message, contactsUrl } = params;
    const frontendUrl = this.configService.get('FRONTEND_URL', '');

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"><title>Nuevo contacto</title></head>
      <body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f7f7f7;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:20px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:8px;overflow:hidden;">
              <tr>
                <td align="center" style="padding:20px;background:#F5F5F5;">
                  <img src="${frontendUrl}/images/metroprop.png" alt="Metroprop" width="150" style="display:block;">
                </td>
              </tr>
              <tr>
                <td style="padding:30px;color:#333;font-size:16px;line-height:1.6;">
                  <p style="margin:0; font-size:26px; font-weight:800;text-align:center;color:#0B1B57;">¡Nueva consulta!</p>
                  <p style="margin:28px 0 24px 0;">Un usuario se interesó en una de tus propiedades publicadas.</p>

                  <ul style="list-style:none; padding: 24px 28px; background-color:#ffffff; margin:0;border-radius: 8px;border:1px solid #006AFF;">
                    <li style="margin-bottom: 24px;">Propiedad : <strong>${propertyLabel}</strong></li>
                    <li style="margin-bottom: 24px;">Zona : ${propertyZone}</li>
                    <li style="margin-bottom: 24px;">Interesado: ${lead.name}</li>
                    <li style="margin-bottom: 24px;">Contacto: ${lead.phone ? `${lead.phone}` : ''} / ${lead.email ? `${lead.email}` : ''}</li>
                    <li style="margin-bottom: 0;">Mensaje: ${message}</li>
                  </ul>
                  <div style="text-align:center; margin-top:30px;">
                    <a href="${contactsUrl}" style="background-color:#007bff;color:#fff;text-decoration:none;padding:12px 28px;border-radius:4px;font-weight:bold;display:inline-block;">
                      Ver todos tus contactos
                    </a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 30px 30px;color:#333;font-size:16px;line-height:1.6;">
                  ${partnerName ? `<p style="margin:0 0 24px;text-align:center;">Este contacto también se envió a tu CRM ${partnerName}.</p>` : ''}
                  <p style="margin:0;font-weight:bold;text-align:center;">Equipo Metroprop</p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:20px; font-size:12px; color:#777777; background-color:#F5F5F5; border-top:1px solid #E5E5E5;">
                  <p style="margin:0 0 16px 0;">
                    <img src="${frontendUrl}/icons/fb.png" alt="Facebook" width="20" style="vertical-align:middle; margin-right:50px;">
                    <img src="${frontendUrl}/icons/instagram.png" alt="Instagram" width="20" style="vertical-align:middle; margin-right:50px;">
                    <img src="${frontendUrl}/icons/youtube.png" alt="YouTube" width="20" style="vertical-align:middle;">
                  </p>
                  <p style="margin:0 0 16px 0;">
                    <a href="https://www.metroprop.co/policy" style="color:#777777; text-decoration:none;">Políticas de privacidad</a> |
                    <a href="https://www.metroprop.co/terms" style="color:#777777; text-decoration:none;">Términos y condiciones</a>
                  </p>
                  <p style="margin:0; text-align:center; font-size:11px; color:#aaa; line-height:1.5;">
                    Recibís este e-mail porque sos usuario registrado en Metroprop al amparo de nuestra Política de Privacidad.<br>
                    Este e-mail se ha enviado desde Metroprop.
                  </p>
                </td>
              </tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    await this.sendEmail({
      to,
      subject: `Te contactaron por la propiedad ${propertyLabel}`,
      html,
    });
  }

  async sendLeadAutoReplyEmail(params: {
    to: string;
    recipientName: string;
    propertyLabel: string;
    message: string;
    organization: { company_name: string; email: string; phone?: string };
    propertyUrl: string;
    assignedUser: { id: number; email: string; name: string, phone?: string };

  }): Promise<void> {
    const { to, recipientName, propertyLabel, message, organization, propertyUrl, assignedUser } = params;
    const frontendUrl = this.configService.get('FRONTEND_URL', '');
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"><title>Gracias por tu mensaje</title></head>
      <body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f7f7f7;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:20px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:8px;overflow:hidden;">
              <tr>
                <td align="center" style="padding:20px;background:#F5F5F5;">
                  <img src="${frontendUrl}/images/metroprop.png" alt="Metroprop" width="150" style="display:block;">
                </td>
              </tr>
              <tr>
                <td style="padding:30px;color:#333;font-size:16px;line-height:1.6;">
                  <p style="margin:0 0 12px;">Hola <strong>${recipientName}</strong>,</p>
                  <p style="margin:0 0 16px;">Gracias por tu mensaje sobre la propiedad <a href="${propertyUrl}" style="color:#007bff;text-decoration:none;"><strong>${propertyLabel}</strong></a>:</p>
                  <blockquote style="border-left:4px solid #007bff;padding:12px 16px;margin:0 0 20px;background:#f0f6ff;border-radius:0 4px 4px 0;color:#555;font-style:italic;">
                    ${message}
                  </blockquote>
                  <p>El agente asignado a la propiedad es:</p>
                  <ul style="margin:0 0 24px;padding-left:20px;">
                    ${assignedUser.name ? `<li><strong>Nombre:</strong> ${assignedUser.name}</li>` : ''}
                    ${assignedUser.email ? `<li><strong>Email:</strong> ${assignedUser.email}</li>` : ''}
                    ${assignedUser.phone ? `<li><strong>Tel&eacute;fono:</strong> ${assignedUser.phone}</li>` : ''}
                  </ul>
                  <p>Los datos de contacto de la inmobiliaria son:</p>
                  <ul style="margin:0 0 24px;padding-left:20px;">
                    ${organization.company_name ? `<li><strong>Nombre:</strong> ${organization.company_name}</li>` : ''}
                    ${organization.email ? `<li><strong>Email:</strong> ${organization.email}</li>` : ''}
                    ${organization.phone ? `<li><strong>Tel&eacute;fono:</strong> ${organization.phone}</li>` : ''}
                  </ul>
                  
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:16px;font-size:12px;color:#999;background:#f7f7f7;">
                  Metroprop &mdash; <a href="${frontendUrl}" style="color:#007bff;text-decoration:none;">metroprop.co</a>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:20px; font-size:12px; color:#777777; background-color:#F5F5F5; border-top:1px solid #E5E5E5;">
                  <p style="margin:0 0 16px 0;">
                    <img src="${frontendUrl}/icons/fb.png" alt="Facebook" width="20" style="vertical-align:middle; margin-right:50px;">
                    <img src="${frontendUrl}/icons/instagram.png" alt="Instagram" width="20" style="vertical-align:middle; margin-right:50px;">
                    <img src="${frontendUrl}/icons/youtube.png" alt="YouTube" width="20" style="vertical-align:middle;">
                  </p>
                  <p style="margin:0 0 16px 0;">
                    <a href="https://www.metroprop.co/policy" style="color:#777777; text-decoration:none;">Políticas de privacidad</a> |
                    <a href="https://www.metroprop.co/terms" style="color:#777777; text-decoration:none;">Términos y condiciones</a>
                  </p>
                  <p style="margin:0; text-align:center; font-size:11px; color:#aaa; line-height:1.5;">
                   Este e-mail se ha enviado desde Metroprop.
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    await this.sendEmail({
      to,
      subject: `MetroProp · Te contactaste por la propiedad ${propertyLabel}`,
      html,
    });
  }
}