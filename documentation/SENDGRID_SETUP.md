# SendGrid Email Integration - MetroProp 

Este proyecto utiliza SendGrid para el manejo profesional de emails. Esta guía documenta la configuración e implementación.

## 🔧 Configuración

### 1. Variables de Entorno Requeridas

```env
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@metroprop.com  
SENDGRID_FROM_NAME=MetroProp
```

### 2. Obtener API Key de SendGrid

1. Registrarse en [SendGrid](https://sendgrid.com/)
2. Navegar a Settings → API Keys
3. Crear nueva API key con permisos de "Mail Send"
4. Copiar el API key y añadirlo a tu archivo `.env`

## 📧 Emails Disponibles

El servicio de email envía automáticamente los siguientes tipos de emails:

### 1. Email de Bienvenida (Usuario Regular)
```typescript
await emailService.sendWelcomeEmail(
  'usuario@ejemplo.com', 
  'Juan Pérez', 
  'verification_token_123'
);
```

### 2. Email de Bienvenida (Usuario Profesional)
```typescript
await emailService.sendProfessionalWelcomeEmail(
  'profesional@ejemplo.com',
  'María García',
  'verification_token_456'  
);
```

### 3. Email de Restablecimiento de Contraseña
```typescript
await emailService.sendPasswordResetEmail(
  'usuario@ejemplo.com',
  'Juan Pérez', 
  'reset_token_789'
);
```

## ⚡ Uso del Servicio

### Inyectar el Servicio
```typescript
import { EmailService } from '@/common/email/email.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly emailService: EmailService) {}
  
  @Post('register')
  async register(@Body() body: RegisterDto) {
    // ... lógica de registro
    
    // Enviar email de bienvenida
    await this.emailService.sendWelcomeEmail(
      user.email,
      user.name,
      verificationToken
    );
  }
}
```

### Envío Personalizado
```typescript
await emailService.sendEmail({
  to: 'destinatario@ejemplo.com',
  subject: 'Asunto del email',
  html: '<h1>Tu contenido HTML aquí</h1>'
});
```

## 🔍 Características Implementadas

- ✅ **Envío confiable** - SendGrid garantiza alta deliverabilidad
- ✅ **Tracking de emails** - Click tracking y open tracking habilitados
- ✅ **Manejo de errores** - Logs detallados para debugging
- ✅ **Templates HTML** - Emails con diseño profesional
- ✅ **Configuración flexible** - Fácil configuración via variables de entorno

## 🐛 Debugging

### Logs
El servicio registra automáticamente:
- ✅ Emails enviados exitosamente
- ❌ Errores con detalles de SendGrid
- 📊 Códigos de estado de respuesta

### Errores Comunes

#### API Key Inválido
```
Error: SendGrid error: Unauthorized (Code: 401)
```
**Solución**: Verificar que `SENDGRID_API_KEY` es correcto.

#### Email "From" no verificado
```
Error: SendGrid error: Forbidden (Code: 403)
```
**Solución**: Verificar dominio en SendGrid o usar email de prueba.

## 🚀 Migración desde Nodemailer

El proyecto anteriormente usaba Nodemailer. Los cambios realizados:

1. **Instalado**: `@sendgrid/mail`
2. **Removido**: `nodemailer`, `@types/nodemailer` 
3. **Actualizado**: `EmailService` para usar SendGrid API
4. **Mejorado**: Manejo de errores y logging
5. **Añadido**: Tracking de emails automático

## 📝 Testing

### Prueba Manual
```bash
# Registrar un usuario para probar email de bienvenida
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@ejemplo.com",
    "name": "Usuario Test", 
    "password": "password123"
  }'
```

### Verificar en SendGrid Dashboard
1. Ir a Activity → Email Activity
2. Buscar por email del destinatario
3. Verificar status del email enviado

---

**Nota**: Para producción, configurar Domain Authentication en SendGrid para mejor deliverabilidad.