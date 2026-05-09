import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    if (this.shouldBypassAuth(request)) {
      return {
        id: Number(this.configService.get('DEV_BYPASS_USER_ID', 73)),
        email: this.configService.get('DEV_BYPASS_USER_EMAIL', 'dev-bypass@local.test'),
        role_id: Number(this.configService.get('DEV_BYPASS_ROLE_ID', 2)),
        organization_id: Number(this.configService.get('DEV_BYPASS_ORGANIZATION_ID', 1)),
      };
    }

    if (err || !user) {
      throw err || new UnauthorizedException('Invalid token');
    }
    return user;
  }

  private shouldBypassAuth(request: any): boolean {
    const isDevelopment = this.configService.get('NODE_ENV') === 'development';
    if (!isDevelopment) return false;

    const bypassRaw =
      request?.headers?.['x-dev-auth-bypass'] ??
      request?.query?.bypass_security ??
      request?.body?.bypass_security;

    const bypassEnabled = ['1', 'true', 'yes', 'on'].includes(
      String(bypassRaw ?? '').toLowerCase(),
    );

    if (!bypassEnabled) return false;

    const expectedToken = this.configService.get<string>('DEV_BYPASS_TOKEN');
    const providedToken = String(
      request?.headers?.['x-dev-bypass-token'] ??
        request?.query?.dev_bypass_token ??
        request?.body?.dev_bypass_token ??
        '',
    );

    if (!expectedToken || providedToken !== expectedToken) {
      throw new UnauthorizedException('Invalid development bypass token');
    }

    return true;
  }
}
