import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partner } from '../../modules/partners/entities/partner.entity';
import { Request } from 'express';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(Partner)
    private partnersRepository: Repository<Partner>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKey(request);
    const apiSecret = this.extractApiSecret(request);
    const clientIp = request.ip || request.socket?.remoteAddress || 'unknown';

    if (!apiKey) {
      console.warn(`⚠️ Partner API auth failed: Missing API Key | IP: ${clientIp} | ${request.method} ${request.originalUrl}`);
      throw new UnauthorizedException('API Key is required');
    }

    if (!apiSecret) {
      console.warn(`⚠️ Partner API auth failed: Missing API Secret | IP: ${clientIp} | Key: ${apiKey.substring(0, 8)}... | ${request.method} ${request.originalUrl}`);
      throw new UnauthorizedException('API Secret is required');
    }

    const partner = await this.partnersRepository.findOne({
      where: { 
        app_key: apiKey,
        app_secret: apiSecret,
        deleted: false,
        status: 1
      }
    });

    if (!partner) {
      console.warn(`⚠️ Partner API auth failed: Invalid credentials | IP: ${clientIp} | Key: ${apiKey.substring(0, 8)}... | ${request.method} ${request.originalUrl}`);
      throw new UnauthorizedException('Invalid API Key or Secret');
    }

    // Add partner info to request for use in controllers
    (request as any).partner = partner;
    
    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    return (
      request.headers['x-api-key'] as string ||
      request.headers['api-key'] as string || 
      undefined
    );
  }

  private extractApiSecret(request: Request): string | undefined {
    return (
      request.headers['x-api-secret'] as string ||
      request.headers['api-secret'] as string ||
      undefined
    );
  }
}