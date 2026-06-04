import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { UserRole } from '../enums';

/**
 * Verifica que el usuario autenticado tenga permisos sobre el usuario objetivo.
 * El usuario objetivo se determina por el parámetro de ruta `id`.
 *
 * Reglas de negocio:
 * - SUPER_ADMIN: Acceso total.
 * - ADMIN / SUPERVISOR: Acceso a usuarios de su misma organization_id.
 * - COLLABORATOR y otros roles: Solo acceso a su propio perfil.
 *
 * Este Guard se aplica a `findOne`, `update` y `remove`.
 */
@Injectable()
export class UserOwnershipGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const requester = request.user;
    const targetUserId = parseInt(request.params.id, 10);

    if (!requester || !targetUserId || isNaN(targetUserId)) {
      return false;
    }

    // Un usuario siempre puede acceder a su propio perfil
    if (requester.id === targetUserId) {
      return true;
    }

    // SUPER_ADMIN puede acceder a cualquier usuario
    if (requester.role_id === UserRole.USER_ROL_SUPER_ADMIN) {
      return true;
    }

    // ADMIN y SUPERVISOR pueden acceder a usuarios de su organización
    if (
      requester.role_id === UserRole.USER_ROL_ADMIN ||
      requester.role_id === UserRole.USER_ROL_SUPERVISOR
    ) {
      if (!requester.organization_id) {
        throw new ForbiddenException('No tenés permiso para acceder a este recurso.');
      }

      const targetUser = await this.userRepository.findOne({
        where: { id: targetUserId },
        select: ['id', 'organization_id'],
      });

      if (!targetUser) {
        throw new NotFoundException('Usuario no encontrado.');
      }

      if (targetUser.organization_id === requester.organization_id) {
        return true;
      }
    }

    // Por defecto, se niega el acceso
    throw new ForbiddenException('No tenés permiso para acceder a este recurso.');
  }
}
