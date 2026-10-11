import { config } from '../config/index.ts';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  provider: 'resend' | 'console' | 'smtp_dummy' | 'none';
  error?: string;
  previewDetails?: {
    to: string;
    code: string;
    resetUrl: string;
  };
}

export class EmailService {
  /**
   * Generates official branded Directaurante HTML email for password recovery
   */
  public static getPasswordResetHtml(params: {
    name: string;
    email: string;
    code: string;
    resetUrl: string;
  }): string {
    const { name, code, resetUrl } = params;
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperación de Contraseña - Directaurante</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F6F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #101828;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F4F6F8; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="540" style="max-width: 540px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid #E5E7EB; box-shadow: 0 4px 16px rgba(0,0,0,0.06);" border="0" cellspacing="0" cellpadding="0">
          <!-- Header -->
          <tr>
            <td style="background-color: #05268F; padding: 32px 24px; text-align: center;">
              <table align="center" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background-color: #05268F; border: 2px solid #FFD318; border-radius: 14px; width: 44px; height: 44px; text-align: center; vertical-align: middle;">
                    <span style="color: #FFD318; font-size: 24px; font-weight: 900; line-height: 44px;">D</span>
                  </td>
                  <td style="padding-left: 12px; text-align: left;">
                    <span style="color: #FFFFFF; font-size: 20px; font-weight: 900; letter-spacing: -0.5px;">Directaurante</span>
                    <br/>
                    <span style="color: #FFD318; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Plataforma Gastronómica Soberana</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 28px;">
              <h1 style="color: #101828; font-size: 20px; font-weight: 800; margin: 0 0 12px 0;">
                Recuperación de Contraseña
              </h1>
              <p style="color: #667085; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                Hola <strong>${name || 'Usuario'}</strong>, hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Directaurante.
              </p>

              <!-- Code Box -->
              <div style="background-color: #F4F6F8; border: 1px dashed #05268F; border-radius: 14px; padding: 18px; text-align: center; margin-bottom: 24px;">
                <span style="display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #667085; margin-bottom: 6px;">
                  Tu código de seguridad de 6 dígitos:
                </span>
                <span style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #05268F; font-family: monospace;">
                  ${code}
                </span>
                <span style="display: block; font-size: 11px; color: #667085; margin-top: 6px;">
                  Válido durante 60 minutos · De un solo uso
                </span>
              </div>

              <!-- Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: #05268F; color: #FFD318; font-weight: 800; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 12px; border: 1px solid #FFD318; text-transform: uppercase; letter-spacing: 0.5px;">
                      Restablecer mi Contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #667085; font-size: 12px; line-height: 1.5; margin: 0 0 12px 0;">
                Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:
              </p>
              <p style="background-color: #F4F6F8; padding: 10px 12px; border-radius: 8px; font-size: 11px; word-break: break-all; color: #05268F; margin: 0 0 24px 0;">
                <a href="${resetUrl}" style="color: #05268F; text-decoration: none;">${resetUrl}</a>
              </p>

              <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />

              <p style="color: #98A2B3; font-size: 11px; line-height: 1.5; margin: 0;">
                Si no realizaste esta solicitud, puedes ignorar este mensaje; tu contraseña actual continuará siendo segura y no se realizarán cambios.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F4F6F8; padding: 20px 24px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="color: #667085; font-size: 11px; margin: 0;">
                Directaurante V2 · Pénjamo, GTO, México
              </p>
              <p style="color: #98A2B3; font-size: 10px; margin: 4px 0 0 0;">
                Este es un mensaje seguro generado por el servidor central de Directaurante.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Dispatches password reset email through configured external provider
   * or securely records in dev audit console.
   */
  public static async sendPasswordResetEmail(params: {
    toEmail: string;
    userName: string;
    rawToken: string;
    rawCode: string;
  }): Promise<EmailSendResult> {
    const { toEmail, userName, rawToken, rawCode } = params;

    // Determine target URL for reset password
    const baseUrl =
      process.env.APP_URL?.trim() ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

    const resetUrl = `${baseUrl}/#reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(toEmail)}`;

    const htmlContent = this.getPasswordResetHtml({
      name: userName,
      email: toEmail,
      code: rawCode,
      resetUrl,
    });

    const emailFrom = process.env.EMAIL_FROM || 'Directaurante <seguridad@directaurante.com>';
    const resendApiKey = process.env.RESEND_API_KEY?.trim();

    // 1. If RESEND_API_KEY is configured
    if (resendApiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [toEmail],
            subject: 'Restablece tu contraseña - Directaurante',
            html: htmlContent,
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          console.log(`[EmailService] Correo enviado exitosamente vía Resend a ${toEmail}. ID: ${data?.id}`);
          return {
            success: true,
            messageId: data?.id,
            provider: 'resend',
          };
        } else {
          const errText = await response.text();
          console.error(`[EmailService] Error enviando correo vía Resend (${response.status}):`, errText);
        }
      } catch (err: any) {
        console.error('[EmailService] Excepción de conexión con proveedor de correo Resend:', err.message);
      }
    }

    // 2. Production handling: never print recovery codes or links to logs and report delivery failure safely
    if (process.env.NODE_ENV === 'production') {
      console.error(
        `[EmailService] Fallo al despachar correo de recuperación a ${toEmail}: proveedor de correo no configurado o indisponible.`
      );
      return {
        success: false,
        provider: 'none',
        error: 'No se pudo entregar el correo de restablecimiento de contraseña en producción',
      };
    }

    // 3. Fallback en entorno de desarrollo / pruebas:
    // Registro exclusivo para depuración local
    console.log('\n======================================================================');
    console.log('✉️  [DIRECTAURANTE EMAIL DISPATCH - RECUPERACIÓN DE CONTRASEÑA]');
    console.log(`    Destinatario: ${toEmail} (${userName})`);
    console.log(`    Código de seguridad: ${rawCode}`);
    console.log(`    Enlace de recuperación: ${resetUrl}`);
    console.log('    Vigencia: 60 minutos (hash SHA-256 persistido en MongoDB)');
    console.log('======================================================================\n');

    return {
      success: true,
      provider: 'console',
      previewDetails: {
        to: toEmail,
        code: rawCode,
        resetUrl,
      },
    };
  }
}
