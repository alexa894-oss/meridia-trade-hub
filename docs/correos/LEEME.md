# Correos de Meridia (Supabase → Authentication → Emails → Templates)

Pegar en cada proyecto (desarrollo y producción). `{{ .ConfirmationURL }}` lo completa Supabase.

| Plantilla en Supabase | Asunto | Cuerpo |
|---|---|---|
| Confirm signup | Confirma tu correo · Meridia Trade Hub | `confirmar-cuenta.html` |
| Reset password | Restablece tu contraseña · Meridia Trade Hub | `restablecer-contrasena.html` |
| Change email address | Confirma tu nuevo correo · Meridia Trade Hub | `cambiar-correo.html` |

Envío: SMTP propio de Zoho (`smtppro.zoho.com`, puerto 465, usuario `info@meridiatradehub.com`, contraseña de aplicación de Zoho).
