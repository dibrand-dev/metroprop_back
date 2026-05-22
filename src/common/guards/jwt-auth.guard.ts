import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

const LOOPBACK = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();

    // ── STEP 1: ¿Estamos en localhost? Si NO → flujo normal, fin. ────────────
    const ip = req?.ip ?? req?.socket?.remoteAddress ?? '';
    if (!LOOPBACK.some((addr) => ip === addr || ip.endsWith(addr))) {
      return super.canActivate(context);
    }

    // ── STEP 2: Somos local. ¿Viene x-bypass: true en el header? Si NO → flujo normal. ───────
    // Se usa SOLO header para evitar que el ValidationPipe rechace query params desconocidos.
    const bypassFlag = req?.headers?.['x-bypass'];

    if (String(bypassFlag ?? '').toLowerCase() !== 'true') {
      return super.canActivate(context);
    }

    console.warn(`⚠️  JWT BYPASS ACTIVATED for IP ${ip} - injecting fake user and skipping auth guards. Remove 'x-bypass' header to disable.`);
    // ── STEP 3: Local + bypass activo → inyectar usuario fake, saltar Passport.
    req.user = {
      id: Number(process.env.DEV_BYPASS_USER_ID ?? 76),
      email: process.env.DEV_BYPASS_USER_EMAIL ?? 'huerta.em@gmail.com',
      role_id: Number(process.env.DEV_BYPASS_ROLE_ID ?? 2),
      organization_id: Number(process.env.DEV_BYPASS_ORGANIZATION_ID ?? null),
    };
    console.warn(`Injected fake user: ${JSON.stringify(req.user)}`);
    return true;
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid token');
    }
    return user;
  }
}
