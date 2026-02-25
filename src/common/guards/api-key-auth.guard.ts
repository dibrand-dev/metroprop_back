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

    if (!apiKey) {
      throw new UnauthorizedException('API Key is required');
    }

    if (!apiSecret) {
      throw new UnauthorizedException('API Secret is required');
    }

    const partner = await this.partnersRepository.findOne({
      where: { 
        app_key: apiKey,
        app_secret: apiSecret,
        deleted: false,
        status: 1 // assuming 1 is active status
      }
    });

    if (!partner) {
      throw new UnauthorizedException('Invalid API Key or Secret');
    }

    // Add partner info to request for use in controllers
    (request as any).partner = partner;
    
    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    // Check for API key in multiple locations
    return (
      request.headers['x-api-key'] as string ||
      request.headers['api-key'] as string ||
      request.query['api_key'] as string
    );
  }

  private extractApiSecret(request: Request): string | undefined {
    // Check for API secret in multiple locations
    return (
      request.headers['x-api-secret'] as string ||
      request.headers['api-secret'] as string ||
      request.query['api_secret'] as string
    );
  }
}